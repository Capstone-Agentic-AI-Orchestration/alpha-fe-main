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
  if (action === 'reply') return { prompt: 'The project manager has a question', action: 'Reply' };
  if (action === 'agree_scope') return { prompt: 'A plan is ready for you to approve', action: 'Review plan' };
  if (action === 'review_result') return { prompt: 'Your result is ready to check', action: 'Check the result' };
  return null;
}

/**
 * The client's name as they gave it, or '' when the account has none. An email address is never
 * a name: older portal proposals stored the account email where the name belongs.
 */
export function clientDisplayName(name?: string | null, email?: string | null): string {
  const trimmed = name?.trim().replace(/\s+/g, ' ') ?? '';
  if (!trimmed || /^[^\s@]+@[^\s@]+$/.test(trimmed)) return '';
  return email && trimmed.toLowerCase() === email.trim().toLowerCase() ? '' : trimmed;
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

type RequestWithLink = RequestLike & Partial<Pick<ClientProjectRequestItem, 'projectLinkStatus'>>;

/** Long generated references stay unique in a title attribute; rows show a readable prefix. */
export function shortReference(reference: string): string {
  const match = /^([A-Z]+-)([0-9A-F]{12,})$/i.exec(reference);
  return match ? match[1] + match[2].slice(0, 6).toUpperCase() : reference;
}

const NEXT_FOR_ACTION: Record<NonNullable<ClientProjectRequestItem['requestedAction']>, string> = {
  reply: 'reply to the project manager’s question',
  agree_scope: 'approve the plan so the work can start',
  review_result: 'check the result, then accept it or ask for a fix',
};
const NEXT_FOR_STATUS: Partial<Record<ClientProjectRequestItem['status'], string>> = {
  received: 'the project manager reviews your request',
  under_review: 'the project manager prepares the plan',
  awaiting_client: 'the project manager sends the next update',
  in_progress: 'the project manager shares the result',
  ready_for_review: 'tell the project manager if anything looks wrong',
  on_hold: 'the project manager updates you when work resumes',
};

/** One short "Next:" line for a request in a list; null once the request has ended. */
export function clientNextLine(item: RequestWithLink): string | null {
  if (TERMINAL.has(item.status)) return null;
  if (item.projectLinkStatus === 'pending_review') return 'the project manager confirms which project this belongs to';
  if (item.requestedAction) return NEXT_FOR_ACTION[item.requestedAction];
  return NEXT_FOR_STATUS[item.status] ?? null;
}

const WHAT_NEXT_FOR_ACTION: Record<NonNullable<ClientProjectRequestItem['requestedAction']>, string> = {
  reply: 'Once you reply below, the project manager picks it up from there.',
  agree_scope: 'Once you approve, the project manager starts the work. It moves to In progress here, and you get a notification when the result is ready.',
  review_result: 'If you accept, the request is finished. If you ask for a fix, the project manager makes the change and shares it again.',
};
const WHAT_NEXT_FOR_STATUS: Partial<Record<ClientProjectRequestItem['status'], string>> = {
  received: 'The project manager will read your request, then send a plan or ask a question here.',
  under_review: 'The project manager is preparing the plan. You get a notification when there is something to approve.',
  awaiting_client: 'The project manager will post the next update here.',
  in_progress: 'When the work is done, the project manager shares the result here for you to check.',
  ready_for_review: 'If anything looks wrong, tell the project manager in the conversation below.',
  on_hold: 'The project manager will update you here when work resumes.',
};

/** What the client can expect after the current step, in one or two sentences; null once the request has ended. */
export function clientWhatNext(item: RequestLike): string | null {
  if (TERMINAL.has(item.status)) return null;
  if (item.requestedAction) return WHAT_NEXT_FOR_ACTION[item.requestedAction];
  return WHAT_NEXT_FOR_STATUS[item.status] ?? null;
}

/** The five steps, each with one plain sentence, for the Requests page guide. */
export const CLIENT_STEP_GUIDE: Array<{ label: string; detail: string }> = [
  { label: 'Received', detail: 'The project manager reads your request.' },
  { label: 'Planning', detail: 'They send a plan. You approve it or ask for changes.' },
  { label: 'In progress', detail: 'The work happens. Nothing is needed from you.' },
  { label: 'Ready for you', detail: 'Check the result. Accept it or ask for a fix.' },
  { label: 'Done', detail: 'The request is finished. Its history stays here.' },
];

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
