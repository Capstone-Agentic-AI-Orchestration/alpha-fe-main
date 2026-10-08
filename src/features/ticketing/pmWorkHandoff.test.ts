import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiService } from '@/shared/services/apiService';
import type { Issue, Project } from '@/shared/types';
import type { PmTicketDetail } from './pmApi';
import { canAuthorizeTicketWork, isHandoffIssueCandidate, loadPmHandoffOptions, validHandoffSelection, type PmHandoffOptions } from './pmWorkHandoff';

afterEach(() => vi.restoreAllMocks());

function detail(): PmTicketDetail {
  return {
    id: 'ticket', reference: 'T-1', title: 'Test ticket', description: 'Test-only request', companyLabel: 'Test client',
    version: 3, createdAt: '2026-10-08T03:00:00Z', updatedAt: '2026-10-08T03:00:00Z', closedAt: null,
    requestedAction: null, sharedProjectName: null, relatedTicket: null, delivery: null, request: null,
    status: 'under_review', writesAvailable: true, readOnly: false,
    scope: { id: 'scope', summary: 'Agreed work', proposedAt: '2026-10-08T03:00:00Z', agreed: true },
    internal: { updatedAt: '2026-10-08T03:00:00Z', nextAction: 'authorize_work', actionOwner: 'pm',
      scopeVersion: { id: 'scope', summary: 'Agreed work', developerBrief: 'Private brief', proposedAt: '2026-10-08T03:00:00Z', immutable: true, clientVisible: true },
      authorizedScopeVersionId: null, projectId: null, requiredIssueIds: [], withdrawalRequested: false,
      correctionRequestedFor: null, closureReason: null, request: null, deliveryAssessment: null },
  };
}
function options(): PmHandoffOptions {
  return { projects: [{ id: 'project-a', key: 'A', name: 'Project A' }, { id: 'project-b', key: 'B', name: 'Project B' }],
    issues: [{ id: 'issue-a', projectId: 'project-a', identifier: 'A-1', title: 'Existing work', assignedHuman: 'dev', status: 'todo' },
      { id: 'issue-b', projectId: 'project-b', identifier: 'B-1', title: 'Other project work', assignedHuman: 'dev', status: 'backlog' }] };
}

describe('PM work handoff display preflight', () => {
  it('offers authorization only after client agreement', () => {
    expect(canAuthorizeTicketWork(detail(), true)).toBe(true);
    const state = detail(); state.scope!.agreed = false;
    expect(canAuthorizeTicketWork(state, true)).toBe(false);
    expect(canAuthorizeTicketWork(detail(), false)).toBe(false);
  });
  it.each(['received', 'awaiting_client', 'in_progress', 'ready_for_review', 'on_hold', 'closed', 'declined', 'cancelled'] as const)('does not offer a new handoff while %s', status => {
    const state = detail(); state.status = status;
    expect(canAuthorizeTicketWork(state, true)).toBe(false);
  });
  it.each(['disabled', 'read-only', 'authorized', 'project-linked', 'manifest-present', 'withdrawing', 'stale-scope', 'no-scope'])('fails closed on %s', condition => {
    const state = detail();
    if (condition === 'disabled') state.writesAvailable = false;
    if (condition === 'read-only') state.readOnly = true;
    if (condition === 'authorized') state.internal.authorizedScopeVersionId = 'scope';
    if (condition === 'project-linked') state.internal.projectId = 'project-a';
    if (condition === 'manifest-present') state.internal.requiredIssueIds = ['issue-a'];
    if (condition === 'withdrawing') state.internal.withdrawalRequested = true;
    if (condition === 'stale-scope') state.internal.scopeVersion!.id = 'other-scope';
    if (condition === 'no-scope') state.scope = null;
    expect(canAuthorizeTicketWork(state, true)).toBe(false);
  });
  it('does not lose handoff access when a client follow-up changes the suggested next action', () => {
    const state = detail(); state.internal.nextAction = 'reply';
    expect(canAuthorizeTicketWork(state, true)).toBe(true);
  });
  it.each(['backlog', 'todo'] as const)('allows an assigned %s Issue from the selected project', status => {
    const issue = options().issues[0]; issue.status = status;
    expect(isHandoffIssueCandidate(issue, 'project-a')).toBe(true);
    expect(isHandoffIssueCandidate(issue, 'project-b')).toBe(false);
  });
  it.each(['in_progress', 'agent_running', 'review', 'done'] as const)('excludes already-started %s Issues', status => {
    expect(isHandoffIssueCandidate({ ...options().issues[0], status }, 'project-a')).toBe(false);
  });
  it.each([null, '', '   '])('excludes missing human assignment %s', assignedHuman => {
    expect(isHandoffIssueCandidate({ ...options().issues[0], assignedHuman }, 'project-a')).toBe(false);
  });
  it('accepts only a nonempty unique selection of existing Issues in one existing project', () => {
    const choices = options();
    expect(validHandoffSelection(choices, 'project-a', ['issue-a'])).toBe(true);
    expect(validHandoffSelection(choices, 'project-b', ['issue-b'])).toBe(true);
    for (const ids of [[], ['missing'], ['issue-b'], ['issue-a', 'issue-a'], ['issue-a', 'issue-b']]) {
      expect(validHandoffSelection(choices, 'project-a', ids)).toBe(false);
    }
    expect(validHandoffSelection(choices, 'missing', ['issue-a'])).toBe(false);
  });
  it('loads existing workspace APIs without retaining descriptions, repository resources or secrets', async () => {
    const projects = vi.spyOn(apiService, 'getProjects').mockResolvedValue([
      { ...options().projects[0], envVars: [{ key: 'TEST_ONLY', value: 'synthetic-sensitive-value' }], resources: [{ pathOrUrl: 'private-path' }] } as Project,
    ]);
    const issues = vi.spyOn(apiService, 'getIssues').mockResolvedValue([
      { ...options().issues[0], description: 'private description', comments: [{ content: 'private comment' }] } as unknown as Issue,
    ]);
    const result = await loadPmHandoffOptions();
    expect(projects).toHaveBeenCalledOnce(); expect(issues).toHaveBeenCalledOnce();
    expect(result).toEqual({ projects: [options().projects[0]], issues: [options().issues[0]] });
  });
  it('does not substitute mock or partially loaded choices if an API fails', async () => {
    vi.spyOn(apiService, 'getProjects').mockResolvedValue([]);
    vi.spyOn(apiService, 'getIssues').mockRejectedValue(new Error('Unavailable'));
    await expect(loadPmHandoffOptions()).rejects.toThrow('Unavailable');
  });
});
