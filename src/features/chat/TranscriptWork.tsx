import React, { useState } from 'react';
import { AlertTriangle, Check, ChevronRight } from 'lucide-react';
import type { AgentCall, ProjectBuildAgentCard, ProjectBuildOrchestration, ProjectChatAgent } from '@/shared/types';
import { MessageMarkdown } from './MessageMarkdown';
import { UsageDetails, workDuration, type UsageEntry } from './ChatUsage';
import {
  attemptsDuration, buildWorkSummary, formatDuration, isWorkingBuildStatus, stepGroups,
  type Step, type StepGroup, type StepSourceGroup
} from './transcript';

/**
 * Agent work as it reads in the conversation: quiet one-line steps under each agent while
 * it works, folded into one "Worked for …" line when it is done. See transcript.ts.
 */

function StepRow({ step, current }: { step: Step; current: boolean }) {
  const full = [step.verb, step.target, step.extra].filter(Boolean).join(' ');
  return <li title={full} className={'truncate ' + (current ? 'text-content motion-safe:animate-pulse' : 'text-content-secondary')}>
    {step.verb}
    {step.target && <> <code className="font-mono text-[12px] text-content">{step.target}</code></>}
    {step.extra && <span className="text-content-muted"> {step.extra}</span>}
  </li>;
}

export function StepGroups({ groups }: { groups: StepGroup[] }) {
  if (!groups.length) return null;
  return <div className="space-y-2 border-l border-divider pl-4 text-[13px] leading-6">
    {groups.map(group => <section key={group.key} aria-label={'What ' + group.agentName + ' did'}>
      <div className="text-xs text-content-muted">{group.agentName}</div>
      {group.earlier > 0 && <div className="text-content-muted">{group.earlier} earlier {group.earlier === 1 ? 'step' : 'steps'}</div>}
      <ol>
        {group.steps.map((step, index) => <StepRow key={step.id} step={step} current={group.working && index === group.steps.length - 1} />)}
        {group.working && !group.steps.length && <li className="text-content-muted motion-safe:animate-pulse">Getting started…</li>}
      </ol>
    </section>)}
  </div>;
}

/** A quiet line that opens to show what is behind it. */
function Fold({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <div className="text-xs text-content-muted">
    <button type="button" aria-expanded={open} onClick={onToggle}
      className="inline-flex items-center gap-1 rounded py-0.5 text-left hover:text-content-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
      {label}<ChevronRight aria-hidden="true" className={'h-3 w-3 motion-safe:transition-transform ' + (open ? 'rotate-90' : '')} />
    </button>
    {open && <div className="mt-2 space-y-3">{children}</div>}
  </div>;
}

type BuildTask = ProjectBuildOrchestration['tasks'][number];

const TASK_MARKS: Partial<Record<BuildTask['status'], { box: string; label: string }>> = {
  accepted: { box: 'border-control bg-control text-content', label: 'done' },
  running: { box: 'border-link', label: 'in progress' },
  submitted: { box: 'border-link', label: 'being checked' },
  cancelled: { box: 'border-content-muted', label: 'cancelled' }
};
const TASK_TEXT: Partial<Record<BuildTask['status'], string>> = {
  accepted: 'text-content-muted line-through',
  running: 'text-content',
  submitted: 'text-content',
  failed: 'text-content',
  blocked: 'text-content',
  cancelled: 'text-content-muted line-through'
};

function TaskMark({ status }: { status: BuildTask['status'] }) {
  if (status === 'failed' || status === 'blocked') {
    return <><AlertTriangle aria-hidden="true" className="mt-1 h-3.5 w-3.5 shrink-0 text-status-warning" /><span className="sr-only">Needs attention: </span></>;
  }
  const mark = TASK_MARKS[status] ?? { box: 'border-content-muted', label: 'not started' };
  return <>
    <span aria-hidden="true" className={'mt-1 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[4px] border ' + mark.box}>
      {status === 'accepted' && <Check className="h-2.5 w-2.5" />}
    </span>
    <span className="sr-only">{mark.label[0].toUpperCase() + mark.label.slice(1)}: </span>
  </>;
}

/** The build's tasks as a checklist that ticks itself off as the agents' work is accepted. */
export function PlanChecklist({ tasks }: { tasks: BuildTask[] }) {
  const shown = tasks.filter(task => task.status !== 'superseded');
  if (!shown.length) return null;
  return <ul aria-label="Plan" className="space-y-1.5 text-sm">
    {shown.map(task => <li key={task.id} className="flex items-start gap-2.5">
      <TaskMark status={task.status} />
      <span className={TASK_TEXT[task.status] ?? 'text-content-secondary'}>{task.title}</span>
    </li>)}
  </ul>;
}

function callAgentName(call: AgentCall, agents: ProjectChatAgent[]): string {
  return agents.find(agent => agent.id === call.agentId)?.name ?? (call.squadId === 'alpha-chat' ? 'Alpha' : call.agentId);
}

function callsDuration(calls: AgentCall[]): number {
  const starts = calls.map(call => Date.parse(call.startedAt ?? call.createdAt)).filter(Number.isFinite);
  const ends = calls.flatMap(call => call.completedAt ? [Date.parse(call.completedAt)] : []).filter(Number.isFinite);
  return starts.length && ends.length ? Math.max(...ends) - Math.min(...starts) : 0;
}

function turnOutcome(calls: AgentCall[]): string {
  const last = calls.at(-1)?.status;
  if (last === 'failed') return 'Failed after';
  if (last === 'cancelled') return 'Stopped after';
  return 'Worked for';
}

/**
 * The work behind one of your messages: its steps while Alpha (or an agent) works, then
 * "Worked for 21s ›", which opens to the steps and the token usage.
 */
export function TurnWork({ calls, agents, handoff, entries, now, names, working }: {
  calls: AgentCall[];
  agents: ProjectChatAgent[];
  /** Alpha's note on who it handed the request to. */
  handoff?: string;
  entries: UsageEntry[];
  now: number;
  names?: Record<string, string>;
  working: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ordered = [...calls].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const sources: StepSourceGroup[] = ordered.map(call => ({
    key: call.id, agentName: callAgentName(call, agents), working: call.status === 'running' || call.status === 'queued', activity: call.activities
  }));
  if (working) {
    // A plain answer has no steps; its words stream in below instead.
    const live = stepGroups(sources, 6).filter(group => group.steps.length);
    return live.length ? <StepGroups groups={live} /> : null;
  }
  if (!ordered.length && !entries.length) return null;
  const ms = entries.length ? workDuration(entries, now) : callsDuration(ordered);
  return <Fold label={turnOutcome(ordered) + ' ' + formatDuration(ms)} open={open} onToggle={() => setOpen(value => !value)}>
    {handoff && <div className="text-[13px] text-content-secondary"><MessageMarkdown content={handoff} /></div>}
    <StepGroups groups={stepGroups(sources, 40)} />
    {entries.length > 0 && <UsageDetails entries={entries} now={now} names={names} />}
  </Fold>;
}

/** Each agent's activity on this build, one group per agent in the order they started. */
function buildStepSources(orchestration: ProjectBuildOrchestration, cards: ProjectBuildAgentCard[]): StepSourceGroup[] {
  const runIds = new Set(orchestration.attempts.flatMap(attempt => attempt.prototypeRunId ? [attempt.prototypeRunId] : []));
  const byAgent = new Map<string, StepSourceGroup>();
  for (const card of cards) {
    if (!card.runId || !runIds.has(card.runId)) continue;
    const group = byAgent.get(card.agentName) ?? { key: card.agentName, agentName: card.agentName, working: false, activity: [] };
    group.working = group.working || card.status === 'running';
    group.activity.push(...card.activity);
    byAgent.set(card.agentName, group);
  }
  return [...byAgent.values()];
}

/**
 * A build in the conversation: the plan as a checklist and each agent's steps while it works;
 * once it stops, one line ("Worked for 3m 12s · 3 agents · every check passed ›") that opens
 * to the same. `details` (the plan file and the raw log) sits behind "Technical details".
 */
export function BuildWork({ orchestration, agentCards, entries, now, names, details }: {
  orchestration: ProjectBuildOrchestration;
  agentCards: ProjectBuildAgentCard[];
  entries: UsageEntry[];
  now: number;
  names?: Record<string, string>;
  details?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const status = orchestration.run.status;
  const working = isWorkingBuildStatus(status);
  const groups = stepGroups(buildStepSources(orchestration, agentCards), working ? 6 : 40);
  const technical = <Fold label="Technical details" open={technicalOpen} onToggle={() => setTechnicalOpen(value => !value)}>
    {details}
    {entries.length > 0 && <UsageDetails entries={entries} now={now} names={names} />}
  </Fold>;
  if (working || status === 'awaiting_plan_approval') {
    return <div className="space-y-3">
      <PlanChecklist tasks={orchestration.tasks} />
      {working && <StepGroups groups={groups} />}
      {technical}
    </div>;
  }
  const ms = entries.length ? workDuration(entries, now) : attemptsDuration(orchestration);
  return <Fold label={buildWorkSummary(orchestration, ms)} open={open} onToggle={() => setOpen(value => !value)}>
    <PlanChecklist tasks={orchestration.tasks} />
    <StepGroups groups={groups} />
    {technical}
  </Fold>;
}

/** "Working · 1m 42s · Esc to stop", over the message box while Alpha or a build works. */
export function WorkingStatusLine({ label, since, now, hint }: { label: string; since?: string; now: number; hint: string }) {
  const started = since ? Date.parse(since) : Number.NaN;
  return <div role="status" className="flex items-center gap-1.5 px-4 text-xs text-content-muted">
    <span className="text-content-secondary motion-safe:animate-pulse">{label}</span>
    {Number.isFinite(started) && <span aria-hidden="true">· {formatDuration(now - started)}</span>}
    {hint && <span>· {hint}</span>}
  </div>;
}
