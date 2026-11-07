import type { BoardAgentChange, IssueStatus } from '@/shared/types';

/** How long an agent's change stays marked on its card, and how long Undo is offered. */
export const RECENT_MS = 30 * 60 * 1000;
export const UNDO_MS = 24 * 60 * 60 * 1000;

const sameLogin = (a?: string, b?: string) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());

/** The developer the agent acted for decides on held changes and can undo. */
export const isMine = (change: BoardAgentChange, login?: string) => sameLogin(change.actorLogin, login) || change.actorUserId === login;

export const decidedAt = (change: BoardAgentChange) => Date.parse(change.decidedAt ?? change.createdAt);

export function canUndo(change: BoardAgentChange, login: string | undefined, now = Date.now()): boolean {
  return change.status === 'applied' && change.action !== 'comment' && isMine(change, login) && now - decidedAt(change) <= UNDO_MS;
}

export const byWhom = (change: BoardAgentChange) => change.agentName + ' for ' + change.actorLogin;

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes + ' min ago';
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
  const days = Math.round(hours / 24);
  return days + (days === 1 ? ' day ago' : ' days ago');
}

export interface CardMark {
  kind: 'held' | 'recent';
  label: string;
  changeId: string;
}

/**
 * What to show on each card: a change waiting for confirmation wins over a
 * recent one. Text labels go with every visual cue.
 */
export function cardMarks(changes: BoardAgentChange[], now = Date.now()): Map<string, CardMark> {
  const marks = new Map<string, CardMark>();
  for (const change of changes) {
    if (!change.issueId) continue;
    if (change.status === 'held') {
      marks.set(change.issueId, { kind: 'held', label: 'Waiting for ' + change.actorLogin + ' to confirm', changeId: change.id });
    } else if (change.status === 'applied' && change.action !== 'comment' && now - decidedAt(change) <= RECENT_MS && !marks.has(change.issueId)) {
      marks.set(change.issueId, { kind: 'recent', label: 'Changed by ' + byWhom(change), changeId: change.id });
    }
  }
  return marks;
}

export interface GhostCard {
  changeId: string;
  column: IssueStatus;
  title: string;
  issueId?: string;
  label: string;
}

/** Held creates and moves, shown dashed in the column they would land in until confirmed or rejected. */
export function ghostCards(changes: BoardAgentChange[]): GhostCard[] {
  const ghosts: GhostCard[] = [];
  for (const change of changes) {
    if (change.status !== 'held') continue;
    if (change.action === 'create') {
      const fields = (change.input.fields ?? {}) as { status?: IssueStatus; title?: string };
      ghosts.push({ changeId: change.id, column: fields.status ?? 'todo', title: fields.title ?? 'New card', label: 'Proposed by ' + byWhom(change) });
    } else if (change.action === 'move') {
      const updates = (change.input.updates ?? {}) as { status?: IssueStatus };
      if (updates.status) {
        ghosts.push({ changeId: change.id, column: updates.status, issueId: change.issueId,
          title: String((change.before as { identifier?: string } | undefined)?.identifier ?? change.summary), label: 'Proposed move by ' + byWhom(change) });
      }
    }
  }
  return ghosts;
}

/** What a change did, field by field, for card history. */
export function changeDetails(change: BoardAgentChange): Array<{ field: string; before: string; after: string }> {
  const before = (change.before ?? {}) as Record<string, unknown>;
  const after = (change.after ?? {}) as Record<string, unknown>;
  const show = (value: unknown) => value === null || value === undefined || value === '' ? '(none)'
    : Array.isArray(value) ? (value.length ? value.map(item => typeof item === 'object' && item && 'title' in item ? String((item as { title: unknown }).title) : String(item)).join(', ') : '(none)')
    : String(value);
  return Object.keys(after)
    .filter(key => key !== 'updatedAt' && key !== 'identifier')
    .map(field => ({ field, before: show(before[field]), after: show(after[field]) }))
    .filter(row => row.before !== row.after);
}

