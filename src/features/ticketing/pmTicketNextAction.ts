import type { PmTicketQueueItem } from './pmApi';

export function pmTicketNextAction(action: PmTicketQueueItem['internal']['nextAction']): string | null {
  switch (action) {
    case 'review_ticket': return 'Review request';
    case 'reply': return 'Reply to client';
    case 'agree_scope': return 'Waiting for client scope decision';
    case 'authorize_work': return 'Authorize agreed work';
    case 'execute_work': return 'Developer work in progress';
    case 'assess_result': return 'Assess completed work';
    case 'share_result': return 'Share approved result';
    case 'review_result': return 'Waiting for client result review';
    case 'close_ticket': return 'Close accepted request';
    case 'triage_correction': return 'Review correction request';
    case 'handle_withdrawal': return 'Review withdrawal request';
    case 'resolve_hold': return 'Resolve request hold';
    case null: return null;
  }
}
