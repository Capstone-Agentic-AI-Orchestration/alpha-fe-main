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

/** Project requests without an existing scope use the conversation and board checklist. */
export function pmProjectUsesChecklist(ticket: PmTicketDetail): boolean {
  return Boolean(ticket.internal.projectId && !ticket.scope && !ticket.internal.scopeVersion
    && !ticket.internal.authorizedScopeVersionId && !ticket.internal.requiredIssueIds.length
    && !ticket.delivery && !ticket.internal.deliveryAssessment);
}

type Step = PmNextStep['primary'];
const TERMINAL = new Set(['closed', 'declined', 'cancelled']);
const when = (allowed: boolean, action: PmStepAction, label: string): Step => allowed ? { action, label } : null;
const step = (owner: PmNextStep['owner'], title: string, detail: string, primary: Step = null, alternative: Step = null): PmNextStep =>
  ({ owner, title, detail, primary, alternative });

type NextAction = NonNullable<PmTicketDetail['internal']['nextAction']>;
/** One entry per server "next action": the sentence the PM reads and the button they get. */
const STEPS: Record<NextAction, (ticket: PmTicketDetail, flags: PmNextStepFlags) => PmNextStep> = {
  review_ticket: (_ticket, flags) => step('You', 'Send the client a plan', 'Describe the work, or ask a question first in the conversation.',
    when(flags.canPlan, 'plan', 'Send plan')),
  reply: (ticket, flags) => ticket.internal.actionOwner === 'client'
    ? step('Client', 'Waiting for the client to answer your question', 'They see this as something that needs them.')
    : step('You', 'The client replied', 'Answer in the conversation, or send a plan when you have what you need.',
      { action: 'reply', label: 'Reply' }, when(flags.canPlan, 'plan', ticket.scope ? 'Revise plan' : 'Send plan')),
  agree_scope: ticket => step('Client', 'Waiting for the client to approve the plan', 'You can start without their approval if you prefer.',
    null, when(Boolean(ticket.scope), 'skip_approval', 'Start without approval')),
  authorize_work: (ticket, flags) => step('You',
    ticket.scope?.approvedBy === 'pm' ? 'Plan ready: start the work' : 'The client approved the plan: start the work',
    'Choose the project tasks the developer should work on.', when(flags.canStartWork, 'start_work', 'Start work')),
  execute_work: (_ticket, flags) => step('Developer', 'The work is underway', 'You will be asked to check it once the tasks are done and reviewed.',
    null, when(flags.canCorrect, 'correction', 'Send tasks back')),
  assess_result: (_ticket, flags) => step('You', 'Check the finished work and share it', 'Look over the result, then send it to the client in one step.',
    when(flags.canCheckAndShare, 'check_share', 'Check & share result'), when(flags.canCorrect, 'correction', 'Send tasks back')),
  share_result: (_ticket, flags) => step('You', 'Share the approved result', 'The result is checked but the client cannot see it yet.',
    when(flags.canShare, 'share', 'Share result')),
  review_result: () => step('Client', 'Waiting for the client to check the result', 'The request closes by itself when they accept it.'),
  close_ticket: (_ticket, flags) => step('You', 'The client accepted the result', 'Close the request to finish it.',
    when(flags.canClose, 'close', 'Close request')),
  triage_correction: (_ticket, flags) => step('You', 'The client asked for a fix', 'Read their note, then send the affected tasks back to the developer.',
    when(flags.canCorrect, 'correction', 'Review fix request')),
  handle_withdrawal: () => WITHDRAWAL,
  resolve_hold: (_ticket, flags) => step('You', 'Paused', 'Resume when you are ready.', when(flags.canResume, 'resume', 'Resume')),
};
const WITHDRAWAL = step('You', 'The client asked to withdraw this request', 'Cancel it, or put it on hold while you talk it through.',
  { action: 'withdrawal', label: 'Cancel request' });

function finishedStep(ticket: PmTicketDetail): PmNextStep {
  const answered = ticket.internal.closureReason === 'answered';
  const titles: Record<string, string> = {
    closed: answered ? 'Answered and closed' : 'Done: the client accepted the result', declined: 'Declined', cancelled: 'Cancelled',
  };
  return step(null, titles[ticket.status], 'This request is finished. Its conversation stays available.');
}

/**
 * Turns the server's "next action" into one sentence and one button. Display only:
 * the server still decides whether each action is allowed.
 */
export function pmNextStep(ticket: PmTicketDetail, flags: PmNextStepFlags): PmNextStep {
  if (TERMINAL.has(ticket.status)) return finishedStep(ticket);
  if (ticket.status === 'on_hold') return STEPS.resolve_hold(ticket, flags);
  if (ticket.internal.withdrawalRequested) return WITHDRAWAL;
  const checklist = pmProjectUsesChecklist(ticket);
  if (!flags.clientAccessActive) {
    if (!flags.canInvite) return step('Client', 'Waiting for the client to activate their account', 'You can keep private notes until they join.');
    const detail = checklist ? 'They need a portal account before you can message them.'
      : 'They need a portal account before you can message them or send a plan.';
    return step('You', 'Invite the client', detail, { action: 'invite', label: 'Invite client' });
  }
  const next = ticket.internal.nextAction;
  if (checklist && next === 'review_ticket') return step(null, 'Manage request', 'Track the work on the project board.');
  if (checklist && next === 'reply' && ticket.internal.actionOwner !== 'client') {
    return step('You', 'The client replied', 'Continue in the conversation.', { action: 'reply', label: 'Reply' });
  }
  return next ? STEPS[next](ticket, flags) : step(null, 'Nothing to do right now', '');
}
