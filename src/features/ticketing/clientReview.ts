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
