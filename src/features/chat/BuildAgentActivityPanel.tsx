import React, { useEffect, useRef } from 'react';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Circle, FileCode2, Flag, Radio, Sparkles, Wrench, X } from 'lucide-react';

import type { LiveBuildRoomActivity } from '@/shared/types';
import type { BuildAgentNode, BuildAgentState } from './useProjectLiveBuild';

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

/** One build agent's live work, shown beside the chat when its node is chosen. */
export const BuildAgentActivityPanel: React.FC<{
  agent: BuildAgentNode;
  repository: string;
  onOpenRoom: () => void;
  onClose: () => void;
}> = ({ agent, repository, onOpenRoom, onClose }) => {
  const timelineRef = useRef<HTMLOListElement>(null);
  const activities = [...(agent.card?.activity ?? [])].sort((a, b) => a.sequence - b.sequence);
  const live = agent.state === 'running';
  const state = STATE[agent.state];

  useEffect(() => {
    const list = timelineRef.current;
    if (live && list) list.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }, [activities.length, live]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <aside aria-label={agent.name + ' build activity'} className="flex h-full w-[380px] shrink-0 flex-col border-l border-white/[0.08] bg-shell">
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
        <button type="button" onClick={onClose} aria-label="Close agent activity" className="rounded-lg p-1.5 text-gray-500 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60"><X className="h-4 w-4" /></button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {agent.currentTaskTitle && <section>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{live ? 'Working on' : agent.state === 'waiting' ? 'Next task' : 'Task'}</h3>
          <p className="text-xs leading-relaxed text-gray-200">{agent.currentTaskTitle}</p>
        </section>}

        <section>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Assigned in this build</h3>
          <ul className="space-y-1.5">{agent.tasks.map(task => <li key={task.id} className="flex items-start justify-between gap-3 rounded-lg bg-white/[0.03] px-2.5 py-2">
            <span className="min-w-0 text-[11px] text-gray-200">{task.title}</span>
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
      </div>

      <footer className="border-t border-white/[0.07] px-5 py-3">
        <button type="button" onClick={onOpenRoom} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-violet-200 hover:text-violet-100"><Radio className="h-3.5 w-3.5" />Open in Live Build Room</button>
      </footer>
    </aside>
  );
};

