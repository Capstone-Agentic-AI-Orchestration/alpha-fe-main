import type { IssueBuildStatus } from '@/shared/services/apiService';
import type { BoardAgentChange, Issue, Project } from '@/shared/types';
import type { PmClientSummary } from '@/features/ticketing/pmApi';

/**
 * Everything waiting on this person, across projects, as one list.
 *
 * Each item comes from data a screen already loads: a build's status, agent board changes held
 * for confirmation, clients waiting on their project manager, and new inquiries. Nothing is
 * stored for this list; it is rebuilt from those sources every time.
 */
export type AttentionGroup = 'approve' | 'answer' | 'review';

export const ATTENTION_GROUPS: ReadonlyArray<{ id: AttentionGroup; label: string; empty: string }> = [
  { id: 'approve', label: 'Approve', empty: 'No plans waiting for approval.' },
  { id: 'answer', label: 'Answer', empty: 'Nothing is stuck waiting on an answer from you.' },
  { id: 'review', label: 'Review', empty: 'Nothing is waiting for your review.' },
];

/** Where an item is finished: the screen, and what to select on it. */
export type AttentionTarget =
  | { view: 'issues'; projectId: string; issueId?: string }
  | { view: 'clients'; clientKey: string }
  | { view: 'inquiries' };

export interface AttentionItem {
  id: string;
  group: AttentionGroup;
  title: string;
  detail: string;
  /** When the item started waiting, when the source says. */
  since?: string;
  action: string;
  target: AttentionTarget;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** A build waiting on a person: a plan to approve, a stop to look at, or finished work to review. */
export function buildAttention(build: IssueBuildStatus, issue: Issue | undefined, project: Project | undefined): AttentionItem | null {
  const name = issue?.title ?? 'a task';
  const detail = [project?.name, issue?.identifier].filter(Boolean).join(' · ');
  const base = { id: 'build:' + build.runId + ':' + build.issueId, detail, since: build.updatedAt,
    target: { view: 'issues' as const, projectId: build.projectId, issueId: build.issueId } };
  if (build.workspaceLost || build.status === 'blocked' || build.status === 'recovery_required') {
    return { ...base, group: 'answer', title: 'Build stopped: ' + name, action: 'See what it needs' };
  }
  if (build.status === 'awaiting_plan_approval') return { ...base, group: 'approve', title: 'Plan ready: ' + name, action: 'Review plan' };
  if (build.status === 'awaiting_approval') return { ...base, group: 'review', title: 'Ready for review: ' + name, action: 'Review changes' };
  return null;
}

/** Agent changes to one project's board, held until someone confirms them. */
export function agentChangesAttention(changes: readonly BoardAgentChange[], project: Project): AttentionItem | null {
  const held = changes.filter(change => change.status === 'held');
  if (!held.length) return null;
  const oldest = held.map(change => change.createdAt).sort()[0];
  const onlyIssue = held.every(change => change.issueId && change.issueId === held[0].issueId) ? held[0].issueId : undefined;
  return {
    id: 'agent-changes:' + project.id,
    group: 'review',
    title: plural(held.length, 'board change from an agent is', 'board changes from agents are') + ' waiting for you',
    detail: project.name,
    since: oldest,
    action: 'Confirm',
    target: { view: 'issues', projectId: project.id, ...(onlyIssue ? { issueId: onlyIssue } : {}) },
  };
}

/** A client with requests their project manager must act on, or replies nobody has read. */
export function clientAttention(client: PmClientSummary): AttentionItem | null {
  const needs = client.tickets.needsPm;
  const unread = client.tickets.unreadReplies ?? 0;
  if (!needs && !unread) return null;
  const parts = [needs ? plural(needs, 'request needs', 'requests need') + ' you' : '', unread ? plural(unread, 'unread reply', 'unread replies') : ''];
  return {
    id: 'client:' + client.key,
    group: 'answer',
    title: client.displayName + ' is waiting on you',
    detail: parts.filter(Boolean).join(' · '),
    since: client.lastActivityAt,
    action: 'Open client',
    target: { view: 'clients', clientKey: client.key },
  };
}

/** New inquiries nobody has handled. `more` says the count is only the first page. */
export function inquiriesAttention(count: number, more: boolean, oldest?: string): AttentionItem | null {
  if (!count) return null;
  return {
    id: 'inquiries',
    group: 'answer',
    title: (more ? count + '+ new inquiries' : plural(count, 'new inquiry', 'new inquiries')) + ' to answer',
    detail: 'Requests that are not a client project yet',
    since: oldest,
    action: 'Open inquiries',
    target: { view: 'inquiries' },
  };
}

/** Oldest first inside each group: the longest wait is the most urgent. */
export function sortAttention(items: readonly AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => (a.since ?? '').localeCompare(b.since ?? ''));
}

