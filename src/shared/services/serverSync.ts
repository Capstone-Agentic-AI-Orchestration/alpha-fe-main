import { apiService } from './apiService';
import { catchUpBoard } from './boardSync';
import { isDesktop } from '@/shared/desktop';
import type { BoardSyncResult } from '@/shared/types/boardSync';

/**
 * Hydration from the local Alpha daemon.
 *
 * The daemon owns every entity it has a table for. When it is reachable its data
 * replaces whatever is cached locally — that is what stops the frontend seed and
 * `sqliteService.seedDefaultsIfEmpty()` from drifting apart, which they already had.
 *
 * When it is unreachable the app keeps working from the localStorage cache. Agents
 * cannot run without the daemon, but reading and planning still work offline.
 */

export type ServerStatus = 'connecting' | 'online' | 'offline';

/** Entities the daemon is authoritative for. Everything else stays client-side. */
export interface ServerSnapshot {
  projects: unknown[];
  agents: unknown[];
  issues: unknown[];
  skills: unknown[];
  runtimes: unknown[];
  chatThreads: unknown[];
  runs: unknown[];
  squadRuns: unknown[];
  /** Aggregated run telemetry is an object rather than a collection. */
  analytics: unknown;
}

export interface ServerSyncResult {
  snapshot: Partial<ServerSnapshot>;
  board: BoardSyncResult;
  /** Endpoint failures are partial: the board may still be usable. */
  failures: Partial<Record<keyof ServerSnapshot, string>>;
}

function describeSyncFailure(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String(reason);
  const compact = message.replace(/\s+/g, ' ').trim();
  return compact.length > 240 ? `${compact.slice(0, 240)}…` : compact || 'The service did not return a reason.';
}

/**
 * Fetch everything the daemon owns.
 *
 * `allSettled`, not `all`: one failing endpoint must not blank the other seven.
 * A partially-implemented backend is the normal state during Phase 2, and a single
 * 500 taking down the whole hydration would be indistinguishable from the daemon
 * being offline.
 */
async function settleSnapshot(
  calls: Partial<Record<keyof ServerSnapshot, Promise<unknown>>>
): Promise<{
  snapshot: Partial<ServerSnapshot>;
  failures: Partial<Record<keyof ServerSnapshot, string>>;
}> {
  const entries = Object.entries(calls) as [keyof ServerSnapshot, Promise<unknown>][];
  const settled = await Promise.allSettled(entries.map(([, request]) => request));
  const snapshot: Partial<ServerSnapshot> = {};
  const failures: Partial<Record<keyof ServerSnapshot, string>> = {};

  settled.forEach((result, i) => {
    const key = entries[i][0];
    if (
      result.status === 'fulfilled' &&
      (Array.isArray(result.value) || key === 'analytics')
    ) {
      snapshot[key] = result.value as never;
    } else if (result.status === 'rejected') {
      const message = describeSyncFailure(result.reason);
      failures[key] = message;
      console.warn(`[sync] ${String(key)} failed to load:`, message);
    } else {
      const message = 'The service returned an invalid response.';
      failures[key] = message;
      console.warn(`[sync] ${String(key)} failed to load:`, message);
    }
  });

  return { snapshot, failures };
}

/**
 * Fetch non-board daemon data and update the board from one bootstrap or bounded
 * cursor pages. The no-argument overload remains for the two hydration callers
 * that are migrated in the next plan task.
 */
export function fetchServerSnapshot(): Promise<Partial<ServerSnapshot>>;
export function fetchServerSnapshot(workspaceId: string): Promise<ServerSyncResult>;
export async function fetchServerSnapshot(
  workspaceId?: string
): Promise<Partial<ServerSnapshot> | ServerSyncResult> {
  if (workspaceId !== undefined) {
    const calls = {
      skills: apiService.getSkills(),
      runtimes: apiService.getRuntimes(),
      chatThreads: apiService.getChatThreads(),
      // The web reads summaries: full runs carry every stage log, and the
      // desktop's own list is local so it keeps the full rows.
      runs: apiService.getRuns(isDesktop ? undefined : 'summary'),
      analytics: apiService.getAnalytics(),
      // History for builds started before squads were removed.
      squadRuns: apiService.getSquadRuns()
    } as const;
    const [settled, board] = await Promise.all([
      settleSnapshot(calls),
      catchUpBoard(workspaceId)
    ]);
    return { ...settled, board };
  }

  return fetchLegacyServerSnapshot();
}

/** Transitional path used only until AppContext switches to workspace cursors. */
async function fetchLegacyServerSnapshot(): Promise<Partial<ServerSnapshot>> {
  const calls = {
    projects: apiService.getProjects(),
    agents: apiService.getAgents(),
    issues: apiService.getIssues(),
    skills: apiService.getSkills(),
    runtimes: apiService.getRuntimes(),
    chatThreads: apiService.getChatThreads(),
    runs: apiService.getRuns(),
    analytics: apiService.getAnalytics(),
    // History for builds started before squads were removed.
    squadRuns: apiService.getSquadRuns()
  } as const;

  return (await settleSnapshot(calls)).snapshot;
}

/** Cheap liveness probe. Never throws. */
export async function probeServer(): Promise<boolean> {
  try {
    await apiService.checkHealth();
    return true;
  } catch {
    return false;
  }
}

/**
 * Persist a local change without blocking the UI.
 *
 * The context's mutators are synchronous and return the created entity, so callers
 * can use it immediately. Rather than change every signature to async, writes apply
 * optimistically and reconcile here: on success the server's canonical row replaces
 * the optimistic one; on failure the caller is told so it can surface a toast.
 *
 * The alternative — awaiting every write — would make the UI wait on a subprocess-
 * heavy local server for what is usually a form submit.
 */
/**
 * Reduce a failed write to one line a person can act on.
 *
 * Express serves its default HTML error page on an unhandled throw, so a
 * constraint violation arrives as a full document with a stack trace in a
 * `<pre>`. Shown verbatim in a toast or beside a submit button that is several
 * hundred characters of markup. Pull the real error out when it is in there.
 */
export function describeWriteError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  // `SqliteError: UNIQUE constraint failed: projects.key` and friends.
  const sqlite = raw.match(/\b(\w*(?:Error|Exception)): ([^<\n]{1,160})/);
  if (raw.includes('<!DOCTYPE') && sqlite) {
    return `${sqlite[1]}: ${sqlite[2]}`.trim();
  }

  const firstLine = raw.split('\n')[0].trim();
  return firstLine.length > 200 ? `${firstLine.slice(0, 200)}…` : firstLine;
}

export function persist<T>(
  op: () => Promise<T>,
  onReconcile: (serverValue: T) => void,
  onError: (message: string) => void
): void {
  op()
    .then(onReconcile)
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[sync] write failed, keeping local copy:', message);
      onError(message);
    });
}
