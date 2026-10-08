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
      {(['reply', 'note'] as const).map(value => <button key={value} aria-pressed={mode === value} className={`${secondary} ${mode === value ? 'border-brand-400/30 bg-brand-500/10 text-brand-300' : ''}`} onClick={() => { setMode(value); setBody(''); setError(''); }}>
        {value === 'reply' ? <MessageSquare size={14} /> : <LockKeyhole size={14} />}{value === 'reply' ? 'Client conversation' : 'Internal notes'}</button>)}
    </div>}
    <div className="space-y-3" aria-label={mode === 'note' ? 'Internal notes' : 'Ticket conversation'}>
      {messages.length === 0 && <div className="rounded-xl border border-dashed border-white/10 px-5 py-8 text-center">
        <MessageSquare size={22} className="mx-auto mb-3 text-gray-600" />
        <p className="text-sm text-gray-300">{mode === 'note' || notesOnly ? 'No internal notes' : 'Start the conversation here'}</p>
        <p className="mt-1 text-xs text-gray-500">{mode === 'note' || notesOnly ? 'Only the PM view can see these notes.' : 'Keep questions, replies and updates on this same ticket.'}</p>
      </div>}
      {messages.map(message => <article key={message.id} className={`rounded-xl border p-4 ${mode === 'note' || notesOnly ? 'border-amber-400/15 bg-amber-500/[0.04]' : 'border-white/[0.07] bg-white/[0.02]'}`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-medium text-gray-200">{message.author === 'pm' ? 'Project Manager · preview' : 'Client · preview'}{(mode === 'note' || notesOnly) && <span className="ml-2 text-amber-300">Private note</span>}</span>
          <time className="text-[10px] text-gray-500" dateTime={message.createdAt}>{time(message.createdAt)}</time></div>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300">{message.body}</p>
      </article>)}
    </div>
    {terminal ? <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] p-4 text-xs text-gray-400"><LockKeyhole size={15} />This ticket is read-only. Additional work belongs in a new linked ticket.</div> :
      <form onSubmit={event => {
        event.preventDefault();
        try { onMessage(body, mode === 'note'); setBody(''); setError(''); }
        catch (err) { setError(err instanceof Error ? err.message : 'Could not save the preview message.'); }
      }} className="rounded-xl border border-white/10 bg-well p-3">
        <label className="block"><span className="mb-2 block text-xs font-medium text-gray-400">{mode === 'note' ? 'Internal note — never sent to the client' : 'Reply on this ticket'}</span>
          <textarea className="min-h-24 w-full resize-y bg-transparent p-1 text-sm text-gray-200 placeholder:text-gray-600" required maxLength={4000} value={body} onChange={event => setBody(event.target.value)} placeholder={mode === 'note' || notesOnly ? 'Add internal context for the PM…' : 'Write your message…'} /></label>
        {error && <p role="alert" className="p-2 text-xs text-rose-300">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
          <span className="text-[10px] text-gray-500">{mode === 'note' || notesOnly ? 'Visible only in the PM preview' : 'Visible to client and PM in this preview'} · no email sent</span>
          <button type="submit" disabled={!body.trim()} className={primary}>{mode === 'note' || notesOnly ? <LockKeyhole size={14} /> : <Send size={14} />}{mode === 'note' || notesOnly ? 'Save preview note' : 'Send preview reply'}</button>
        </div>
      </form>}
  </div>;
}
