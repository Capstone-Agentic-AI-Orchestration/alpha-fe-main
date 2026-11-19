import { describe, expect, it } from 'vitest';
import { clientTicketProgress } from './clientTicketProgress';

describe('client ticket status guidance', () => {
  it.each([
    ['received', 'Received', 'Waiting for your project manager to review'],
    ['under_review', 'Planning', 'Your project manager is planning the work'],
    ['awaiting_client', 'Planning', 'Waiting for your project manager’s update'],
    ['in_progress', 'In progress', 'The work is underway'],
    ['ready_for_review', 'Ready for you', 'Your result has been shared'],
    ['on_hold', 'Paused', 'Your project manager has paused this request'],
    ['closed', 'Done', 'Request done'],
    ['declined', 'Not proceeding', 'Request not proceeding'],
    ['cancelled', 'Cancelled', 'Request cancelled'],
  ] as const)('explains the %s state without inventing a client action', (status, statusLabel, label) => {
    expect(clientTicketProgress(status, null)).toMatchObject({ statusLabel, label, needsClientAction: false });
  });

  it.each([
    ['reply', 'Your reply is needed', 'Reply needed'],
    ['agree_scope', 'Approve the plan', 'Approve the plan'],
    ['review_result', 'Your result is ready to check', 'Ready for you'],
  ] as const)('gives a plain-language next step for %s', (action, label, statusLabel) => {
    expect(clientTicketProgress('awaiting_client', action)).toMatchObject({ label, statusLabel, needsClientAction: true });
  });

  it('shows a clear status when the client needs to act', () => {
    expect(clientTicketProgress('awaiting_client', 'agree_scope').statusLabel).toBe('Approve the plan');
  });

  it('does not surface a stale client action for a terminal ticket', () => {
    expect(clientTicketProgress('closed', 'review_result')).toMatchObject({ label: 'Request done', needsClientAction: false });
  });

  it('does not imply that a shared result completes the project', () => {
    const copy = clientTicketProgress('ready_for_review', null).description;
    expect(copy).toContain('shared a result');
    expect(copy).not.toContain('project is complete');
  });
});
