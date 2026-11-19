import type { PmTicketDetail } from './pmApi';

/** The one action the PM screen offers as its big button. */
export type PmStepAction =
  | 'invite' | 'plan' | 'reply' | 'skip_approval' | 'start_work' | 'check_share' | 'share'
  | 'close' | 'correction' | 'withdrawal' | 'resume';

export interface PmNextStep {
  /** Who the request is waiting on, in plain words. */
  owner: 'You' | 'Client' | 'Developer' | null;
  /** One short sentence: what happens next. */
  title: string;
  /** One line of help for the PM. */
  detail: string;
  primary: { action: PmStepAction; label: string } | null;
  /** A quieter alternative shown beside the main button. */
  alternative: { action: PmStepAction; label: string } | null;
}

export interface PmNextStepFlags {
  clientAccessActive: boolean;
  /** The client still has to be invited before anything else can happen. */
  canInvite: boolean;
  canPlan: boolean;
  canStartWork: boolean;
  canCheckAndShare: boolean;
  canShare: boolean;
  canClose: boolean;
  canCorrect: boolean;
  canResume: boolean;
}

const TERMINAL = new Set(['closed', 'declined', 'cancelled']);

/**
 * Turns the server's "next action" into one sentence and one button. Display only:
 * the server still decides whether each action is allowed.
 */
export function pmNextStep(ticket: PmTicketDetail, flags: PmNextStepFlags): PmNextStep {
  const none = { primary: null, alternative: null };
  if (TERMINAL.has(ticket.status)) {
    const title = ticket.status === 'closed'
      ? ticket.internal.closureReason === 'answered' ? 'Answered and closed' : 'Done: the client accepted the result'
      : ticket.status === 'declined' ? 'Declined' : 'Cancelled';
    return { owner: null, title, detail: 'This request is finished. Its conversation stays available.', ...none };
  }
  if (ticket.status === 'on_hold') {
    return { owner: 'You', title: 'Paused', detail: 'Resume when you are ready to continue from where it stopped.',
      primary: flags.canResume ? { action: 'resume', label: 'Resume' } : null, alternative: null };
  }
  if (ticket.internal.withdrawalRequested) {
    return { owner: 'You', title: 'The client asked to withdraw this request', detail: 'Cancel it, or put it on hold while you talk it through.',
      primary: { action: 'withdrawal', label: 'Cancel request' }, alternative: null };
  }
  if (!flags.clientAccessActive && flags.canInvite) {
    return { owner: 'You', title: 'Invite the client', detail: 'They need a portal account before you can message them or send a plan.',
      primary: { action: 'invite', label: 'Invite client' }, alternative: null };
  }
  if (!flags.clientAccessActive) {
    return { owner: 'Client', title: 'Waiting for the client to activate their account', detail: 'You can keep private notes until they join.', ...none };
  }
  switch (ticket.internal.nextAction) {
    case 'review_ticket':
      return { owner: 'You', title: 'Send the client a plan', detail: 'Describe the work, or ask a question first in the conversation.',
        primary: flags.canPlan ? { action: 'plan', label: 'Send plan' } : null, alternative: null };
    case 'reply':
      if (ticket.internal.actionOwner === 'client') {
        return { owner: 'Client', title: 'Waiting for the client to answer your question', detail: 'They see this as something that needs them.', ...none };
      }
      return { owner: 'You', title: 'The client replied', detail: 'Answer in the conversation, or send a plan when you have what you need.',
        primary: { action: 'reply', label: 'Reply' }, alternative: flags.canPlan ? { action: 'plan', label: ticket.scope ? 'Revise plan' : 'Send plan' } : null };
    case 'agree_scope':
      return { owner: 'Client', title: 'Waiting for the client to approve the plan', detail: 'You can start without their approval if you prefer.',
        primary: null, alternative: ticket.scope ? { action: 'skip_approval', label: 'Start without approval' } : null };
    case 'authorize_work':
      return { owner: 'You', title: ticket.scope?.approvedBy === 'pm' ? 'Plan ready: start the work' : 'The client approved the plan: start the work',
        detail: 'Choose the project tasks the developer should work on.',
        primary: flags.canStartWork ? { action: 'start_work', label: 'Start work' } : null, alternative: null };
    case 'execute_work':
      return { owner: 'Developer', title: 'The work is underway', detail: 'You will be asked to check it once the tasks are done and reviewed.',
        primary: null, alternative: flags.canCorrect ? { action: 'correction', label: 'Send tasks back' } : null };
    case 'assess_result':
      return { owner: 'You', title: 'Check the finished work and share it', detail: 'Look over the result, then send it to the client in one step.',
        primary: flags.canCheckAndShare ? { action: 'check_share', label: 'Check & share result' } : null,
        alternative: flags.canCorrect ? { action: 'correction', label: 'Send tasks back' } : null };
    case 'share_result':
      return { owner: 'You', title: 'Share the approved result', detail: 'The result is checked but the client cannot see it yet.',
        primary: flags.canShare ? { action: 'share', label: 'Share result' } : null, alternative: null };
    case 'review_result':
      return { owner: 'Client', title: 'Waiting for the client to check the result', detail: 'The request closes by itself when they accept it.', ...none };
    case 'close_ticket':
      return { owner: 'You', title: 'The client accepted the result', detail: 'Close the request to finish it.',
        primary: flags.canClose ? { action: 'close', label: 'Close request' } : null, alternative: null };
    case 'triage_correction':
      return { owner: 'You', title: 'The client asked for a fix', detail: 'Read their note, then send the affected tasks back to the developer.',
        primary: flags.canCorrect ? { action: 'correction', label: 'Review fix request' } : null, alternative: null };
    case 'handle_withdrawal':
      return { owner: 'You', title: 'The client asked to withdraw this request', detail: 'Cancel it, or put it on hold while you talk it through.',
        primary: { action: 'withdrawal', label: 'Cancel request' }, alternative: null };
    case 'resolve_hold':
      return { owner: 'You', title: 'Paused', detail: 'Resume when you are ready.',
        primary: flags.canResume ? { action: 'resume', label: 'Resume' } : null, alternative: null };
    default:
      return { owner: null, title: 'Nothing to do right now', detail: '', ...none };
  }
}

