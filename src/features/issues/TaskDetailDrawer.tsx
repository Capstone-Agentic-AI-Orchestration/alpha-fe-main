import React, { useId, useState } from 'react';
import { Archive, ArrowUpRight, Bot, ExternalLink, GitBranch, GitPullRequest, MessageSquare, Plus, Send, Sparkles, X } from 'lucide-react';
import { useApp, useTabSessionState } from '@/app/AppContext';
import type { BoardAgentChange, Issue, IssuePriority, IssueStatus } from '@/shared/types';
import { AgentChangesList } from '@/features/board-agent/AgentChangesList';
import type { IssueBuildStatus } from '@/shared/services/apiService';
import { CopyButton } from '@/shared/components/CopyButton';
import { Modal } from '@/shared/components/Modal';
import { isEpic } from '@/features/board-build/epic';
import { FeatureSpecPanel } from '@/features/board-build/FeatureSpecPanel';
import { TaskBuildPanel, type SpecState } from '@/features/board-build/TaskBuildPanel';
import { useFeatureSpec } from '@/features/board-build/useTaskBuild';
import { isDesktop } from '@/shared/desktop';
import { TASK_PRIORITIES, TASK_STATUSES, nextStepFor, type NextStepAction } from './taskFlow';
import { DatePicker } from '@/shared/components/ui/date-picker';

interface TaskDetailDrawerProps {
  onOpenTask?: (id: string, projectId: string) => void;
  issue: Issue;
  /** Tab-session key prefix of the board this drawer belongs to. */
  sessionPrefix: string;
  build?: IssueBuildStatus;
  buildActive: boolean;
  canStartBuild: boolean;
  onClose: () => void;
  /** Remove the task after the user confirms the destructive action. */
  onRemove: (issue: Issue) => void;
  /** Status changes go through the board so Building and Done keep their confirmations. */
  onRequestStatus: (issue: Issue, status: IssueStatus) => void;
  onPlanBuild: (issue: Issue) => void;
  /** Open the chat this task's build runs in; absent when no such chat is known. */
  onOpenBuildChat?: (issue: Issue) => void;
  /** Open project chat with a hand-off message; absent for roles without chat. */
  onHandOff?: (issue: Issue) => void;
  /** A build decision was made on this task; the board re-reads build statuses. */
  onBuildChanged?: () => void;
  /** Changes agents made or proposed on this card, with before and after values. */
  agentChanges?: BoardAgentChange[];
  agentDecidingId?: string | null;
  onAgentDecide?: (id: string, action: 'approve' | 'reject' | 'undo') => void;
}

type DrawerTab = 'overview' | 'activity' | 'build';

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const formatTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date().toDateString() === date.toDateString();
  return today ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : `${formatDate(iso)}, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
};

/**
 * One task, and the one thing to do next with it.
 *
 * The status reads as a track you can click, the next step is chosen for the
 * reader's role, details sit in a plain table, and the description, activity
 * and build each get a tab. The comment box stays at the bottom so a note is
 * never more than a click away.
 */
export const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({
  issue,
  sessionPrefix,
  build,
  buildActive,
  canStartBuild,
  onClose,
  onRemove,
  onRequestStatus,
  onPlanBuild,
  onOpenBuildChat,
  onHandOff,
  onBuildChanged,
  onOpenTask,
  agentChanges = [],
  agentDecidingId,
  onAgentDecide,
}) => {
  const { updateIssue, addIssueComment, can, identity, currentUser, projects, issues } = useApp();
  const ids = useId();
  const canManageIssues = can('manage_issues');
  const [tab, setTab] = useTabSessionState<DrawerTab>(`${sessionPrefix}.drawerTab`, 'overview');
  const [newSubtask, setNewSubtask] = useTabSessionState<string>(`${sessionPrefix}.newSubtaskTitle`, '');
  const [comment, setComment] = useTabSessionState<string>(`${sessionPrefix}.newComment`, '');
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

  const project = projects.find(item => item.id === issue.projectId);
  const projectTasks = issues
    .filter(item => item.projectId === issue.projectId && item.id !== issue.id)
    .sort((left, right) => left.identifier.localeCompare(right.identifier));
  const parentTask = issue.parentIssueId ? projectTasks.find(item => item.id === issue.parentIssueId) : undefined;
  const childTasks = issues
    .filter(item => item.parentIssueId === issue.id)
    .sort((left, right) => left.identifier.localeCompare(right.identifier));
  const dependencies = issue.dependsOnIssueIds ?? [];
  const spec = useFeatureSpec(issue, isDesktop);
  const specState: SpecState = !spec.record ? 'none' : spec.record.status === 'approved' ? (spec.record.stale ? 'stale' : 'approved') : 'draft';
  // A task with a build under way sits in Building on the board; the track says the same.
  const shownStatus = buildActive && issue.status !== 'done' ? 'agent_running' : issue.status;
  const shownBranch = buildActive ? build?.branchName : issue.branchName;
  const statusIndex = TASK_STATUSES.findIndex(item => item.id === shownStatus);
  const done = issue.subtasks.filter(subtask => subtask.completed).length;
  const step = nextStepFor({
    status: issue.status,
    buildStatus: build?.status,
    blocker: build?.blocker,
    fresh: build?.fresh,
    requestStatus: build?.request?.status,
    buildActive,
    canManageIssues,
    canStartBuild,
    canHandOffToChat: Boolean(onHandOff),
    hasBuildChat: Boolean(onOpenBuildChat)
  });

  const postComment = () => {
    const content = comment.trim();
    if (!content) return;
    addIssueComment(issue.id, {
      id: `comm-${Date.now()}`,
      authorType: 'user',
      authorName: currentUser?.name || identity?.login || 'You',
      content,
      createdAt: new Date().toISOString()
    });
    setComment('');
    setTab('activity');
  };

  const run = (action: NextStepAction) => {
    switch (action) {
      case 'open_build': setTab('build'); break;
      case 'open_chat': onOpenBuildChat?.(issue); break;
      case 'handoff_chat': onHandOff?.(issue); break;
      case 'plan_build': onPlanBuild(issue); break;
      case 'move_todo': onRequestStatus(issue, 'todo'); break;
      case 'move_review': onRequestStatus(issue, 'review'); break;
      case 'mark_done': onRequestStatus(issue, 'done'); break;
      case 'reopen': onRequestStatus(issue, 'todo'); break;
      case 'request_changes':
        onRequestStatus(issue, 'in_progress');
        setTab('activity');
        document.getElementById(`${ids}-comment`)?.focus();
        break;
    }
  };

  const toggleSubtask = (subtaskId: string) =>
    updateIssue(issue.id, { subtasks: issue.subtasks.map(subtask => (subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask)) });

  const addSubtask = (event: React.FormEvent) => {
    event.preventDefault();
    const title = newSubtask.trim();
    if (!title) return;
    updateIssue(issue.id, { subtasks: [...issue.subtasks, { id: `sub-${Date.now()}`, title, completed: false }] });
    setNewSubtask('');
  };

  const tabButton = (id: DrawerTab, label: string, count?: number) => (
    <button
      type="button"
      role="tab"
      id={`${ids}-tab-${id}`}
      aria-selected={tab === id}
      aria-controls={`${ids}-panel`}
      onClick={() => setTab(id)}
      className={`relative inline-flex h-9 items-center gap-1.5 text-[13px] font-medium transition-colors ${tab === id ? 'text-content after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-link' : 'text-content-muted hover:text-content-secondary'}`}
    >
      {label}
      {count !== undefined && <span className="text-[11.25px] tabular-nums text-content-muted">{count}</span>}
    </button>
  );

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${ids}-title`}
      onKeyDown={event => { if (event.key === 'Escape') onClose(); }}
      className="absolute inset-y-0 right-0 z-30 flex w-full max-w-[640px] flex-col border-l border-divider bg-surface-raised text-sm shadow-2xl animate-slide-up"
    >
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-divider pl-5 pr-2 text-[12.5px] text-content-muted">
        <span className="font-mono text-xs text-content-secondary">{issue.identifier}</span>
        {isEpic(issue.labels) && <span className="rounded bg-selected px-1.5 text-[10.5px] font-semibold text-selected-content">Epic</span>}
        <CopyButton value={issue.identifier} label={`task ID ${issue.identifier}`} />
        {project && <span className="truncate">in {project.name}</span>}
        {canManageIssues && (
          <button
            type="button"
            onClick={() => setRemoveDialogOpen(true)}
            aria-label={`Archive task ${issue.identifier}`}
            title="Archive task"
            className="rounded-md p-1.5 text-content-muted transition-colors hover:bg-surface-high hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Archive aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Close task details" className="ml-auto rounded-md p-1.5 text-content-muted hover:bg-surface-high hover:text-content">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5">
        <label htmlFor={`${ids}-title`} className="sr-only">Title</label>
        <input
          id={`${ids}-title`}
          value={issue.title}
          readOnly={!canManageIssues}
          onChange={event => updateIssue(issue.id, { title: event.target.value })}
          className="mb-4 w-full rounded-md bg-transparent text-xl font-semibold tracking-tight text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />

        <ol aria-label="Status" className="mb-4 flex">
          {TASK_STATUSES.map((item, index) => {
            const past = index < statusIndex;
            const current = index === statusIndex;
            return (
              <li key={item.id} className="min-w-0 flex-1">
                <button
                  type="button"
                  aria-current={current ? 'step' : undefined}
                  disabled={!canManageIssues || current}
                  onClick={() => onRequestStatus(issue, item.id)}
                  title={canManageIssues ? `Move to ${item.label}` : item.label}
                  className={`group flex w-full flex-col items-start gap-1.5 pr-1.5 text-left text-[11.25px] font-medium disabled:cursor-default ${current ? 'text-content' : past ? 'text-content-secondary' : 'text-content-muted enabled:hover:text-content-secondary'}`}
                >
                  <span className="relative flex h-3 w-full items-center">
                    {index < TASK_STATUSES.length - 1 && (
                      <span aria-hidden="true" className={`absolute left-3.5 right-[-6px] top-[5.5px] h-px ${past ? 'bg-link' : 'bg-divider'}`} />
                    )}
                    <span
                      aria-hidden="true"
                      className={`relative z-[1] h-3 w-3 rounded-full border-[1.5px] ${past ? 'border-link bg-link' : current ? 'border-link bg-surface-raised ring-[3px] ring-selected' : 'border-control bg-surface-raised'}`}
                    >
                      {current && <span className="absolute inset-[2px] rounded-full bg-link" />}
                    </span>
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <div role="status" className="mb-5 flex gap-3 rounded-lg border border-divider bg-surface p-3.5">
          <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-selected text-link">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-content">{step.title}</p>
            <p className="mt-0.5 text-[12.5px] text-content-muted">{step.text}</p>
            {(step.primary || step.secondary) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {step.primary && (
                  <button type="button" onClick={() => run(step.primary!.action)} className="inline-flex h-8 items-center gap-2 rounded-md bg-action px-3 text-[12.5px] font-semibold text-on-action hover:bg-action-hover">
                    {(step.primary.action === 'handoff_chat' || step.primary.action === 'open_chat') && <MessageSquare className="h-3.5 w-3.5" />}
                    {step.primary.label}
                  </button>
                )}
                {step.secondary && (
                  <button type="button" onClick={() => run(step.secondary!.action)} className="inline-flex h-8 items-center rounded-md border border-divider px-3 text-[12.5px] font-medium text-content-secondary hover:bg-surface-high hover:text-content">
                    {step.secondary.label}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <dl className="mb-5 grid grid-cols-[110px_minmax(0,1fr)] border-t border-divider text-[12.5px]">
          <dt className="border-b border-divider py-2 text-content-muted">Priority</dt>
          <dd className="border-b border-divider py-1.5">
            <label htmlFor={`${ids}-priority`} className="sr-only">Priority</label>
            <select
              id={`${ids}-priority`}
              value={issue.priority}
              disabled={!canManageIssues}
              onChange={event => updateIssue(issue.id, { priority: event.target.value as IssuePriority })}
              className="h-7 rounded-md bg-transparent pr-6 text-content-secondary hover:bg-surface-high focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {TASK_PRIORITIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </dd>
          <dt className="border-b border-divider py-2 text-content-muted">Assignee</dt>
          <dd className="flex items-center gap-3 border-b border-divider py-2 text-content-secondary">
            <span className="truncate">{issue.assignedHuman || 'Unassigned'}</span>
            {canManageIssues && identity && (
              issue.assignedHuman === identity.login
                ? <button type="button" onClick={() => updateIssue(issue.id, { assignedHuman: '' })} className="text-[11.25px] font-medium text-content-muted hover:text-content">Unassign</button>
                : <button type="button" onClick={() => updateIssue(issue.id, { assignedHuman: identity.login })} className="text-[11.25px] font-medium text-link hover:text-link-hover">Assign to me</button>
            )}
          </dd>
          {issue.labels.length > 0 && <>
            <dt className="border-b border-divider py-2 text-content-muted">Labels</dt>
            <dd className="border-b border-divider py-2 text-content-secondary">{issue.labels.join(', ')}</dd>
          </>}
          {shownBranch && <>
            <dt className="border-b border-divider py-2 text-content-muted">Branch</dt>
            <dd className="flex min-w-0 items-center gap-1.5 border-b border-divider py-1.5 text-content-secondary">
              <GitBranch aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-content-muted" />
              <span className="truncate font-mono text-[11.5px]">{shownBranch}</span>
              <CopyButton value={shownBranch} label={`branch ${shownBranch}`} />
            </dd>
          </>}
          {issue.prUrl && <>
            <dt className="border-b border-divider py-2 text-content-muted">Pull request</dt>
            <dd className="border-b border-divider py-2">
              <a href={issue.prUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-link hover:text-link-hover">
                <GitPullRequest aria-hidden="true" className="h-3.5 w-3.5" />
                Open on GitHub
                <ExternalLink aria-hidden="true" className="h-3 w-3" />
              </a>
            </dd>
          </>}
          <dt className="border-b border-divider py-2 text-content-muted">Created</dt>
          <dd className="border-b border-divider py-2 text-content-secondary">
            {[issue.createdBy, formatDate(issue.createdAt)].filter(Boolean).join(' · ')}
          </dd>
        </dl>

        <div role="tablist" aria-label="Task sections" className="mb-4 flex gap-5 border-b border-divider">
          {tabButton('overview', 'Overview')}
          {tabButton('activity', 'Activity', issue.comments.length)}
          {tabButton('build', 'Build')}
        </div>

        <div id={`${ids}-panel`} role="tabpanel" aria-labelledby={`${ids}-tab-${tab}`}>
          {tab === 'overview' && (
            <div className="space-y-5">
              {(parentTask || childTasks.length > 0) && (
                <section aria-label="Related tasks" className="space-y-2 border-b border-divider pb-4">
                  {parentTask && (
                    <div>
                      <p className="mb-1 text-[11px] font-medium text-content-muted">Part of</p>
                      <button
                        type="button"
                        disabled={!onOpenTask}
                        onClick={() => onOpenTask?.(parentTask.id, parentTask.projectId)}
                        className="max-w-full truncate text-left text-[12.5px] font-medium text-link hover:underline disabled:cursor-default disabled:text-content-secondary disabled:no-underline"
                      >
                        {parentTask.identifier} · {parentTask.title}
                      </button>
                    </div>
                  )}
                  {childTasks.length > 0 && (
                    <div>
                      <p className="mb-1 text-[11px] font-medium text-content-muted">Work packages</p>
                      <ul className="space-y-1">
                        {childTasks.map(task => (
                          <li key={task.id}>
                            <button
                              type="button"
                              disabled={!onOpenTask}
                              onClick={() => onOpenTask?.(task.id, task.projectId)}
                              className="max-w-full truncate text-left text-[12.5px] text-link hover:underline disabled:cursor-default disabled:text-content-secondary disabled:no-underline"
                            >
                              {task.identifier} · {task.title}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}
              <section aria-labelledby={`${ids}-schedule`} className="border-b border-divider pb-4">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 id={`${ids}-schedule`} className="text-[13px] font-semibold text-content-secondary">Dates</h3>
                  <span className="text-[11px] text-content-muted">Due dates and plan dates are separate</span>
                </div>
                <label htmlFor={`${ids}-due-date`} className="mb-3 block max-w-xs space-y-1 text-[11.5px] text-content-muted">
                  <span className="block font-medium text-content-secondary">Due date</span>
                  <DatePicker
                    id={`${ids}-due-date`}
                    value={issue.dueDate ?? ''}
                    disabled={!canManageIssues}
                    onChange={value => updateIssue(issue.id, { dueDate: value })}
                    buttonClassName="h-8 w-full justify-start border-control bg-well px-2 text-[12px] text-content-secondary disabled:cursor-not-allowed disabled:opacity-60"
                    className="w-full"
                  />
                  <span className="block text-[10.5px]">Expected finish for this task.</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-[11.5px] text-content-muted">
                    <span className="block">Planned start</span>
                    <DatePicker
                      value={issue.plannedStartDate ?? ''}
                      disabled={!canManageIssues}
                      onChange={value => updateIssue(issue.id, { plannedStartDate: value })}
                      buttonClassName="h-8 w-full justify-start border-control bg-well px-2 text-[12px] text-content-secondary disabled:cursor-not-allowed disabled:opacity-60"
                      className="w-full"
                    />
                  </label>
                  <label className="space-y-1 text-[11.5px] text-content-muted">
                    <span className="block">Planned finish</span>
                    <DatePicker
                      value={issue.plannedEndDate ?? ''}
                      disabled={!canManageIssues}
                      onChange={value => updateIssue(issue.id, { plannedEndDate: value })}
                      buttonClassName="h-8 w-full justify-start border-control bg-well px-2 text-[12px] text-content-secondary disabled:cursor-not-allowed disabled:opacity-60"
                      className="w-full"
                    />
                  </label>
                </div>
                <fieldset className="mt-3">
                  <legend className="text-[11.5px] font-medium text-content-secondary">Depends on</legend>
                  <p className="mb-1.5 text-[11px] text-content-muted">Select tasks that need to finish before this task starts.</p>
                  {projectTasks.length === 0 ? (
                    <p className="rounded-md border border-dashed border-divider px-2.5 py-2 text-[11px] text-content-muted">No other tasks in this project yet.</p>
                  ) : (
                    <div className="max-h-36 overflow-y-auto rounded-md border border-divider bg-well p-1">
                      {projectTasks.map(task => {
                        const checked = dependencies.includes(task.id);
                        return (
                          <label key={task.id} className={`flex min-h-7 items-center gap-2 rounded px-2 text-[11.5px] ${canManageIssues ? 'cursor-pointer hover:bg-surface-high' : 'cursor-default opacity-60'}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!canManageIssues}
                              onChange={() => {
                                const next = checked
                                  ? dependencies.filter(id => id !== task.id)
                                  : [...dependencies, task.id];
                                updateIssue(issue.id, { dependsOnIssueIds: next });
                              }}
                              className="h-3.5 w-3.5 accent-brand-500"
                            />
                            <span className="shrink-0 font-mono text-[10px] text-content-muted">{task.identifier}</span>
                            <span className="truncate text-content-secondary">{task.title}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </fieldset>
              </section>

              <div>
                <label htmlFor={`${ids}-description`} className="sr-only">Description</label>
                <textarea
                  id={`${ids}-description`}
                  rows={5}
                  value={issue.description}
                  readOnly={!canManageIssues}
                  placeholder="No description yet."
                  onChange={event => updateIssue(issue.id, { description: event.target.value })}
                  className="w-full resize-y rounded-md border border-transparent bg-transparent p-0 text-sm leading-relaxed text-content-secondary placeholder-content-muted hover:border-divider focus:border-control focus:bg-well focus:p-2.5 focus:outline-none"
                />
              </div>

              {/* Writing a spec is an agent step, so only developers start one; anyone sees a spec that exists. */}
              {isDesktop && (spec.record || (can('run_builds') && can('manage_chat'))) && <FeatureSpecPanel issue={issue} spec={spec} />}

              <section aria-labelledby={`${ids}-subtasks`}>
                <div className="mb-2 flex items-center gap-2.5">
                  <h3 id={`${ids}-subtasks`} className="text-[13px] font-semibold text-content-secondary" title="The build must meet each open item">Checklist</h3>
                  {issue.subtasks.length > 0 && <>
                    <span className="text-xs tabular-nums text-content-muted">{done} of {issue.subtasks.length}</span>
                    <span aria-hidden="true" className="relative h-1 w-16 overflow-hidden rounded-full bg-surface-high">
                      <span className="absolute inset-y-0 left-0 rounded-full bg-status-success" style={{ width: `${Math.round((done / issue.subtasks.length) * 100)}%` }} />
                    </span>
                  </>}
                </div>
                <ul className="space-y-0.5">
                  {issue.subtasks.map(subtask => (
                    <li key={subtask.id} className="flex min-h-8 items-center gap-2.5 rounded-md px-2 hover:bg-surface-high">
                      <input id={`${ids}-${subtask.id}`} type="checkbox" checked={subtask.completed} disabled={!canManageIssues} onChange={() => toggleSubtask(subtask.id)} className="h-3.5 w-3.5 accent-brand-500" />
                      <label htmlFor={`${ids}-${subtask.id}`} className={`flex-1 cursor-pointer text-[13px] ${subtask.completed ? 'text-content-muted line-through' : 'text-content-secondary'}`}>{subtask.title}</label>
                    </li>
                  ))}
                </ul>
                {canManageIssues && (
                  <form onSubmit={addSubtask} className="mt-1.5 flex h-8 items-center gap-2 rounded-md border border-dashed border-divider px-2.5">
                    <Plus aria-hidden="true" className="h-3.5 w-3.5 text-content-muted" />
                    <label htmlFor={`${ids}-new-subtask`} className="sr-only">New checklist item</label>
                    <input id={`${ids}-new-subtask`} value={newSubtask} onChange={event => setNewSubtask(event.target.value)} placeholder="Add a checklist item" className="min-w-0 flex-1 bg-transparent text-[13px] text-content placeholder-content-muted focus:outline-none" />
                    <button type="submit" disabled={!newSubtask.trim()} className="text-xs font-semibold text-link disabled:opacity-40">Add</button>
                  </form>
                )}
              </section>
            </div>
          )}

          {tab === 'activity' && (
            <>
            {agentChanges.length > 0 && (
              <section aria-label="Agent changes" className="mb-4 rounded-lg border border-divider">
                <p className="px-3 pt-2 text-[11.5px] font-semibold text-content-secondary">Agent changes</p>
                <AgentChangesList changes={agentChanges} login={identity?.login} busyId={agentDecidingId} onDecide={onAgentDecide} showDetails />
              </section>
            )}
            {issue.comments.length === 0
              ? <p className="text-[13px] text-content-muted">No activity yet. Comments and agent updates appear here.</p>
              : (
                <ol className="space-y-4">
                  {issue.comments.map(entry => (
                    <li key={entry.id} className="flex gap-3">
                      <span aria-hidden="true" className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-high text-content-muted">
                        {entry.authorType === 'agent' ? <Bot className="h-3 w-3 text-status-info" /> : entry.authorType === 'system' ? <Sparkles className="h-3 w-3" /> : <span className="text-[9px] font-semibold text-content-secondary">{entry.authorName.slice(0, 1).toUpperCase()}</span>}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] text-content-muted">
                          <span className="font-medium text-content">{entry.authorName}</span>
                          <span className="ml-2 text-[11.25px] tabular-nums">{formatTime(entry.createdAt)}</span>
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-content-secondary">{entry.content}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}

          {tab === 'build' && (
            <div className="space-y-4">
              <TaskBuildPanel issue={issue} build={build} canStartBuild={canStartBuild} specState={specState} onPlanBuild={onPlanBuild} onBuildChanged={onBuildChanged} onOpenTask={onOpenTask} />
              {/* A build started from chat before the board took over still opens in its chat while the Chat tab is on. */}
              {build && onOpenBuildChat && (
                <button type="button" onClick={() => onOpenBuildChat(issue)} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-link hover:text-link-hover">
                  Open in chat <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={event => { event.preventDefault(); postComment(); }}
        className="shrink-0 border-t border-divider p-3"
      >
        <div className="rounded-md border border-control bg-well focus-within:ring-2 focus-within:ring-focus">
          <label htmlFor={`${ids}-comment`} className="sr-only">Comment</label>
          <textarea
            id={`${ids}-comment`}
            rows={2}
            value={comment}
            onChange={event => setComment(event.target.value)}
            onKeyDown={event => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                postComment();
              }
            }}
            placeholder="Leave a comment"
            className="block w-full resize-none bg-transparent px-3 pb-1 pt-2.5 text-[13.5px] text-content placeholder-content-muted focus:outline-none"
          />
          <div className="flex items-center gap-2 px-3 pb-2 text-[11.25px] text-content-muted">
            <span>Ctrl ↵ to send</span>
            <button type="submit" disabled={!comment.trim()} className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md bg-action px-2.5 text-xs font-semibold text-on-action hover:bg-action-hover disabled:opacity-40">
              <Send aria-hidden="true" className="h-3.5 w-3.5" /> Post comment
            </button>
          </div>
        </div>
      </form>

      <Modal
        isOpen={removeDialogOpen}
        onClose={() => setRemoveDialogOpen(false)}
        title="Archive task?"
        subtitle={`${issue.identifier} · ${issue.title}`}
        maxWidth="max-w-md"
        footer={(
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRemoveDialogOpen(false)}
              className="rounded-md border border-divider px-3.5 py-2 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-high hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Keep task
            </button>
            <button
              type="button"
              disabled={buildActive}
              onClick={() => {
                if (buildActive) return;
                setRemoveDialogOpen(false);
                onRemove(issue);
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-action px-3.5 py-2 text-sm font-semibold text-on-action transition-colors hover:bg-action-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Archive aria-hidden="true" className="h-3.5 w-3.5" />
              Archive task
            </button>
          </div>
        )}
      >
        <div className="space-y-3 text-sm leading-relaxed text-content-secondary">
          <p>Archiving takes the task off the board. Its subtasks, comments and history are kept, and you can restore it from Archived.</p>
          {buildActive ? (
            <p role="alert" className="rounded-md border border-status-warning-border bg-status-warning-subtle px-3 py-2 text-status-warning">
              This task has an active build. Wait for the build to stop before archiving it.
            </p>
          ) : (
            <p>A linked GitHub issue is left as it is.</p>
          )}
        </div>
      </Modal>
    </aside>
  );
};
