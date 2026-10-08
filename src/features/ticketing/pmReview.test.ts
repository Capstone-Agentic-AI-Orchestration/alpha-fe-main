import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiService } from '@/shared/services/apiService';
import type { Issue } from '@/shared/types';
import type { PmTicketDetail } from './pmApi';
import type { PmHandoffIssue } from './pmWorkHandoff';
import { canAssessTicketDelivery, canCloseAcceptedTicket, canShareAssessedDelivery, isPmCorrectionCandidate, loadPmReviewIssues, pmCorrectionCommand, pmCorrectionMode, validPmCorrectionSelection } from './pmReview';

afterEach(() => vi.restoreAllMocks());
function detail(): PmTicketDetail {
  return {
    id: 'ticket', reference: 'T-1', title: 'Test ticket', description: 'Test-only request', companyLabel: 'Test client',
    version: 5, createdAt: '2026-10-08T03:00:00Z', updatedAt: '2026-10-08T03:00:00Z', closedAt: null,
    requestedAction: null, sharedProjectName: null, relatedTicket: null, delivery: null, request: null,
    status: 'in_progress', writesAvailable: true, readOnly: false,
    scope: { id: 'scope', summary: 'Agreed work', proposedAt: '2026-10-08T03:00:00Z', agreed: true },
    internal: { updatedAt: '2026-10-08T03:00:00Z', nextAction: 'assess_result', actionOwner: 'pm',
      scopeVersion: { id: 'scope', summary: 'Agreed work', developerBrief: 'Private brief', proposedAt: '2026-10-08T03:00:00Z', immutable: true, clientVisible: true },
      authorizedScopeVersionId: 'scope', projectId: 'project', requiredIssueIds: ['issue-a', 'issue-b'], withdrawalRequested: false,
      correctionRequestedFor: null, closureReason: null, request: null, deliveryAssessment: null },
  };
}
function issues(): PmHandoffIssue[] {
  return ['a', 'b'].map(suffix => ({ id: `issue-${suffix}`, identifier: `P-${suffix}`, title: 'Reviewed work',
    projectId: 'project', assignedHuman: 'dev', status: 'done' }));
}
function accepted(): PmTicketDetail {
  const ticket = detail(); ticket.status = 'ready_for_review';
  ticket.delivery = { id: 'delivery', scopeVersionId: 'scope', summary: 'Shared result', sharedAt: '2026-10-08T03:00:00Z', accepted: true };
  ticket.internal.deliveryAssessment = { id: 'delivery', scopeVersionId: 'scope', summary: 'Result', pinnedAssetId: 'asset',
    issueRevisionIds: ['rev-a', 'rev-b'], immutable: true, clientVisible: true, shared: true };
  return ticket;
}

describe('PM correction preflight', () => {
  it('offers result assessment only for current agreed work pending PM review, never publication', () => {
    expect(canAssessTicketDelivery(detail(), true)).toBe(true);
    expect(canAssessTicketDelivery(detail(), false)).toBe(false);
    for (const invalid of ['disabled', 'read-only', 'wrong-action', 'withdrawal', 'no-project', 'wrong-scope', 'not-agreed', 'assessed', 'no-manifest', 'private-scope']) {
      const v = detail();
      if (invalid === 'disabled') v.writesAvailable = false;
      if (invalid === 'read-only') v.readOnly = true;
      if (invalid === 'wrong-action') v.internal.nextAction = 'execute_work';
      if (invalid === 'withdrawal') v.internal.withdrawalRequested = true;
      if (invalid === 'no-project') v.internal.projectId = null;
      if (invalid === 'wrong-scope') v.internal.authorizedScopeVersionId = 'other';
      if (invalid === 'not-agreed') v.scope!.agreed = false;
      if (invalid === 'assessed') v.internal.deliveryAssessment = accepted().internal.deliveryAssessment;
      if (invalid === 'no-manifest') v.internal.requiredIssueIds = [];
      if (invalid === 'private-scope') v.internal.scopeVersion!.clientVisible = false;
      expect(canAssessTicketDelivery(v, true), invalid).toBe(false);
    }
  });
  it('offers sharing only for an already assessed unshared complete current result', () => {
    const value = accepted(); value.status = 'in_progress'; value.delivery = null;
    value.internal.deliveryAssessment!.shared = false; value.internal.nextAction = 'share_result';
    expect(canShareAssessedDelivery(value, true)).toBe(true);
    expect(canShareAssessedDelivery(value, false)).toBe(false);
    const original = structuredClone(value);
    for (const invalid of ['disabled', 'withdrawal', 'shared', 'wrong-scope', 'not-agreed', 'wrong-action', 'no-project', 'incomplete', 'private', 'mutable']) {
      const v = structuredClone(original);
      if (invalid === 'disabled') v.writesAvailable = false;
      if (invalid === 'withdrawal') v.internal.withdrawalRequested = true;
      if (invalid === 'shared') v.internal.deliveryAssessment!.shared = true;
      if (invalid === 'wrong-scope') v.internal.deliveryAssessment!.scopeVersionId = 'other';
      if (invalid === 'not-agreed') v.scope!.agreed = false;
      if (invalid === 'wrong-action') v.internal.nextAction = 'execute_work';
      if (invalid === 'no-project') v.internal.projectId = null;
      if (invalid === 'incomplete') v.internal.deliveryAssessment!.issueRevisionIds = ['one'];
      if (invalid === 'private') v.internal.deliveryAssessment!.clientVisible = false;
      if (invalid === 'mutable') v.internal.deliveryAssessment!.immutable = false;
      expect(canShareAssessedDelivery(v, true), invalid).toBe(false);
    }
  });
  it('distinguishes PM review from a client correction on the exact shared delivery', () => {
    expect(pmCorrectionMode(detail(), true)).toBe('pm_review');
    const ticket = accepted(); ticket.status = 'under_review'; ticket.internal.correctionRequestedFor = 'delivery';
    expect(pmCorrectionMode(ticket, true)).toBe('client_feedback');
    ticket.internal.correctionRequestedFor = 'older-delivery';
    expect(pmCorrectionMode(ticket, true)).toBeNull();
  });
  it.each(['received', 'awaiting_client', 'ready_for_review', 'on_hold', 'closed', 'declined', 'cancelled'] as const)('refuses correction while %s', status => {
    const ticket = detail(); ticket.status = status;
    expect(pmCorrectionMode(ticket, true)).toBeNull();
  });
  it.each(['no-client', 'disabled', 'read-only', 'withdrawal', 'no-project', 'no-manifest', 'no-agreement', 'wrong-scope'])('refuses %s', condition => {
    const ticket = detail();
    if (condition === 'disabled') ticket.writesAvailable = false;
    if (condition === 'read-only') ticket.readOnly = true;
    if (condition === 'withdrawal') ticket.internal.withdrawalRequested = true;
    if (condition === 'no-project') ticket.internal.projectId = null;
    if (condition === 'no-manifest') ticket.internal.requiredIssueIds = [];
    if (condition === 'no-agreement') ticket.scope!.agreed = false;
    if (condition === 'wrong-scope') ticket.internal.authorizedScopeVersionId = 'other';
    expect(pmCorrectionMode(ticket, condition !== 'no-client')).toBeNull();
  });
  it.each(['review', 'done'] as const)('offers an assigned %s Issue in the exact ticket manifest', status => {
    expect(isPmCorrectionCandidate(detail(), { ...issues()[0], status })).toBe(true);
  });
  it.each(['backlog', 'todo', 'in_progress', 'agent_running'] as const)('does not offer %s work for another reset', status => {
    expect(isPmCorrectionCandidate(detail(), { ...issues()[0], status })).toBe(false);
  });
  it('excludes other projects, other tickets and unassigned work', () => {
    for (const extra of [{ projectId: 'other' }, { id: 'unrelated' }, { assignedHuman: null }, { assignedHuman: ' ' }]) {
      expect(isPmCorrectionCandidate(detail(), { ...issues()[0], ...extra })).toBe(false);
    }
  });
  it('requires the full visible manifest and a unique affected subset with explicit instructions', () => {
    const draft = { issueIds: ['issue-a'], reason: 'Fix the agreed validation behavior.' };
    expect(validPmCorrectionSelection(detail(), issues(), draft)).toBe(true);
    expect(validPmCorrectionSelection(detail(), issues().slice(0, 1), draft)).toBe(false);
    for (const invalid of [{ issueIds: [] }, { issueIds: ['unrelated'] }, { issueIds: ['issue-a', 'issue-a'] }, { reason: ' ' }, { reason: 'x'.repeat(4001) }]) {
      expect(validPmCorrectionSelection(detail(), issues(), { ...draft, ...invalid })).toBe(false);
    }
  });
  it('sends PM-written instructions with either correction action and copies the selected array', () => {
    const draft = { issueIds: ['issue-b'], reason: '  Correct validation only.  ' };
    const command = pmCorrectionCommand(detail(), 'pm_review', draft);
    expect(command).toEqual({ type: 'request_fixes', issueIds: ['issue-b'], reason: 'Correct validation only.' });
    draft.issueIds.push('issue-a'); expect('issueIds' in command && command.issueIds).toEqual(['issue-b']);
    const ticket = accepted(); ticket.internal.correctionRequestedFor = 'delivery';
    expect(pmCorrectionCommand(ticket, 'client_feedback', { issueIds: ['issue-a'], reason: 'Fix the accepted scope.' }))
      .toEqual({ type: 'authorize_correction', deliveryId: 'delivery', issueIds: ['issue-a'], reason: 'Fix the accepted scope.' });
  });
  it('loads only this ticket’s Issue labels, without retaining descriptions or internal comments', async () => {
    vi.spyOn(apiService, 'getIssues').mockResolvedValue([
      ...issues().map(issue => ({ ...issue, description: 'Private implementation', comments: [{ content: 'Private note' }] })),
      { ...issues()[0], id: 'unrelated' }, { ...issues()[0], projectId: 'other' },
    ] as unknown as Issue[]);
    expect(await loadPmReviewIssues(detail())).toEqual(issues());
  });
});

describe('PM accepted ticket closure preflight', () => {
  it('offers closure only for the client-accepted current scope/delivery', () => {
    expect(canCloseAcceptedTicket(accepted(), true)).toBe(true);
    expect(canCloseAcceptedTicket(accepted(), false)).toBe(false);
  });
  it.each(['not-accepted', 'wrong-delivery', 'wrong-scope', 'withdrawal', 'closed', 'disabled', 'read-only'])('refuses %s closure', condition => {
    const ticket = accepted();
    if (condition === 'not-accepted') ticket.delivery!.accepted = false;
    if (condition === 'wrong-delivery') ticket.delivery!.id = 'older-delivery';
    if (condition === 'wrong-scope') ticket.delivery!.scopeVersionId = 'older-scope';
    if (condition === 'withdrawal') ticket.internal.withdrawalRequested = true;
    if (condition === 'closed') ticket.status = 'closed';
    if (condition === 'disabled') ticket.writesAvailable = false;
    if (condition === 'read-only') ticket.readOnly = true;
    expect(canCloseAcceptedTicket(ticket, true)).toBe(false);
  });
});
