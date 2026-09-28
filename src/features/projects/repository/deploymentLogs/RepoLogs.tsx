import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, RotateCcw, ScrollText } from 'lucide-react';

import type { PipelineBranch } from '@/shared/types';
import { RepoSection } from '../SectionState';
import { countLinesAfter, logLevelTone } from './logBuffer';
import {
  formatLogDateTime,
  formatLogTime,
  instanceTag,
  LOG_RANGE_OPTIONS,
  rangeWindow,
  stripAnsi,
  type LogRangePreset
} from './logFormat';
import type { DeploymentLogLine, LogQueryFilters } from './logTypes';
import { useHostingLogs, type DeploymentLogsViewModel } from './useHostingLogs';

/** Within this many pixels of the bottom counts as reading the newest lines. */
const BOTTOM_SLACK = 12;

const RANGES = LOG_RANGE_OPTIONS.filter(option => option.value !== 'deploy' && option.value !== '7d');

const TONE_CLASS: Record<string, string> = {
  danger: 'text-rose-300',
  warning: 'text-amber-300',
  muted: 'text-gray-500',
  default: 'text-gray-200'
};

const controlClass =
  'rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-[11px] text-gray-200 focus:border-brand-500 focus:outline-none';

/**
 * A hosted branch's logs, live: Render's for a backend, the newest Vercel
 * deployment's for a frontend. Secrets are redacted on the server before a
 * line ever reaches this view.
 */
export const RepoLogs: React.FC<{ projectId: string; repo: string; branches: PipelineBranch[] }> = ({
  projectId,
  repo,
  branches
}) => {
  const [branch, setBranch] = useState<PipelineBranch>(branches.includes('main') ? 'main' : branches[0]);
  const [preset, setPreset] = useState<LogRangePreset>('1h');
  const [type, setType] = useState<LogQueryFilters['type']>(null);
  // Measured once per choice: an open window keeps tailing from its start.
  const logWindow = useMemo(() => rangeWindow(preset, Date.now(), null), [preset]);

  const vm = useHostingLogs({ projectId, repo, branch, window: logWindow, filters: { type } });

  return (
    <RepoSection
      id={`repo-logs-${repo}`}
      title="Logs"
      icon={<ScrollText className="h-3.5 w-3.5 text-brand-400" aria-hidden />}
      actions={<TailBadge vm={vm} />}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-3.5 py-2">
        <label className="sr-only" htmlFor={`logs-branch-${repo}`}>
          Branch
        </label>
        <select
          id={`logs-branch-${repo}`}
          value={branch}
          onChange={e => setBranch(e.target.value as PipelineBranch)}
          className={controlClass}
        >
          {branches.map(b => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={`logs-range-${repo}`}>
          Time range
        </label>
        <select
          id={`logs-range-${repo}`}
          value={preset}
          onChange={e => setPreset(e.target.value as LogRangePreset)}
          className={controlClass}
        >
          {RANGES.map(r => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        {vm.supportedFilters.includes('type') && (
          <>
            <label className="sr-only" htmlFor={`logs-type-${repo}`}>
              Log type
            </label>
            <select
              id={`logs-type-${repo}`}
              value={type ?? ''}
              onChange={e => setType((e.target.value || null) as LogQueryFilters['type'])}
              className={controlClass}
            >
              <option value="">All output</option>
              <option value="build">Build</option>
              <option value="app">Runtime</option>
            </select>
          </>
        )}
        {vm.supportedFilters.includes('level') && (
          <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-400">
            <input type="checkbox" checked={vm.errorsOnly} onChange={vm.toggleErrorsOnly} className="accent-rose-400" />
            Errors only{vm.errorCount > 0 && <span className="text-rose-300">({vm.errorCount})</span>}
          </label>
        )}
        {vm.supportedFilters.includes('text') && (
          <input
            type="search"
            value={vm.search}
            onChange={e => vm.setSearch(e.target.value)}
            placeholder="Search"
            aria-label="Search logs"
            className={`${controlClass} ml-auto w-40`}
          />
        )}
      </div>
      <LogNotices vm={vm} />
      <LogLineList vm={vm} />
    </RepoSection>
  );
};

const TailBadge: React.FC<{ vm: DeploymentLogsViewModel }> = ({ vm }) => {
  if (vm.source === 'unavailable')
    return <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-400">Unavailable</span>;
  const label = { live: 'Live', connecting: 'Connecting…', paused: 'Paused', closed: 'Ended', off: '' }[vm.tail];
  if (!label) return null;
  const live = vm.tail === 'live';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] ${live ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-gray-400'}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-400 motion-safe:animate-pulse' : 'bg-gray-500'}`}
        aria-hidden
      />
      {label}
    </span>
  );
};

const LogNotices: React.FC<{ vm: DeploymentLogsViewModel }> = ({ vm }) => (
  <>
    {vm.source === 'unavailable' && vm.reason && (
      <p className="border-b border-white/[0.06] px-3.5 py-2 text-[11px] text-amber-300">{vm.reason}</p>
    )}
    {!vm.atLive && (
      <p className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-2 text-[11px] text-gray-400">
        Showing older lines; new ones are not being added.
        <button type="button" onClick={vm.restart} className="text-brand-400 hover:text-brand-100">
          Back to live
        </button>
      </p>
    )}
    {vm.error && (
      <p
        role="alert"
        className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-2 text-[11px] text-amber-300"
      >
        {vm.error}
        <button
          type="button"
          onClick={vm.restart}
          className="inline-flex items-center gap-1 text-gray-300 hover:text-white"
        >
          <RotateCcw className="h-3 w-3" aria-hidden /> Retry
        </button>
      </p>
    )}
  </>
);

const LogLineList: React.FC<{ vm: DeploymentLogsViewModel }> = ({ vm }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const [seenId, setSeenId] = useState<string | null>(null);
  const before = useRef<{ height: number; firstId: string | null }>({ height: 0, firstId: null });
  const lines = vm.lines;
  const newest = lines[lines.length - 1]?.id ?? null;

  // Pin to the bottom while the reader is there; when older lines land above
  // someone reading, keep what they were looking at in place.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const firstId = lines[0]?.id ?? null;
    if (pinned) {
      box.scrollTop = box.scrollHeight;
      setSeenId(newest);
    } else if (before.current.firstId && firstId !== before.current.firstId) {
      box.scrollTop += box.scrollHeight - before.current.height;
    }
    before.current = { height: box.scrollHeight, firstId };
  }, [lines, pinned, newest]);

  const onScroll = () => {
    const box = boxRef.current;
    if (!box) return;
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight <= BOTTOM_SLACK;
    if (atBottom !== pinned) setPinned(atBottom);
  };

  const unseen = pinned ? 0 : countLinesAfter(lines, seenId);

  return (
    <div className="relative">
      <div
        ref={boxRef}
        onScroll={onScroll}
        role="log"
        aria-live="off"
        aria-label="Log lines"
        className="h-80 overflow-y-auto bg-black/30 py-1 font-mono text-[11px] leading-5"
      >
        {vm.older !== 'none' && (
          <div className="px-3.5 py-1">
            <button
              type="button"
              onClick={vm.loadOlder}
              disabled={vm.older === 'loading'}
              className="text-[11px] text-brand-400 hover:text-brand-100 disabled:text-gray-500"
            >
              {vm.older === 'loading' ? 'Loading older…' : 'Load older'}
            </button>
          </div>
        )}
        {vm.status === 'loading' && lines.length === 0 && <p className="px-3.5 py-2 text-gray-500">Loading logs…</p>}
        {vm.status === 'ready' && lines.length === 0 && vm.source !== 'unavailable' && (
          <p className="px-3.5 py-2 text-gray-500">No log lines in this range yet.</p>
        )}
        {lines.map(line => (
          <LogLine key={line.id} line={line} />
        ))}
      </div>
      {unseen > 0 && (
        <button
          type="button"
          onClick={() => setPinned(true)}
          className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-brand-500 px-2.5 py-1 text-[11px] font-medium text-on-accent shadow"
        >
          <ArrowDown className="h-3 w-3" aria-hidden /> {unseen} new line{unseen === 1 ? '' : 's'}
        </button>
      )}
    </div>
  );
};

const LogLine: React.FC<{ line: DeploymentLogLine }> = ({ line }) => {
  const tag = instanceTag(line.instance);
  return (
    <div
      className={`flex gap-2 px-3.5 hover:bg-white/[0.03] ${TONE_CLASS[logLevelTone(line.level)] ?? TONE_CLASS.default}`}
    >
      <time className="flex-shrink-0 text-gray-500" dateTime={line.timestamp} title={formatLogDateTime(line.timestamp)}>
        {formatLogTime(line.timestamp)}
      </time>
      {tag && <span className="flex-shrink-0 text-gray-600">{tag}</span>}
      <span className="min-w-0 whitespace-pre-wrap break-words">{stripAnsi(line.message)}</span>
    </div>
  );
};
