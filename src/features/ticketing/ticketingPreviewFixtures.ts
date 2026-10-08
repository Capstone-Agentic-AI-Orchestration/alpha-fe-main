import { createTicketPreview, type PreviewSeedTicket } from './previewModel';
import {
  pmTicketApi,
  type PmTicketDetail,
  type PmTicketMessage,
  type PmTicketNote,
  type PmTicketQueueItem,
  type PmTicketQueueOptions,
  type PmTicketQueuePage,
  type TicketActionOwner,
  type TicketNextAction,
  type TicketStatus,
} from './pmApi';

interface DemoTicket extends PreviewSeedTicket {
  messages: PmTicketMessage[];
  notes: PmTicketNote[];
  status: TicketStatus;
  companyLabel: string;
  clientAccessActive: boolean;
  actionOwner: TicketActionOwner;
  nextAction: TicketNextAction;
  projectId: string | null;
  projectName: string | null;
  requiredIssueIds: string[];
  requestedAction: PmTicketQueueItem['requestedAction'];
  scopeSummary: string | null;
  scopeAgreed: boolean;
  closureReason: PmTicketDetail['internal']['closureReason'];
}

const message = (id: string, author: 'pm' | 'client', body: string, createdAt: string): PmTicketMessage => ({
  id, author, body, createdAt,
});

const note = (id: string, body: string, createdAt: string): PmTicketNote => ({
  id, author: 'pm', authorId: 'preview-pm', body, createdAt,
});

/** Fictional values used only by the development preview; never sent to Alpha. */
export const DEMO_TICKETS: DemoTicket[] = [
  {
    id: 'preview-ticket-1042', reference: 'DEMO-1042',
    title: 'Add CSV export to the monthly sales report',
    description: 'Let project users export the currently filtered monthly sales report as a CSV file.',
    stage: 'implementing', status: 'in_progress',
    createdAt: '2026-10-05T10:22:00+08:00', updatedAt: '2026-10-08T08:45:00+08:00', closedAt: null,
    relatedTicketId: null, source: 'authenticated_request', contact: null, requestedDeadline: '2026-10-20',
    companyLabel: 'Northstar Demo Co.', clientAccessActive: true, actionOwner: 'developer', nextAction: 'execute_work',
    projectId: 'preview-project-ops', projectName: 'Operations Dashboard', requiredIssueIds: ['DEMO-ISSUE-17'],
    requestedAction: null, scopeSummary: 'Export the active report filters and visible columns to CSV.', scopeAgreed: true,
    closureReason: null,
    messages: [
      message('message-1042-1', 'pm', 'The agreed export work is underway. I’ll share it here after review.', '2026-10-07T13:10:00+08:00'),
      message('message-1042-2', 'client', 'Please include the date range currently selected in the exported file.', '2026-10-07T14:02:00+08:00'),
    ],
    notes: [note('note-1042-1', 'Preview example: linked to the existing Operations Dashboard project and developer issue.', '2026-10-07T13:18:00+08:00')],
  },
  {
    id: 'preview-ticket-1043', reference: 'DEMO-1043',
    title: 'Confirm how cancelled orders should appear',
    description: 'Before agreeing to this report update, confirm whether cancelled orders should be excluded from the monthly totals.',
    stage: 'awaiting_client', status: 'awaiting_client',
    createdAt: '2026-10-06T11:10:00+08:00', updatedAt: '2026-10-08T07:30:00+08:00', closedAt: null,
    relatedTicketId: null, source: 'authenticated_request', contact: null, requestedDeadline: null,
    companyLabel: 'Northstar Demo Co.', clientAccessActive: true, actionOwner: 'client', nextAction: 'agree_scope',
    projectId: null, projectName: null, requiredIssueIds: [], requestedAction: 'agree_scope',
    scopeSummary: 'Update report totals to exclude cancelled orders.', scopeAgreed: false, closureReason: null,
    messages: [message('message-1043-1', 'pm', 'Could you confirm that cancelled orders should be excluded from the totals?', '2026-10-08T07:30:00+08:00')],
    notes: [note('note-1043-1', 'Waiting for the client to confirm scope before linking this request to project work.', '2026-10-08T07:32:00+08:00')],
  },
  {
    id: 'preview-ticket-1044', reference: 'DEMO-1044',
    title: 'Review the mobile dashboard filter update',
    description: 'Review the updated mobile filter layout shared by the project manager.',
    stage: 'client_review', status: 'ready_for_review',
    createdAt: '2026-10-03T09:14:00+08:00', updatedAt: '2026-10-07T16:00:00+08:00', closedAt: null,
    relatedTicketId: null, source: 'authenticated_request', contact: null, requestedDeadline: null,
    companyLabel: 'Northstar Demo Co.', clientAccessActive: true, actionOwner: 'client', nextAction: 'review_result',
    projectId: 'preview-project-ops', projectName: 'Operations Dashboard', requiredIssueIds: ['DEMO-ISSUE-21'],
    requestedAction: 'review_result', scopeSummary: 'Make the dashboard filters usable on narrow mobile screens.', scopeAgreed: true,
    closureReason: null,
    messages: [message('message-1044-1', 'pm', 'I reviewed the update and shared the mobile filter preview. Please review it and let me know if it meets the agreed request.', '2026-10-07T16:00:00+08:00')],
    notes: [note('note-1044-1', 'Preview example: result is awaiting client review; no real delivery file is attached.', '2026-10-07T16:02:00+08:00')],
  },
  {
    id: 'preview-ticket-1041', reference: 'DEMO-1041',
    title: 'Find archived monthly reports',
    description: 'Help locate the archived monthly reports in the dashboard.',
    stage: 'closed', status: 'closed',
    createdAt: '2026-10-01T09:05:00+08:00', updatedAt: '2026-10-02T12:40:00+08:00', closedAt: '2026-10-02T12:40:00+08:00',
    relatedTicketId: null, source: 'authenticated_request', contact: null, requestedDeadline: null,
    companyLabel: 'Northstar Demo Co.', clientAccessActive: true, actionOwner: null, nextAction: null,
    projectId: 'preview-project-ops', projectName: 'Operations Dashboard', requiredIssueIds: [],
    requestedAction: null, scopeSummary: null, scopeAgreed: false, closureReason: 'answered',
    messages: [
      message('message-1041-1', 'pm', 'Archived reports are available from the Reports menu under History.', '2026-10-02T12:25:00+08:00'),
      message('message-1041-2', 'client', 'Found them, thank you.', '2026-10-02T12:40:00+08:00'),
    ],
    notes: [note('note-1041-1', 'Resolved with guidance; no developer work was needed.', '2026-10-02T12:41:00+08:00')],
  },
  {
    id: 'preview-ticket-1045', reference: 'DEMO-1045',
    title: 'Request an inventory overview',
    description: 'We would like an overview of stock levels and recent inventory changes.',
    stage: 'received', status: 'received',
    createdAt: '2026-10-08T09:10:00+08:00', updatedAt: '2026-10-08T09:10:00+08:00', closedAt: null,
    relatedTicketId: null, source: 'public_inquiry',
    contact: { fullName: 'Jordan Reyes', email: 'jordan.reyes@example.test', company: 'Northstar Demo Co.', verified: false },
    requestedDeadline: '2026-11-15', companyLabel: 'Northstar Demo Co.', clientAccessActive: false,
    actionOwner: 'pm', nextAction: 'review_ticket', projectId: null, projectName: null, requiredIssueIds: [],
    requestedAction: null, scopeSummary: null, scopeAgreed: false, closureReason: null,
    messages: [], notes: [note('note-1045-1', 'Review the inquiry and verify the contact before issuing any client invitation.', '2026-10-08T09:20:00+08:00')],
  },
];

function toQueueItem(ticket: DemoTicket): PmTicketQueueItem {
  return {
    id: ticket.id, reference: ticket.reference, title: ticket.title, status: ticket.status,
    createdAt: ticket.createdAt, updatedAt: ticket.updatedAt, closedAt: ticket.closedAt,
    readOnly: true, writesAvailable: false, requestedAction: ticket.requestedAction,
    internal: {
      updatedAt: ticket.updatedAt, actionOwner: ticket.actionOwner, nextAction: ticket.nextAction,
      projectId: ticket.projectId, clientAccessActive: ticket.clientAccessActive,
    },
  };
}

function toTicketDetail(ticket: DemoTicket): PmTicketDetail {
  const scopeId = `${ticket.id}-scope`;
  const scope = ticket.scopeSummary ? {
    id: scopeId, summary: ticket.scopeSummary, proposedAt: ticket.updatedAt, agreed: ticket.scopeAgreed,
  } : null;
  return {
    id: ticket.id, reference: ticket.reference, title: ticket.title, description: ticket.description,
    companyLabel: ticket.companyLabel, status: ticket.status, version: 1,
    createdAt: ticket.createdAt, updatedAt: ticket.updatedAt, closedAt: ticket.closedAt,
    readOnly: true, writesAvailable: false, requestedAction: ticket.requestedAction,
    sharedProjectName: ticket.projectName, relatedTicket: null, scope, delivery: null,
    request: {
      projectPreference: ticket.projectId ? 'shared_project' : 'not_sure',
      projectLabel: ticket.projectName, requestedDeadline: ticket.requestedDeadline,
    },
    internal: {
      updatedAt: ticket.updatedAt, projectId: ticket.projectId, requiredIssueIds: ticket.requiredIssueIds,
      actionOwner: ticket.actionOwner, nextAction: ticket.nextAction,
      authorizedScopeVersionId: ticket.scopeAgreed ? scopeId : null,
      correctionRequestedFor: null, withdrawalRequested: false, closureReason: ticket.closureReason,
      request: {
        source: ticket.source === 'public_inquiry' ? 'public_inquiry' : 'authenticated_client',
        preferredProjectId: ticket.projectId,
        projectLabel: ticket.projectName,
        requestedDeadline: ticket.requestedDeadline,
        contact: ticket.contact ? {
          fullName: ticket.contact.fullName, email: ticket.contact.email, company: ticket.contact.company,
          verification: 'unverified_submission',
        } : null,
      },
      scopeVersion: scope ? {
        id: scope.id, summary: scope.summary,
        developerBrief: ticket.scopeAgreed ? 'Implement only the agreed report behavior and keep existing filters intact.' : null,
        proposedAt: scope.proposedAt, immutable: ticket.scopeAgreed, clientVisible: true,
      } : null,
      deliveryAssessment: null,
    },
  };
}

function filterTickets(tickets: readonly DemoTicket[], options: PmTicketQueueOptions): DemoTicket[] {
  const search = options.search?.trim().toLowerCase();
  return tickets.filter(ticket => {
    const terminal = ['closed', 'declined', 'cancelled'].includes(ticket.status);
    const matchesFilter = !options.filter || options.filter === 'all'
      || (options.filter === 'history' && terminal)
      || (options.filter === 'open' && !terminal)
      || (options.filter === 'needs_pm' && !terminal && ticket.actionOwner === 'pm')
      || (options.filter === 'in_progress' && ticket.status === 'in_progress')
      || (options.filter === 'waiting_client' && !terminal && ticket.actionOwner === 'client')
      || (options.filter === 'closed_month' && ticket.status === 'closed' && ticket.closedAt?.slice(0, 7) === new Date().toISOString().slice(0, 7));
    const matchesSearch = !search || `${ticket.reference} ${ticket.title} ${ticket.description}`.toLowerCase().includes(search);
    return matchesFilter && matchesSearch;
  });
}

const queueCounters = {
  kind: 'pm' as const,
  needsPm: DEMO_TICKETS.filter(ticket => ticket.actionOwner === 'pm' && !['closed', 'declined', 'cancelled'].includes(ticket.status)).length,
  inProgress: DEMO_TICKETS.filter(ticket => ticket.status === 'in_progress').length,
  waitingClient: DEMO_TICKETS.filter(ticket => ticket.actionOwner === 'client' && !['closed', 'declined', 'cancelled'].includes(ticket.status)).length,
  closedMonth: DEMO_TICKETS.filter(ticket => ticket.status === 'closed' && ticket.closedAt?.slice(0, 7) === new Date().toISOString().slice(0, 7)).length,
};

const localMethods: Partial<typeof pmTicketApi> = {
  async list(options: PmTicketQueueOptions = {}): Promise<PmTicketQueuePage> {
    const tickets = filterTickets(DEMO_TICKETS, options);
    const limit = Math.max(1, Math.min(options.limit ?? 50, 100));
    return { items: tickets.slice(0, limit).map(toQueueItem), nextCursor: null, counters: queueCounters };
  },
  async get(ticketId: string): Promise<PmTicketDetail> {
    const ticket = DEMO_TICKETS.find(item => item.id === ticketId);
    if (!ticket) throw new Error('Preview ticket not found.');
    return toTicketDetail(ticket);
  },
  async getMessages(ticketId: string) {
    const ticket = DEMO_TICKETS.find(item => item.id === ticketId);
    if (!ticket) throw new Error('Preview ticket not found.');
    return { items: ticket.messages.map(item => ({ ...item })), nextCursor: null };
  },
  async getNotes(ticketId: string) {
    const ticket = DEMO_TICKETS.find(item => item.id === ticketId);
    if (!ticket) throw new Error('Preview ticket not found.');
    return { items: ticket.notes.map(item => ({ ...item })), nextCursor: null };
  },
};

/** Read-only fake transport used exclusively by the development PM preview. */
export const pmPreviewApi = new Proxy(pmTicketApi, {
  get(target, property, receiver) {
    if (typeof property === 'string' && property in localMethods) {
      return localMethods[property as keyof typeof localMethods];
    }
    const value = Reflect.get(target, property, receiver);
    if (typeof value === 'function') return async () => {
      throw new Error('Ticket changes are disabled in the local UI preview.');
    };
    return value;
  },
});

export function createClientPreviewModel() {
  return createTicketPreview(undefined, undefined, DEMO_TICKETS);
}
