import { ClientTicketApiError, clientTicketApi } from './clientApi';
import type {
  ClientProject, ClientProjectFeedbackMessage, ClientProjectRequestItem, ClientProjectRequestQueue,
  ClientTicketDetail, ClientTicketQueue, ClientTicketQueueOptions,
} from './clientApi';
import { DEMO_TICKETS } from './ticketingPreviewFixtures';

const workspace = 'client-ui-sample-workspace';
const terminal = (status: string) => ['closed', 'declined', 'cancelled'].includes(status);

/** Explicit public projection: never spread a PM record into the client UI. */
function clientSamples(): ClientTicketDetail[] {
  return DEMO_TICKETS.filter(ticket => ticket.clientAccessActive).map(ticket => ({
    id: ticket.id, reference: ticket.reference, title: ticket.title, description: ticket.description,
    companyLabel: ticket.companyLabel, status: ticket.status, version: 1,
    createdAt: ticket.createdAt, updatedAt: ticket.updatedAt, closedAt: ticket.closedAt,
    readOnly: true, writesAvailable: false, requestedAction: ticket.requestedAction,
    sharedProjectName: ticket.projectName, relatedTicket: null, delivery: null,
    scope: ticket.scopeSummary ? {
      id: `${ticket.id}-scope`, summary: ticket.scopeSummary, proposedAt: ticket.updatedAt, agreed: ticket.scopeAgreed,
    } : null,
    request: { projectPreference: ticket.projectId ? 'shared_project' : 'not_sure', projectLabel: ticket.projectName, requestedDeadline: ticket.requestedDeadline },
  }));
}

function assertWorkspace(value: string): void {
  if (value !== workspace) throw new ClientTicketApiError(404, 'Sample workspace not found.');
}

function clientRequestItems(): ClientProjectRequestItem[] {
  return clientSamples().map(ticket => {
    const source = DEMO_TICKETS.find(item => item.id === ticket.id)!;
    return {
      id: ticket.id, reference: ticket.reference, title: ticket.title, status: ticket.status,
      createdAt: ticket.createdAt, updatedAt: ticket.updatedAt, closedAt: ticket.closedAt,
      readOnly: true, writesAvailable: false, requestedAction: ticket.requestedAction,
      workspaceId: workspace, projectId: source.projectId, projectName: source.projectName,
      projectLinkStatus: source.projectId ? 'linked' : null, requestedProjectName: null,
    };
  });
}

function requestPage(options: ClientTicketQueueOptions = {}, projectId?: string): ClientProjectRequestQueue {
  let tickets = clientRequestItems().filter(ticket => !projectId || ticket.projectId === projectId);
  const search = options.search?.trim().toLowerCase();
  if (search) tickets = tickets.filter(ticket => `${ticket.reference} ${ticket.title}`.toLowerCase().includes(search));
  if (options.filter === 'open') tickets = tickets.filter(ticket => !terminal(ticket.status));
  if (options.filter === 'history') tickets = tickets.filter(ticket => terminal(ticket.status));
  if (options.filter === 'needs_client') tickets = tickets.filter(ticket => !terminal(ticket.status) && ticket.requestedAction !== null);
  const offset = options.after ? Number(options.after) : 0;
  if (!Number.isSafeInteger(offset) || offset < 0) throw new ClientTicketApiError(404, 'Sample request page not found.');
  const limit = options.limit ?? 50;
  const items = tickets.slice(offset, offset + limit);
  const nextCursor = offset + items.length < tickets.length ? String(offset + items.length) : null;
  const all = clientRequestItems().filter(ticket => !projectId || ticket.projectId === projectId);
  const open = all.filter(ticket => !terminal(ticket.status));
  return { items, nextCursor, counters: { kind: 'client', open: open.length,
    needsClient: open.filter(ticket => ticket.requestedAction !== null).length } };
}

const sampleProjectId = 'preview-project-ops';
const sampleProject: ClientProject = {
  workspaceId: workspace, projectId: sampleProjectId, name: 'Operations Dashboard',
  updatedAt: '2026-10-08T08:45:00+08:00', intakeOptionId: 'sample-shared-project', preview: null,
};

const methods: Partial<typeof clientTicketApi> = {
  async getWorkflowCapabilities() { return { phaseWorkflowEnabled: false }; },
  async getSession() { return { authenticated: true, fullName: 'Alex Morgan', email: 'alex.morgan@example.test' }; },
  async listWorkspaces() { return { items: [{ workspaceId: workspace, displayName: 'Northstar Demo Co. · fictional samples' }] }; },
  async listProjects() { return { items: [sampleProject] }; },
  async listProjectProposals() { return { items: [] }; },
  async listRequests(options: ClientTicketQueueOptions = {}) { return requestPage(options); },
  async listProjectRequests(workspaceId: string, projectId: string, options: ClientTicketQueueOptions = {}) {
    assertWorkspace(workspaceId);
    if (projectId !== sampleProjectId) throw new ClientTicketApiError(404, 'Sample project not found.');
    return requestPage(options, projectId);
  },
  async getProjectFeedbackMessages(workspaceId: string, projectId: string): Promise<{ items: ClientProjectFeedbackMessage[]; nextCursor: null }> {
    assertWorkspace(workspaceId);
    if (projectId !== sampleProjectId) throw new ClientTicketApiError(404, 'Sample project not found.');
    return { items: [], nextCursor: null };
  },
  async listTickets(workspaceId: string, options: ClientTicketQueueOptions = {}): Promise<ClientTicketQueue> {
    assertWorkspace(workspaceId);
    const tickets = clientSamples();
    const query = options.search?.trim().toLowerCase();
    const items = tickets.filter(ticket => {
      const matchesFilter = !options.filter || options.filter === 'all'
        || (options.filter === 'history' && terminal(ticket.status))
        || (options.filter === 'open' && !terminal(ticket.status))
        || (options.filter === 'needs_client' && !terminal(ticket.status) && ticket.requestedAction !== null);
      return matchesFilter && (!query || `${ticket.reference} ${ticket.title} ${ticket.description}`.toLowerCase().includes(query));
    });
    return { items, nextCursor: null, counters: { kind: 'client', open: tickets.filter(ticket => !terminal(ticket.status)).length,
      needsClient: tickets.filter(ticket => !terminal(ticket.status) && ticket.requestedAction !== null).length } };
  },
  async getTicket(workspaceId: string, ticketId: string) {
    assertWorkspace(workspaceId);
    const ticket = clientSamples().find(ticket => ticket.id === ticketId);
    if (!ticket) throw new ClientTicketApiError(404, 'Sample ticket not found.');
    return ticket;
  },
  async getMessages(workspaceId: string, ticketId: string) {
    assertWorkspace(workspaceId);
    const ticket = DEMO_TICKETS.find(ticket => ticket.id === ticketId && ticket.clientAccessActive);
    if (!ticket) throw new ClientTicketApiError(404, 'Sample ticket not found.');
    return { items: ticket.messages.map(({ id, author, body, createdAt }) => ({ id, author, body, createdAt })), nextCursor: null };
  },
  async getIntakeContext(workspaceId: string) {
    assertWorkspace(workspaceId);
    return { intakeContextId: 'sample-context', canCreate: true,
      sharedProjects: [{ optionId: 'sample-shared-project', displayName: 'Operations Dashboard' }] };
  },
};

/** Dev-only read transport. Every unimplemented call refuses without fetch. */
export const clientPreviewApi = new Proxy(clientTicketApi, {
  get(_target, property) {
    if (typeof property === 'string' && Object.prototype.hasOwnProperty.call(methods, property)) {
      return methods[property as keyof typeof methods];
    }
    return async () => { throw new ClientTicketApiError(503, 'This action is disabled while inspecting sample tickets.'); };
  },
});
