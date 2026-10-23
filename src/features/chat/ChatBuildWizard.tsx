import React, { useState } from 'react';
import { AlertTriangle, Check, ChevronDown, CircleDot, ExternalLink, LoaderCircle } from 'lucide-react';

import { PlanBody, ReviewBody } from './ChatBuildBodies';
import type { ProjectLiveBuild } from './useProjectLiveBuild';

export type WizardStep = 'plan' | 'approve' | 'build' | 'review' | 'publish';

const STEPS: Array<{ id: WizardStep; label: string }> = [
  { id: 'plan', label: 'Plan' },
  { id: 'approve', label: 'Approve' },
  { id: 'build', label: 'Build' },
  { id: 'review', label: 'Review' },
  { id: 'publish', label: 'Pull request' }
];

/** A planning attempt that ended before any build existed, read from the chat. */
export interface BuildPlanningFailure {
  messageId: string;
  reason: string;
  /** The request that was being planned, so it can be tried again. */
  request?: string;
}

/** Which step a build is on, and whether that step needs the person. */
export function wizardStepFor(build: ProjectLiveBuild | null): { step: WizardStep; attention: boolean } {
  if (!build) return { step: 'plan', attention: true };
  switch (build.status) {
    case 'planning': return { step: 'plan', attention: false };
    case 'awaiting_plan_approval': return { step: 'approve', attention: true };
    case 'paused':
    case 'blocked':
    case 'recovery_required': return { step: 'build', attention: true };
    case 'awaiting_approval': return { step: 'review', attention: true };
    case 'publishing': return { step: 'publish', attention: false };
    default: return { step: 'build', attention: false };
  }
}

/** Strip the chat formatting from the Orchestrator's "Build not started." message. */
export function planningFailureReason(content: string): string {
  return content
    .replace(/\*\*Build not started(?: for any repository)?\.\*\*/i, '')
    .replace(/\*\*/g, '')
    .trim();
}

interface Option {
  label: string;
  hint?: string;
  onSelect: () => void;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  disabled?: boolean;
}

/** Numbered choices, like the prompts a coding agent shows above its input. */
const Options: React.FC<{ options: Option[] }> = ({ options }) => (
  <ol className="space-y-1">
    {options.map((option, index) => <li key={option.label}>
      <button type="button" onClick={option.onSelect} disabled={option.disabled || option.busy}
        className={'group flex w-full items-start gap-2.5 rounded-xl border px-3 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60 ' +
          (option.tone === 'primary' ? 'border-violet-300/30 bg-violet-400/[0.12] hover:bg-violet-400/[0.2]'
            : option.tone === 'danger' ? 'border-white/[0.07] bg-white/[0.02] hover:border-rose-300/30 hover:bg-rose-400/[0.08]'
              : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]')}>
        <span className={'mt-px grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-semibold ' + (option.tone === 'primary' ? 'bg-violet-300 text-[#171224]' : 'bg-white/[0.08] text-gray-300')}>
          {option.busy ? <LoaderCircle className="h-3 w-3 animate-spin" /> : index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className={'block text-xs font-medium ' + (option.tone === 'danger' ? 'text-gray-200 group-hover:text-rose-100' : 'text-white')}>{option.label}</span>
          {option.hint && <span className="block text-[11px] leading-4 text-gray-400">{option.hint}</span>}
        </span>
      </button>
    </li>)}
  </ol>
);

const Stepper: React.FC<{ step: WizardStep; attention: boolean; failed: boolean }> = ({ step, attention, failed }) => {
  const current = STEPS.findIndex(item => item.id === step);
  return <ol aria-label="Build steps" className="flex min-w-0 items-center gap-1.5">
    {STEPS.map((item, index) => {
      const done = index < current;
      const active = index === current;
      return <li key={item.id} aria-current={active ? 'step' : undefined} className="flex min-w-0 items-center gap-1.5">
        {index > 0 && <span aria-hidden="true" className={'h-px w-3 shrink-0 ' + (done || active ? 'bg-violet-300/50' : 'bg-white/10')} />}
        <span className={'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ' +
          (active ? (failed ? 'bg-rose-400/15 text-rose-100' : attention ? 'bg-amber-300/15 text-amber-100' : 'bg-violet-400/15 text-violet-100')
            : done ? 'text-violet-200/80' : 'text-gray-500')}>
          {done ? <Check className="h-3 w-3" /> : active ? (failed ? <AlertTriangle className="h-3 w-3" /> : attention ? <CircleDot className="h-3 w-3" /> : <LoaderCircle className="h-3 w-3 animate-spin" />) : null}
          {item.label}
        </span>
      </li>;
    })}
  </ol>;
};

const TASK_TONE: Record<string, string> = {
  accepted: 'text-emerald-200',
  running: 'text-violet-200',
  submitted: 'text-sky-200',
  failed: 'text-rose-200',
  blocked: 'text-amber-200'
};

const shortRepo = (repository: string) => repository.split('/').pop() || repository;

/** Every repository the build touches, so a frontend + backend build is not labelled with only its first repository. */
export function buildRepositoriesLabel(build: ProjectLiveBuild): string {
  const { run, tasks } = build.orchestration;
  const names = [...new Set([
    ...(run.repositories ?? []).map(item => item.repository),
    ...tasks.map(task => task.repository),
    run.repository
  ].filter(Boolean))];
  return names.map(shortRepo).join(', ');
}

/** The repository of the task being worked on, falling back to the whole build. */
function currentRepositoryLabel(build: ProjectLiveBuild, taskTitle?: string): string {
  const { run, tasks } = build.orchestration;
  const task = tasks.find(item => item.id === run.currentTaskId) ?? tasks.find(item => item.title === taskTitle);
  return task?.repository ? shortRepo(task.repository) : buildRepositoriesLabel(build);
}

const Progress: React.FC<{ build: ProjectLiveBuild }> = ({ build }) => {
  const tasks = build.orchestration.tasks;
  const done = tasks.filter(task => task.status === 'accepted').length;
  return <div className="space-y-2">
    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-violet-300/70 transition-all" style={{ width: (tasks.length ? Math.round(done / tasks.length * 100) : 0) + '%' }} /></div>
    <ul className="space-y-1">
      {tasks.map(task => <li key={task.id} className="flex items-start justify-between gap-3 text-[11px]">
        <span className="min-w-0 text-gray-200">{task.status === 'running' && <LoaderCircle className="mr-1.5 inline h-3 w-3 animate-spin text-violet-200" />}{task.title} <span className="text-gray-500">· {task.ownerName}</span></span>
        <span className={'shrink-0 capitalize ' + (TASK_TONE[task.status] ?? 'text-gray-500')}>{task.status === 'accepted' ? 'done' : task.status.replace(/_/g, ' ')}</span>
      </li>)}
    </ul>
  </div>;
};

export interface ChatBuildWizardProps {
  projectId: string;
  build: ProjectLiveBuild | null;
  failure: BuildPlanningFailure | null;
  canStart: boolean;
  canApprove: boolean;
  canStop: boolean;
  busy: 'start' | 'approve' | 'stop' | 'continue' | 'retry' | null;
  error: string | null;
  onStart: () => void;
  onApprove: () => void;
  onStop: () => void;
  /** Resume a paused build, or fix what blocked it and continue. */
  onContinue: () => void;
  /** Put the cursor in the message box, for a reply in the person's own words. */
  onReply: (prefill?: string) => void;
  onRetry: () => void;
  onDismiss: () => void;
  onOpenRoom: () => void;
}

/**
 * The build, step by step, docked above the message box: what the
 * Orchestrator is doing now, and the choices it is waiting on, answered here
 * without leaving the chat.
 */
export const ChatBuildWizard: React.FC<ChatBuildWizardProps> = props => {
  const { build, failure, busy } = props;
  const [collapsed, setCollapsed] = useState(false);
  const failed = !build && Boolean(failure);
  const { step, attention } = wizardStepFor(build);

  let title: string;
  let subtitle: string;
  let body: React.ReactNode = null;
  let options: Option[] = [];

  if (!build && failure) {
    title = 'Build not started';
    subtitle = 'Planning stopped before any agent changed code.';
    body = <p className="whitespace-pre-wrap rounded-xl border border-rose-300/15 bg-rose-500/[0.05] px-3 py-2.5 text-[11px] leading-5 text-rose-50/90">{failure.reason}</p>;
    options = [
      ...(failure.request ? [{ label: 'Try again', hint: 'Plan the same request again.', onSelect: props.onRetry, tone: 'primary' as const, busy: busy === 'retry' }] : []),
      { label: 'Change the request', hint: 'Describe what you want in the message box.', onSelect: () => props.onReply() },
      { label: 'Dismiss', onSelect: props.onDismiss }
    ];
  } else if (build) {
    const reason = build.orchestration.run.stoppedReason;
    switch (build.status) {
      case 'planning':
        title = 'Planning the build';
        subtitle = 'The Orchestrator is reading the codebases and splitting the work. No code changes until you approve.';
        options = props.canStop ? [{ label: 'Stop planning', onSelect: props.onStop, tone: 'danger', busy: busy === 'stop' }] : [];
        break;
      case 'awaiting_plan_approval':
        title = 'Plan ready for your approval';
        subtitle = build.orchestration.tasks.length + (build.orchestration.tasks.length === 1 ? ' task' : ' tasks') + ' · ' + buildRepositoriesLabel(build) + '. No code has changed yet.';
        body = <PlanBody orchestration={build.orchestration} />;
        options = [
          props.canStart
            ? { label: 'Start planned work', hint: 'Agents begin with the first task.', onSelect: props.onStart, tone: 'primary', busy: busy === 'start' }
            : { label: 'Start planned work', hint: 'Your workspace role cannot start builds.', onSelect: () => undefined, disabled: true },
          ...(props.canStop ? [{ label: 'Stop and plan something else', hint: 'Then describe what you want instead.', onSelect: props.onStop, busy: busy === 'stop' }] : []),
          { label: 'Open the full plan', onSelect: props.onOpenRoom }
        ];
        break;
      case 'paused':
      case 'blocked':
      case 'recovery_required':
        title = build.status === 'paused' ? 'Build paused' : 'The build needs you';
        subtitle = buildRepositoriesLabel(build);
        body = <>
          {reason && <p className="whitespace-pre-wrap rounded-xl border border-amber-300/20 bg-amber-400/[0.06] px-3 py-2.5 text-[11px] leading-5 text-amber-50/90">{reason}</p>}
          <Progress build={build} />
        </>;
        options = [
          { label: build.status === 'paused' ? 'Resume' : 'Fix and continue', hint: build.status === 'paused' ? 'Pick up where it stopped.' : 'The Orchestrator repairs what stopped it and carries on.', onSelect: props.onContinue, tone: 'primary', busy: busy === 'continue' },
          { label: 'Tell the Orchestrator what to do', hint: 'Answer in the message box.', onSelect: () => props.onReply() },
          ...(props.canStop ? [{ label: 'Stop the build', hint: 'Work saved on the build branch stays available.', onSelect: props.onStop, tone: 'danger' as const, busy: busy === 'stop' }] : [])
        ];
        break;
      case 'awaiting_approval':
      case 'publishing':
        title = build.status === 'publishing' ? 'Opening the pull request' : 'Build ready for your review';
        subtitle = buildRepositoriesLabel(build);
        body = <ReviewBody projectId={props.projectId} orchestration={build.orchestration} />;
        options = [
          props.canApprove
            ? { label: build.status === 'publishing' ? 'Retry opening the pull request' : 'Approve and open the pull request', hint: 'Pushes the checked branch to GitHub.', onSelect: props.onApprove, tone: 'primary', busy: busy === 'approve' }
            : { label: 'Approve and open the pull request', hint: 'A project manager or admin approves builds.', onSelect: () => undefined, disabled: true },
          { label: 'Ask for changes', hint: 'Describe them in the message box.', onSelect: () => props.onReply() },
          { label: 'Open the full review', onSelect: props.onOpenRoom }
        ];
        break;
      default: {
        const working = build.agents.find(agent => agent.state === 'running');
        title = build.status === 'cancelling' ? 'Stopping the build' : working ? working.name + ' is working' : build.status === 'validating' ? 'Checking the build' : 'Building';
        subtitle = (working?.currentTaskTitle ?? build.goal) + ' · ' + currentRepositoryLabel(build, working?.currentTaskTitle);
        body = <Progress build={build} />;
        options = [
          { label: 'Watch it live', onSelect: props.onOpenRoom },
          ...(props.canStop && build.status !== 'cancelling' ? [{ label: 'Stop the build', hint: 'Agents stop at the next safe point.', onSelect: props.onStop, tone: 'danger' as const, busy: busy === 'stop' }] : [])
        ];
      }
    }
  } else {
    return null;
  }

  const border = failed ? 'border-rose-300/25' : attention ? 'border-amber-300/25' : 'border-violet-300/25';
  return <section aria-label={title} className={'overflow-hidden rounded-2xl border bg-surface-raised/95 shadow-xl shadow-black/50 backdrop-blur ' + border}>
    <div className="flex items-center gap-3 px-4 pt-3">
      <Stepper step={step} attention={attention} failed={failed} />
      <span className="ml-auto flex items-center gap-1">
        {build && <button type="button" onClick={props.onOpenRoom} aria-label="Open in Live Build Room" title="Open in Live Build Room" className="rounded-lg p-1 text-gray-400 hover:bg-white/[0.06] hover:text-white"><ExternalLink className="h-3.5 w-3.5" /></button>}
        <button type="button" onClick={() => setCollapsed(value => !value)} aria-expanded={!collapsed} aria-label={collapsed ? 'Show build details' : 'Hide build details'} className="rounded-lg p-1 text-gray-400 hover:bg-white/[0.06] hover:text-white"><ChevronDown className={'h-4 w-4 transition-transform ' + (collapsed ? '' : 'rotate-180')} /></button>
      </span>
    </div>
    <div className="px-4 pb-3 pt-2">
      <div className="text-xs font-semibold text-white">{title}</div>
      <div className="truncate text-[11px] text-gray-400">{subtitle}</div>
    </div>
    {!collapsed && <>
      {body && <div className="max-h-[22vh] space-y-3 overflow-y-auto border-t border-white/[0.07] px-4 py-3">{body}</div>}
      {options.length > 0 && <div className="border-t border-white/[0.07] px-3 py-2.5"><Options options={options} /></div>}
      {props.error && <p role="alert" className="border-t border-rose-300/15 bg-rose-500/[0.06] px-4 py-2 text-[11px] text-rose-100">{props.error}</p>}
    </>}
  </section>;
};
