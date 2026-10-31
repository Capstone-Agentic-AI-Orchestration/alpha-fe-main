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

  it('changes client request permission through the PM ticket API', async () => {
    const request = vi.spyOn(apiService, 'ticketRequest').mockResolvedValue({
      ticketId: 'ticket-1', acceptsNewRequests: true,
    } as never);

    await pmTicketApi.setClientRequestsEnabled('ticket-1', true);

    expect(request).toHaveBeenCalledWith('/tickets/ticket-1/client-requests', {
      method: 'PUT', body: JSON.stringify({ acceptsNewRequests: true }),
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
