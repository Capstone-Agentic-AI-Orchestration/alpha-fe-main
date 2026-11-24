import type { PmTicketCommandInput, PmTicketDetail, PmTicketInvitationReceipt, PmTicketReceipt } from './pmApi';

/** What inviting a client needs from the PM ticket API. */
export interface ClientInviteApi {
  get(ticketId: string): Promise<Pick<PmTicketDetail, 'id' | 'status' | 'version'>>;
  execute(ticketId: string, input: PmTicketCommandInput): Promise<PmTicketReceipt>;
  sendInvitationEmail(ticketId: string): Promise<PmTicketInvitationReceipt>;
}

/**
 * Email the person behind a public inquiry an invitation to set up their client portal account.
 *
 * The backend only invites from a request under review, so a request that is still
 * `received` is reviewed first: inviting the client is the PM's review of the inquiry.
 * Pass the ticket's status and version when the caller already has them; otherwise
 * they are read first. Resolves with the invitation once the server confirms it.
 */
export async function inviteClientToPortal(api: ClientInviteApi, ticketId: string,
  current?: { status: PmTicketDetail['status']; version: number }): Promise<PmTicketInvitationReceipt> {
  const ticket = current ?? await api.get(ticketId);
  if (ticket.status === 'received') {
    await api.execute(ticketId, { schemaVersion: 1, operationId: crypto.randomUUID(), expectedVersion: ticket.version, command: { type: 'review' } });
  }
  const receipt = await api.sendInvitationEmail(ticketId);
  if (!receipt || receipt.ticketId !== ticketId || !receipt.invitationId || !Number.isFinite(Date.parse(receipt.expiresAt))
    || receipt.status !== 'pending' || typeof receipt.alreadyPending !== 'boolean') throw new Error('Invalid client invitation receipt.');
  return receipt;
}

/** How an invitation sent alongside starting a project went, for the PM's toast. */
export type ClientInviteOutcome = { sent: PmTicketInvitationReceipt } | { failed: string };

/** One sentence for the PM about the invitation, or nothing when none was asked for. */
export function inviteOutcomeText(email: string, outcome: ClientInviteOutcome | null): string {
  if (!outcome) return '';
  if ('sent' in outcome) {
    return outcome.sent.alreadyPending
      ? `An invitation to ${email} is already on its way.`
      : `Invitation sent to ${email}. They get access once they set a password.`;
  }
  return `The invitation to ${email} wasn't sent: ${outcome.failed} Open the request from Inquiries → Handled to send it again.`;
}
