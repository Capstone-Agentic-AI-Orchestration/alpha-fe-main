import { apiService } from '@/shared/services/apiService';
import type { Issue, Project } from '@/shared/types';
import type { PmTicketDetail } from './pmApi';

export interface PmHandoffProject { id: string; name: string; key: string }
export interface PmHandoffIssue {
  id: string; projectId: string; identifier: string; title: string;
  status: Issue['status']; assignedHuman: string | null;
}
export interface PmHandoffOptions { projects: PmHandoffProject[]; issues: PmHandoffIssue[] }

export function pmIssueChoice(issue: Issue): PmHandoffIssue {
  return { id: issue.id, projectId: issue.projectId, identifier: issue.identifier,
    title: issue.title, status: issue.status, assignedHuman: issue.assignedHuman ?? null };
}

export function canAuthorizeTicketWork(detail: PmTicketDetail, clientAccessActive: boolean): boolean {
  return clientAccessActive && detail.writesAvailable && !detail.readOnly
    && detail.status === 'under_review'
    && detail.scope?.agreed === true && detail.scope.id === detail.internal.scopeVersion?.id
    && !detail.internal.authorizedScopeVersionId && !detail.internal.projectId
    && detail.internal.requiredIssueIds.length === 0 && !detail.internal.withdrawalRequested;
}

/** Display preflight only. The command service rechecks authoritative tenant,
 * assignment, run, binding and revision evidence inside the handoff transaction.
 */
export function isHandoffIssueCandidate(issue: PmHandoffIssue, projectId: string): boolean {
  return issue.projectId === projectId && (issue.status === 'backlog' || issue.status === 'todo')
    && Boolean(issue.assignedHuman?.trim());
}

export function validHandoffSelection(options: PmHandoffOptions, projectId: string, issueIds: readonly string[]): boolean {
  return options.projects.some(project => project.id === projectId) && issueIds.length > 0
    && new Set(issueIds).size === issueIds.length
    && issueIds.every(id => options.issues.some(issue => issue.id === id && isHandoffIssueCandidate(issue, projectId)));
}

/** Reuse the existing workspace-scoped APIs; do not introduce a second project
 * catalogue. Retain only selection labels, never project resources/env values,
 * Issue descriptions/comments or repository details in the form's state.
 */
export async function loadPmHandoffOptions(): Promise<PmHandoffOptions> {
  const [projects, issues] = await Promise.all([apiService.getProjects(), apiService.getIssues()]);
  return {
    projects: projects.map((project: Project) => ({ id: project.id, name: project.name, key: project.key })),
    issues: issues.map(pmIssueChoice),
  };
}
