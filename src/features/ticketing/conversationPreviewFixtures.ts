import type { ConversationItem, ConversationRequest } from './projectConversation';

/** Fictional sample conversation for the local ticketing preview only. */
export const PREVIEW_CONVERSATION_PROJECT = { workspaceId: 'preview-workspace', projectId: 'preview-project-ops', projectName: 'Operations Dashboard' };

// Both requests are sample requests DEMO-1044 and DEMO-1042, so opening either shows its progress and context.
const filterRequest = { ticketId: 'preview-ticket-1044', reference: 'DEMO-1044', title: 'Review the mobile dashboard filter update' };
const exportRequest = { ticketId: 'preview-ticket-1042', reference: 'DEMO-1042', title: 'Add CSV export to the monthly sales report' };
const filterBody = 'On my phone the filters scroll away. Keep them at the top while I scroll the report.';
const exportBody = 'Every Monday we copy the numbers by hand. A CSV download would save us an hour.';

export const PREVIEW_CONVERSATION_ITEMS: ConversationItem[] = [
  { id: 'ce:preview-1', kind: 'clarification', author: 'pm', body: 'Before we start: which teams will use the dashboard first?',
    createdAt: '2026-10-01T09:00:00+08:00', request: null, task: null },
  { id: 'ce:preview-2', kind: 'clarification', author: 'client', body: 'Operations first, then finance next month.',
    createdAt: '2026-10-01T10:30:00+08:00', request: null, task: null },
  { id: 'request:preview-ticket-1044', kind: 'request', author: 'client', body: filterBody,
    createdAt: '2026-10-03T09:14:00+08:00', request: filterRequest, task: null },
  { id: 'tm:preview-1', kind: 'message', author: 'pm', body: 'Got it. Should the filters also stay when you switch tabs?',
    createdAt: '2026-10-03T11:00:00+08:00', request: filterRequest, task: null },
  { id: 'pm:preview-2', kind: 'message', author: 'client', body: 'No, scrolling is enough. Thanks!',
    createdAt: '2026-10-03T11:20:00+08:00', request: null, task: null },
  { id: 'tl:preview-issue-1', kind: 'task_linked', author: 'pm', body: '', createdAt: '2026-10-03T12:00:00+08:00',
    request: filterRequest, task: { issueId: 'preview-issue-1', identifier: 'OPS-12', title: 'Keep the filter bar on screen' } },
  { id: 'request:preview-ticket-1042', kind: 'request', author: 'client', body: exportBody,
    createdAt: '2026-10-06T08:40:00+08:00', request: exportRequest, task: null },
];

export const PREVIEW_CONVERSATION_REQUESTS: ConversationRequest[] = [
  { ...exportRequest, workspaceId: PREVIEW_CONVERSATION_PROJECT.workspaceId, description: exportBody,
    ticketStatus: 'in_progress', checklist: 'in_progress', doneBy: null, doneAt: null, createdAt: '2026-10-06T08:40:00+08:00', linkedTasks: [] },
  { ...filterRequest, workspaceId: PREVIEW_CONVERSATION_PROJECT.workspaceId, description: filterBody,
    ticketStatus: 'ready_for_review', checklist: 'ready_to_check', doneBy: null, doneAt: null, createdAt: '2026-10-03T09:14:00+08:00',
    linkedTasks: [{ issueId: 'preview-issue-1', identifier: 'OPS-12', title: 'Keep the filter bar on screen', status: 'done' }] },
];
