import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { apiService } from '@/shared/services/apiService';
import type {
  DeploymentLogLine,
  DeploymentLogsQuery,
  DeploymentLogsResponse,
  LogFilterKey,
  LogQueryFilters,
  LogSource,
  LogWindow
} from './logTypes';
import { errorCount, newestTimestamp, olderPageCursor } from './logBuffer';
import {
  applyAppend,
  applyError,
  applyGapPage,
  applyOlderLoading,
  applyOlderPage,
  applySnapshot,
  applyStatus,
  initialLogState,
  stateFor,
  type LogState
} from './logState';
import { LEGACY_LOG_FILTERS, normalizeLogsResponse } from './logNormalize';

/** Debounce on the server-side search, so typing is not a query per key. */
export const LOG_SEARCH_DEBOUNCE_MS = 350;
/** Pages fetched at most to close the gap a pause left. 10 x 100 lines. */
const GAP_FILL_PAGES = 10;
const LOG_PAGE_LIMIT = 100;

/**
 * Live tail by polling, not a stream: the desktop reaches the cloud through
 * a request/response relay, and a request has to carry the workspace and
 * sign-in headers an EventSource cannot send. Each tick asks for what landed
 * after the newest line held; ticks are chained, so two never overlap.
 */
const POLL_MS = 4_000;
/** Forward pages read in one tick when a burst of lines arrived. */
const CATCH_UP_PAGES = 5;
/** Consecutive failed ticks before the tail stops and says so. */
const MAX_POLL_FAILURES = 5;
const MAX_BACKOFF_MS = 30_000;

const LOAD_ERROR = 'Could not load logs. Please retry.';
const OLDER_ERROR = 'Could not load older logs. Please retry.';
const POLL_STOPPED_ERROR = 'Live logs stopped after repeated failures. Restart the tail to retry.';

type FetchPage = (query: DeploymentLogsQuery) => Promise<DeploymentLogsResponse>;

/** One page of a hosted branch's logs, through Alpha's hosting route (the cloud answers, directly or relayed). */
function fetcherFor(projectId: string, repo: string, branch: string): FetchPage {
  return async query =>
    normalizeLogsResponse((await apiService.getRepoHostingLogs(projectId, repo, branch, query)) ?? {});
}

export type DeploymentLogsStatus = 'idle' | 'loading' | 'ready' | 'error';
/**
 * `live` tails an open window; `paused` is the same window while the tab is
 * hidden (the stream is closed to spare provider calls); `closed` is a window
 * that has ended, fetched once; `off` has no window at all.
 */
export type LogTailState = 'off' | 'connecting' | 'live' | 'paused' | 'closed';
export type OlderPageState = 'available' | 'loading' | 'none';

export interface DeploymentLogsViewModel {
  status: DeploymentLogsStatus;
  lines: DeploymentLogLine[];
  errorCount: number;
  source: LogSource | null;
  /** Why the provider did not answer, or why lines are simulated. */
  reason: string | null;
  /** Filters this provider supports. Controls render only for these. */
  supportedFilters: readonly LogFilterKey[];
  tail: LogTailState;
  /** False once older pages pushed the newest lines out of the buffer. */
  atLive: boolean;
  older: OlderPageState;
  loadOlder: () => void;
  errorsOnly: boolean;
  toggleErrorsOnly: () => void;
  search: string;
  setSearch: (value: string) => void;
  /** Reopen from scratch: back to the live edge, or retry after an error. */
  restart: () => void;
  /** Display string. Never an API object. */
  error: string | null;
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

/** Whether the page is on screen. Assumed visible during the server render. */
function useDocumentVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState !== 'hidden',
    () => true
  );
}

function timeOf(iso: string): number {
  const value = Date.parse(iso);
  return Number.isNaN(value) ? 0 : value;
}

function logsQuery(type: LogQueryFilters['type'], errorsOnly: boolean, text: string): DeploymentLogsQuery {
  return {
    limit: LOG_PAGE_LIMIT,
    ...(type ? { type: [type] } : {}),
    ...(errorsOnly ? { level: ['error' as const] } : {}),
    ...(text ? { text } : {})
  };
}

function deriveStatus(state: LogState, key: string, on: boolean): DeploymentLogsStatus {
  if (!on) return 'idle';
  if (state.key !== key || !state.received) {
    return state.key === key && state.error ? 'error' : 'loading';
  }
  return 'ready';
}

/** The parts of the ViewModel read straight off the current state. */
function readState(state: LogState, key: string, on: boolean) {
  return {
    status: deriveStatus(state, key, on),
    lines: state.buffer.lines,
    errorCount: errorCount(state.buffer.lines),
    source: state.source,
    reason: state.reason,
    supportedFilters: state.filters ?? LEGACY_LOG_FILTERS,
    atLive: state.buffer.atLive,
    error: state.error
  };
}

function deriveTail(on: boolean, logWindow: LogWindow | null, visible: boolean, received: boolean): LogTailState {
  if (!on || !logWindow) return 'off';
  if (logWindow.endTime !== null) return 'closed';
  if (!visible) return 'paused';
  return received ? 'live' : 'connecting';
}

function deriveOlder(state: LogState, current: boolean): OlderPageState {
  if (!current) return 'none';
  if (state.older === 'loading') return 'loading';
  const more = state.buffer.trimmedOldest || (state.hasMore && state.next !== null);
  return more ? 'available' : 'none';
}

function readOptions(options: {
  projectId: string;
  repo: string;
  branch: string;
  window: LogWindow | null;
  filters?: LogQueryFilters;
  enabled?: boolean;
}) {
  const windowStart = options.window?.startTime ?? null;
  return {
    windowStart,
    windowEnd: options.window?.endTime ?? null,
    type: options.filters?.type ?? null,
    on: options.enabled !== false && Boolean(options.projectId && options.repo && options.branch && windowStart)
  };
}

interface GapFill {
  fetchPage: FetchPage;
  query: DeploymentLogsQuery;
  from: DeploymentLogsResponse['next'];
  /** The newest line held before the gap opened; paging stops once past it. */
  until: string;
  isCurrent: () => boolean;
  merge: (logs: DeploymentLogLine[]) => void;
}

/**
 * Close the gap a pause left. The snapshot after a resume is only the newest
 * page; if more lines landed while the tab was hidden, the ones between the
 * last line held and that page are paged in backward until they meet.
 */
async function fillGap(fill: GapFill): Promise<void> {
  let cursor = fill.from;
  for (let page = 0; cursor && page < GAP_FILL_PAGES; page += 1) {
    const response = await fill.fetchPage({
      ...fill.query,
      ...cursor,
      direction: 'backward'
    });
    if (!fill.isCurrent()) return;
    fill.merge(response.logs);
    const oldest = response.logs[0];
    if (!response.hasMore || !oldest) return;
    if (timeOf(oldest.timestamp) <= timeOf(fill.until)) return;
    cursor = response.next;
  }
}

/**
 * ViewModel for a hosted branch's logs.
 *
 * An open window (`endTime: null`) is live-tailed by polling: a snapshot of
 * the newest page, then only what landed after the newest line held. A
 * closed window is one fetch. Older lines page in backward on request.
 * Errors-only, the type and the search are server-side filters, so changing
 * one is a new query.
 *
 * Cost: polling stops while the tab is hidden and resumes from the newest
 * line held when it is shown again; the overlap is deduped by id.
 */
export function useHostingLogs(options: {
  projectId: string;
  repo: string;
  branch: string;
  window: LogWindow | null;
  filters?: LogQueryFilters;
  /** False when there is nothing to show yet. */
  enabled?: boolean;
}): DeploymentLogsViewModel {
  const { projectId, repo, branch, window: logWindow } = options;
  const { windowStart, windowEnd, type, on } = readOptions(options);
  const fetchPage = useMemo(() => fetcherFor(projectId, repo, branch), [projectId, repo, branch]);

  const [errorsOnly, setErrorsOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [text, setText] = useState('');
  const [nonce, setNonce] = useState(0);
  const visible = useDocumentVisible();

  const key = JSON.stringify([projectId, repo, branch, windowStart, windowEnd, type, errorsOnly, text, nonce]);
  const query = useMemo(() => logsQuery(type, errorsOnly, text), [type, errorsOnly, text]);

  const [state, setState] = useState<LogState>(() => initialLogState(key));
  // The effects below read the latest state without depending on it: the
  // stream must not reopen on every line that arrives.
  const stateRef = useRef(state);
  const keyRef = useRef(key);
  useEffect(() => {
    stateRef.current = state;
    keyRef.current = key;
  }, [state, key]);

  useEffect(() => {
    const timer = setTimeout(() => setText(search.trim()), LOG_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Live tail. Restarted when the query changes or the tab is shown again.
  useEffect(() => {
    if (!on || !windowStart || windowEnd !== null || !visible) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const isCurrent = () => active && keyRef.current === key;
    const newest = () => newestTimestamp(stateFor(stateRef.current, key).buffer);

    // The first tick: the newest page, then the gap back to what was held before a pause.
    async function snapshot() {
      const until = newest();
      const page = await fetchPage({ ...query, endTime: new Date().toISOString(), direction: 'backward' });
      if (!isCurrent()) return;
      setState(prev => applySnapshot(prev, key, page));
      if (!until || !page.hasMore || !page.next) return;
      void fillGap({
        fetchPage,
        query,
        from: page.next,
        until,
        isCurrent,
        merge: logs => setState(prev => applyGapPage(prev, key, logs))
      }).catch(() => undefined);
    }

    // Every later tick: forward from the newest line held. The boundary line
    // comes back again (startTime is inclusive) and is deduped by id.
    async function catchUp() {
      let cursor: Partial<Pick<DeploymentLogsQuery, 'startTime' | 'endTime'>> = { startTime: newest() ?? windowStart! };
      for (let page = 0; page < CATCH_UP_PAGES; page += 1) {
        const response = await fetchPage({ ...query, ...cursor, direction: 'forward' });
        if (!isCurrent()) return;
        setState(prev =>
          response.source === 'live'
            ? applyAppend(prev, key, response.source, response.logs)
            : applyStatus(applyAppend(prev, key, response.source, response.logs), key, response.source, response.reason)
        );
        if (!response.hasMore || !response.next) return;
        cursor = response.next;
      }
    }

    const tick = async (first: boolean) => {
      try {
        await (first ? snapshot() : catchUp());
        failures = 0;
      } catch {
        failures += 1;
        if (failures >= MAX_POLL_FAILURES) {
          if (isCurrent()) setState(prev => applyError(prev, key, POLL_STOPPED_ERROR));
          return;
        }
      }
      if (active) timer = setTimeout(() => void tick(false), Math.min(POLL_MS * 2 ** failures, MAX_BACKOFF_MS));
    };
    void tick(true);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [on, key, query, fetchPage, windowStart, windowEnd, visible]);

  // Closed window: one fetch of its newest page.
  useEffect(() => {
    if (!on || !windowStart || windowEnd === null) return;
    let active = true;
    fetchPage({
      ...query,
      startTime: windowStart,
      endTime: windowEnd,
      direction: 'backward'
    })
      .then(page => {
        if (active) setState(prev => applySnapshot(prev, key, page));
      })
      .catch(() => {
        if (active) setState(prev => applyError(prev, key, LOAD_ERROR));
      });
    return () => {
      active = false;
    };
  }, [on, key, query, fetchPage, windowStart, windowEnd]);

  const current = stateFor(state, key);
  const older = deriveOlder(current, on && current.received);

  function loadOlder() {
    if (!logWindow || older !== 'available') return;
    const cursor = olderPageCursor(current.buffer, current.next, logWindow);
    if (!cursor) return;
    setState(prev => applyOlderLoading(prev, key));
    fetchPage({
      ...query,
      ...cursor,
      direction: 'backward'
    })
      .then(page => setState(prev => applyOlderPage(prev, key, page)))
      .catch(() => setState(prev => (prev.key === key ? applyError(prev, key, OLDER_ERROR) : prev)));
  }

  return {
    ...readState(current, key, on),
    tail: deriveTail(on, logWindow, visible, current.received),
    older,
    loadOlder,
    errorsOnly,
    toggleErrorsOnly: () => setErrorsOnly(value => !value),
    search,
    setSearch,
    restart: () => setNonce(value => value + 1)
  };
}
