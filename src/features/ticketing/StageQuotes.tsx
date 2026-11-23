import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { stageDay } from './PocScopeView';
import { SignOffDialog } from './SignOffDialog';
import type { ClientStagePanelProps } from './ClientStagePanel';
import type { PmStagePanelProps } from './PmStagePanel';
import type { Quote } from './projectStages';
import './projectStages.css';

const newOperationId = () => crypto.randomUUID();

/** An amount as money in the quote's currency, or as a plain number if the currency is unknown to the browser. */
export function quoteAmount(quote: Pick<Quote, 'amount' | 'currency'>): string {
  if (quote.amount === null) return '';
  const value = Number(quote.amount);
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: quote.currency }).format(value); }
  catch { return `${quote.currency} ${value.toFixed(2)}`; }
}
const KIND = { paid_revision: 'Paid revision round', change_request: 'Change request' } as const;
const STATUS = { requested: 'Waiting for a quote', sent: 'Quote sent', accepted: 'Accepted', declined: 'Declined', withdrawn: 'Withdrawn' } as const;

/** The client's quotes, and the way to ask for new work outside the contract. */
export function ClientQuotes({ api, project, summary, busy, readOnly = false, run }: Readonly<ClientStagePanelProps>) {
  const [deciding, setDeciding] = useState<Quote | null>(null);
  const [asking, setAsking] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const open = summary.quotes.filter(quote => quote.status === 'requested' || quote.status === 'sent');
  const decided = summary.quotes.filter(quote => quote.status === 'accepted' || quote.status === 'declined');
  const decide = async (quote: Quote, decision: 'accept' | 'decline', fullName?: string) => {
    const done = await run(() => api.decideQuote(project.workspaceId, project.projectId, quote.id, { operationId: newOperationId(), decision, fullName }),
      'Your decision was not saved. Try again.');
    if (done) setDeciding(null);
  };
  const ask = async () => {
    const done = await run(() => api.requestChange(project.workspaceId, project.projectId,
      { operationId: newOperationId(), title: title.trim(), description: description.trim() }), 'Your change request was not sent. Try again.');
    if (done) { setAsking(false); setTitle(''); setDescription(''); }
  };
  return <div className="ps-quotes">
    {(open.length > 0 || decided.length > 0) && <h4 className="ps-section-title">Quotes</h4>}
    {open.map(quote => <div key={quote.id} className="ps-quote-row">
      <p className="ps-lead"><strong>{quote.title}</strong> · {KIND[quote.kind]}</p>
      {quote.status === 'requested'
        ? <p className="ps-note">Your project manager is preparing a quote. Nothing starts until you accept it.</p>
        : <>
          <p className="ps-amount">{quoteAmount(quote)}</p>
          {quote.description && <p className="ps-copy">{quote.description}</p>}
          {!readOnly && <div className="ps-actions">
            <button type="button" className="ps-button is-primary" disabled={busy} onClick={() => setDeciding(quote)}>Accept quote</button>
            <button type="button" className="ps-button" disabled={busy} onClick={() => void decide(quote, 'decline')}>Decline</button>
          </div>}
        </>}
    </div>)}
    {decided.length > 0 && <ul className="ps-quote-history">
      {decided.map(quote => <li key={quote.id}>{quote.title} · {quoteAmount(quote)} · {STATUS[quote.status]}{quote.decidedAt ? ` ${stageDay(quote.decidedAt)}` : ''}</li>)}
    </ul>}
    {!readOnly && (summary.stage === 'development' || summary.stage === 'completed') && (asking
      ? <form className="ps-form" onSubmit={event => { event.preventDefault(); void ask(); }}>
        <label className="ps-field"><span>What would you like added or changed?</span>
          <input value={title} onChange={event => setTitle(event.target.value)} maxLength={300} disabled={busy} autoFocus /></label>
        <label className="ps-field"><span>Details (optional)</span>
          <textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} maxLength={8000} disabled={busy} /></label>
        <p className="ps-hint">Work outside the contract is quoted first. Nothing starts or is charged until you accept the quote.</p>
        <div className="ps-actions">
          <button type="submit" className="ps-button is-primary" disabled={busy || !title.trim()}>Ask for a quote</button>
          <button type="button" className="ps-button" disabled={busy} onClick={() => setAsking(false)}>Cancel</button>
        </div>
      </form>
      : <button type="button" className="ps-link" onClick={() => setAsking(true)}>Request new work (quoted)</button>)}
    {deciding && <SignOffDialog title="Accept the quote" busy={busy} confirmLabel="Accept quote"
      consent={`I accept this quote and agree to pay ${quoteAmount(deciding)} for this work.`}
      onCancel={() => setDeciding(null)} onConfirm={fullName => void decide(deciding, 'accept', fullName)}>
      <p className="ps-copy"><strong>{deciding.title}</strong> · {KIND[deciding.kind]}</p>
      {deciding.kind === 'paid_revision' && <p className="ps-copy">Accepting sends your feedback round to your project manager.</p>}
    </SignOffDialog>}
  </div>;
}

/** The PM's quotes: price each requested one and send it; see what the client decided. */
export function PmQuotes({ api, projectId, clientId, summary, busy, run }: Readonly<PmStagePanelProps>) {
  if (!summary.quotes.length) return null;
  return <section className="space-y-3">
    <h3 className="text-[13px] font-semibold text-content">Quotes</h3>
    {summary.quotes.map(quote => <div key={quote.id} className="space-y-2 border-l-2 border-divider pl-3">
      <p className="text-content"><strong>{quote.title}</strong> <span className="text-content-muted">· {KIND[quote.kind]} · asked by the {quote.requestedBy === 'client' ? 'client' : 'PM'}</span></p>
      {quote.status === 'requested'
        ? <QuoteForm key={quote.id} quote={quote} busy={busy}
          onSend={input => run(() => api.sendQuote(projectId, clientId, quote.id, { operationId: newOperationId(), ...input }), 'The quote was not sent. Try again.')} />
        : <p className="text-[12.5px] text-content-secondary">{quoteAmount(quote)} · {STATUS[quote.status]}
          {quote.decidedName ? ` by ${quote.decidedName}` : ''}{quote.decidedAt ? ` on ${stageDay(quote.decidedAt)}` : ''}</p>}
    </div>)}
  </section>;
}

function QuoteForm({ quote, busy, onSend }: Readonly<{ quote: Quote; busy: boolean;
  onSend: (input: { amount: number; currency: string; description: string }) => Promise<boolean> }>) {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('PHP');
  const [description, setDescription] = useState(quote.description);
  const value = Number(amount);
  const ready = amount.trim() !== '' && Number.isFinite(value) && value >= 0 && /^[A-Z]{3}$/.test(currency);
  return <form className="space-y-2" onSubmit={event => { event.preventDefault(); if (ready) void onSend({ amount: value, currency, description: description.trim() }); }}>
    <div className="flex flex-wrap gap-2">
      <label className="space-y-1"><span className="text-[11.5px] font-medium text-content-secondary">Amount</span>
        <Input type="number" min={0} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} className="h-8 w-32" /></label>
      <label className="space-y-1"><span className="text-[11.5px] font-medium text-content-secondary">Currency</span>
        <Input value={currency} onChange={event => setCurrency(event.target.value.toUpperCase().slice(0, 3))} className="h-8 w-20" /></label>
    </div>
    <label className="block space-y-1"><span className="text-[11.5px] font-medium text-content-secondary">What the quote covers</span>
      <Textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} maxLength={8000} /></label>
    <Button type="submit" size="sm" disabled={busy || !ready}>Send quote</Button>
  </form>;
}
