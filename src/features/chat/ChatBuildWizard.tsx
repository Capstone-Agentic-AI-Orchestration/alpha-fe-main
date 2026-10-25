import React, { useEffect, useState } from 'react';
import { OrchestrationPlanPreview } from '../live-build-room/OrchestrationPlanPreview';
import { AlertTriangle, Check, ChevronDown, CircleDot, ExternalLink, LoaderCircle } from 'lucide-react';

import { needsSecurityAuditPlan, type ProjectLiveBuild } from './useProjectLiveBuild';
import type { LiveBuildRecoveryAction } from '@/shared/types';

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
  /** Codebases that planning attempt covered. */
  repositories?: string[];
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

/** Compact controls for recovery; approval lives in the review tab. */
const Options: React.FC<{ options: Option[] }> = ({ options }) => (
  <div className="flex flex-wrap gap-2">
    {options.map(option => <div key={option.label}>
      <button type="button" onClick={option.onSelect} disabled={option.disabled || option.busy}
        className={'group flex w-full items-start gap-2.5 rounded-xl border px-3 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60 ' +
          (option.tone === 'primary' ? 'border-violet-300/30 bg-violet-400/[0.12] hover:bg-violet-400/[0.2]'
            : option.tone === 'danger' ? 'border-white/[0.07] bg-white/[0.02] hover:border-rose-300/30 hover:bg-rose-400/[0.08]'
              : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]')}>
        {option.busy && <LoaderCircle className="h-3 w-3 animate-spin" />}
        <span className="min-w-0 flex-1">
          <span className={'block text-xs font-medium ' + (option.tone === 'danger' ? 'text-gray-200 group-hover:text-rose-100' : 'text-white')}>{option.label}</span>
          {option.hint && <span className="block text-[11px] leading-4 text-gray-400">{option.hint}</span>}
        </span>
      </button>
    </div>)}
  </div>
);

const Stepper: React.FC<{ step: WizardStep; attention: boolean; failed: boolean }> = ({ step, attention, failed }) => {
  const current = STEPS.findIndex(item => item.id === step);
  // Stretched across the composer's width: the connectors grow, the labels keep their size.
  return <ol aria-label="Build steps" className="flex min-w-0 flex-1 items-center">
    {STEPS.map((item, index) => {
      const done = index < current;
      const active = index === current;
      return <li key={item.id} aria-current={active ? 'step' : undefined} className={'flex min-w-0 items-center ' + (index > 0 ? 'flex-1' : '')}>
        {index > 0 && <span aria-hidden="true" className={'mx-2 h-px min-w-3 flex-1 ' + (done || active ? 'bg-violet-300/50' : 'bg-white/10')} />}
        <span className={'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ' +
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

/**
 * What "continue" will actually do for a stopped build, worded for that action. The
 * server lists the recovery actions it allows; offering a generic "Fix and continue"
 * when it cannot be done left the person pressing a button that changed nothing.
 */
export function continueChoice(build: ProjectLiveBuild): { label: string; hint: string; action?: LiveBuildRecoveryAction } | null {
  if (build.status === 'blocked' && build.orchestration.run.stoppedReason?.startsWith('Plan document could not be saved before dispatch:')) return { label: 'Retry saving the plan', hint: 'Save the Markdown document before continuing work.' };
  if (build.status === 'blocked' && build.orchestration.run.stoppedReason?.startsWith('Milestone planning stopped before dispatch:')) return { label: 'Retry milestone planning', hint: 'Use the saved checkpoint to plan the next milestone again.' };
  if (build.status === 'paused') return { label: 'Resume', hint: 'Pick up where it stopped.' };
  const recovery = build.orchestration.recovery;
  const available = new Set(recovery?.availableActions ?? []);
  const task = recovery?.taskTitle ? `“${recovery.taskTitle}”` : 'the stopped task';
  if (available.has('plan_final_validation_corrections')) {
    return { label: 'Send the failed checks to their owners', hint: 'Each owning agent fixes its part, then a fresh review and the final checks run again.', action: 'plan_final_validation_corrections' };
  }
  if (recovery?.category === 'final_validation' && available.has('recheck_prerequisite')) {
    return { label: 'Run the final checks again', hint: 'Every task is done. Alpha re-checks the saved work and closes findings that were already answered.', action: 'recheck_prerequisite' };
  }
  if (available.has('retry_report_format')) return { label: 'Ask the agent to resend its report', hint: `The agent on ${task} fixes its report only; no code changes.`, action: 'retry_report_format' };
  if (available.has('repair_and_continue')) return { label: 'Fix and continue', hint: `The agent that owns ${task} repairs it, then the build carries on.`, action: 'repair_and_continue' };
  if (available.has('resume_checkpoint')) return { label: 'Continue from the saved checkpoint', hint: 'Alpha checks the saved branch, then carries on.', action: 'resume_checkpoint' };
  if (available.has('recheck_prerequisite')) return { label: 'Check again and continue', hint: 'Use this after fixing the access or setup problem above.', action: 'recheck_prerequisite' };
  // No recovery recorded yet (an older build): let the server pick the action.
  return recovery ? null : { label: 'Fix and continue', hint: 'The Orchestrator repairs what stopped it and carries on.', action: 'repair_and_continue' };
}

const isBlocking = (severity: string) => severity === 'blocking' || severity === 'critical';

/**
 * The Orchestrator's account of the build: what each agent delivered, how the final
 * checks went and which review findings are still open. Shown wherever the build is,
 * so the chat you are in reports it even when another conversation started the build.
 */
export const OrchestratorReport: React.FC<{ build: ProjectLiveBuild }> = ({ build }) => {
  const { tasks, attempts, findings, finalValidation } = build.orchestration;
  const latest = (taskId: string) => {
    const own = attempts.filter(attempt => attempt.taskId === taskId);
    return [...own].reverse().find(attempt => attempt.status === 'accepted') ?? own.at(-1);
  };
  const open = findings.filter(finding => finding.status === 'open');
  const blocking = open.filter(finding => isBlocking(finding.severity));
  const warnings = open.filter(finding => !isBlocking(finding.severity));
  const checkGroups = finalValidation
    ? (finalValidation.repositories?.length ? finalValidation.repositories : [{ repository: '', status: finalValidation.status, commands: finalValidation.commands, missingScripts: finalValidation.missingScripts }])
    : [];
  const findingLabel = (finding: typeof open[number]) => (finding.title ?? finding.instruction ?? finding.severity) + (finding.path ? ' · ' + finding.path : '');
  return <div className="space-y-2.5">
    <ul className="space-y-2">
      {tasks.map(task => {
        const attempt = latest(task.id);
        const done = task.status === 'accepted';
        return <li key={task.id} className="text-[11px] leading-4">
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0 text-gray-100">{task.status === 'running' && <LoaderCircle className="mr-1.5 inline h-3 w-3 animate-spin text-violet-200" />}{task.title} <span className="text-gray-500">· {task.ownerName}</span></span>
            <span className={'shrink-0 capitalize ' + (TASK_TONE[task.status] ?? 'text-gray-500')}>{done ? 'done' : task.status.replace(/_/g, ' ')}</span>
          </div>
          {attempt?.summary && <p className="mt-0.5 line-clamp-2 text-gray-400">{attempt.summary}</p>}
          {!done && attempt?.failureReason && <p className="mt-0.5 text-rose-200/80">{attempt.failureReason}</p>}
          {attempt && attempt.changedPaths.length > 0 && <p className="mt-0.5 text-[10px] text-gray-500">{attempt.changedPaths.length} {attempt.changedPaths.length === 1 ? 'file' : 'files'} changed</p>}
        </li>;
      })}
    </ul>
    {checkGroups.length > 0 && <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2 text-[11px]">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Final checks</div>
      {checkGroups.map((group, index) => {
        const failedCommands = group.commands.filter(command => command.exitCode !== 0 || command.signal !== null);
        const passed = group.status === 'passed' && !failedCommands.length && !group.missingScripts.length;
        return <div key={group.repository || index} className="mt-1 flex items-start justify-between gap-3">
          <span className="min-w-0 text-gray-300">{group.repository ? shortRepo(group.repository) : 'All codebases'}{!passed && failedCommands.length > 0 && <span className="text-rose-200/80"> · {failedCommands.map(command => command.display ?? command.script ?? 'check').join(', ')}</span>}{group.missingScripts.length > 0 && <span className="text-amber-200/80"> · not set up: {group.missingScripts.join(', ')}</span>}</span>
          <span className={'shrink-0 ' + (passed ? 'text-emerald-200' : 'text-rose-200')}>{passed ? 'passed' : 'failed'}</span>
        </div>;
      })}
    </div>}
    {blocking.length > 0 && <div className="rounded-xl border border-rose-300/15 bg-rose-500/[0.05] px-3 py-2 text-[11px] text-rose-50/90">
      <div className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-3.5 w-3.5" />{blocking.length} blocking {blocking.length === 1 ? 'finding' : 'findings'}</div>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">{blocking.slice(0, 5).map(finding => <li key={finding.id}>{findingLabel(finding)}</li>)}</ul>
    </div>}
    {warnings.length > 0 && <details className="group rounded-xl border border-amber-300/15 bg-amber-400/[0.04] px-3 py-2 text-[11px] text-amber-50/90">
      <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">{warnings.length} review {warnings.length === 1 ? 'warning' : 'warnings'} <span className="text-amber-100/60">· do not block the build</span></summary>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-100/80">{warnings.slice(0, 8).map(finding => <li key={finding.id}>{findingLabel(finding)}</li>)}</ul>
    </details>}
  </div>;
};

const Progress: React.FC<{ build: ProjectLiveBuild }> = ({ build }) => {
  const tasks = build.orchestration.tasks;
  const done = tasks.filter(task => task.status === 'accepted').length;
  return <div className="space-y-2">
    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-violet-300/70 transition-all" style={{ width: (tasks.length ? Math.round(done / tasks.length * 100) : 0) + '%' }} /></div>
    <OrchestratorReport build={build} />
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
  /** Resume a paused build, or take the recovery action the server offers for a stopped one. */
  onContinue: (action?: LiveBuildRecoveryAction) => void;
  onAuditPlan?: () => void;
  /** Put the cursor in the message box, for a reply in the person's own words. */
  onReply: (prefill?: string) => void;
  onRetry: () => void;
  onDismiss: () => void;
  onOpenReview?: () => void;
}

/**
 * The build, step by step, docked above the message box: what the
 * Orchestrator is doing now, and the choices it is waiting on, answered here
 * without leaving the chat.
 */
export const ChatBuildWizard: React.FC<ChatBuildWizardProps> = props => {
  const { build, failure, busy } = props;
  const failed = !build && Boolean(failure);
  const { step, attention } = wizardStepFor(build);
  // Only a step that needs the person opens by itself; a working build is just the step bar.
  const needsYou = failed || attention;
  const [collapsed, setCollapsed] = useState(!needsYou);
  useEffect(() => { if (needsYou) setCollapsed(false); }, [needsYou, build?.status]);

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
        body = <p className="text-xs text-gray-300">{props.canStart ? 'Review the saved plan and type start in the Build review tab.' : 'Your workspace role cannot start builds.'}</p>;
        options = [];
        break;
      case 'paused':
      case 'blocked':
      case 'recovery_required':
      {
        title = build.status === 'paused' ? 'Build paused' : 'The build needs you';
        subtitle = buildRepositoriesLabel(build);
        const auditPlan = needsSecurityAuditPlan(build) && props.onAuditPlan;
        const choice = auditPlan ? null : continueChoice(build);
        const recovery = build.orchestration.recovery;
        // Why "continue" is not offered, in the server's words, when no automatic step is safe.
        const noAutomaticStep = !choice && recovery
          ? recovery.actionReasons.provide_guidance ?? Object.values(recovery.actionReasons).find(Boolean)
          : undefined;
        body = <>
          {reason && <p className="whitespace-pre-wrap rounded-xl border border-amber-300/20 bg-amber-400/[0.06] px-3 py-2.5 text-[11px] leading-5 text-amber-50/90">{reason}</p>}
          {noAutomaticStep && <p className="text-[11px] leading-4 text-gray-400">{noAutomaticStep}</p>}
          <Progress build={build} />
        </>;
        options = [
          ...(auditPlan ? [{ label: 'Plan with Security', hint: 'The Orchestrator prepares a revised audit-and-fix plan for your review.', onSelect: auditPlan, tone: 'primary' as const, busy: busy === 'continue', disabled: !props.canStart }] : []),
          ...(choice ? [{ label: choice.label, hint: choice.hint, onSelect: () => props.onContinue(choice.action), tone: 'primary' as const, busy: busy === 'continue' }] : []),
          { label: 'Tell the Orchestrator what to do', hint: 'Answer in the message box.', onSelect: () => props.onReply(), tone: choice ? undefined : 'primary' as const },
          ...(props.canStop ? [{ label: 'Stop the build', hint: 'Work saved on the build branch stays available.', onSelect: props.onStop, tone: 'danger' as const, busy: busy === 'stop' }] : [])
        ];
        break;
      }
      case 'awaiting_approval':
      case 'publishing':
        title = build.status === 'publishing' ? 'Opening the pull request' : 'Build ready for your review';
        subtitle = buildRepositoriesLabel(build);
        body = <p className="text-xs text-gray-300">{build.status === 'publishing' ? 'Publication progress is in the Build review tab.' : 'Checks, findings, code changes and approval are in the Build review tab.'}</p>;
        options = [];
        break;
      default: {
        const working = build.agents.find(agent => agent.state === 'running');
        title = build.status === 'cancelling' ? 'Stopping the build' : working ? working.name + ' is working' : build.status === 'validating' ? 'Checking the build' : 'Building';
        subtitle = (working?.currentTaskTitle ?? build.goal) + ' · ' + currentRepositoryLabel(build, working?.currentTaskTitle);
        body = <Progress build={build} />;
        options = [
          ...(props.canStop && build.status !== 'cancelling' ? [{ label: 'Stop the build', hint: 'Agents stop at the next safe point.', onSelect: props.onStop, tone: 'danger' as const, busy: busy === 'stop' }] : [])
        ];
      }
    }
  } else {
    return null;
  }

  const border = failed ? 'border-rose-300/25' : attention ? 'border-amber-300/25' : 'border-white/10';
  const details = !collapsed && Boolean((build && build.status !== 'planning') || body || options.length || props.error);
  return <section aria-label={title} className="space-y-2">
    <div className="flex items-center gap-3 px-3">
      <Stepper step={step} attention={attention} failed={failed} />
      <span className="flex shrink-0 items-center gap-1">
        {build && <button type="button" onClick={props.onOpenReview} aria-label="Show Build review tab" title="Show Build review tab" className="rounded-lg p-1 text-gray-400 hover:bg-white/[0.06] hover:text-white"><ExternalLink className="h-3.5 w-3.5" /></button>}
        <button type="button" onClick={() => setCollapsed(value => !value)} aria-expanded={!collapsed} aria-label={collapsed ? 'Show build details' : 'Hide build details'} className="rounded-lg p-1 text-gray-400 hover:bg-white/[0.06] hover:text-white"><ChevronDown className={'h-4 w-4 transition-transform ' + (collapsed ? '' : 'rotate-180')} /></button>
      </span>
    </div>
    {details && <div className={'overflow-hidden rounded-2xl border bg-surface-raised/95 shadow-xl shadow-black/50 backdrop-blur ' + border}>
      {needsYou && <div className="px-4 pb-2 pt-3">
        <div className="text-xs font-semibold text-white">{title}</div>
        <div className="truncate text-[11px] text-gray-400">{subtitle}</div>
      </div>}
      {build && !['planning', 'awaiting_plan_approval', 'awaiting_approval', 'publishing'].includes(build.status) && <div className={'px-4 pb-3 ' + (needsYou ? '' : 'pt-3')}><OrchestrationPlanPreview key={build.runId} projectId={props.projectId} runId={build.runId} planVersion={build.orchestration.run.planVersion} autoShow={build.status === 'executing'} /></div>}
      {body && <div className="max-h-[22vh] space-y-3 overflow-y-auto border-t border-white/[0.07] px-4 py-3">{body}</div>}
      {options.length > 0 && <div className="border-t border-white/[0.07] px-3 py-2.5"><Options options={options} /></div>}
      {props.error && <p role="alert" className="border-t border-rose-300/15 bg-rose-500/[0.06] px-4 py-2 text-[11px] text-rose-100">{props.error}</p>}
    </div>}
  </section>;
};
