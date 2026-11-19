import type { ClientTicketStatus } from './clientApi';

export type ClientTicketRequestedAction = 'reply' | 'agree_scope' | 'review_result' | null;

export interface ClientTicketProgress {
  statusLabel: string;
  label: string;
  description: string;
  needsClientAction: boolean;
}

/** Client-safe explanation of the current request state; never infers project completion. */
export function clientTicketProgress(
  status: ClientTicketStatus,
  requestedAction: ClientTicketRequestedAction,
): ClientTicketProgress {
  if (status === 'closed') return {
    statusLabel: 'Done',
    label: 'Request done',
    description: 'This request is finished. Its conversation and history stay available.',
    needsClientAction: false,
  };
  if (status === 'declined') return {
    statusLabel: 'Not proceeding',
    label: 'Request not proceeding',
    description: 'Your project manager declined this request. The conversation history remains available for reference.',
    needsClientAction: false,
  };
  if (status === 'cancelled') return {
    statusLabel: 'Cancelled',
    label: 'Request cancelled',
    description: 'This request was cancelled. Its conversation history remains available for reference.',
    needsClientAction: false,
  };
  if (requestedAction === 'reply') return {
    statusLabel: 'Reply needed',
    label: 'Your reply is needed',
    description: 'Your project manager needs more information. Reply in this request’s conversation below.',
    needsClientAction: true,
  };
  if (requestedAction === 'agree_scope') return {
    statusLabel: 'Approve the plan',
    label: 'Approve the plan',
    description: 'Your project manager sent a plan. Approve it, or ask for changes. Work starts once it is approved.',
    needsClientAction: true,
  };
  if (requestedAction === 'review_result') return {
    statusLabel: 'Ready for you',
    label: 'Your result is ready to check',
    description: 'Look over the result. Accept it to finish the request, or tell your project manager what needs fixing.',
    needsClientAction: true,
  };

  switch (status) {
    case 'received':
      return { statusLabel: 'Received', label: 'Waiting for your project manager to review', description: 'A project manager will review your request. You do not need to do anything right now.', needsClientAction: false };
    case 'under_review':
      return { statusLabel: 'Planning', label: 'Your project manager is planning the work', description: 'Your project manager is working out the plan. You do not need to do anything right now.', needsClientAction: false };
    case 'awaiting_client':
      return { statusLabel: 'Planning', label: 'Waiting for your project manager’s update', description: 'Your project manager will contact you here if they need information or a decision. You do not need to do anything right now.', needsClientAction: false };
    case 'in_progress':
      return { statusLabel: 'In progress', label: 'The work is underway', description: 'The work is underway. You do not need to do anything right now; updates and questions stay in this request’s conversation.', needsClientAction: false };
    case 'ready_for_review':
      return { statusLabel: 'Ready for you', label: 'Your result has been shared', description: 'Your project manager shared a result. Look over it and let them know in the conversation if anything is wrong.', needsClientAction: false };
    case 'on_hold':
      return { statusLabel: 'Paused', label: 'Your project manager has paused this request', description: 'This request is paused. Message your project manager here if you have a question; otherwise, wait for their update.', needsClientAction: false };
  }
}
