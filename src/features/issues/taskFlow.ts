import type { Issue, IssuePriority, IssueStatus } from '@/shared/types';

/**
 * The board's lifecycle, in the order a task moves through it.
 *
 * The details drawer draws this as a track you can click, so the order here is
 * the order people read left to right.
 */
export const TASK_STATUSES: { id: IssueStatus; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'Todo' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'agent_running', label: 'Building' },
  { id: 'review', label: 'In review' },
  { id: 'done', label: 'Done' }
];

export const TASK_PRIORITIES: { id: IssuePriority; label: string }[] = [
  { id: 'urgent', label: 'Urgent' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
  { id: 'none', label: 'No priority' }
];

export const statusLabel = (status: IssueStatus) =>
  TASK_STATUSES.find(item => item.id === status)?.label ?? status;

export const priorityLabel = (priority: IssuePriority) =>
  TASK_PRIORITIES.find(item => item.id === priority)?.label ?? priority;

/** Build states in which the build, not the person, is what the task waits on. */
export const BUILD_DECISION_STATUSES = new Set(['awaiting_plan_approval', 'awaiting_approval', 'blocked', 'recovery_required']);

/**
 * Subtasks suggested from what the author already wrote.
 *
 * Only the description is used: bullet or numbered lines become one subtask
 * each, otherwise each sentence does. Nothing is invented, which is the point —
 * the old "agent" mode added three fixed subtasks to every task whatever it
 * said, and nobody could tell them from real work.
 */
export function suggestSubtasks(description: string, limit = 6): string[] {
  const text = description.trim();
  if (!text) return [];
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const listed = lines
    .filter(line => /^([-*•]|\d+[.)])\s+/.test(line))
    .map(line => line.replace(/^([-*•]|\d+[.)])\s+/, ''));
  const pieces = listed.length
    ? listed
    : text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of pieces) {
    const cleaned = raw.trim().replace(/[.;:!?]+$/, '');
    if (cleaned.split(/\s+/).length < 3) continue;
    const sentence = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    const key = sentence.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(sentence.length > 140 ? `${sentence.slice(0, 137)}…` : sentence);
    if (result.length >= limit) break;
  }
  return result;
}

/** The message a developer's chat opens with when they pick a task up from the board. */
export function taskHandoffMessage(issue: Pick<Issue, 'identifier' | 'title'>): string {
  return `Please work on ${issue.identifier}: ${issue.title.trim().replace(/[.!?]+$/, '')}.`;
}

/**
 * What the agent receives with a hand-off: the typed message, then the task.
 *
 * The person sees and edits only their own sentence; the task's description and
 * open subtasks travel with it so the agent does not have to ask for them.
 */
export function taskHandoffContext(issue: Pick<Issue, 'identifier' | 'title' | 'description' | 'subtasks'>): string {
  const parts = [`Task ${issue.identifier}: ${issue.title.trim()}`];
  const description = issue.description?.trim();
  if (description) parts.push(description.slice(0, 3_500));
  const open = issue.subtasks.filter(subtask => !subtask.completed).map(subtask => `- ${subtask.title}`);
  if (open.length) parts.push(`Open subtasks:\n${open.join('\n')}`);
  return parts.join('\n\n');
}

export type NextStepAction =
  | 'open_chat'
  | 'handoff_chat'
  | 'plan_build'
  | 'move_todo'
  | 'move_review'
  | 'mark_done'
  | 'request_changes'
  | 'reopen';

export interface NextStep {
  title: string;
  text: string;
  primary?: { label: string; action: NextStepAction };
  secondary?: { label: string; action: NextStepAction };
}

export interface NextStepInput {
  status: IssueStatus;
  /** Latest Orchestrator build status for the task, if any. */
  buildStatus?: string;
  buildActive: boolean;
  canManageIssues: boolean;
  canStartBuild: boolean;
  /** The role can use project chat, so a task can be handed to it. */
  canHandOffToChat: boolean;
  /** A chat thread already exists for this task's build. */
  hasBuildChat: boolean;
}

/**
 * The one thing to do next on a task, for this person.
 *
 * The drawer used to offer every control at once and leave the reader to work
 * out which mattered. This picks one primary action from the task's status, its
 * build, and the reader's role, and says why.
 */
export function nextStepFor(input: NextStepInput): NextStep {
  const chat = input.hasBuildChat ? { label: 'Open in chat', action: 'open_chat' as const } : undefined;
  if (input.buildActive) {
    switch (input.buildStatus) {
      case 'awaiting_plan_approval':
        return { title: 'Plan ready to approve', text: 'The Orchestrator drafted a plan. Review it in the project chat; nothing in the code changes until it is approved.', primary: chat };
      case 'awaiting_approval':
        return { title: 'Ready for your review', text: 'The build finished. Review the changes in the project chat, then approve them or ask for changes.', primary: chat };
      case 'blocked':
      case 'recovery_required':
        return { title: 'The build needs you', text: 'The build stopped and is waiting for direction. Answer it in the project chat to continue.', primary: chat };
      case 'paused':
        return { title: 'Build paused', text: 'Resume it from the project chat when you are ready.', primary: chat };
      default:
        return { title: 'Building now', text: 'The Orchestrator is working on this task. Follow each step in the project chat.', primary: chat };
    }
  }

  const handoff = input.canHandOffToChat ? { label: 'Work on this in chat', action: 'handoff_chat' as const } : undefined;
  const plan = input.canStartBuild ? { label: 'Plan a build', action: 'plan_build' as const } : undefined;

  switch (input.status) {
    case 'done':
      return {
        title: 'Done',
        text: 'This task is finished.',
        secondary: input.canManageIssues ? { label: 'Reopen', action: 'reopen' } : undefined
      };
    case 'review':
      if (handoff && !input.canManageIssues) {
        return { title: 'In review', text: 'Waiting for a reviewer. If changes come back, pick it up in chat.', primary: handoff };
      }
      return {
        title: 'Ready for review',
        text: 'Check the work, then mark it done or send it back with a comment.',
        primary: input.canManageIssues ? { label: 'Mark done', action: 'mark_done' } : undefined,
        secondary: input.canManageIssues ? { label: 'Request changes', action: 'request_changes' } : undefined
      };
    case 'backlog':
      return {
        title: 'Not planned yet',
        text: 'Move it to Todo when it is ready to be picked up.',
        primary: input.canManageIssues ? { label: 'Move to Todo', action: 'move_todo' } : undefined,
        secondary: handoff
      };
    case 'in_progress':
      return handoff
        ? {
            title: 'Pick this up in chat',
            text: 'Opens the project chat with a message ready to send and this task attached. Nothing is sent until you press Send.',
            primary: handoff,
            secondary: input.canManageIssues ? { label: 'Move to review', action: 'move_review' } : undefined
          }
        : {
            title: 'In progress',
            text: 'Move it to review when the work is ready to check.',
            primary: input.canManageIssues ? { label: 'Move to review', action: 'move_review' } : undefined
          };
    default:
      return handoff
        ? {
            title: 'Pick this up in chat',
            text: 'Opens the project chat with a message ready to send and this task attached. Nothing is sent until you press Send.',
            primary: handoff,
            secondary: plan
          }
        : {
            title: plan ? 'Ready to build' : 'Ready for a developer',
            text: plan
              ? 'The Orchestrator drafts a plan and picks an agent for each step. Nothing in the code changes until the plan is approved.'
              : 'A developer will plan and run this task. You can review the resulting work here.',
            primary: plan
          };
  }
}

/** Two-letter initials for a person's avatar. */
export function initialsOf(name: string): string {
  return name.replace(/[^a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
}
