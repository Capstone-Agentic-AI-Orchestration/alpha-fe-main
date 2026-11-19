import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError, apiService } from '@/shared/services/apiService';
import { pmTicketApi } from './pmApi';

afterEach(() => vi.restoreAllMocks());

describe('PM ticket transport', () => {
  it('prepares only a client-safe summary through the existing result endpoint', async () => {
    const request = vi.spyOn(apiService, 'ticketRequest').mockResolvedValue({ deliveryId: 'candidate' } as never);
    const input = { schemaVersion: 1 as const, operationId: 'result-operation', expectedVersion: 5, publicSummary: 'Completed agreed work.' };
    const controller = new AbortController();
    await pmTicketApi.prepareResult('ticket/one', input, controller.signal);
    expect(request).toHaveBeenCalledWith('/tickets/ticket%2Fone/results', {
      method: 'POST', body: JSON.stringify(input), signal: controller.signal,
    });
  });
  it('propagates result readiness failures without automatically repeating preparation', async () => {
    const failure = new ApiRequestError(409, 'Work is not ready', 'ticket_conflict');
    const request = vi.spyOn(apiService, 'ticketRequest').mockRejectedValue(failure);
    await expect(pmTicketApi.prepareResult('ticket', { schemaVersion: 1, operationId: 'op', expectedVersion: 5, publicSummary: 'Summary' })).rejects.toBe(failure);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('loads handled inquiries and allowlists outcome status without exposing internal notes', async () => {
    const row = { id: 'inquiry-1', publicReference: `INQ-${'A'.repeat(32)}`, fullName: 'Test client', email: 'client@example.test',
      company: null, title: 'Test inquiry', description: 'A request', requestedDeadline: null, submittedAt: '2026-10-24T01:00:00Z',
      status: 'declined', handledAt: '2026-10-24T02:00:00Z', outcomeEmailStatus: 'pending', declineReason: 'PRIVATE note' };
    const request = vi.spyOn(apiService, 'ticketRequest').mockResolvedValue({ items: [row], nextCursor: null } as never);
    const result = await pmTicketApi.listCentralIntakes(null, 'handled');
    expect(request).toHaveBeenCalledWith('/tickets/intakes?limit=50&filter=handled');
    expect(result.items[0]).toMatchObject({ status: 'declined', handledAt: row.handledAt, outcomeEmailStatus: 'pending' });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    request.mockResolvedValue({ items: [{ ...row, status: 'unknown' }], nextCursor: null } as never);
    await expect(pmTicketApi.listCentralIntakes(null, 'handled')).rejects.toThrow('status is invalid');
  });
  it('distinguishes authenticated project proposals in the shared PM intake', async () => {
    const proposal = { id: 'proposal-1', publicReference: `INQ-${'B'.repeat(32)}`, kind: 'project_proposal',
      fullName: 'Client account', email: 'client@example.test', company: null, title: 'A new project',
      description: 'Desired outcome', requestedDeadline: null, submittedAt: '2026-10-29T01:00:00Z', status: 'pending',
      clientUserId: 'must-not-be-exposed' };
    const request = vi.spyOn(apiService, 'ticketRequest').mockResolvedValue({ items: [proposal], nextCursor: null } as never);
    const result = await pmTicketApi.listCentralIntakes();
    expect(result.items[0]).toMatchObject({ kind: 'project_proposal', email: proposal.email });
    expect(JSON.stringify(result)).not.toContain('must-not-be-exposed');
    request.mockResolvedValue({ items: [{ ...proposal, kind: 'unknown' }], nextCursor: null } as never);
    await expect(pmTicketApi.listCentralIntakes()).rejects.toThrow('Shared intake item kind is invalid');
  });
  it('loads the server-owned Phase 7–9 capability without making it a UI grant', async () => {
    const request = vi.spyOn(apiService, 'ticketRequest').mockResolvedValue({ phaseWorkflowEnabled: true } as never);
    await expect(pmTicketApi.getWorkflowCapabilities()).resolves.toEqual({ phaseWorkflowEnabled: true });
    expect(request).toHaveBeenCalledWith('/tickets/workflow-capabilities');
  });

  it('uses only the PM candidate namespace and allowlists its list response', async () => {
    const controller = new AbortController();
    const request = vi.spyOn(apiService, 'ticketRequest').mockResolvedValue({ items: [{ id: 'candidate', scopeVersionId: 'scope', summary: 'Prepared result', fileCount: 1, privateNotes: 'secret' }], nextCursor: null } as never);
    expect(await pmTicketApi.getDeliveryCandidates('ticket/one', 'cursor/one', controller.signal))
      .toEqual({ items: [{ id: 'candidate', scopeVersionId: 'scope', summary: 'Prepared result', fileCount: 1 }], nextCursor: null });
    expect(request).toHaveBeenCalledWith('/tickets/ticket%2Fone/delivery-candidates?limit=10&after=cursor%2Fone', { signal: controller.signal });
  });
  it('recovers an uncertain work handoff with the same version, IDs and operation, without CRUD or runner calls', async () => {
    const receipt = { ticketId: 'ticket-1', operationId: 'handoff', version: 4, status: 'in_progress' };
    const request = vi.spyOn(apiService, 'ticketRequest')
      .mockRejectedValueOnce(new ApiRequestError(null, 'unknown', 'ticket_transport_outcome_unknown', true))
      .mockRejectedValueOnce(new ApiRequestError(404, 'not found', 'ticket_not_found'))
      .mockResolvedValueOnce(receipt as never);
    const input = { schemaVersion: 1 as const, operationId: 'handoff', expectedVersion: 3,
      command: { type: 'authorize_work' as const, scopeVersionId: 'scope', projectId: 'project', issueIds: ['issue-a', 'issue-b'] } };
    await expect(pmTicketApi.execute('ticket-1', input)).resolves.toEqual(receipt);
    expect(request.mock.calls).toEqual([
      ['/tickets/ticket-1/commands', { method: 'POST', body: JSON.stringify(input) }],
      ['/tickets/operations/handoff?ticketId=ticket-1'],
      ['/tickets/ticket-1/commands', { method: 'POST', body: JSON.stringify(input) }],
    ]);
  });
  it('encodes ticket IDs and uses only the restricted ticket API path', async () => {
    const request = vi.spyOn(apiService, 'ticketRequest').mockResolvedValue({ id: 'ticket-1' } as never);

    await pmTicketApi.get('ticket/one');

    expect(request).toHaveBeenCalledWith('/tickets/ticket%2Fone');
  });

  it('reconciles an uncertain reply before replaying the identical operation', async () => {
    const receipt = { ticketId: 'ticket/one', operationId: 'operation/stable', version: 4, status: 'under_review' as const };
    const request = vi.spyOn(apiService, 'ticketRequest')
      .mockRejectedValueOnce(new ApiRequestError(null, 'unknown', 'ticket_transport_outcome_unknown', true))
      .mockRejectedValueOnce(new ApiRequestError(404, 'not found', 'ticket_not_found'))
      .mockResolvedValueOnce(receipt as never);
    const input = {
      schemaVersion: 1 as const, operationId: 'operation/stable', expectedVersion: 3, body: 'Clarify this request.',
      action: { type: 'request_details' as const },
    };

    await expect(pmTicketApi.reply('ticket/one', input)).resolves.toEqual(receipt);
    const body = JSON.stringify(input);
    expect(request.mock.calls).toEqual([
      ['/tickets/ticket%2Fone/messages', { method: 'POST', body }],
      ['/tickets/operations/operation%2Fstable?ticketId=ticket%2Fone'],
      ['/tickets/ticket%2Fone/messages', { method: 'POST', body }],
    ]);
  });

  it('requests a PM invitation email without accepting recipient or account data from the UI', async () => {
    const request = vi.spyOn(apiService, 'ticketRequest').mockResolvedValue({
      invitationId: 'invitation-1', ticketId: 'ticket-1', status: 'pending',
      expiresAt: '2026-10-10T00:00:00.000Z', alreadyPending: false,
    } as never);

    await pmTicketApi.sendInvitationEmail('ticket-1');

    expect(request).toHaveBeenCalledWith('/tickets/ticket-1/invitations', { method: 'POST', body: '{}' });
  });

  it('links a request to a workspace project through the PM ticket API only', async () => {
    const request = vi.spyOn(apiService, 'ticketRequest').mockResolvedValue({
      ticketId: 'ticket/one', operationId: 'link-operation', version: 3, status: 'under_review',
      projectId: 'project-a', projectName: 'Client-safe name', clientVisible: true,
    } as never);
    const input = { schemaVersion: 1 as const, operationId: 'link-operation', expectedVersion: 2,
      projectId: 'project-a', clientVisible: true };

    await pmTicketApi.linkProject('ticket/one', input);

    expect(request).toHaveBeenCalledWith('/tickets/ticket%2Fone/project', { method: 'PUT', body: JSON.stringify(input) });
  });

  it('records a shared-inbox decline with its optional internal-only reason', async () => {
    const request = vi.spyOn(apiService, 'ticketRequest').mockResolvedValue({
      intakeId: 'intake-1', operationId: 'decline-operation', status: 'declined',
    } as never);
    await expect(pmTicketApi.declineCentralIntake('intake-1', 'decline-operation', 'Outside scope.'))
      .resolves.toEqual({ intakeId: 'intake-1', operationId: 'decline-operation', status: 'declined' });
    expect(request).toHaveBeenCalledWith('/tickets/intakes/intake-1/decline', {
      method: 'POST', body: JSON.stringify({ schemaVersion: 1, operationId: 'decline-operation', reason: 'Outside scope.' }),
    });
  });

  it('loads and updates the selected project client preview through the workspace-scoped PM API', async () => {
    const preview = { repository: 'org/repo', branch: 'uat' as const, url: 'https://preview.example.test' };
    const request = vi.spyOn(apiService, 'ticketRequest')
      .mockResolvedValueOnce({ preview } as never)
      .mockResolvedValueOnce({ preview: null } as never);

    await expect(pmTicketApi.getProjectClientPreview('project/one')).resolves.toEqual({ preview });
    await expect(pmTicketApi.setProjectClientPreview('project/one', null)).resolves.toEqual({ preview: null });
    expect(request.mock.calls).toEqual([
      ['/tickets/projects/project%2Fone/client-preview'],
      ['/tickets/projects/project%2Fone/client-preview', { method: 'PUT', body: JSON.stringify({ preview: null }) }],
    ]);

    request.mockRejectedValueOnce(new ApiRequestError(503, 'API Error [503]: Ticket changes are not enabled yet.'));
    await expect(pmTicketApi.getProjectClientPreview('project/one')).resolves.toEqual({ preview: null });
  });

  it('loads only clients with server-confirmed access to the selected project', async () => {
    const items = [{ clientId: 'client-1', displayName: 'Client One' }, { clientId: 'client-2', displayName: 'Client Two' }];
    const request = vi.spyOn(apiService, 'ticketRequest').mockResolvedValue({ items } as never);
    await expect(pmTicketApi.listProjectPreviewClients('project/one')).resolves.toEqual({ items });
    expect(request).toHaveBeenCalledWith('/tickets/projects/project%2Fone/client-preview/clients');
  });

  it('reconciles an uncertain PM project feedback send by its operation receipt', async () => {
    const receipt = { messageId: 'feedback-1', operationId: 'feedback-operation-1' };
    const request = vi.spyOn(apiService, 'ticketRequest')
      .mockRejectedValueOnce(new ApiRequestError(null, 'unknown', 'project_message_outcome_unknown', true))
      .mockResolvedValueOnce(receipt as never);
    const input = { schemaVersion: 1 as const, operationId: 'feedback-operation-1', body: 'Please review the preview.' };

    await expect(pmTicketApi.sendProjectFeedbackMessage('project/one', 'client/one', input)).resolves.toEqual(receipt);
    expect(request.mock.calls).toEqual([
      ['/tickets/projects/project%2Fone/client-preview/messages?clientId=client%2Fone', { method: 'POST', body: JSON.stringify(input) }],
      ['/tickets/projects/project%2Fone/client-preview/messages/operations/feedback-operation-1?clientId=client%2Fone'],
    ]);
  });

  it('scopes project feedback page reads to the selected client and requires the client ID in message rows', async () => {
    const request = vi.spyOn(apiService, 'ticketRequest').mockResolvedValue({ items: [
      { id: 'message-1', clientId: 'client-1', author: 'client', body: 'Looks good.', createdAt: '2026-10-26T00:00:00Z' },
    ], nextCursor: null } as never);
    await expect(pmTicketApi.getProjectFeedbackMessages('project-1', 'client-1', { limit: 20, before: 'message-0' }))
      .resolves.toMatchObject({ items: [{ clientId: 'client-1' }] });
    expect(request).toHaveBeenCalledWith('/tickets/projects/project-1/client-preview/messages?clientId=client-1&limit=20&before=message-0');
  });
});

describe('PM client list transport', () => {
  const client = {
    key: 'client:ana', displayName: 'Ana Cruz', company: null, access: 'active',
    tickets: { needsPm: 1, waitingClient: 0, open: 2, closed: 0, unlinkedOpen: 0, accessRevoked: 0 },
    projects: [{ projectId: 'gh-repo-1', name: 'Resort Website', previewPublished: false }],
    lastActivityAt: '2026-11-15T10:00:00.000Z',
  };
  it('reads the client list and keeps only the documented fields', async () => {
    const request = vi.spyOn(apiService, 'ticketRequest').mockResolvedValue({ items: [{ ...client, email: 'ana@example.test' }] } as never);
    const result = await pmTicketApi.listClients();
    expect(request).toHaveBeenCalledWith('/tickets/clients');
    expect(result).toEqual([client]);
  });
  it.each([
    ['an unverified inquiry key', { ...client, key: 'ticket:t1' }],
    ['a negative count', { ...client, tickets: { ...client.tickets, open: -1 } }],
    ['an unknown access state', { ...client, access: 'pending' }],
    ['a repeated project', { ...client, projects: [client.projects[0], client.projects[0]] }],
  ])('rejects %s', async (_label, item) => {
    vi.spyOn(apiService, 'ticketRequest').mockResolvedValue({ items: [item] } as never);
    await expect(pmTicketApi.listClients()).rejects.toThrow('Client list response is invalid.');
  });
  it('rejects a repeated client', async () => {
    vi.spyOn(apiService, 'ticketRequest').mockResolvedValue({ items: [client, client] } as never);
    await expect(pmTicketApi.listClients()).rejects.toThrow('Client list response is invalid.');
  });
});

describe('PM client conversation transport', () => {
  const row = { ticketId: 't1', latestMessage: { id: 'm1', author: 'client', preview: 'Hello', truncated: false, createdAt: '2026-11-15T10:00:00.000Z' } };
  it('reads one client’s conversation summary and keeps only the documented fields', async () => {
    const request = vi.spyOn(apiService, 'ticketRequest').mockResolvedValue({
      items: [{ ...row, body: 'full text', latestMessage: { ...row.latestMessage, audience: 'client' } }, { ticketId: 't2', latestMessage: null }], complete: true,
    } as never);
    expect(await pmTicketApi.listClientConversations('client:ana')).toEqual({ items: [row, { ticketId: 't2', latestMessage: null }], complete: true });
    expect(request).toHaveBeenCalledWith('/tickets/clients/client%3Aana/conversations');
  });
  it.each([
    ['an internal author', { ...row, latestMessage: { ...row.latestMessage, author: 'developer' } }],
    ['a long preview', { ...row, latestMessage: { ...row.latestMessage, preview: 'x'.repeat(281) } }],
    ['a bad time', { ...row, latestMessage: { ...row.latestMessage, createdAt: 'never' } }],
    ['a missing ticket', { ...row, ticketId: '' }],
  ])('rejects %s', async (_label, item) => {
    vi.spyOn(apiService, 'ticketRequest').mockResolvedValue({ items: [item], complete: true } as never);
    await expect(pmTicketApi.listClientConversations('client:ana')).rejects.toThrow('Client conversation response is invalid.');
  });
  it('rejects a repeated request or a missing completeness flag', async () => {
    vi.spyOn(apiService, 'ticketRequest').mockResolvedValueOnce({ items: [row, row], complete: true } as never)
      .mockResolvedValueOnce({ items: [row] } as never);
    await expect(pmTicketApi.listClientConversations('client:ana')).rejects.toThrow('invalid');
    await expect(pmTicketApi.listClientConversations('client:ana')).rejects.toThrow('invalid');
  });
});

describe('PM client list unread replies', () => {
  const client = {
    key: 'client:ana', displayName: 'Ana Cruz', company: null, access: 'active',
    tickets: { needsPm: 1, waitingClient: 0, open: 2, closed: 0, unlinkedOpen: 0, accessRevoked: 0 },
    projects: [], lastActivityAt: '2026-11-15T10:00:00.000Z',
  };
  it('reads unread replies when the server sends them, and leaves them out when it does not', async () => {
    vi.spyOn(apiService, 'ticketRequest').mockResolvedValueOnce({ items: [{ ...client, tickets: { ...client.tickets, unreadReplies: 3 } }] } as never)
      .mockResolvedValueOnce({ items: [client] } as never);
    expect((await pmTicketApi.listClients())[0].tickets.unreadReplies).toBe(3);
    expect((await pmTicketApi.listClients())[0].tickets).not.toHaveProperty('unreadReplies');
  });
  it('rejects an invalid unread count', async () => {
    vi.spyOn(apiService, 'ticketRequest').mockResolvedValue({ items: [{ ...client, tickets: { ...client.tickets, unreadReplies: -1 } }] } as never);
    await expect(pmTicketApi.listClients()).rejects.toThrow('Client list response is invalid.');
  });
});

describe('PM client proposals transport', () => {
  const proposal = (id: string, submittedAt: string, kind = 'project_proposal') => ({ kind, status: 'pending', id, fullName: 'Ana', email: 'ana@example.test',
    company: null, title: 'Idea ' + id, description: 'Details', requestedDeadline: null, submittedAt });
  it('reads open and handled proposals for one client account, newest first', async () => {
    const request = vi.spyOn(apiService, 'ticketRequest')
      .mockResolvedValueOnce({ items: [proposal('a', '2026-11-01T00:00:00.000Z')], nextCursor: null } as never)
      .mockResolvedValueOnce({ items: [{ ...proposal('b', '2026-11-03T00:00:00.000Z'), status: 'accepted' }], nextCursor: null } as never);
    const items = await pmTicketApi.listClientProposals('client:ana');
    expect(items.map(item => item.id)).toEqual(['b', 'a']);
    expect(request).toHaveBeenCalledWith('/tickets/intakes?limit=50&client=ana');
    expect(request).toHaveBeenCalledWith('/tickets/intakes?limit=50&filter=handled&client=ana');
  });
  it('asks for nothing for a contact without an account', async () => {
    const request = vi.spyOn(apiService, 'ticketRequest');
    expect(await pmTicketApi.listClientProposals('ticket:t1')).toEqual([]);
    expect(request).not.toHaveBeenCalled();
  });
});

describe('starting a project from an inquiry', () => {
  const started = { ticketId: 'ticket-1', reference: `TKT-${'A'.repeat(32)}`, projectId: 'proj-intake-1', projectName: 'Informational Website',
    projectKey: 'INF', created: true, clientVisible: true };

  it('sends the operation, the project and client visibility, and returns what was made', async () => {
    const request = vi.spyOn(apiService, 'ticketRequest').mockResolvedValue(started as never);
    const result = await pmTicketApi.startProjectFromIntake('intake-1', 'op-1', { name: 'Informational Website', targetDate: '2026-12-01' }, true);
    expect(result).toEqual(started);
    expect(request).toHaveBeenCalledWith('/tickets/intakes/intake-1/start-project', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({ schemaVersion: 1, operationId: 'op-1',
      project: { name: 'Informational Website', targetDate: '2026-12-01' }, clientVisible: true });
  });

  it('refuses a response that does not describe a project', async () => {
    vi.spyOn(apiService, 'ticketRequest').mockResolvedValue({ ...started, projectId: '' } as never);
    await expect(pmTicketApi.startProjectFromIntake('intake-1', 'op-1', { existingProjectId: 'p1' }, false)).rejects.toThrow('Project start response is invalid.');
  });

  it('reads what an accepted inquiry became from the list', async () => {
    const row = { kind: 'project_proposal', id: 'i1', publicReference: `INQ-${'B'.repeat(32)}`, fullName: 'a@example.test', email: 'a@example.test',
      company: null, title: 'Site', description: 'A site', requestedDeadline: null, submittedAt: '2026-11-19T00:00:00Z', status: 'accepted',
      acceptedTicketId: 'ticket-1', acceptedTicketReference: `TKT-${'A'.repeat(32)}`, acceptedProjectId: 'p1', acceptedProjectName: 'Site' };
    vi.spyOn(apiService, 'ticketRequest').mockResolvedValue({ items: [row], nextCursor: null } as never);
    const page = await pmTicketApi.listCentralIntakes(null, 'handled');
    expect(page.items[0]).toMatchObject({ acceptedTicketId: 'ticket-1', acceptedProjectId: 'p1', acceptedProjectName: 'Site' });
  });
});
