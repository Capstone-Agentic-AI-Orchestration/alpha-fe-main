import { ClientTicketApiError, clientTicketApi } from './clientApi';
import type { ClientTicketDetail, ClientTicketQueue, ClientTicketQueueOptions } from './clientApi';
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

const methods: Partial<typeof clientTicketApi> = {
  async getSession() { return { authenticated: true }; },
  async listWorkspaces() { return { items: [{ workspaceId: workspace, displayName: 'Northstar Demo Co. · fictional samples' }] }; },
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
