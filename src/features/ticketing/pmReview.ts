import { apiService } from '@/shared/services/apiService';
import type { PmTicketCommand, PmTicketDetail } from './pmApi';
import { pmIssueChoice, type PmHandoffIssue } from './pmWorkHandoff';

export type PmCorrectionMode = 'pm_review' | 'client_feedback';
export interface PmCorrectionDraft { issueIds: string[]; reason: string }

export function pmCorrectionMode(ticket: PmTicketDetail, clientAccessActive: boolean): PmCorrectionMode | null {
  if (!clientAccessActive || !ticket.writesAvailable || ticket.readOnly || ticket.internal.withdrawalRequested
    || !ticket.internal.projectId || !ticket.internal.requiredIssueIds.length
    || !ticket.scope?.agreed || ticket.internal.authorizedScopeVersionId !== ticket.scope.id
    || ticket.internal.scopeVersion?.id !== ticket.scope.id) return null;
  if (ticket.status === 'in_progress') return 'pm_review';
  if (ticket.status === 'under_review' && ticket.internal.correctionRequestedFor
    && ticket.internal.correctionRequestedFor === ticket.internal.deliveryAssessment?.id) return 'client_feedback';
  return null;
}

/** UI filtering only. The server must recheck run claims, exact revisions,
 * ticket ownership and active assignees in the correction transaction.
 */
export function isPmCorrectionCandidate(ticket: PmTicketDetail, issue: PmHandoffIssue): boolean {
  return ticket.internal.requiredIssueIds.includes(issue.id) && issue.projectId === ticket.internal.projectId
    && (issue.status === 'review' || issue.status === 'done') && Boolean(issue.assignedHuman?.trim());
}

export function validPmCorrectionSelection(ticket: PmTicketDetail, issues: readonly PmHandoffIssue[], draft: PmCorrectionDraft): boolean {
  const manifest = ticket.internal.requiredIssueIds;
  return manifest.length > 0 && new Set(manifest).size === manifest.length
    && manifest.every(id => issues.some(issue => issue.id === id && issue.projectId === ticket.internal.projectId))
    && draft.issueIds.length > 0 && new Set(draft.issueIds).size === draft.issueIds.length
    && draft.issueIds.every(id => issues.some(issue => issue.id === id && isPmCorrectionCandidate(ticket, issue)))
    && draft.reason.trim().length > 0 && draft.reason.trim().length <= 4000;
}

export function pmCorrectionCommand(ticket: PmTicketDetail, mode: PmCorrectionMode, draft: PmCorrectionDraft): PmTicketCommand {
  const values = { issueIds: [...draft.issueIds], reason: draft.reason.trim() };
  return mode === 'client_feedback'
    ? { type: 'authorize_correction', deliveryId: ticket.internal.correctionRequestedFor!, ...values }
    : { type: 'request_fixes', ...values };
}

export async function loadPmReviewIssues(ticket: PmTicketDetail): Promise<PmHandoffIssue[]> {
  const issues = await apiService.getIssues();
  return issues.filter(issue => ticket.internal.requiredIssueIds.includes(issue.id)
    && issue.projectId === ticket.internal.projectId).map(pmIssueChoice);
}

export function canCloseAcceptedTicket(ticket: PmTicketDetail, clientAccessActive: boolean): boolean {
  return clientAccessActive && ticket.writesAvailable && !ticket.readOnly && !ticket.internal.withdrawalRequested
    && ticket.status === 'ready_for_review' && ticket.delivery?.accepted === true
    && ticket.delivery.id === ticket.internal.deliveryAssessment?.id
    && ticket.internal.deliveryAssessment.shared && ticket.internal.deliveryAssessment.immutable
    && ticket.internal.deliveryAssessment.clientVisible
    && ticket.internal.deliveryAssessment.scopeVersionId === ticket.delivery.scopeVersionId
    && ticket.delivery.scopeVersionId === ticket.internal.authorizedScopeVersionId
    && ticket.scope?.id === ticket.delivery.scopeVersionId && ticket.scope.agreed;
}

export function canShareAssessedDelivery(ticket: PmTicketDetail, clientAccessActive: boolean): boolean {
  const delivery = ticket.internal.deliveryAssessment;
  return clientAccessActive && ticket.writesAvailable && !ticket.readOnly && !ticket.internal.withdrawalRequested
    && ticket.status === 'in_progress' && ticket.internal.actionOwner === 'pm' && ticket.internal.nextAction === 'share_result'
    && ticket.internal.correctionRequestedFor === null && ticket.delivery === null && delivery !== null
    && !delivery.shared && delivery.immutable && delivery.clientVisible && Boolean(delivery.pinnedAssetId)
    && ticket.scope?.agreed === true && delivery.scopeVersionId === ticket.scope.id
    && ticket.internal.authorizedScopeVersionId === ticket.scope.id && Boolean(ticket.internal.projectId)
    && ticket.internal.requiredIssueIds.length > 0
    && new Set(ticket.internal.requiredIssueIds).size === ticket.internal.requiredIssueIds.length
    && delivery.issueRevisionIds.length === ticket.internal.requiredIssueIds.length
    && new Set(delivery.issueRevisionIds).size === delivery.issueRevisionIds.length;
}

/** Display-only preflight. Actual completed reviews/registration/scanning must
 * be checked again by the backend assessment transaction, not this UI label.
 */
export function canAssessTicketDelivery(ticket: PmTicketDetail, clientAccessActive: boolean): boolean {
  return clientAccessActive && ticket.writesAvailable && !ticket.readOnly && !ticket.internal.withdrawalRequested
    && ticket.status === 'in_progress' && ticket.internal.actionOwner === 'pm'
    && ['assess_result', 'reply'].includes(ticket.internal.nextAction ?? '')
    && ticket.delivery === null && ticket.internal.deliveryAssessment === null && ticket.internal.correctionRequestedFor === null
    && ticket.scope?.agreed === true && ticket.internal.authorizedScopeVersionId === ticket.scope.id
    && ticket.internal.scopeVersion?.id === ticket.scope.id && ticket.internal.scopeVersion.immutable
    && ticket.internal.scopeVersion.clientVisible && Boolean(ticket.internal.projectId)
    && ticket.internal.requiredIssueIds.length > 0
    && new Set(ticket.internal.requiredIssueIds).size === ticket.internal.requiredIssueIds.length;
}
