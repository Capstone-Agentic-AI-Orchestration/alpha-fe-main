import type { ClientTicketDetail } from './clientApi';

export const CLIENT_PROGRESS_LABELS = ['Request received', 'Project manager review', 'Proposed work', 'Work underway', 'Result review'] as const;
export type ClientProgressState = 'done' | 'current' | 'upcoming';
export interface ClientProgressStep { label: string; state: ClientProgressState; needsYou: boolean }

type TicketForSteps = Pick<ClientTicketDetail, 'status' | 'requestedAction' | 'scope' | 'delivery'>;

/** Where the request is on the five-step path, or null when a path would mislead (paused, declined, cancelled, answered). */
function position(ticket: TicketForSteps): number | 'complete' | null {
  const { status, scope, delivery } = ticket;
  if (status === 'declined' || status === 'cancelled' || status === 'on_hold') return null;
  if (delivery?.accepted) return 'complete';
  if (status === 'closed') return null;
  if (status === 'received') return 0;
  if (status === 'ready_for_review') return 4;
  if (status === 'in_progress') return 3;
  // Under review or waiting on the client. A result that is back for a fix, or an agreed scope
  // waiting for the PM to start, is still the work stage.
  if (delivery || scope?.agreed) return 3;
  return scope ? 2 : 1;
}

function stateAt(index: number, at: number | 'complete'): ClientProgressState {
  if (at === 'complete' || index < at) return 'done';
  return index === at ? 'current' : 'upcoming';
}

/** Five plain steps for the client. Display only; the server decides what can actually happen next. */
export function clientProgressSteps(ticket: TicketForSteps): ClientProgressStep[] {
  const at = position(ticket);
  if (at === null) return [];
  return CLIENT_PROGRESS_LABELS.map((defaultLabel, index) => {
    const state = stateAt(index, at);
    const needsYou = index === at && ticket.requestedAction !== null;
    const label = needsYou
      ? ticket.requestedAction === 'reply' ? 'Reply to your project manager'
        : ticket.requestedAction === 'agree_scope' ? 'Review proposed work'
          : ticket.requestedAction === 'review_result' ? 'Review shared result' : defaultLabel
      : defaultLabel;
    return { label, state, needsYou };
  });
}
