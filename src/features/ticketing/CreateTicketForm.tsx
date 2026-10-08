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
    <button onClick={onCancel} className="mb-6 inline-flex items-center gap-2 text-xs text-gray-400 hover:text-white"><ArrowLeft size={14} />My Tickets</button>
    <div className="mb-7 flex items-start gap-3">
      <span className="rounded-xl border border-brand-400/20 bg-brand-500/10 p-3 text-brand-300"><Ticket size={22} /></span>
      <div><h1 className="text-2xl font-semibold text-white">{related ? 'Request additional work' : 'New ticket'}</h1>
        <p className="mt-1 text-sm text-gray-400">Tell your project manager what you need. You can discuss the details on the ticket.</p></div>
    </div>
    <form className="space-y-5 rounded-xl border border-white/[0.08] bg-surface p-5 md:p-7" onSubmit={event => {
      event.preventDefault();
      try { onCreate({ title, description, relatedTicketId: related?.id }); }
      catch (err) { setError(err instanceof Error ? err.message : 'Could not create this preview ticket.'); }
    }}>
      {related && <p className="rounded-lg border border-brand-400/20 bg-brand-500/5 p-3 text-xs text-brand-300">Linked to {related.reference} · {related.title}. This is a separate request; the original stays unchanged.</p>}
      <label className="block space-y-2"><span className="text-xs font-medium text-gray-300">Title <span className="text-gray-500">(required)</span></span>
        <input className={input} required maxLength={160} value={title} onChange={event => setTitle(event.target.value)} placeholder="What would you like us to work on?" autoFocus /></label>
      <label className="block space-y-2"><span className="text-xs font-medium text-gray-300">Description <span className="text-gray-500">(required)</span></span>
        <textarea className={`${input} min-h-40 resize-y`} required maxLength={6000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Explain the outcome you need, any problem you’re facing, and relevant context." /></label>
      <div className="flex items-start gap-2 rounded-lg bg-white/[0.03] p-3 text-xs leading-relaxed text-gray-400"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-gray-500" />
        <p>The PM decides whether to link an existing project, create one, or answer without development. Submitting a ticket does not start an agent.</p></div>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-5">
        <p className="max-w-xs text-[11px] text-gray-500">Local preview only. Use test text, not confidential information. Refreshing clears these tickets.</p>
        <div className="flex gap-2"><button type="button" onClick={onCancel} className={secondary}>Cancel</button><button className={primary} type="submit"><Plus size={15} />Create preview ticket</button></div>
      </div>
    </form>
  </section>;
}
