import { describe, expect, it } from 'vitest';
import { clientTicketProgress } from './clientTicketProgress';

describe('client ticket status guidance', () => {
  it.each([
    ['received', 'Request received'],
    ['under_review', 'Project manager review'],
    ['awaiting_client', 'Waiting for the next update'],
    ['in_progress', 'Work in progress'],
    ['ready_for_review', 'Project manager review'],
    ['on_hold', 'Request paused'],
    ['closed', 'Request closed'],
    ['declined', 'Request not proceeding'],
    ['cancelled', 'Request cancelled'],
  ] as const)('explains the %s state without inventing a client action', (status, label) => {
    expect(clientTicketProgress(status, null)).toMatchObject({ label, needsClientAction: false });
  });

  it.each([
    ['reply', 'Your reply is needed'],
    ['agree_scope', 'Review the proposed work'],
    ['review_result', 'Your result review is needed'],
  ] as const)('gives a plain-language next step for %s', (action, label) => {
    expect(clientTicketProgress('awaiting_client', action)).toMatchObject({ label, needsClientAction: true });
  });

  it('does not surface a stale client action for a terminal ticket', () => {
    expect(clientTicketProgress('closed', 'review_result')).toMatchObject({ label: 'Request closed', needsClientAction: false });
  });

  it('does not imply that client acceptance closes a ticket or completes a project', () => {
    const copy = clientTicketProgress('ready_for_review', null).description;
    expect(copy).toContain('before a result is shared');
    expect(copy).not.toContain('project is complete');
  });
});
