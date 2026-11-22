import { LoadingRows } from '@/shared/components/ui/skeleton';
import React, { useState } from 'react';
import { Check, ChevronDown, Circle, ExternalLink, MessageSquare, Pause, Play, Send, Sparkles, Square } from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { BuildReviewTab } from '@/features/chat/BuildReviewTab';
import { ReviewBody } from '@/features/chat/ChatBuildBodies';
import { OrchestrationDeliveryPanel } from '@/features/chat/OrchestrationDeliveryPanel';
import { startCorrectionText } from '@/features/chat/ChatBuildWizard';
import { OrchestrationRecoveryPanel } from '@/features/chat/OrchestrationRecoveryPanel';
import { BUILD_STEPS, buildStepFor } from '@/features/chat/buildSteps';
import { buildAgentNodes } from '@/features/chat/useProjectLiveBuild';
import { isDesktop } from '@/shared/desktop';
import { githubLink } from '@/shared/lib/githubLink';
import { apiService, type IssueBuildStatus, userMessage } from '@/shared/services/apiService';
import type { Issue, LiveBuildOrchestrationStatus, ProjectBuildOrchestration } from '@/shared/types';
import { changedFiles, requirementEvidence, useBuildConversation, useTaskBuild } from './useTaskBuild';
import { BuildRequestPanel } from './BuildRequestPanel';
import { lostWorkingCopyText } from '@/features/issues/taskFlow';
import { ReviewedRecoveryPanel } from './ReviewedRecoveryPanel';

export type SpecState = 'none' | 'draft' | 'approved' | 'stale';

interface TaskBuildPanelProps {
  onOpenTask?: (id: string, projectId: string) => void;
  issue: Issue;
  build?: IssueBuildStatus;
  canStartBuild: boolean;
  specState: SpecState;
  onPlanBuild: (issue: Issue) => void;
  /** The board re-reads build statuses after a decision so the card moves without waiting. */
  onBuildChanged?: () => void;
}

const STATUS_COPY: Partial<Record<LiveBuildOrchestrationStatus, string>> = {
  planning: 'Planning the work.',
  awaiting_plan_approval: 'The plan is ready. Nothing in the code changes until you approve it.',
  paused: 'Paused. Resume when you are ready.',
  validating: 'Checking the finished work.',
  awaiting_approval: 'Changes ready for your review. Inspect the current validation evidence below.',
  publishing: 'Opening the pull request.',
  cancelling: 'Stopping the build.',
  blocked: 'The failed step needs recovery review.',
  recovery_required: 'Execution was interrupted. Review the saved state before continuing.',
  failed: 'The build stopped.',
  cancelled: 'Previous build stopped. This is its saved result.'
};

const button = 'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-semibold disabled:opacity-40';
const primary = `${button} bg-action text-on-action hover:bg-action-hover`;
const secondary = `${button} border border-divider font-medium text-content-secondary hover:bg-surface-high hover:text-content`;
const textarea = 'w-full resize-y rounded-md border border-control bg-well px-3 py-2 text-[13px] text-content placeholder-content-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/** The part of a planner requirement a person reads; acceptance criteria follow it in the stored text. */
const requirementText = (description: string) => description.split(' Acceptance: ')[0];

type BuildStepId = (typeof BUILD_STEPS)[number]['id'];

function buildStepDone(id: BuildStepId, orchestration: ProjectBuildOrchestration, published: boolean): boolean {
  const { run, tasks, attempts } = orchestration;
  if (id === 'plan') return run.status !== 'planning';
  if (id === 'approve') return attempts.length > 0;
  if (id === 'build') return tasks.filter(task => task.required).every(task => task.status === 'accepted') && tasks.some(task => task.kind === 'validation' && task.status === 'accepted');
  return published;
}

function stepDotClass(done: boolean, current: boolean, attention: boolean): string {
  if (done) return 'border-link bg-link';
  if (!current) return 'border-control bg-surface-raised';
  return attention ? 'border-status-warning bg-surface-raised ring-[3px] ring-status-warning-subtle' : 'border-link bg-surface-raised ring-[3px] ring-selected';
}

function stepLabelClass(done: boolean, current: boolean): string {
  if (current) return 'text-content';
  return done ? 'text-content-secondary' : 'text-content-muted';
}

/**
 * Which repository memory (AGENTS.md) the latest attempt was given, so a person
 * can see what the agents were told first. Nothing when none was used.
 */
export const MemoryUsed: React.FC<{ orchestration: ProjectBuildOrchestration }> = ({ orchestration }) => {
  const latest = [...orchestration.attempts].reverse().find(attempt => attempt.repositoryMemory?.length);
  if (!latest?.repositoryMemory) return null;
  return (
    <p className="text-[12px] text-content-muted">
      Project memory read first:{' '}
      {latest.repositoryMemory.map((item, index) => (
        <span key={item.repository}>
          {index > 0 && ', '}
          <span className="font-mono text-content-secondary">{item.repository}</span> {item.file}
          {item.version && <> @ <span className="font-mono">{item.version.slice(0, 7)}</span></>}
        </span>
      ))}
    </p>
  );
};

/** Plan, approve, build, review, pull request: where the build is, as a row of dots. */
const BuildProgressTrack: React.FC<{ orchestration: ProjectBuildOrchestration; publications: readonly unknown[]; stepIndex: number; attention: boolean }> = ({ orchestration, publications, stepIndex, attention }) => {
  const status = orchestration.run.status;
  const changesCode = orchestration.tasks.some(task => ['database', 'backend', 'frontend', 'mobile'].includes(task.kind));
  const moving = !['completed', 'cancelled', 'failed'].includes(status);
  return (
    <ol aria-label="Build progress" className="flex">
      {BUILD_STEPS.filter(item => item.id !== 'publish' || changesCode || publications.length > 0).map((item, index) => {
        const done = buildStepDone(item.id, orchestration, publications.length > 0);
        const current = moving && index === stepIndex;
        return (
          <li key={item.id} aria-current={current ? 'step' : undefined} className="min-w-0 flex-1">
            <span className="relative flex h-3 w-full items-center">
              {index < BUILD_STEPS.length - 1 && <span aria-hidden="true" className={`absolute left-3.5 right-[-6px] top-[5.5px] h-px ${done ? 'bg-link' : 'bg-divider'}`} />}
              <span aria-hidden="true" className={`relative z-[1] h-3 w-3 rounded-full border-[1.5px] ${stepDotClass(done, current, attention)}`} />
            </span>
            <span className={`mt-1.5 block truncate text-[11.25px] font-medium ${stepLabelClass(done, current)}`}>{item.label}</span>
          </li>
        );
      })}
    </ol>
  );
};

/**
 * A task's build, on the task.
 *
 * Shows where the build is, the checklist with its evidence, and the one
 * decision that needs this person. Every decision calls the same endpoint the
 * chat uses, so the orchestration is unchanged. Which agent did what stays in
 * the closed "Build details" section.
 */
export const TaskBuildPanel: React.FC<TaskBuildPanelProps> = ({ issue, build, canStartBuild, specState, onPlanBuild, onBuildChanged, onOpenTask }) => {
  const { can, role } = useApp();
  const { snapshot, orchestration, loadError, refresh, canControl, open, running } = useTaskBuild(issue, build, Boolean(build) && isDesktop);
  const conversation = useBuildConversation(issue.projectId, issue.id, orchestration?.run.originChatThreadId, open);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [planChanges, setPlanChanges] = useState('');
  const [changingPlan, setChangingPlan] = useState(false);
  const [sendBack, setSendBack] = useState('');
  const [sendingBack, setSendingBack] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [question, setQuestion] = useState('');
  const [confirmStop, setConfirmStop] = useState(false);
  // A plan the Orchestrator fixed before it could start: what changed, waiting for Start again.
  const [correction, setCorrection] = useState('');

  const act = async (label: string, action: () => Promise<unknown>) => {
    setBusy(label);
    setError('');
    try {
      await action();
      await refresh();
      onBuildChanged?.();
      return true;
    } catch (failure) {
      setError(userMessage(failure, 'That action did not complete.'));
      await refresh();
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (!isDesktop) {
    return <p className="text-[13px] text-content-muted">{role === 'dev' ? 'Open this task in Alpha desktop to plan and run its build.' : 'Assign this task to a developer. You can review shared task outcomes here.'}</p>;
  }

  const specNote = specState === 'draft'
    ? 'The feature spec is still a draft. Approve it so the build follows its checklist.'
    : specState === 'stale'
      ? 'The task changed after its feature spec was approved. Approve the spec again before building.'
      : specState === 'approved' ? 'The build will follow the approved feature spec.' : '';

  if (!build?.runId) {
    return (
      <div className="space-y-3">
        <BuildRequestPanel issue={issue} build={build} onChanged={onBuildChanged} onOpenTask={onOpenTask} />
        <p className="text-[13px] text-content-muted">
          No build yet. {canStartBuild ? 'Plan one to have the Orchestrator do this task.' : role === 'pm' ? 'A developer can plan and run this task.' : ''}
        </p>
        {specNote && <p className={`text-[12.5px] ${specState === 'approved' ? 'text-content-secondary' : 'text-status-warning'}`}>{specNote}</p>}
        {canStartBuild && (
          <button type="button" disabled={specState === 'stale'} onClick={() => onPlanBuild(issue)} className={secondary}>
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-link" /> Plan build
          </button>
        )}
      </div>
    );
  }

  if (!orchestration) {
    return loadError
      ? <div role="alert" className="space-y-2 text-[13px] text-status-danger"><p>{loadError}</p><button type="button" onClick={() => void refresh()} className={secondary}>Retry loading build</button></div>
      : <LoadingRows label="Loading the build" layout="conversation" />;
  }

  const run = orchestration.run;
  const status = run.status;
  const step = buildStepFor(status);
  const stepIndex = BUILD_STEPS.findIndex(item => item.id === step.step);
  const finished = status === 'completed';
  const currentTask = orchestration.tasks.find(task => task.id === run.currentTaskId);
  const evidence = requirementEvidence(orchestration);
  const files = changedFiles(orchestration);
  const covered = orchestration.requirements.filter(requirement => evidence.has(requirement.id)).length;
  const canDecide = can('run_builds') && can('manage_chat') && canControl;
  const canPublish = can('publish_build') && can('run_builds') && can('manage_chat') && canControl;
  // The working copy and its unpublished commits are gone: nothing can be approved, sent back or resumed.
  const lostText = open ? lostWorkingCopyText(run.workspaceLostReason) ?? lostWorkingCopyText(run.stoppedReason) ?? lostWorkingCopyText(error) : undefined;
  const statusText = lostText ? 'This build can no longer be approved.' : status === 'executing'
    ? currentTask ? `Working on: ${currentTask.title}` : 'Building.'
    : finished
      ? (run.publications?.length || run.publication ? 'Build complete. The pull request is open for review.' : 'Report complete. Ready for review.')
      : STATUS_COPY[status] ?? status.replace(/_/g, ' ');
  const publications = run.publications?.length ? run.publications : run.publication ? [run.publication] : [];
  const pullRequestLinks = publications.flatMap(publication => {
    const href = githubLink(publication.pullRequestUrl);
    return href ? [{ href, repository: publication.repository ?? run.repository }] : [];
  });
  const stoppable = open && !['publishing', 'cancelling'].includes(status);
  const live = ['planning', 'executing', 'validating', 'publishing'].includes(status);
  const historyMessages = conversation.messages.filter(entry => ['build', 'build_milestone'].includes(entry.messageType ?? ''));
  const questionMessages = conversation.messages.filter(entry => !['build', 'build_milestone'].includes(entry.messageType ?? ''));

  return (
    <div className="space-y-5">
      <BuildRequestPanel issue={issue} build={build} onChanged={onBuildChanged} onOpenTask={onOpenTask} />

      <div role="status" className="space-y-1">
        <p className="text-[13px] font-semibold text-content">{statusText}</p>
        {lostText && <p className="text-[12.5px] leading-relaxed text-content-secondary">{lostText}</p>}
        {run.stoppedReason && !lostText && !['completed'].includes(status) && (
          <details className="text-[12.5px] text-content-secondary"><summary>Technical details · {new Date(run.updatedAt).toLocaleString()}</summary><pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap">{run.stoppedReason}</pre></details>
        )}
      </div>

      {correction && <p role="status" className="whitespace-pre-wrap rounded-md border border-divider bg-selected px-3 py-2 text-[12.5px] text-content">{correction}</p>}
      {error && !lostText && <p role="alert" className="rounded-md border border-status-danger-border bg-status-danger-subtle px-3 py-2 text-[12.5px] text-status-danger">{error}</p>}

      {status === 'awaiting_plan_approval' && (
        <section aria-label="Plan" className="space-y-3">
          <h3 className="text-[13px] font-semibold text-content-secondary">The plan</h3>
          <ol className="list-decimal space-y-1 pl-5 text-[13px] text-content-secondary">
            {orchestration.tasks.filter(task => task.required).map(task => <li key={task.id}>{task.title}</li>)}
          </ol>
          {run.exclusions.length > 0 && (
            <p className="text-[12.5px] text-content-muted">Out of scope: {run.exclusions.join('; ')}</p>
          )}
          {canDecide && (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={Boolean(busy)} onClick={() => void act('start', async () => {
                setCorrection('');
                const result = await apiService.startPlannedOrchestration(issue.projectId, run.id, run.revision);
                if (result.corrected) setCorrection(startCorrectionText(result.corrected));
              })} className={primary}>
                <Play aria-hidden="true" className="h-3.5 w-3.5" /> Approve plan and build
              </button>
              <button type="button" disabled={Boolean(busy)} onClick={() => setChangingPlan(value => !value)} className={secondary}>Revise plan</button>
            </div>
          )}
          {changingPlan && (
            <form
              className="space-y-2"
              onSubmit={event => {
                event.preventDefault();
                void act('change_plan', async () => {
                  await apiService.reviseIssueBuildPlan(issue.projectId, run.id, run.revision, planChanges);
                }).then(ok => { if (ok) { setChangingPlan(false); setPlanChanges(''); } });
              }}
            >
              <label htmlFor={`plan-changes-${issue.id}`} className="text-[12.5px] text-content-muted">What should the plan do differently? The current plan stays available until a valid replacement is prepared. The replacement needs your approval.</label>
              <textarea id={`plan-changes-${issue.id}`} rows={3} maxLength={1500} value={planChanges} onChange={event => setPlanChanges(event.target.value)} className={textarea} />
              <button type="submit" disabled={!planChanges.trim() || Boolean(busy)} className={primary}>Prepare revised plan</button>
            </form>
          )}
        </section>
      )}

      {(status === 'executing' || status === 'paused') && canDecide && (
        <div className="flex flex-wrap gap-2">
          {status === 'executing' && !run.pauseRequestedAt && (
            <button type="button" disabled={Boolean(busy)} onClick={() => void act('pause', () => apiService.pauseOrchestration(issue.projectId, run.id, run.revision))} className={secondary}>
              <Pause aria-hidden="true" className="h-3.5 w-3.5" /> Pause after this step
            </button>
          )}
          {status === 'paused' && (
            <button type="button" disabled={Boolean(busy)} onClick={() => void act('resume', () => apiService.resumeOrchestration(issue.projectId, run.id))} className={primary}>
              <Play aria-hidden="true" className="h-3.5 w-3.5" /> Resume
            </button>
          )}
        </div>
      )}

      {(status === 'blocked' || status === 'recovery_required') && (
        orchestration.recovery
          ? (
            <OrchestrationRecoveryPanel
              projectId={issue.projectId}
              runId={run.id}
              runRevision={run.revision}
              taskRevision={orchestration.tasks.find(task => task.id === orchestration.recovery?.taskId)?.revision}
              recovery={orchestration.recovery}
              canControl={canDecide}
              threadId={conversation.threadId}
              onActionComplete={async () => { await refresh(); onBuildChanged?.(); }}
              compact
            />
          )
          : canDecide && !lostText && snapshot?.orchestrationResumeAvailable && (
            <button type="button" disabled={Boolean(busy)} onClick={() => void act('resume', () => apiService.resumeOrchestration(issue.projectId, run.id))} className={primary}>
              <Play aria-hidden="true" className="h-3.5 w-3.5" /> Resume
            </button>
          )
      )}
      {['blocked', 'recovery_required', 'paused'].includes(status) && !lostText && <ReviewedRecoveryPanel projectId={issue.projectId} runId={run.id} canControl={canDecide} onChanged={() => { void refresh(); onBuildChanged?.(); }} />}

      {status === 'awaiting_approval' && !lostText && (
        <section aria-label="Review" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {canPublish && (
              <button type="button" disabled={Boolean(busy)} onClick={() => void act('publish', () => apiService.approveOrchestration(issue.projectId, run.id, run.revision))} className={primary}>
                <Check aria-hidden="true" className="h-3.5 w-3.5" /> Approve and open pull request
              </button>
            )}
            {canPublish && <button type="button" disabled={Boolean(busy)} onClick={() => setSendingBack(value => !value)} className={secondary}>Send back</button>}
          </div>
          {sendingBack && (
            <form
              className="space-y-2"
              onSubmit={event => {
                event.preventDefault();
                void act('send_back', () => apiService.requestOrchestrationChanges(issue.projectId, run.id, run.revision, sendBack))
                  .then(ok => { if (ok) { setSendingBack(false); setSendBack(''); } });
              }}
            >
              <label htmlFor={`send-back-${issue.id}`} className="text-[12.5px] text-content-muted">What should change? The agents correct their own work, then it is reviewed and checked again before it comes back to you.</label>
              <textarea id={`send-back-${issue.id}`} rows={3} maxLength={2000} value={sendBack} onChange={event => setSendBack(event.target.value)} className={textarea} />
              <button type="submit" disabled={!sendBack.trim() || Boolean(busy)} className={primary}>Send back with these changes</button>
            </form>
          )}
          <details className="group rounded-md border border-divider">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium text-content-secondary">
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 -rotate-90 transition-transform group-open:rotate-0" />
              Changed files ({files.length})
            </summary>
            <div className="space-y-2 border-t border-divider px-3 py-2">
              <ul className="space-y-0.5 font-mono text-[11.5px] text-content-secondary">
                {files.slice(0, 12).map(file => <li key={file} className="truncate">{file}</li>)}
                {files.length > 12 && <li className="font-sans text-content-muted">and {files.length - 12} more</li>}
              </ul>
              <button type="button" onClick={() => setShowDiff(value => !value)} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-link hover:text-link-hover">
                <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${showDiff ? 'rotate-180' : ''}`} /> {showDiff ? 'Hide the changes' : 'Show the changes'}
              </button>
              {showDiff && <ReviewBody projectId={issue.projectId} orchestration={orchestration} expandedDiff />}
            </div>
          </details>
        </section>
      )}

      {status === 'publishing' && run.stoppedReason && canPublish && (
        <button type="button" disabled={Boolean(busy)} onClick={() => void act('publish', () => apiService.approveOrchestration(issue.projectId, run.id, run.revision))} className={primary}>Retry publishing</button>
      )}

      {pullRequestLinks.length > 0 && (
        <ul className="space-y-1">
          {pullRequestLinks.map(link => (
            <li key={link.href}>
              <a href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-link hover:text-link-hover">
                {link.repository} pull request <ExternalLink aria-hidden="true" className="h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {finished && publications.length > 0 && <OrchestrationDeliveryPanel projectId={issue.projectId} runId={run.id} onRepairPrepared={() => { void refresh(); onBuildChanged?.(); }} />}

      {(status === 'failed' || status === 'cancelled') && canStartBuild && (
        <button type="button" onClick={() => onPlanBuild(issue)} className={secondary}>
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-link" /> Plan a new build
        </button>
      )}


      {stoppable && canDecide && (
        confirmStop
          ? (
            <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <span className="text-content-secondary">Stop this build? Saved work is kept for review.</span>
              <button type="button" disabled={Boolean(busy)} onClick={() => void act('stop', () => apiService.cancelOrchestration(issue.projectId, run.id)).then(() => setConfirmStop(false))} className={`${button} bg-status-danger text-on-accent`}>
                <Square aria-hidden="true" className="h-3 w-3" /> Stop build
              </button>
              <button type="button" onClick={() => setConfirmStop(false)} className={secondary}>Keep building</button>
            </div>
          )
          : <button type="button" onClick={() => setConfirmStop(true)} className={lostText ? secondary : 'text-[12.5px] font-medium text-content-muted hover:text-status-danger'}>Stop this build</button>
      )}



      {/* Progress, evidence and questions support the decision above; they open by themselves only while agents work. */}
      <details open={live} className="group rounded-md border border-divider">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium text-content-secondary">
          <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 -rotate-90 transition-transform group-open:rotate-0" />
          Build details
          {orchestration.requirements.length > 0 && status !== 'awaiting_plan_approval' && <span className="font-normal tabular-nums text-content-muted">· checklist {covered} of {orchestration.requirements.length} with evidence</span>}
        </summary>
        <div className="space-y-5 border-t border-divider px-3 py-3">
          <BuildProgressTrack orchestration={orchestration} publications={publications} stepIndex={stepIndex} attention={Boolean(step.attention)} />
          <MemoryUsed orchestration={orchestration} />

          {orchestration.requirements.length > 0 && status !== 'awaiting_plan_approval' && (
            <section aria-label="Checklist" className="space-y-2">
              <h3 className="text-[13px] font-semibold text-content-secondary">Checklist <span className="font-normal tabular-nums text-content-muted">{covered} of {orchestration.requirements.length} with evidence</span></h3>
              <ul className="space-y-1.5">
                {orchestration.requirements.map(requirement => {
                  const proof = evidence.get(requirement.id);
                  return (
                    <li key={requirement.id} className="flex gap-2 text-[13px]">
                      {proof
                        ? <Check aria-label="Has evidence" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-success" />
                        : <Circle aria-label="No evidence yet" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-content-muted" />}
                      <span className="min-w-0">
                        <span className="text-content-secondary">{requirementText(requirement.description)}</span>
                        {proof && <span className="mt-0.5 block text-[11.5px] text-content-muted">{proof}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <section aria-label="Build conversation" className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-content-secondary"><MessageSquare aria-hidden="true" className="h-3.5 w-3.5" /> Ask about this build</h3>
            {conversation.privateToOwner
              ? <p className="text-[12.5px] text-content-muted">This build's conversation is private to the person who started it.</p>
              : (
                <>
                  {questionMessages.length > 0 && (
                    <ol className="max-h-64 space-y-2 overflow-y-auto">
                      {questionMessages.slice(-8).map(entry => (
                        <li key={entry.id} className={`rounded-md px-3 py-2 text-[12.5px] ${entry.messageType === 'build_milestone' ? 'border border-divider bg-surface' : entry.senderType === 'user' ? 'bg-surface-high' : 'bg-surface'}`}>
                          <span className="font-medium text-content">{entry.senderType === 'user' ? 'You' : 'Alpha'}</span>
                          <p className="mt-0.5 whitespace-pre-wrap text-content-secondary">{entry.content.length > 600 ? `${entry.content.slice(0, 597)}...` : entry.content}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                  {historyMessages.length > 0 && <details className="text-[12px] text-content-muted"><summary>Previous build activity</summary><ol className="max-h-56 space-y-2 overflow-auto pt-2">{historyMessages.slice(-8).map(entry => <li key={entry.id}><time>{new Date(entry.timestamp).toLocaleString()}</time><p className="whitespace-pre-wrap">{entry.content.slice(0, 1200)}</p></li>)}</ol></details>}
                  {can('manage_chat') && (
                    <form
                      className="flex items-end gap-2"
                      onSubmit={event => {
                        event.preventDefault();
                        void conversation.ask(question).then(sent => { if (sent) setQuestion(''); });
                      }}
                    >
                      <label htmlFor={`build-question-${issue.id}`} className="sr-only">Question about this build</label>
                      <textarea id={`build-question-${issue.id}`} rows={1} value={question} onChange={event => setQuestion(event.target.value)} placeholder="Why does the plan change this file?" className={textarea} />
                      <button type="submit" disabled={!question.trim() || conversation.sending} aria-label="Ask" className={primary}><Send aria-hidden="true" className="h-3.5 w-3.5" /></button>
                    </form>
                  )}
                  {conversation.error && <p role="alert" className="text-[12.5px] text-status-danger">{conversation.error}</p>}
                </>
              )}
          </section>
          {(role === 'dev' || role === 'admin') && snapshot && (
            <div className="flex max-h-[480px] min-h-0 flex-col rounded-md border border-divider">
                  <BuildReviewTab
                    projectId={issue.projectId}
                    build={{ runId: run.id, status, revision: run.revision, repository: run.repository, goal: run.goal, running, canControl: false, agents: buildAgentNodes(snapshot), orchestration }}
                    canStart={false}
                    canApprove={false}
                    busy={false}
                    error={null}
                  />
            </div>
          )}
        </div>
      </details>
    </div>
  );
};
