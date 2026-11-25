import { describe, expect, it, vi } from 'vitest';
import { inviteClientToPortal, inviteOutcomeText, type ClientInviteApi } from './clientInvite';

const receipt = { ticketId: 'ticket-1', invitationId: 'invitation-1', expiresAt: '2026-12-02T00:00:00.000Z', status: 'pending' as const, alreadyPending: false };

function fakeApi(status: 'received' | 'under_review', sent: unknown = receipt) {
  const calls: string[] = [];
  const api = {
    get: vi.fn(async () => { calls.push('get'); return { id: 'ticket-1', status, version: 3 }; }),
    execute: vi.fn(async (_ticketId: string, input: { expectedVersion: number; command: { type: string } }) => {
      calls.push(`${input.command.type}@${input.expectedVersion}`);
      return { ticketId: 'ticket-1', operationId: 'op', version: 4, status: 'under_review' as const };
    }),
    sendInvitationEmail: vi.fn(async () => { calls.push('invite'); return sent; }),
  };
  return { api: api as unknown as ClientInviteApi, calls };
}

describe('inviting a client to the portal', () => {
  it('reviews a new request first, then sends the invitation', async () => {
    const { api, calls } = fakeApi('received');
    await expect(inviteClientToPortal(api, 'ticket-1')).resolves.toEqual(receipt);
    expect(calls).toEqual(['get', 'review@3', 'invite']);
  });

  it('invites straight away from a request already under review', async () => {
    const { api, calls } = fakeApi('under_review');
    await inviteClientToPortal(api, 'ticket-1');
    expect(calls).toEqual(['get', 'invite']);
  });

  it('uses the status the caller already has instead of reading the request again', async () => {
    const { api, calls } = fakeApi('under_review');
    await inviteClientToPortal(api, 'ticket-1', { status: 'received', version: 7 });
    expect(calls).toEqual(['review@7', 'invite']);
  });

  it('refuses a receipt that does not confirm a pending invitation for this request', async () => {
    for (const bad of [{ ...receipt, ticketId: 'other' }, { ...receipt, expiresAt: 'soon' }, { ...receipt, alreadyPending: undefined }, null]) {
      const { api } = fakeApi('under_review', bad);
      await expect(inviteClientToPortal(api, 'ticket-1')).rejects.toThrow('Invalid client invitation receipt.');
    }
  });

  it('tells the PM whether the invitation went, and where to resend it when it did not', () => {
    expect(inviteOutcomeText('jane@acme.test', null)).toBe('');
    expect(inviteOutcomeText('jane@acme.test', { sent: receipt })).toBe('Invitation sent to jane@acme.test. They get access once they set a password.');
    expect(inviteOutcomeText('jane@acme.test', { sent: { ...receipt, alreadyPending: true } })).toContain('already on its way');
    const failed = inviteOutcomeText('jane@acme.test', { failed: 'Ticket service is temporarily unavailable.' });
    expect(failed).toContain("wasn't sent: Ticket service is temporarily unavailable.");
    expect(failed).toContain('Inquiries → Handled');
  });
});
