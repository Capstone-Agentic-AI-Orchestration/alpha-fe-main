import React, { useMemo } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Circle,
  Loader2,
  TerminalSquare,
  Wrench
} from 'lucide-react';
import { RunActivity } from '@/shared/types';

interface ActivityFeedProps {
  activities?: RunActivity[];
  live?: boolean;
}

const iconFor = (kind: RunActivity['kind'], streaming?: boolean) => {
  if (streaming) return Loader2;
  switch (kind) {
    case 'assistant': return Bot;
    case 'tool': return Wrench;
    case 'tool_result': return TerminalSquare;
    case 'error': return AlertCircle;
    case 'summary': return CheckCircle2;
    default: return Circle;
  }
};

const toneFor = (kind: RunActivity['kind']) => {
  switch (kind) {
    case 'assistant': return 'text-content';
    case 'tool': return 'text-status-info';
    case 'tool_result': return 'text-content-secondary';
    case 'error': return 'text-status-danger';
    case 'summary': return 'text-status-success';
    default: return 'text-content-secondary';
  }
};

const timeFor = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

/** Chronological, user-safe activity trail for a live or completed run. */
export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities, live = false }) => {
  const ordered = useMemo(
    () => [...(activities ?? [])].sort((a, b) => a.sequence - b.sequence),
    [activities]
  );

  const hasAssistantActivity = ordered.some(activity => activity.kind === 'assistant');
  const hasTokenStream = ordered.some(activity => activity.isStreaming || activity.streamed);
  const hasCompletedOnlyOutput = hasAssistantActivity && !hasTokenStream;

  const deliveryLabel = live
    ? hasTokenStream
      ? 'Live tokens'
      : hasCompletedOnlyOutput
        ? 'Live updates'
        : 'Live'
    : hasTokenStream
      ? 'Token stream'
      : hasCompletedOnlyOutput
        ? 'Completed updates'
        : undefined;

  if (!ordered.length) return null;

  return (
    <div className="rounded-lg border border-divider bg-canvas/70" aria-live="polite" aria-label="Agent activity feed">
      <div className="flex items-center justify-between border-b border-divider px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-content-muted">Agent activity</p>
        {deliveryLabel && <span className="flex items-center gap-1.5 text-[10px] text-status-info"><span className={`h-1.5 w-1.5 rounded-full bg-cyan-300 ${live ? 'animate-pulse' : ''}`} />{deliveryLabel}</span>}
      </div>
      {hasCompletedOnlyOutput && (
        <p className="border-b border-divider px-3 py-2 text-[10px] leading-relaxed text-content-muted">
          No token deltas were received for this run; assistant messages are shown as completed updates.
        </p>
      )}
      <ol className="max-h-96 space-y-3 overflow-y-auto px-3 py-3">
        {ordered.map(activity => {
          const Icon = iconFor(activity.kind, activity.isStreaming);
          return (
            <li key={activity.id} className="flex items-start gap-2.5 text-[11px]">
              <Icon className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${toneFor(activity.kind)} ${activity.isStreaming ? 'animate-spin' : ''}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className={`whitespace-pre-wrap break-words leading-relaxed ${toneFor(activity.kind)}`}>
                    {activity.message}
                    {activity.isStreaming && <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-cyan-300 align-[-2px]" aria-label="still streaming" />}
                  </p>
                  <time className="flex-shrink-0 text-[9px] tabular-nums text-content-muted">{timeFor(activity.createdAt)}</time>
                </div>
                {activity.detail && (
                  <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded bg-well p-1.5 font-mono text-[10px] leading-relaxed text-content-muted">
                    {activity.detail}
                  </pre>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
