import { describe, expect, it } from 'vitest';
import type { ClientTicketDetail } from './clientApi';
import { canReviewClientDelivery, clientDeliveryReviewKey } from './clientReview';

function ticket(): ClientTicketDetail {
  return { id: 'ticket-a', reference: 'TEST-1', title: 'Test-only ticket', description: 'Test', companyLabel: 'Test client', version: 7,
    status: 'ready_for_review', writesAvailable: true, readOnly: false, requestedAction: 'review_result',
    createdAt: '2026-10-08T03:00:00Z', updatedAt: '2026-10-08T03:00:00Z', closedAt: null,
    relatedTicket: null, sharedProjectName: null, request: null,
    scope: { id: 'scope-a', summary: 'Agreed work', proposedAt: '2026-10-08T03:00:00Z', agreed: true },
    delivery: { id: 'delivery-a', scopeVersionId: 'scope-a', summary: 'Result', sharedAt: '2026-10-08T03:00:00Z', accepted: false } };
}
describe('client review preflight', () => {
  it('requires inspection of the exact current ticket/result/scope', () => {
    const value = ticket(); expect(canReviewClientDelivery(value, '')).toBe(false);
    expect(canReviewClientDelivery(value, clientDeliveryReviewKey(value))).toBe(true);
    for (const other of [{ ...value, id: 'other' }, { ...value, delivery: { ...value.delivery!, id: 'other' } },
      { ...value, delivery: { ...value.delivery!, scopeVersionId: 'other' } }]) {
      expect(canReviewClientDelivery(other, clientDeliveryReviewKey(value))).toBe(false);
    }
  });
  it.each(['disabled', 'read-only', 'accepted', 'not-agreed', 'wrong-scope', 'not-requested', 'missing-result'])('refuses %s', invalid => {
    const value = ticket(); const key = clientDeliveryReviewKey(value);
    if (invalid === 'disabled') value.writesAvailable = false;
    if (invalid === 'read-only') value.readOnly = true;
    if (invalid === 'accepted') value.delivery!.accepted = true;
    if (invalid === 'not-agreed') value.scope!.agreed = false;
    if (invalid === 'wrong-scope') value.scope!.id = 'other';
    if (invalid === 'not-requested') value.requestedAction = null;
    if (invalid === 'missing-result') value.delivery = null;
    expect(canReviewClientDelivery(value, key)).toBe(false);
  });
  it.each(['received', 'under_review', 'awaiting_client', 'in_progress', 'on_hold', 'closed', 'declined', 'cancelled'] as const)('refuses review during %s', status => {
    const value = ticket(); value.status = status; expect(canReviewClientDelivery(value, clientDeliveryReviewKey(value))).toBe(false);
  });
});
