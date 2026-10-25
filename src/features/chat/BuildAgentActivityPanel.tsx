import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Circle, FileCode2, Flag, Radio, Sparkles, Wrench } from 'lucide-react';

import type { LiveBuildRoomActivity } from '@/shared/types';
import type { BuildAgentNode, BuildAgentState } from './useProjectLiveBuild';
import { LiveChangesView } from './LiveChangesView';

const STATE: Record<BuildAgentState, { label: string; tone: string }> = {
  running: { label: 'Working', tone: 'text-violet-100 bg-violet-400/15' },
  waiting: { label: 'Waiting for its turn', tone: 'text-sky-200 bg-sky-400/10' },
  review: { label: 'Being checked', tone: 'text-amber-200 bg-amber-400/10' },
  completed: { label: 'Done', tone: 'text-emerald-200 bg-emerald-400/10' },
  failed: { label: 'Needs attention', tone: 'text-rose-200 bg-rose-400/10' }
};

function activityIcon(kind: LiveBuildRoomActivity['kind']) {
  const className = 'h-3.5 w-3.5';
  switch (kind) {
    case 'tool':
    case 'tool_result': return <Wrench className={className} />;
    case 'file_change': return <FileCode2 className={className} />;
    case 'handoff': return <ArrowRightLeft className={className} />;
    case 'error': return <AlertTriangle className={className} />;
    case 'summary': return <CheckCircle2 className={className} />;
    case 'stage': return <Flag className={className} />;
    default: return <Circle className="h-2.5 w-2.5" />;
  }
}

function clock(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** One build agent's live work and code changes, shown as a tab beside the chat when its node is chosen. */
export const BuildAgentActivityPanel: React.FC<{
  agent: BuildAgentNode;
  projectId: string;
  runId: string;
  /** The codebase of the agent's current task. */
  repository: string;
  onOpenReview: () => void;
  usage?: React.ReactNode;
}> = ({ agent, projectId, runId, repository, onOpenReview, usage }) => {
  const timelineRef = useRef<HTMLOListElement>(null);
  const activities = [...(agent.card?.activity ?? [])].sort((a, b) => a.sequence - b.sequence);
  const live = agent.state === 'running';
  const state = STATE[agent.state];
  const [view, setView] = useState<'activity' | 'changes'>('activity');
  const [picked, setPicked] = useState(false);
  const lastEdit = [...activities].reverse().find(activity => activity.kind === 'file_change' && activity.paths?.length);
  const focusPath = lastEdit?.paths?.at(-1);

  // When the agent starts writing files, show its edits — unless the person already chose a view.
  useEffect(() => { if (live && lastEdit && !picked) setView('changes'); }, [live, lastEdit?.id, picked]);
  const choose = (next: 'activity' | 'changes') => { setPicked(true); setView(next); };

  useEffect(() => {
    const list = timelineRef.current;
    if (live && list && view === 'activity') list.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }, [activities.length, live, view]);

  return (
    <section aria-label={agent.name + ' build activity'} className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-start gap-3 border-b border-white/[0.07] px-5 py-4">
        <span className={'grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-300 to-violet-700 text-sm font-semibold text-white ' + (live ? 'shadow-[0_0_18px_rgba(167,139,250,0.55)]' : '')}>{agent.name.slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-white">{agent.name}</h2>
          <p className="truncate text-[11px] text-gray-500">{[agent.role, repository].filter(Boolean).join(' · ') || 'Build agent'}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
            <span className={'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ' + state.tone}>{live && <span className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse" />}{state.label}</span>
            {agent.card?.currentStage && <span className="text-gray-500">{agent.card.currentStage}</span>}
          </div>
        </div>
      </header>

      {usage && <div className="max-h-48 shrink-0 overflow-y-auto px-5">{usage}</div>}
      <div role="tablist" aria-label={agent.name + ' views'} className="flex shrink-0 gap-4 border-b border-white/[0.07] px-5">
        {(['activity', 'changes'] as const).map(item => <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => choose(item)}
          className={'-mb-px border-b-2 py-2 text-[11px] font-medium ' + (view === item ? 'border-violet-300 text-white' : 'border-transparent text-gray-500 hover:text-gray-200')}>
          {item === 'activity' ? 'Activity' : <span className="inline-flex items-center gap-1.5">Changes{agent.changedFiles.length > 0 && <span className="rounded bg-white/[0.08] px-1 text-[9px] text-gray-300">{agent.changedFiles.length}</span>}{live && lastEdit && <span className="h-1.5 w-1.5 rounded-full bg-violet-300 motion-safe:animate-pulse" />}</span>}
        </button>)}
      </div>

      {view === 'changes' ? <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <LiveChangesView projectId={projectId} runId={runId} live={live} repository={repository || undefined}
          // A working agent owns the edits in its codebase right now; a finished one shows the files it changed.
          paths={live ? undefined : agent.changedFiles}
          focusPath={focusPath}
          emptyText={agent.state === 'waiting' ? 'This agent has not started yet.' : undefined} />
      </div> : <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {!!agent.audits?.length && <section aria-label="Dependency audit evidence" className="space-y-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Dependency audit evidence</h3>
          {[...agent.audits].reverse().map(audit => <div key={audit.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-[11px]">
            <div className={audit.passesPolicy ? 'font-semibold text-emerald-200' : 'font-semibold text-amber-200'}>
              {audit.status === 'error' ? 'Audit could not run' : audit.purpose === 'verification' && audit.passesPolicy ? 'Security verification passed' : audit.status === 'findings' ? 'Audit completed: findings found' : 'Audit completed: no findings'}
            </div>
            <p className="mt-1 break-all text-gray-400">{audit.repository}</p>
            <p className="mt-1 text-gray-500">{audit.scanner} · {audit.purpose} · threshold: {audit.level} · {audit.counts.total ?? audit.findings.length} findings</p>
            {audit.purpose === 'self-check' && <p className="mt-1 text-gray-500">Supporting self-check; independent Security assessment is still required.</p>}
            {!!audit.findings.length && <details className="mt-2"><summary className="cursor-pointer text-violet-200">Show package findings</summary>
              <ul className="mt-2 space-y-2">{audit.findings.map(item => <li key={item.package} className="break-words"><span className="font-mono text-gray-200">{item.package}</span> · {item.severity}<p className="text-gray-500">{item.range}</p>{item.advisories.map((value, i) => <p key={i} className="text-gray-400">{value}</p>)}</li>)}</ul>
            </details>}
          </div>)}
        </section>}
        {agent.currentTaskTitle && <section>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{live ? 'Working on' : agent.state === 'waiting' ? 'Next task' : 'Task'}</h3>
          <p className="text-xs leading-relaxed text-gray-200">{agent.currentTaskTitle}</p>
        </section>}

        <section>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Assigned in this build</h3>
          <ul className="space-y-1.5">{agent.tasks.map(task => <li key={task.id} className="flex items-start justify-between gap-3 rounded-lg bg-white/[0.03] px-2.5 py-2">
            <div className="min-w-0 flex-1 text-[11px] text-gray-200">
              <p>{task.title}</p>
              {task.assignmentReason && <p className="mt-1 text-[10px] leading-4 text-gray-400">Why assigned: {task.assignmentReason}</p>}
              <p className="mt-1 text-[10px] text-violet-200">{['database', 'backend', 'frontend', 'mobile'].includes(task.kind ?? '') ? 'Scoped file edits' : 'Read-only assessment'}{task.repository ? ` · ${task.repository}` : ''}</p>
              <details className="mt-1 text-[10px] text-gray-500"><summary className="cursor-pointer">Assignment boundaries</summary>
                <p className="mt-1 break-words">Included: {task.scope?.includePaths.join(', ') || 'No repository edits'}</p>
                {!!task.scope?.excludePaths.length && <p className="mt-1 break-words">Excluded: {task.scope.excludePaths.join(', ')}</p>}
                <p className="mt-1">Approved checks: {task.requiredChecks?.join(', ') || 'None assigned'}</p>
                <p className="mt-1">Dependencies: {task.dependsOn?.join(', ') || 'None'}</p>
              </details>
            </div>
            <span className="shrink-0 text-[10px] capitalize text-violet-200">{task.status.replace(/_/g, ' ')}</span>
          </li>)}</ul>
        </section>

        <section>
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">What it is doing</h3>
          {activities.length ? <ol ref={timelineRef} className="relative space-y-4 border-l border-white/[0.08] pl-5">
            {activities.map((activity, index) => {
              const latest = index === activities.length - 1;
              return <li key={activity.id} className="relative">
                <span className={'absolute -left-[29px] top-0 grid h-[17px] w-[17px] place-items-center rounded-full border bg-shell ' + (activity.kind === 'error' ? 'border-rose-400/40 text-rose-300' : latest && live ? 'border-violet-300/60 text-violet-200 shadow-[0_0_10px_rgba(167,139,250,0.5)]' : 'border-white/15 text-gray-400')}>{activityIcon(activity.kind)}</span>
                <div className="flex items-baseline justify-between gap-3">
                  <p className={'text-xs leading-relaxed ' + (latest ? 'text-white' : 'text-gray-300')}>{activity.toolName ? <span className="mr-1 font-mono text-[10px] text-violet-200">{activity.toolName}</span> : null}{activity.message}</p>
                  <span className="shrink-0 text-[10px] text-gray-600">{clock(activity.createdAt)}</span>
                </div>
                {activity.detail && <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-[11px] text-gray-500">{activity.detail}</p>}
                {activity.paths && activity.paths.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{activity.paths.slice(0, 6).map(path => <span key={path} className="max-w-full truncate rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-gray-400">{path}</span>)}{activity.paths.length > 6 && <span className="text-[10px] text-gray-500">+{activity.paths.length - 6} more</span>}</div>}
              </li>;
            })}
            {live && <li className="relative text-[11px] text-violet-200"><span className="absolute -left-[25px] top-1 h-2 w-2 rounded-full bg-violet-300 motion-safe:animate-ping" />Working…</li>}
          </ol> : <p className="flex items-center gap-2 text-xs text-gray-500"><Sparkles className="h-3.5 w-3.5 text-violet-300" />{live ? 'Starting up. Activity will appear here as the agent works.' : agent.state === 'waiting' ? 'This agent starts when the tasks before it are accepted.' : 'No activity was recorded for this agent yet.'}</p>}
        </section>
      </div>}

      <footer className="border-t border-white/[0.07] px-5 py-3">
        <button type="button" onClick={onOpenReview} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-violet-200 hover:text-violet-100"><Radio className="h-3.5 w-3.5" />Show Build review tab</button>
      </footer>
    </section>
  );
};

