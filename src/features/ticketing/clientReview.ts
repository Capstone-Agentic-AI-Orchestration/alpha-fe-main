import type { ClientTicketDetail } from './clientApi';

/** Display-only evidence. It cannot grant permission or override server facts. */
export function clientDeliveryReviewKey(ticket: ClientTicketDetail): string {
  return JSON.stringify([ticket.id, ticket.delivery?.id, ticket.delivery?.scopeVersionId]);
}
export function canReviewClientDelivery(ticket: ClientTicketDetail, inspectedKey: string): boolean {
  return ticket.writesAvailable && !ticket.readOnly && ticket.status === 'ready_for_review'
    && ticket.requestedAction === 'review_result' && ticket.delivery !== null && !ticket.delivery.accepted
    && ticket.scope?.agreed === true && ticket.scope.id === ticket.delivery.scopeVersionId
    && inspectedKey === clientDeliveryReviewKey(ticket);
}

/**
 * Display-only: the server does not require a download, so a client who has
 * downloaded a file OR opened the shared project preview has looked at the result.
 */
export function clientReviewEvidenceKey(downloadedKey: string, previewOpenedKey: string, currentKey: string): string {
  return downloadedKey === currentKey || previewOpenedKey === currentKey ? currentKey : '';
}

export function clientReviewLockMessage(hasPreview: boolean): string {
  return hasPreview
    ? 'To review this result, download a file or open the project preview first. The Accept and Needs a fix buttons unlock afterwards.'
    : 'To review this result, download a file first. The Accept and Needs a fix buttons unlock afterwards.';
}

export const SCOPE_CHANGE_PREFIX = 'I would like changes to the proposed scope:\n\n';
export const SCOPE_CHANGE_MAX_LENGTH = 3800;

/** A scope change request is an ordinary reply, so the ticket moves back to the PM. */
export function scopeChangeMessage(detail: string): string | null {
  const text = detail.trim();
  return text && text.length <= SCOPE_CHANGE_MAX_LENGTH ? `${SCOPE_CHANGE_PREFIX}${text}` : null;
}

export function clientAcceptedResultNote(closed: boolean): string {
  return closed
    ? 'Accepted result · this request is closed.'
    : 'Thanks, your acceptance is recorded. Your project manager will close this request. Nothing more is needed from you.';
}
