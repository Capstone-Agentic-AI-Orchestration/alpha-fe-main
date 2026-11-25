import type { PmCentralIntakeItem } from './pmApi';

/**
 * How an inquiry reads on the PM's Inquiries page, in one place so the list,
 * the detail header and the decision box can never describe it differently.
 */

/** What kind of request this is, in the PM's words. */
export function inquiryKind(item: Pick<PmCentralIntakeItem, 'kind'>): string {
  return item.kind === 'project_proposal' ? 'New project request' : 'Website inquiry';
}

/**
 * Which project it is for. A proposal from a signed-in client always asks for a
 * new project; a website inquiry could become either, so it is not decided yet.
 */
export function inquiryFor(item: Pick<PmCentralIntakeItem, 'kind' | 'status' | 'acceptedProjectName' | 'acceptedTicketId'>): string {
  if (item.acceptedProjectName) return `Project: ${item.acceptedProjectName}`;
  if (item.status === 'accepted' && item.acceptedTicketId) return 'No project linked yet';
  return item.kind === 'project_proposal' ? 'For a new project' : 'Project not decided';
}

/** The reference people can read aloud: "INQ-02D05BE4" rather than all 36 characters. */
export function shortReference(reference: string | undefined): string | null {
  if (!reference) return null;
  const match = /^INQ-([A-F0-9]{8})[A-F0-9]*$/i.exec(reference);
  return match ? `INQ-${match[1].toUpperCase()}` : reference;
}

/**
 * Who sent it, without saying the same thing twice. A proposal stores the
 * client's email as their name, so the email is only shown when it adds something.
 */
export function inquiryContact(item: Pick<PmCentralIntakeItem, 'fullName' | 'email' | 'company'>): { name: string; detail: string | null } {
  const name = item.fullName.trim() || item.email;
  const sameAsName = name.toLowerCase() === item.email.toLowerCase();
  const parts = [sameAsName ? null : item.email, item.company?.trim() || null].filter((part): part is string => Boolean(part));
  return { name, detail: parts.length ? parts.join(' · ') : null };
}

/** Where it stands, worded the same in the list and the header. */
export function inquiryStatus(item: Pick<PmCentralIntakeItem, 'kind' | 'status' | 'clarificationMessages'>, view: 'pending' | 'handled'): string {
  if (view === 'handled') return item.status === 'accepted' ? 'Accepted' : 'Declined';
  if (item.status === 'awaiting_client') return 'Waiting for the client';
  if (item.kind === 'project_proposal' && item.clarificationMessages?.at(-1)?.author === 'client') return 'Client replied';
  return item.kind === 'project_proposal' ? 'Ready for your review' : 'New · email not verified';
}

/** What became of a handled inquiry, in one sentence. */
export function handledOutcome(item: Pick<PmCentralIntakeItem, 'kind' | 'status' | 'acceptedProjectName'>): string {
  const proposal = item.kind === 'project_proposal';
  if (item.status === 'accepted' && item.acceptedProjectName) {
    return proposal ? `Accepted into ${item.acceptedProjectName}. The client follows it from their projects.` : `Accepted into ${item.acceptedProjectName}.`;
  }
  if (item.status === 'accepted') {
    return proposal ? 'Accepted. Open the request to start or link the project.' : 'Accepted. The request is available here.';
  }
  return proposal ? 'Declined. No request or project was created.' : 'Declined. No request or client access was created.';
}

/** One sentence on what starting a project does, so the buttons never have to explain themselves. */
export function acceptOutcome(item: Pick<PmCentralIntakeItem, 'kind'>, workspaceName: string | null): string {
  const where = workspaceName ?? 'this workspace';
  return item.kind === 'project_proposal'
    ? `Start a new project and Alpha creates it in ${where}, with its repositories if you choose, opens the request and lets this client see the project. Or add it to a project you already have.`
    : `Start a new project, or add it to one you already have, and Alpha opens the request in ${where} and can email the sender an invitation to the client portal. They get access once they set a password.`;
}
