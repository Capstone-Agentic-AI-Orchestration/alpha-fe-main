import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError, apiService } from '@/shared/services/apiService';
import { pmTicketApi } from './pmApi';

afterEach(() => vi.restoreAllMocks());

describe('PM ticket transport', () => {
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

  it('issues an invitation without accepting recipient or role data from the UI', async () => {
    const request = vi.spyOn(apiService, 'ticketRequest').mockResolvedValue({
      invitationId: 'invitation-1', ticketId: 'ticket-1', status: 'pending',
      expiresAt: '2026-10-09T00:00:00.000Z', alreadyPending: false,
    } as never);

    await pmTicketApi.inviteClient('ticket-1');

    expect(request).toHaveBeenCalledWith('/tickets/ticket-1/invitations', { method: 'POST', body: '{}' });
  });
});
