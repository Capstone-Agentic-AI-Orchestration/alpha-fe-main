import { ApiRequestError } from '@/shared/services/apiService';
import { pmTicketApi } from './pmApi';

/** The New task dialog's tab-session key for the client request a new task is for. */
export const LINKED_REQUEST_KEY = 'issueModal.linkedRequest';
/**
 * A request-specific shortcut fixes the link; the task dialog allows the PM to edit it.
 * `description` is the client's wording, offered in the dialog but never copied in by default:
 * the request is the whole brief, and each task under it is one piece of that work.
 */
export interface LinkedRequestDraft {
  ticketId: string; title: string; reference?: string; description?: string; source: 'conversation' | 'task_dialog';
}
/** Set when the dialog opens from a project's conversation: the task's project is that project, not a choice. */
export const PROJECT_LOCKED_KEY = 'issueModal.projectLocked';

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
