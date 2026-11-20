import { ApiRequestError } from '@/shared/services/apiService';
import { pmTicketApi } from './pmApi';

/** The New task dialog's tab-session key for the client request a new task is for. */
export const LINKED_REQUEST_KEY = 'issueModal.linkedRequest';
export interface LinkedRequestDraft { ticketId: string; title: string; source: 'conversation' | 'task_dialog' }

/** Fired after a task is linked to a request, so an open conversation refreshes. */
export const REQUEST_TASK_LINKED_EVENT = 'alpha:request-task-linked';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Link a just-saved task to a client request. In the desktop app a new task
 * reaches the team's cloud board a moment after it is saved, so a "not found"
 * is retried a few times before giving up.
 */
export async function linkSavedTaskToRequest(ticketId: string, issueId: string, source: LinkedRequestDraft['source'],
  api: Pick<typeof pmTicketApi, 'linkTaskToRequest'> = pmTicketApi, delays: readonly number[] = [1500, 3000, 5000]): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await api.linkTaskToRequest(ticketId, issueId, source);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(REQUEST_TASK_LINKED_EVENT, { detail: { ticketId, issueId } }));
      return;
    } catch (error) {
      const notYet = error instanceof ApiRequestError && error.status === 404;
      if (!notYet || attempt >= delays.length) throw error;
      await wait(delays[attempt]);
    }
  }
}
