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
    statusLabel: 'Closed',
    label: 'Request closed',
    description: 'Your project manager closed this request. Its conversation and history remain available.',
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
    statusLabel: 'Decision needed',
    label: 'Review the proposed work',
    description: 'Review the proposed work below. Agree to it or message your project manager with questions. Your project manager will confirm the work is approved before it begins.',
    needsClientAction: true,
  };
  if (requestedAction === 'review_result') return {
    statusLabel: 'Result to review',
    label: 'Your result review is needed',
    description: 'Open and review the shared result against the agreed work. You can accept it or explain what needs fixing.',
    needsClientAction: true,
  };

  switch (status) {
    case 'received':
      return { statusLabel: 'Received', label: 'Waiting for your project manager to review', description: 'A project manager will review your request. You do not need to do anything right now.', needsClientAction: false };
    case 'under_review':
      return { statusLabel: 'Under review', label: 'Your project manager is reviewing it', description: 'Your project manager is reviewing your request. Work has not started, and you do not need to do anything right now.', needsClientAction: false };
    case 'awaiting_client':
      return { statusLabel: 'Awaiting update', label: 'Waiting for your project manager’s update', description: 'Your project manager will contact you here if they need information or a decision. You do not need to do anything right now.', needsClientAction: false };
    case 'in_progress':
      return { statusLabel: 'Work in progress', label: 'The agreed work is underway', description: 'The agreed work is underway. You do not need to do anything right now; updates and questions stay in this request’s conversation.', needsClientAction: false };
    case 'ready_for_review':
      return { statusLabel: 'Project manager checking work', label: 'Your project manager is checking the work', description: 'Your project manager is checking the work before sharing a result with you. You do not need to do anything right now.', needsClientAction: false };
    case 'on_hold':
      return { statusLabel: 'Paused', label: 'Your project manager has paused this request', description: 'This request is paused. Message your project manager here if you have a question; otherwise, wait for their update.', needsClientAction: false };
  }
}
