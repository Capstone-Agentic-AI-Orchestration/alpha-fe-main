import type { ClientTicketStatus } from './clientApi';

export type ClientTicketRequestedAction = 'reply' | 'agree_scope' | 'review_result' | null;

export interface ClientTicketProgress {
  label: string;
  description: string;
  needsClientAction: boolean;
}

/** Client-safe explanation of the current ticket state; never infers project completion. */
export function clientTicketProgress(
  status: ClientTicketStatus,
  requestedAction: ClientTicketRequestedAction,
): ClientTicketProgress {
  if (status === 'closed') return {
    label: 'Request closed',
    description: 'Your project manager closed this request. Its conversation and history remain available.',
    needsClientAction: false,
  };
  if (status === 'declined') return {
    label: 'Request not proceeding',
    description: 'Your project manager declined this request. The conversation history remains available for reference.',
    needsClientAction: false,
  };
  if (status === 'cancelled') return {
    label: 'Request cancelled',
    description: 'This request was cancelled. Its conversation history remains available for reference.',
    needsClientAction: false,
  };
  if (requestedAction === 'reply') return {
    label: 'Your reply is needed',
    description: 'Your project manager needs more information. Reply in this ticket’s conversation below.',
    needsClientAction: true,
  };
  if (requestedAction === 'agree_scope') return {
    label: 'Review the proposed work',
    description: 'Check the proposed scope below and agree to it or message your project manager with questions. Development cannot start until the scope is agreed and the work is authorized.',
    needsClientAction: true,
  };
  if (requestedAction === 'review_result') return {
    label: 'Your result review is needed',
    description: 'Open and review the shared result against the agreed work. You can accept it or explain what needs fixing.',
    needsClientAction: true,
  };

  switch (status) {
    case 'received':
      return { label: 'Request received', description: 'A project manager will review your request before deciding whether to accept it into a workspace.', needsClientAction: false };
    case 'under_review':
      return { label: 'Project manager review', description: 'Your request is being reviewed. Development has not started.', needsClientAction: false };
    case 'awaiting_client':
      return { label: 'Waiting for the next update', description: 'Your project manager will contact you here if they need information or a decision.', needsClientAction: false };
    case 'in_progress':
      return { label: 'Work in progress', description: 'The authorized work is underway. Updates and questions stay in this ticket’s conversation.', needsClientAction: false };
    case 'ready_for_review':
      return { label: 'Project manager review', description: 'The work is being checked before a result is shared with you.', needsClientAction: false };
    case 'on_hold':
      return { label: 'Request paused', description: 'This request is on hold. Message your project manager in this conversation if you need clarification.', needsClientAction: false };
  }
}
