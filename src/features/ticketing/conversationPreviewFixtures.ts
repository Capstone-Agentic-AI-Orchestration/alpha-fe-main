import type { ConversationItem, ConversationRequest } from './projectConversation';

/** Fictional sample conversation for the local ticketing preview only. */
export const PREVIEW_CONVERSATION_PROJECT = { workspaceId: 'preview-workspace', projectId: 'preview-project-ops', projectName: 'Operations Dashboard' };

const formRequest = { ticketId: 'preview-request-form', reference: 'TKT-DEMO-FORM', title: 'Add a contact form' };
// The export request is the sample PM ticket DEMO-1042, so its context tabs have details to show.
const exportRequest = { ticketId: 'preview-ticket-1042', reference: 'DEMO-1042', title: 'Add CSV export to the monthly sales report' };

export const PREVIEW_CONVERSATION_ITEMS: ConversationItem[] = [
  { id: 'ce:preview-1', kind: 'clarification', author: 'pm', body: 'Before we start: which teams will use the dashboard first?',
    createdAt: '2026-10-01T09:00:00+08:00', request: null, task: null },
  { id: 'ce:preview-2', kind: 'clarification', author: 'client', body: 'Operations first, then finance next month.',
    createdAt: '2026-10-01T10:30:00+08:00', request: null, task: null },
  { id: 'request:preview-request-form', kind: 'request', author: 'client', body: 'A short form on the About page that sends an email to our ops inbox.',
    createdAt: '2026-10-03T09:15:00+08:00', request: formRequest, task: null },
  { id: 'tm:preview-1', kind: 'message', author: 'pm', body: 'Got it. Should the form also save a copy in the dashboard?',
    createdAt: '2026-10-03T11:00:00+08:00', request: formRequest, task: null },
  { id: 'pm:preview-2', kind: 'message', author: 'client', body: 'No, the email is enough. Thanks!',
    createdAt: '2026-10-03T11:20:00+08:00', request: null, task: null },
  { id: 'tl:preview-issue-1', kind: 'task_linked', author: 'pm', body: '', createdAt: '2026-10-03T12:00:00+08:00',
    request: formRequest, task: { issueId: 'preview-issue-1', identifier: 'OPS-12', title: 'Build the contact form' } },
  { id: 'request:preview-ticket-1042', kind: 'request', author: 'client', body: 'Every Monday we copy the numbers by hand. A CSV download would save us an hour.',
    createdAt: '2026-10-06T08:40:00+08:00', request: exportRequest, task: null },
];

export const PREVIEW_CONVERSATION_REQUESTS: ConversationRequest[] = [
  { ...exportRequest, workspaceId: PREVIEW_CONVERSATION_PROJECT.workspaceId, description: 'Every Monday we copy the numbers by hand. A CSV download would save us an hour.',
    ticketStatus: 'in_progress', checklist: 'in_progress', doneBy: null, doneAt: null, createdAt: '2026-10-06T08:40:00+08:00', linkedTasks: [] },
  { ...formRequest, workspaceId: PREVIEW_CONVERSATION_PROJECT.workspaceId, description: 'A short form on the About page that sends an email to our ops inbox.',
    ticketStatus: 'under_review', checklist: 'ready_to_check', doneBy: null, doneAt: null, createdAt: '2026-10-03T09:15:00+08:00',
    linkedTasks: [{ issueId: 'preview-issue-1', identifier: 'OPS-12', title: 'Build the contact form', status: 'done' }] },
];
