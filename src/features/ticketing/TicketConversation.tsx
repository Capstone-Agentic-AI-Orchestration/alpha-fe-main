import { useState } from 'react';
import { LockKeyhole, MessageSquare, Send } from 'lucide-react';
import { isTerminal } from './previewModel';
import type { ClientTicketView, PmTicketView, PreviewRole } from './previewModel';
import { primary, secondary, time } from './ticketUi';

export function TicketConversation({ ticket, role, onMessage, notesOnly = false }: {
  ticket: ClientTicketView | PmTicketView; role: PreviewRole; onMessage: (body: string, privateNote: boolean) => void;
  /** Used for unactivated inquiries: PM triage notes are allowed, client replies are not. */
  notesOnly?: boolean;
}) {
  const [mode, setMode] = useState<'reply' | 'note'>(notesOnly ? 'note' : 'reply');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const notes = role === 'pm' && 'notes' in ticket ? ticket.notes : [];
  const messages = notesOnly || mode === 'note' ? notes : ticket.messages;
  const terminal = isTerminal(ticket.status);
  return <div className="space-y-5">
    {role === 'pm' && !notesOnly && <div className="flex flex-wrap items-center gap-2">
      {(['reply', 'note'] as const).map(value => <button key={value} aria-pressed={mode === value} className={`${secondary} ${mode === value ? 'border-divider bg-selected text-selected-content' : ''}`} onClick={() => { setMode(value); setBody(''); setError(''); }}>
        {value === 'reply' ? <MessageSquare size={14} /> : <LockKeyhole size={14} />}{value === 'reply' ? 'Client conversation' : 'Internal notes'}</button>)}
    </div>}
    <div className="space-y-3" aria-label={mode === 'note' ? 'Internal notes' : 'Ticket conversation'}>
      {messages.length === 0 && <div className="rounded-xl border border-dashed border-divider px-5 py-8 text-center">
        <MessageSquare size={22} className="mx-auto mb-3 text-content-muted" />
        <p className="text-sm text-content-secondary">{mode === 'note' || notesOnly ? 'No internal notes' : 'Start the conversation here'}</p>
        <p className="mt-1 text-xs text-content-muted">{mode === 'note' || notesOnly ? 'Only the PM view can see these notes.' : 'Keep questions, replies and updates on this same ticket.'}</p>
      </div>}
      {messages.map(message => <article key={message.id} className={`rounded-xl border p-4 ${mode === 'note' || notesOnly ? 'border-status-warning-border bg-status-warning-subtle' : 'border-divider bg-surface-raised'}`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-medium text-content">{message.author === 'pm' ? 'Project Manager · preview' : 'Client · preview'}{(mode === 'note' || notesOnly) && <span className="ml-2 text-status-warning">Private note</span>}</span>
          <time className="text-[10px] text-content-muted" dateTime={message.createdAt}>{time(message.createdAt)}</time></div>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-content-secondary">{message.body}</p>
      </article>)}
    </div>
    {terminal ? <div className="flex items-center gap-2 rounded-lg bg-surface-raised p-4 text-xs text-content-secondary"><LockKeyhole size={15} />This ticket is read-only. Additional work belongs in a new linked ticket.</div> :
      <form onSubmit={event => {
        event.preventDefault();
        try { onMessage(body, mode === 'note'); setBody(''); setError(''); }
        catch (err) { setError(err instanceof Error ? err.message : 'Could not save the preview message.'); }
      }} className="rounded-xl border border-divider bg-well p-3">
        <label className="block"><span className="mb-2 block text-xs font-medium text-content-secondary">{mode === 'note' ? 'Internal note — never sent to the client' : 'Reply on this ticket'}</span>
          <textarea className="min-h-24 w-full resize-y bg-transparent p-1 text-sm text-content placeholder:text-content-muted" required maxLength={4000} value={body} onChange={event => setBody(event.target.value)} placeholder={mode === 'note' || notesOnly ? 'Add internal context for the PM…' : 'Write your message…'} /></label>
        {error && <p role="alert" className="p-2 text-xs text-status-danger">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-3">
          <span className="text-[10px] text-content-muted">{mode === 'note' || notesOnly ? 'Visible only in the PM preview' : 'Visible to client and PM in this preview'} · no email sent</span>
          <button type="submit" disabled={!body.trim()} className={primary}>{mode === 'note' || notesOnly ? <LockKeyhole size={14} /> : <Send size={14} />}{mode === 'note' || notesOnly ? 'Save preview note' : 'Send preview reply'}</button>
        </div>
      </form>}
  </div>;
}
