import type { ClientTicketDetail } from './clientApi';

/** Five plain stages, the same words everywhere the client sees progress. */
export const CLIENT_PROGRESS_LABELS = ['Received', 'Planning', 'In progress', 'Ready for you', 'Done'] as const;
export type ClientProgressState = 'done' | 'current' | 'upcoming';
export interface ClientProgressStep { label: string; state: ClientProgressState; needsYou: boolean }

/** What the steps read from a request; the PM's ticket detail has the same fields. */
type TicketForSteps = Pick<ClientTicketDetail, 'requestedAction'> & {
  status: string; scope: { agreed: boolean } | null; delivery: { accepted: boolean } | null;
};

/** Where the request is on the five stages, or null when a path would mislead (paused, declined, cancelled, answered). */
function position(ticket: TicketForSteps): number | 'complete' | null {
  const { status, scope, delivery } = ticket;
  if (status === 'declined' || status === 'cancelled' || status === 'on_hold') return null;
  if (delivery?.accepted) return 'complete';
  if (status === 'closed') return null;
  if (status === 'received') return 0;
  if (status === 'ready_for_review') return 3;
  if (status === 'in_progress') return 2;
  // Under review or waiting on the client. A result that is back for a fix, or an approved plan
  // waiting for the PM to start, is still the work stage; everything before that is planning.
  if (delivery || scope?.agreed) return 2;
  return 1;
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
        : ticket.requestedAction === 'agree_scope' ? 'Approve the plan'
          : ticket.requestedAction === 'review_result' ? 'Check your result' : defaultLabel
      : defaultLabel;
    return { label, state, needsYou };
  });
}
