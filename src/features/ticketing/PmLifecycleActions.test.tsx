import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PmTicketDetail } from './pmApi';
import { PmLifecycleForm, pmLifecycleActions, pmLifecycleWrite } from './PmLifecycleActions';

function ticket(overrides: Partial<PmTicketDetail> = {}, internal: Partial<PmTicketDetail['internal']> = {}): PmTicketDetail {
  const base: PmTicketDetail = {
    id: 'ticket', reference: 'T-1', title: 'Test ticket', description: 'Test-only request', companyLabel: 'Test client',
    version: 5, createdAt: '2026-10-08T03:00:00Z', updatedAt: '2026-10-08T03:00:00Z', closedAt: null,
    requestedAction: null, sharedProjectName: null, relatedTicket: null, delivery: null, request: null,
    status: 'under_review', writesAvailable: true, readOnly: false, scope: null,
    internal: { updatedAt: '2026-10-08T03:00:00Z', nextAction: 'review_ticket', actionOwner: 'pm', scopeVersion: null,
      authorizedScopeVersionId: null, projectId: null, requiredIssueIds: [], withdrawalRequested: false,
      correctionRequestedFor: null, closureReason: null, request: null, deliveryAssessment: null },
  };
  return { ...base, ...overrides, internal: { ...base.internal, ...internal } };
}

describe('PM lifecycle actions', () => {
  it('offers answer-and-close and hold for an unauthorized request in review, leaving ending it to Decline', () => {
    expect(pmLifecycleActions(ticket(), true)).toEqual(['answer', 'hold']);
  });

  it('needs active client access and no pending withdrawal to answer and close', () => {
    expect(pmLifecycleActions(ticket(), false)).toEqual(['hold']);
    expect(pmLifecycleActions(ticket({}, { withdrawalRequested: true }), true)).toEqual(['hold']);
  });

  it('offers hold and cancel once work is authorized or under way', () => {
    expect(pmLifecycleActions(ticket({ status: 'in_progress' }, { authorizedScopeVersionId: 'scope', requiredIssueIds: ['i'] }), true)).toEqual(['hold', 'cancel']);
    expect(pmLifecycleActions(ticket({ status: 'awaiting_client' }), true)).toEqual(['hold', 'cancel']);
    expect(pmLifecycleActions(ticket({ status: 'ready_for_review' }), true)).toEqual(['hold', 'cancel']);
  });

  it('offers resume and cancel while on hold', () => {
    expect(pmLifecycleActions(ticket({ status: 'on_hold' }), true)).toEqual(['resume', 'cancel']);
  });

  it('offers nothing on finished or read-only requests', () => {
    for (const status of ['closed', 'declined', 'cancelled'] as const) expect(pmLifecycleActions(ticket({ status }), true)).toEqual([]);
    expect(pmLifecycleActions(ticket({ writesAvailable: false }), true)).toEqual([]);
  });

  it('builds commands with a trimmed reason and the current version', () => {
    expect(pmLifecycleWrite('hold', ticket(), '  Waiting on budget  ', 'op')).toEqual({ kind: 'command',
      input: { schemaVersion: 1, operationId: 'op', expectedVersion: 5, command: { type: 'hold', reason: 'Waiting on budget' } } });
    expect(pmLifecycleWrite('cancel', ticket(), 'No longer needed', 'op').input).toMatchObject({ command: { type: 'cancel', reason: 'No longer needed' } });
    expect(pmLifecycleWrite('resume', ticket(), '', 'op').input).toMatchObject({ command: { type: 'resume' } });
  });

  it('sends answer-and-close as a client message', () => {
    expect(pmLifecycleWrite('answer', ticket(), 'Yes, that is included.', 'op')).toEqual({ kind: 'message',
      input: { schemaVersion: 1, operationId: 'op', expectedVersion: 5, body: 'Yes, that is included.', action: { type: 'answer_close' } } });
  });

  it('asks for a reason or answer except when resuming', () => {
    const hold = renderToStaticMarkup(<PmLifecycleForm action="hold" disabled={false} onCancel={() => undefined} onSubmit={() => undefined} />);
    expect(hold).toContain('Reason for the hold (required)');
    expect(hold).toContain('<textarea');
    expect(hold).toMatch(/<button type="submit"[^>]*disabled=""/);
    const resume = renderToStaticMarkup(<PmLifecycleForm action="resume" disabled={false} onCancel={() => undefined} onSubmit={() => undefined} />);
    expect(resume).not.toContain('<textarea');
    expect(resume).not.toMatch(/<button type="submit"[^>]*disabled=""/);
    expect(renderToStaticMarkup(<PmLifecycleForm action="answer" disabled={false} onCancel={() => undefined} onSubmit={() => undefined} />))
      .toContain('The client sees this message');
  });
});
