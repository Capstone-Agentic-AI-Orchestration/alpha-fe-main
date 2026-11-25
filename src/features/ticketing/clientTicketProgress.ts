import type { ClientTicketStatus } from './clientApi';
import { CHECKLIST_LABEL, type RequestChecklistStatus } from './projectConversation';

export type ClientTicketRequestedAction = 'reply' | 'agree_scope' | 'review_result' | null;

export interface ClientTicketProgress {
  statusLabel: string;
  label: string;
  description: string;
  needsClientAction: boolean;
}

const CHECKLIST_DESCRIPTION: Record<RequestChecklistStatus, string> = {
  open: 'The project manager can follow up here if they need more details.',
  in_progress: 'The team is working on your request.',
  ready_to_check: 'The linked work is complete. Review it and reply here if anything needs changing.',
  done: 'This request was marked done. Its conversation stays available.',
  declined: 'The project manager declined this request. Its conversation stays available.',
  cancelled: 'This request was cancelled. Its conversation stays available.',
};

/** Client-safe explanation of the current request state; never infers project completion. */
export function clientTicketProgress(
  status: ClientTicketStatus,
  requestedAction: ClientTicketRequestedAction,
  checklist?: RequestChecklistStatus,
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
    description: 'The project manager declined this request. The conversation history remains available for reference.',
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
    description: 'The project manager needs more information. Reply in this request’s conversation below.',
    needsClientAction: true,
  };
  if (requestedAction === 'agree_scope') return {
    statusLabel: 'Approve the plan',
    label: 'Approve the plan',
    description: 'The project manager sent a plan. Approve it, or ask for changes. Work starts once it is approved.',
    needsClientAction: true,
  };
  if (requestedAction === 'review_result') return {
    statusLabel: 'Ready for you',
    label: 'Your result is ready to check',
    description: 'Look over the result. Accept it to finish the request, or tell the project manager what needs fixing.',
    needsClientAction: true,
  };
  if (checklist && status !== 'on_hold') return {
    statusLabel: CHECKLIST_LABEL[checklist],
    label: CHECKLIST_LABEL[checklist],
    description: CHECKLIST_DESCRIPTION[checklist],
    needsClientAction: false,
  };

  switch (status) {
    case 'received':
      return { statusLabel: 'Received', label: 'Waiting for the project manager to review', description: 'A project manager will review your request. You do not need to do anything right now.', needsClientAction: false };
    case 'under_review':
      return { statusLabel: 'Planning', label: 'The project manager is planning the work', description: 'The project manager is working out the plan. You do not need to do anything right now.', needsClientAction: false };
    case 'awaiting_client':
      return { statusLabel: 'Planning', label: 'Waiting for the project manager’s update', description: 'The project manager will contact you here if they need information or a decision. You do not need to do anything right now.', needsClientAction: false };
    case 'in_progress':
      return { statusLabel: 'In progress', label: 'The work is underway', description: 'The work is underway. You do not need to do anything right now; updates and questions stay in this request’s conversation.', needsClientAction: false };
    case 'ready_for_review':
      return { statusLabel: 'Ready for you', label: 'Your result has been shared', description: 'The project manager shared a result. Look over it and let them know in the conversation if anything is wrong.', needsClientAction: false };
    case 'on_hold':
      return { statusLabel: 'Paused', label: 'The project manager has paused this request', description: 'This request is paused. Message the project manager here if you have a question; otherwise, wait for their update.', needsClientAction: false };
  }
}
