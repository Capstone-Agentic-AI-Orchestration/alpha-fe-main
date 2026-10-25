import React, { useEffect, useRef } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Circle,
  FileCode2,
  Flag,
  MessageSquare,
  Paperclip,
  Sparkles,
  Wrench
} from 'lucide-react';

import { AgentCall, AgentCallActivity, ProjectChatAgent } from '@/shared/types';

interface AgentActivityPanelProps {
  call: AgentCall;
  agent?: ProjectChatAgent;
  /** Overrides for calls that are not a listed agent, such as the Orchestrator itself. */
  name?: string;
  subtitle?: string;
  usage?: React.ReactNode;
}

const STATUS: Record<AgentCall['status'], { label: string; tone: string }> = {
  draft: { label: 'Draft', tone: 'text-content-secondary bg-surface-raised' },
  queued: { label: 'Queued', tone: 'text-status-info bg-status-info-subtle' },
  running: { label: 'Working', tone: 'text-selected-content bg-selected' },
  awaiting_confirmation: { label: 'Awaiting approval', tone: 'text-status-warning bg-status-warning-subtle' },
  completed: { label: 'Complete', tone: 'text-status-success bg-status-success-subtle' },
  failed: { label: 'Needs attention', tone: 'text-status-danger bg-status-danger-subtle' },
  cancelled: { label: 'Stopped', tone: 'text-content-secondary bg-surface-raised' }
};

const MODE_LABEL: Record<string, string> = {
  ask: 'Answering a question',
  review: 'Reviewing',
  revise: 'Proposing changes',
  implement: 'Implementing'
};

function activityIcon(kind: AgentCallActivity['kind']) {
  const className = 'h-3.5 w-3.5';
  switch (kind) {
    case 'tool':
    case 'tool_result': return <Wrench className={className} />;
    case 'file_change': return <FileCode2 className={className} />;
    case 'handoff': return <ArrowRightLeft className={className} />;
    case 'error': return <AlertTriangle className={className} />;
    case 'summary': return <CheckCircle2 className={className} />;
    case 'attachment': return <Paperclip className={className} />;
    case 'steering': return <MessageSquare className={className} />;
    case 'stage': return <Flag className={className} />;
    default: return <Circle className="h-2.5 w-2.5" />;
  }
}

function clock(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function duration(call: AgentCall): string | null {
  const start = call.startedAt ? Date.parse(call.startedAt) : NaN;
  if (Number.isNaN(start)) return null;
  const end = call.completedAt ? Date.parse(call.completedAt) : Date.now();
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  return seconds < 60 ? seconds + 's' : Math.floor(seconds / 60) + 'm ' + (seconds % 60) + 's';
}

/** What one agent is doing, shown beside the chat when its node is chosen. */
export const AgentActivityPanel: React.FC<AgentActivityPanelProps> = ({ call, agent, name: nameOverride, subtitle, usage }) => {
  const timelineRef = useRef<HTMLOListElement>(null);
  const activities = [...call.activities].sort((a, b) => a.sequence - b.sequence);
  const live = call.status === 'running' || call.status === 'queued';
  const status = STATUS[call.status] ?? { label: call.status, tone: 'text-content-secondary bg-surface-raised' };
  const name = nameOverride ?? agent?.name ?? call.agentId;
  const elapsed = duration(call);

  useEffect(() => {
    // Follow new activity while the agent is working.
    const list = timelineRef.current;
    if (live && list) list.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }, [activities.length, live]);

  return (
    <section aria-label={name + ' activity'} className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-start gap-3 border-b border-divider px-5 py-4">
        <span className={'grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-300 to-violet-700 text-sm font-semibold text-on-accent ' + (live ? 'shadow-[0_0_18px_rgb(var(--ui-link)/0.55)]' : '')}>{name.slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-content">{name}</h2>
          <p className="truncate text-[11px] text-content-muted">{subtitle ?? (agent?.role || 'Project agent')}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
            <span className={'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ' + status.tone}>{live && <span className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse" />}{status.label}</span>
            <span className="text-content-muted">{MODE_LABEL[call.operationMode] ?? call.operationMode}</span>
            {elapsed && <span className="text-content-muted">· {elapsed}</span>}
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {usage}
        <section>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-content-muted">Asked to</h3>
          <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-content">{call.instruction}</p>
        </section>

        {call.error && <section className="flex items-start gap-2 rounded-xl border border-status-danger-border bg-status-danger-subtle p-3 text-xs text-status-danger"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="break-words">{call.error}</span></section>}

        <section>
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-content-muted">What it is doing</h3>
          {activities.length ? <ol ref={timelineRef} className="relative space-y-4 border-l border-divider pl-5">
            {activities.map((activity, index) => {
              const latest = index === activities.length - 1;
              return <li key={activity.id} className="relative">
                <span className={'absolute -left-[29px] top-0 grid h-[17px] w-[17px] place-items-center rounded-full border bg-shell ' + (activity.kind === 'error' ? 'border-status-danger-border text-status-danger' : latest && live ? 'border-divider text-link shadow-[0_0_10px_rgb(var(--ui-link)/0.5)]' : 'border-divider text-content-secondary')}>{activityIcon(activity.kind)}</span>
                <div className="flex items-baseline justify-between gap-3">
                  <p className={'text-xs leading-relaxed ' + (latest ? 'text-content' : 'text-content-secondary')}>{activity.toolName ? <span className="mr-1 font-mono text-[10px] text-link">{activity.toolName}</span> : null}{activity.message}</p>
                  <span className="shrink-0 text-[10px] text-content-muted">{clock(activity.createdAt)}</span>
                </div>
                {activity.detail && <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-[11px] text-content-muted">{activity.detail}</p>}
                {activity.paths && activity.paths.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{activity.paths.slice(0, 6).map(path => <span key={path} className="max-w-full truncate rounded-md bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-content-secondary">{path}</span>)}{activity.paths.length > 6 && <span className="text-[10px] text-content-muted">+{activity.paths.length - 6} more</span>}</div>}
              </li>;
            })}
            {live && <li className="relative text-[11px] text-link"><span className="absolute -left-[25px] top-1 h-2 w-2 rounded-full bg-violet-300 motion-safe:animate-ping" />Working…</li>}
          </ol> : <p className="flex items-center gap-2 text-xs text-content-muted"><Sparkles className="h-3.5 w-3.5 text-link" />{live ? 'Starting up. Activity will appear here as the agent works.' : 'No activity was recorded for this call.'}</p>}
        </section>

        {call.artifacts.length > 0 && <section>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-content-muted">Results</h3>
          <ul className="space-y-2">{call.artifacts.map(artifact => <li key={artifact.id} className="rounded-xl border border-divider bg-surface-raised p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-link">{artifact.artifactType.replace(/_/g, ' ')}</p>
            {artifact.path && <p className="mt-1 truncate font-mono text-[11px] text-content-secondary">{artifact.path}</p>}
            {artifact.content && <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-[11px] text-content-secondary">{artifact.content}</p>}
          </li>)}</ul>
        </section>}
      </div>
    </section>
  );
};
