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

/** A state update that swaps in one request's new copy. */
export function withUpdatedRequest(updated: ConversationRequest) {
  return (previous: ConversationRequest[] | null) => previous?.map(item => item.ticketId === updated.ticketId ? updated : item) ?? previous;
}

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

function parseItemRequest(value: unknown): ConversationItem['request'] {
  if (value === null || value === undefined) return null;
  if (!record(value) || !nonEmpty(value.ticketId) || !text(value.reference) || !text(value.title)) invalid();
  return { ticketId: value.ticketId, reference: value.reference, title: value.title };
}

function parseItemTask(value: unknown): ConversationItem['task'] {
  if (value === null || value === undefined) return null;
  if (!record(value) || !nonEmpty(value.issueId) || !text(value.identifier) || !text(value.title)) invalid();
  return { issueId: value.issueId, identifier: value.identifier, title: value.title };
}

export function parseConversation(value: unknown): { items: ConversationItem[]; clientId?: string } {
  if (!record(value) || !Array.isArray(value.items)) invalid();
  const items = value.items.map((raw): ConversationItem => {
    if (!record(raw) || !nonEmpty(raw.id) || !KINDS.has(raw.kind as ConversationItemKind)
      || (raw.author !== 'client' && raw.author !== 'pm') || !text(raw.body) || !nonEmpty(raw.createdAt)) invalid();
    const request = parseItemRequest(raw.request);
    const task = parseItemTask(raw.task);
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

/** Who did something, from the reader's side. */
function actorName(author: ConversationItem['author'], role: 'client' | 'pm'): string {
  if (author === role) return 'You';
  if (author === 'client') return 'The client';
  return role === 'client' ? 'Your project manager' : 'A project manager';
}

/** Task-link events are internal to the PM; only PMs see linked task details. */
function taskLinkedLine(item: ConversationItem, role: 'client' | 'pm', title: string): string {
  const taskTitle = item.task?.title ?? '';
  if (role === 'client') return '';
  const quoted = taskTitle ? '“' + taskTitle + '” ' : '';
  return (item.task?.identifier ?? 'A task') + ' ' + quoted + 'was linked to ' + title;
}

/** One line for a checklist or task event, from the reader's side. */
function eventLine(item: ConversationItem, role: 'client' | 'pm'): string {
  const title = item.request ? '“' + item.request.title + '”' : 'a request';
  if (item.kind === 'task_linked') return taskLinkedLine(item, role, title);
  const who = actorName(item.author, role);
  return item.kind === 'request_done' ? who + ' marked ' + title + ' done' : who + ' reopened ' + title;
}

function messageTag(item: ConversationItem): string | undefined {
  if (item.kind === 'clarification') return 'Project proposal';
  return item.request ? 'Re: ' + item.request.title : undefined;
}

/** The conversation as chat entries; actions are added per entry by the caller. */
export function conversationChatMessages(items: readonly ConversationItem[], role: 'client' | 'pm',
  actionsFor?: (item: ConversationItem) => TicketChatMessage['actions']): TicketChatMessage[] {
  return items.filter(item => role === 'pm' || item.kind !== 'task_linked').map(item => {
    const actions = actionsFor?.(item);
    if (item.kind === 'task_linked' || item.kind === 'request_done' || item.kind === 'request_reopened') {
      return { id: item.id, author: item.author, kind: 'event', body: eventLine(item, role), createdAt: item.createdAt };
    }
    if (item.kind === 'request') {
      return { id: item.id, author: item.author, kind: 'request', heading: item.request?.title ?? 'New request', reference: item.request?.reference,
        body: item.body, createdAt: item.createdAt, actions };
    }
    return { id: item.id, author: item.kind === 'note' ? 'note' : item.author, body: item.body, createdAt: item.createdAt,
      tag: messageTag(item), actions };
  });
}
