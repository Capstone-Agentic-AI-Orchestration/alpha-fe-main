import type { ClientProjectRequestItem } from './clientApi';

/**
 * Plain-language helpers for the signed-in client portal. Display only: the server
 * still decides which actions are allowed.
 */

const TERMINAL = new Set(['closed', 'declined', 'cancelled']);

export type ClientRequestGroup = 'needs_you' | 'in_progress' | 'done';
export const CLIENT_REQUEST_GROUPS: Array<{ id: ClientRequestGroup; label: string }> = [
  { id: 'needs_you', label: 'Needs you' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'done', label: 'Done' },
];

type RequestLike = Pick<ClientProjectRequestItem, 'status' | 'requestedAction'>;

export function clientRequestGroup(item: RequestLike): ClientRequestGroup {
  if (TERMINAL.has(item.status)) return 'done';
  return item.requestedAction ? 'needs_you' : 'in_progress';
}

/** What the client is being asked to do, phrased as a prompt and a one-to-three word action. */
export function clientNextStep(action: ClientProjectRequestItem['requestedAction']): { prompt: string; action: string } | null {
  if (action === 'reply') return { prompt: 'Your project manager has a question', action: 'Reply' };
  if (action === 'agree_scope') return { prompt: 'A plan is ready for you to approve', action: 'Review plan' };
  if (action === 'review_result') return { prompt: 'Your result is ready to check', action: 'Check the result' };
  return null;
}

export function clientGreeting(now = new Date()): string {
  const hour = now.getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

/** "2 hours ago", "yesterday", or a short date for anything older than a week. */
export function relativeTime(value: string, now = Date.now()): string {
  const then = Date.parse(value);
  if (!Number.isFinite(then)) return '';
  const minutes = Math.floor((now - then) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const date = new Date(then);
  return date.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', ...(date.getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' as const } : {}),
  });
}

/**
 * Which of the five client steps (0-4, see CLIENT_PROGRESS_LABELS) a listed request is on, using only
 * the fields a list row has. Mirrors clientProgressSteps; returns null where the row alone cannot tell
 * (a question from the project manager can come at several steps) or where a path would mislead.
 */
export function listProgressIndex(item: RequestLike): number | null {
  switch (item.status) {
    case 'received': return 0;
    case 'in_progress': return 2;
    case 'ready_for_review': return 3;
    case 'under_review':
    case 'awaiting_client':
      return item.requestedAction === 'agree_scope' ? 1 : item.requestedAction === 'review_result' ? 3 : null;
    default: return null;
  }
}

/** "Today", "Yesterday", or a short date, for grouping a timeline by day. */
export function dayLabel(value: string, now = Date.now()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const startOfDay = (time: number) => { const day = new Date(time); day.setHours(0, 0, 0, 0); return day.getTime(); };
  const days = Math.round((startOfDay(now) - startOfDay(date.getTime())) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', ...(date.getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' as const } : {}),
  });
}
