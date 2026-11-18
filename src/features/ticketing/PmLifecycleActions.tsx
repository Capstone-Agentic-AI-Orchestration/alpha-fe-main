import { useState } from 'react';
import type { PmTicketCommandInput, PmTicketDetail, PmTicketMessageInput } from './pmApi';
import { input, primary, secondary } from './ticketUi';

/** PM decisions that pause, stop or finish a request outside the normal delivery path. */
export type PmLifecycleAction = 'hold' | 'resume' | 'cancel' | 'answer';

const TERMINAL = ['closed', 'declined', 'cancelled'];

/**
 * Which lifecycle actions the backend will accept for this ticket. Mirrors the server rules;
 * the server still decides (for example, cancel is refused while work is running).
 */
export function pmLifecycleActions(ticket: PmTicketDetail, clientAccessActive: boolean): PmLifecycleAction[] {
  if (!ticket.writesAvailable || TERMINAL.includes(ticket.status)) return [];
  if (ticket.status === 'on_hold') return ['resume', 'cancel'];
  const actions: PmLifecycleAction[] = [];
  const authorized = Boolean(ticket.internal.authorizedScopeVersionId) || ticket.internal.requiredIssueIds.length > 0;
  if (ticket.status === 'under_review' && !authorized && clientAccessActive && !ticket.internal.withdrawalRequested) actions.push('answer');
  actions.push('hold');
  // Before work is authorized, Decline already ends a request in review; Cancel is for everything else.
  if (authorized || !['received', 'under_review'].includes(ticket.status)) actions.push('cancel');
  return actions;
}

export const pmLifecycleLabel: Record<PmLifecycleAction, string> = {
  hold: 'Put on hold',
  resume: 'Resume request',
  cancel: 'Cancel request',
  answer: 'Answer and close',
};

const copy: Record<PmLifecycleAction, { title: string; field?: string; note: string; confirm: string; operation: string }> = {
  hold: {
    title: 'Put this request on hold?', field: 'Reason for the hold (required)', confirm: 'Confirm hold', operation: 'hold decision',
    note: 'The request keeps its current stage and resumes there. The reason stays in private PM history.',
  },
  resume: {
    title: 'Resume this request?', confirm: 'Confirm resume', operation: 'resume decision',
    note: 'The request returns to the stage it was paused at, with the same next step.',
  },
  cancel: {
    title: 'Cancel this request?', field: 'Reason for cancelling (required)', confirm: 'Confirm cancellation', operation: 'cancellation',
    note: 'Cancelling makes the request read-only. Queued or running work for it must be stopped first. The reason stays in private PM history.',
  },
  answer: {
    title: 'Answer and close this request?', field: 'Your answer to the client (required)', confirm: 'Send answer and close', operation: 'answer and close',
    note: 'Use this when the request only needed an answer. The client sees this message, and the request closes as answered.',
  },
};

export function pmLifecycleOperation(action: PmLifecycleAction): string {
  return copy[action].operation;
}

/** The write for a lifecycle action: answer-and-close is a client message, the rest are workflow commands. */
export function pmLifecycleWrite(action: PmLifecycleAction, ticket: PmTicketDetail, text: string, operationId: string):
  { kind: 'message'; input: PmTicketMessageInput } | { kind: 'command'; input: PmTicketCommandInput } {
  const base = { schemaVersion: 1 as const, operationId, expectedVersion: ticket.version };
  if (action === 'answer') return { kind: 'message', input: { ...base, body: text, action: { type: 'answer_close' } } };
  const command = action === 'resume' ? { type: 'resume' as const } : { type: action, reason: text.trim() };
  return { kind: 'command', input: { ...base, command } };
}

export function PmLifecycleForm({ action, disabled, onCancel, onSubmit }: {
  action: PmLifecycleAction; disabled: boolean; onCancel: () => void; onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const { title, field, note, confirm } = copy[action];
  const ready = !field || text.trim().length > 0;
  return <form aria-label={pmLifecycleLabel[action]} className={`pm-tickets__action-form${action === 'cancel' ? ' pm-tickets__action-form--decline' : ''}`}
    onSubmit={event => { event.preventDefault(); if (ready && !disabled) onSubmit(text); }}>
    <h3 className="text-sm font-medium text-content">{title}</h3>
    {field && <label className="mt-2 block text-xs text-content-secondary">{field}
      <textarea required maxLength={4000} value={text} onChange={event => setText(event.target.value)} disabled={disabled} className={`${input} mt-2`} /></label>}
    <p className="mt-2 text-xs text-content-muted">{note}</p>
    <div className="mt-3 flex justify-end gap-2">
      <button type="button" onClick={onCancel} disabled={disabled} className={secondary}>Cancel</button>
      <button type="submit" className={primary} disabled={disabled || !ready}>{confirm}</button>
    </div>
  </form>;
}
