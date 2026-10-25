import { useState } from 'react';
import { ArrowLeft, Plus, ShieldCheck, Ticket } from 'lucide-react';
import type { ClientTicketView, NewTicketInput } from './previewModel';
import { input, primary, secondary } from './ticketUi';

export function CreateTicketForm({ related, onCreate, onCancel }: {
  related: ClientTicketView | undefined; onCreate: (value: NewTicketInput) => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  return <section className="mx-auto w-full max-w-2xl p-5 md:p-10">
    <button onClick={onCancel} className="mb-6 inline-flex items-center gap-2 text-xs text-content-secondary hover:text-content"><ArrowLeft size={14} />My Tickets</button>
    <div className="mb-7 flex items-start gap-3">
      <span className="rounded-xl border border-divider bg-selected p-3 text-selected-content"><Ticket size={22} /></span>
      <div><h1 className="text-2xl font-semibold text-content">{related ? 'Request additional work' : 'New ticket'}</h1>
        <p className="mt-1 text-sm text-content-secondary">Tell your project manager what you need. You can discuss the details on the ticket.</p></div>
    </div>
    <form className="space-y-5 rounded-xl border border-divider bg-surface p-5 md:p-7" onSubmit={event => {
      event.preventDefault();
      try { onCreate({ title, description, relatedTicketId: related?.id }); }
      catch (err) { setError(err instanceof Error ? err.message : 'Could not create this preview ticket.'); }
    }}>
      {related && <p className="rounded-lg border border-divider bg-selected p-3 text-xs text-selected-content">Linked to {related.reference} · {related.title}. This is a separate request; the original stays unchanged.</p>}
      <label className="block space-y-2"><span className="text-xs font-medium text-content-secondary">Title <span className="text-content-muted">(required)</span></span>
        <input className={input} required maxLength={160} value={title} onChange={event => setTitle(event.target.value)} placeholder="What would you like us to work on?" autoFocus /></label>
      <label className="block space-y-2"><span className="text-xs font-medium text-content-secondary">Description <span className="text-content-muted">(required)</span></span>
        <textarea className={`${input} min-h-40 resize-y`} required maxLength={6000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Explain the outcome you need, any problem you’re facing, and relevant context." /></label>
      <div className="flex items-start gap-2 rounded-lg bg-surface-raised p-3 text-xs leading-relaxed text-content-secondary"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-content-muted" />
        <p>The PM decides whether to link an existing project, create one, or answer without development. Submitting a ticket does not start an agent.</p></div>
      {error && <p role="alert" className="text-sm text-status-danger">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-5">
        <p className="max-w-xs text-[11px] text-content-muted">Local preview only. Use test text, not confidential information. Refreshing clears these tickets.</p>
        <div className="flex gap-2"><button type="button" onClick={onCancel} className={secondary}>Cancel</button><button className={primary} type="submit"><Plus size={15} />Create preview ticket</button></div>
      </div>
    </form>
  </section>;
}
