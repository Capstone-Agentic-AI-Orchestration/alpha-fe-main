import { describe, expect, it } from 'vitest';
import type { PmTicketDetail } from './pmApi';
import { pmNextStep, pmProjectUsesChecklist, type PmNextStepFlags } from './pmNextStep';

const flags = (overrides: Partial<PmNextStepFlags> = {}): PmNextStepFlags => ({
  clientAccessActive: true, canInvite: false, canPlan: true, canStartWork: true, canCheckAndShare: true,
  canShare: true, canClose: true, canCorrect: true, canResume: true, ...overrides,
});
function ticket(status: PmTicketDetail['status'], nextAction: PmTicketDetail['internal']['nextAction'],
  actionOwner: PmTicketDetail['internal']['actionOwner'] = 'pm', extra: Partial<PmTicketDetail> = {}): PmTicketDetail {
  return {
    id: 't1', reference: 'R-1', title: 'Export', description: 'd', companyLabel: 'Co', status, version: 1,
    createdAt: '', updatedAt: '', closedAt: null, readOnly: false, writesAvailable: true, requestedAction: null,
    sharedProjectName: null, relatedTicket: null, scope: null, delivery: null, request: null,
    internal: { updatedAt: '', projectId: null, requiredIssueIds: [], actionOwner, nextAction, authorizedScopeVersionId: null,
      correctionRequestedFor: null, withdrawalRequested: false, closureReason: null, request: null, scopeVersion: null, deliveryAssessment: null },
    ...extra,
  } as PmTicketDetail;
}
const scope = (approvedBy: 'client' | 'pm' | null, agreed = approvedBy !== null) => ({ id: 's1', summary: 'Plan', proposedAt: '', agreed, approvedBy });

describe('the PM next step', () => {
  it('asks the PM to invite a client who has no account yet, before anything else', () => {
    const step = pmNextStep(ticket('received', 'review_ticket'), flags({ clientAccessActive: false, canInvite: true }));
    expect(step).toMatchObject({ owner: 'You', primary: { action: 'invite', label: 'Invite client' } });
    expect(pmNextStep(ticket('under_review', 'review_ticket'), flags({ clientAccessActive: false })).primary).toBeNull();
  });

  it('starts a standalone request with sending a plan', () => {
    expect(pmNextStep(ticket('received', 'review_ticket'), flags())).toMatchObject({ title: 'Send the client a plan', primary: { action: 'plan' } });
  });

  it('uses the checklist for new project requests while preserving actions for existing scopes', () => {
    const request = ticket('received', 'review_ticket');
    const projectRequest = { ...request, internal: { ...request.internal, projectId: 'project-1' } };
    expect(pmProjectUsesChecklist(projectRequest)).toBe(true);
    expect(pmNextStep(projectRequest, flags())).toMatchObject({ title: 'Manage request', primary: null, alternative: null });
    expect(pmProjectUsesChecklist(request)).toBe(false);

    const existing = { ...projectRequest, status: 'under_review' as const, scope: scope('client'),
      internal: { ...projectRequest.internal, nextAction: 'authorize_work' as const } };
    expect(pmProjectUsesChecklist(existing)).toBe(false);
    expect(pmNextStep(existing, flags()).primary).toMatchObject({ action: 'start_work' });
  });

  it('offers to start without approval while waiting on the client', () => {
    const step = pmNextStep(ticket('awaiting_client', 'agree_scope', 'client', { scope: scope(null, false) }), flags());
    expect(step).toMatchObject({ owner: 'Client', primary: null, alternative: { action: 'skip_approval', label: 'Start without approval' } });
  });

  it('says who approved the plan when it is time to start work', () => {
    expect(pmNextStep(ticket('under_review', 'authorize_work', 'pm', { scope: scope('pm') }), flags()).title).toBe('Plan ready: start the work');
    expect(pmNextStep(ticket('under_review', 'authorize_work', 'pm', { scope: scope('client') }), flags()))
      .toMatchObject({ title: 'The client approved the plan: start the work', primary: { action: 'start_work' } });
  });

  it('checks and shares a finished result as one step, and recovers if sharing did not happen', () => {
    expect(pmNextStep(ticket('in_progress', 'assess_result'), flags()).primary).toEqual({ action: 'check_share', label: 'Check & share result' });
    expect(pmNextStep(ticket('in_progress', 'share_result'), flags()).primary).toEqual({ action: 'share', label: 'Share result' });
  });

  it('tells the PM when the client is the one being waited on', () => {
    expect(pmNextStep(ticket('awaiting_client', 'reply', 'client'), flags())).toMatchObject({ owner: 'Client', primary: null });
    expect(pmNextStep(ticket('ready_for_review', 'review_result', 'client'), flags()).detail).toContain('closes by itself');
  });

  it('shows no button the PM is not allowed to use', () => {
    expect(pmNextStep(ticket('received', 'review_ticket'), flags({ canPlan: false })).primary).toBeNull();
  });

  it('describes finished requests without offering actions', () => {
    const done = ticket('closed', null, null, { internal: { ...ticket('closed', null).internal, closureReason: 'accepted' } });
    expect(pmNextStep(done, flags())).toMatchObject({ title: 'Done: the client accepted the result', primary: null, alternative: null });
  });
});

