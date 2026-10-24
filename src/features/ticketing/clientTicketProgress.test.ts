import { describe, expect, it } from 'vitest';
import { clientTicketProgress } from './clientTicketProgress';

describe('client ticket status guidance', () => {
  it.each([
    ['received', 'Received', 'Waiting for your project manager to review'],
    ['under_review', 'Under review', 'Your project manager is reviewing it'],
    ['awaiting_client', 'Awaiting update', 'Waiting for your project manager’s update'],
    ['in_progress', 'Work in progress', 'The agreed work is underway'],
    ['ready_for_review', 'Project manager checking work', 'Your project manager is checking the work'],
    ['on_hold', 'Paused', 'Your project manager has paused this request'],
    ['closed', 'Closed', 'Request closed'],
    ['declined', 'Not proceeding', 'Request not proceeding'],
    ['cancelled', 'Cancelled', 'Request cancelled'],
  ] as const)('explains the %s state without inventing a client action', (status, statusLabel, label) => {
    expect(clientTicketProgress(status, null)).toMatchObject({ statusLabel, label, needsClientAction: false });
  });

  it.each([
    ['reply', 'Your reply is needed', 'Reply needed'],
    ['agree_scope', 'Review the proposed work', 'Decision needed'],
    ['review_result', 'Your result review is needed', 'Result to review'],
  ] as const)('gives a plain-language next step for %s', (action, label, statusLabel) => {
    expect(clientTicketProgress('awaiting_client', action)).toMatchObject({ label, statusLabel, needsClientAction: true });
  });

  it('shows a clear status when the client needs to act', () => {
    expect(clientTicketProgress('awaiting_client', 'agree_scope').statusLabel).toBe('Decision needed');
  });

  it('does not surface a stale client action for a terminal ticket', () => {
    expect(clientTicketProgress('closed', 'review_result')).toMatchObject({ label: 'Request closed', needsClientAction: false });
  });

  it('does not imply that client acceptance closes a ticket or completes a project', () => {
    const copy = clientTicketProgress('ready_for_review', null).description;
    expect(copy).toContain('before sharing a result');
    expect(copy).not.toContain('project is complete');
  });
});
