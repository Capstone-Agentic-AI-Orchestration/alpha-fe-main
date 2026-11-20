import type { TicketChatMessage } from './TicketChat';

/**
 * One conversation per client and project: the project thread, each request
 * made there and its messages, an accepted proposal's clarifications, tasks
 * linked to requests, and the request checklist, in time order.
 */
export type ConversationItemKind = 'message' | 'note' | 'request' | 'clarification' | 'task_linked' | 'request_done' | 'request_reopened';
export interface ConversationItem {
  id: string;
  kind: ConversationItemKind;
  author: 'client' | 'pm';
  body: string;
  createdAt: string;
  request: { ticketId: string; reference: string; title: string } | null;
  task: { issueId: string; identifier: string; title: string } | null;
}

export type RequestChecklistStatus = 'open' | 'in_progress' | 'ready_to_check' | 'done' | 'declined' | 'cancelled';
export interface ConversationLinkedTask { issueId: string; identifier: string; title: string; status: string }
export interface ConversationRequest {
  ticketId: string;
  workspaceId: string;
  reference: string;
  title: string;
  description: string;
  ticketStatus: string;
  checklist: RequestChecklistStatus;
  doneBy: 'client' | 'pm' | null;
  doneAt: string | null;
  createdAt: string;
  linkedTasks: ConversationLinkedTask[];
}

export const CHECKLIST_LABEL: Record<RequestChecklistStatus, string> = {
  open: 'Open', in_progress: 'In progress', ready_to_check: 'Ready to check', done: 'Done',
  declined: 'Not going ahead', cancelled: 'Cancelled',
};

/** A request can be ticked or reopened unless it was never taken on, or is formally finished. */
export function canToggleRequest(request: ConversationRequest): boolean {
  if (request.checklist === 'declined' || request.checklist === 'cancelled') return false;
  return !(request.checklist === 'done' && request.ticketStatus === 'closed');
}

const KINDS = new Set<ConversationItemKind>(['message', 'note', 'request', 'clarification', 'task_linked', 'request_done', 'request_reopened']);
const CHECKLIST = new Set<RequestChecklistStatus>(['open', 'in_progress', 'ready_to_check', 'done', 'declined', 'cancelled']);
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
function invalid(): never { throw new Error('Conversation response is invalid.'); }

export function parseConversation(value: unknown): { items: ConversationItem[]; clientId?: string } {
  if (!record(value) || !Array.isArray(value.items)) invalid();
  const items = value.items.map((raw): ConversationItem => {
    if (!record(raw) || !nonEmpty(raw.id) || !KINDS.has(raw.kind as ConversationItemKind)
      || (raw.author !== 'client' && raw.author !== 'pm') || !text(raw.body) || !nonEmpty(raw.createdAt)) invalid();
    const request = raw.request === null || raw.request === undefined ? null
      : record(raw.request) && nonEmpty(raw.request.ticketId) && text(raw.request.reference) && text(raw.request.title)
        ? { ticketId: raw.request.ticketId, reference: raw.request.reference, title: raw.request.title } : invalid();
    const task = raw.task === null || raw.task === undefined ? null
      : record(raw.task) && nonEmpty(raw.task.issueId) && text(raw.task.identifier) && text(raw.task.title)
        ? { issueId: raw.task.issueId, identifier: raw.task.identifier, title: raw.task.title } : invalid();
    return { id: raw.id, kind: raw.kind as ConversationItemKind, author: raw.author, body: raw.body, createdAt: raw.createdAt, request, task };
  });
  return nonEmpty(value.clientId) ? { items, clientId: value.clientId } : { items };
}

export function parseConversationRequest(raw: unknown): ConversationRequest {
  if (!record(raw) || !nonEmpty(raw.ticketId) || !nonEmpty(raw.workspaceId) || !text(raw.reference) || !text(raw.title)
    || !text(raw.description) || !text(raw.ticketStatus) || !CHECKLIST.has(raw.checklist as RequestChecklistStatus)
    || !(raw.doneBy === null || raw.doneBy === 'client' || raw.doneBy === 'pm')
    || !(raw.doneAt === null || text(raw.doneAt)) || !nonEmpty(raw.createdAt) || !Array.isArray(raw.linkedTasks)) invalid();
  const linkedTasks = raw.linkedTasks.map(task => {
    if (!record(task) || !nonEmpty(task.issueId) || !text(task.identifier) || !text(task.title) || !text(task.status)) invalid();
    return { issueId: task.issueId, identifier: task.identifier, title: task.title, status: task.status };
  });
  return { ticketId: raw.ticketId, workspaceId: raw.workspaceId, reference: raw.reference, title: raw.title,
    description: raw.description, ticketStatus: raw.ticketStatus, checklist: raw.checklist as RequestChecklistStatus,
    doneBy: raw.doneBy, doneAt: raw.doneAt as string | null, createdAt: raw.createdAt, linkedTasks };
}

export function parseConversationRequests(value: unknown): { items: ConversationRequest[] } {
  if (!record(value) || !Array.isArray(value.items)) invalid();
  return { items: value.items.map(parseConversationRequest) };
}

/** One line for a checklist or task event, from the reader's side. */
function eventLine(item: ConversationItem, role: 'client' | 'pm'): string {
  const title = item.request ? `“${item.request.title}”` : 'a request';
  const who = item.author === role ? 'You' : item.author === 'pm' ? (role === 'client' ? 'Your project manager' : 'A project manager') : 'The client';
  if (item.kind === 'task_linked') {
    return role === 'pm'
      ? `${item.task?.identifier ?? 'A task'} ${item.task?.title ? `“${item.task.title}” ` : ''}was linked to ${title}`
      : `Your project manager added a task for ${title}${item.task?.title ? `: ${item.task.title}` : ''}`;
  }
  if (item.kind === 'request_done') return `${who} marked ${title} done`;
  return `${who} reopened ${title}`;
}

/** The conversation as chat entries; actions are added per entry by the caller. */
export function conversationChatMessages(items: readonly ConversationItem[], role: 'client' | 'pm',
  actionsFor?: (item: ConversationItem) => TicketChatMessage['actions']): TicketChatMessage[] {
  return items.map(item => {
    const actions = actionsFor?.(item);
    if (item.kind === 'task_linked' || item.kind === 'request_done' || item.kind === 'request_reopened') {
      return { id: item.id, author: item.author, kind: 'event', body: eventLine(item, role), createdAt: item.createdAt };
    }
    if (item.kind === 'request') {
      return { id: item.id, author: item.author, kind: 'request', heading: item.request?.title ?? 'New request',
        tag: 'New request', body: item.body, createdAt: item.createdAt, actions };
    }
    const tag = item.kind === 'clarification' ? 'Project proposal'
      : item.request ? `Re: ${item.request.title}` : undefined;
    return { id: item.id, author: item.kind === 'note' ? 'note' : item.author, body: item.body, createdAt: item.createdAt, tag, actions };
  });
}
