import { useRef, useState } from 'react';
import { ArrowLeft, Send, ShieldCheck } from 'lucide-react';
import { PUBLIC_TICKET_INQUIRY_SCHEMA_VERSION } from './publicIntakeContract';
import type { PublicTicketInquiryPayload } from './publicIntakeContract';
import { PublicTicketIntakeApiError } from './publicIntakeApi';
import { input, primary, secondary } from './ticketUi';

export function PublicInquiryForm({ onSubmit, onCancel, submissionEnabled = false, unavailableMessage = 'Inquiry submission is unavailable. Nothing is sent or saved.' }: {
  /** Resolve only after the configured intake transport returns its generic receipt. */
  onSubmit: (value: PublicTicketInquiryPayload) => void | Promise<void>;
  onCancel: () => void;
  submissionEnabled?: boolean;
  unavailableMessage?: string;
}) {
  const operationId = useRef(crypto.randomUUID());
  const retryPayload = useRef<PublicTicketInquiryPayload | null>(null);
  const submissionInFlight = useRef(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requestedDeadline, setRequestedDeadline] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  return <section className="mx-auto w-full max-w-2xl p-5 md:p-10">
    <button onClick={onCancel} disabled={isSubmitting || outcomeUnknown} className="mb-6 inline-flex items-center gap-2 text-xs text-gray-400 hover:text-white disabled:cursor-wait disabled:opacity-50"><ArrowLeft size={14} />Back to Alpha entry</button>
    <div className="mb-7">
      <h1 className="text-2xl font-semibold text-white">Tell us what you need</h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-400">Send an inquiry for the project manager to review. You do not need an Alpha account to start.</p>
    </div>
    <form aria-busy={isSubmitting} className="space-y-5 rounded-xl border border-white/[0.08] bg-surface p-5 md:p-7" onSubmit={event => {
      event.preventDefault();
      if (!submissionEnabled || submissionInFlight.current || submitted) return;
      submissionInFlight.current = true;
      setIsSubmitting(true);
      setError('');
      const payload = retryPayload.current ?? {
          schemaVersion: PUBLIC_TICKET_INQUIRY_SCHEMA_VERSION,
          operationId: operationId.current,
          fullName,
          email,
          company: company.trim() || null,
          title,
          description,
          requestedDeadline: requestedDeadline || null,
        };
      retryPayload.current = payload;
      void Promise.resolve().then(() => onSubmit(payload)).then(() => {
          retryPayload.current = null;
          setOutcomeUnknown(false);
          setSubmitted(true);
        }).catch(err => {
          const uncertain = err instanceof PublicTicketIntakeApiError && err.retryWithSameOperationId;
          setOutcomeUnknown(uncertain);
          if (!uncertain) retryPayload.current = null;
          setError(err instanceof PublicTicketIntakeApiError
            ? err.message : 'The inquiry could not be submitted. Please try again.');
        }).finally(() => {
          submissionInFlight.current = false;
          setIsSubmitting(false);
        });
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2"><span className="text-xs font-medium text-gray-300">Your name <span className="text-gray-500">(required)</span></span>
          <input className={input} required maxLength={160} autoComplete="name" disabled={isSubmitting || outcomeUnknown || submitted} value={fullName} onChange={event => { setFullName(event.target.value); operationId.current = crypto.randomUUID(); }} /></label>
        <label className="block space-y-2"><span className="text-xs font-medium text-gray-300">Email <span className="text-gray-500">(required)</span></span>
          <input className={input} type="email" required maxLength={254} autoComplete="email" disabled={isSubmitting || outcomeUnknown || submitted} value={email} onChange={event => { setEmail(event.target.value); operationId.current = crypto.randomUUID(); }} /></label>
      </div>
      <label className="block space-y-2"><span className="text-xs font-medium text-gray-300">Company <span className="text-gray-500">(optional)</span></span>
        <input className={input} maxLength={160} autoComplete="organization" disabled={isSubmitting || outcomeUnknown || submitted} value={company} onChange={event => { setCompany(event.target.value); operationId.current = crypto.randomUUID(); }} /></label>
      <label className="block space-y-2"><span className="text-xs font-medium text-gray-300">What do you need? <span className="text-gray-500">(required)</span></span>
        <input className={input} required maxLength={160} disabled={isSubmitting || outcomeUnknown || submitted} value={title} onChange={event => { setTitle(event.target.value); operationId.current = crypto.randomUUID(); }} placeholder="A short summary" /></label>
      <label className="block space-y-2"><span className="text-xs font-medium text-gray-300">Details <span className="text-gray-500">(required)</span></span>
        <textarea className={`${input} min-h-36 resize-y`} required maxLength={6000} disabled={isSubmitting || outcomeUnknown || submitted} value={description} onChange={event => { setDescription(event.target.value); operationId.current = crypto.randomUUID(); }} placeholder="Describe the outcome you’re looking for and any useful context." /></label>
      <label className="block max-w-xs space-y-2"><span className="text-xs font-medium text-gray-300">Requested target date <span className="text-gray-500">(optional, not guaranteed)</span></span>
        <input className={input} type="date" disabled={isSubmitting || outcomeUnknown || submitted} value={requestedDeadline} onChange={event => { setRequestedDeadline(event.target.value); operationId.current = crypto.randomUUID(); }} /></label>
      <div className="flex items-start gap-2 rounded-lg bg-white/[0.03] p-3 text-xs leading-relaxed text-gray-400"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-gray-500" />
        <p>This starts a review, not development or an account. The email is unverified and cannot be used to access a ticket. Do not include passwords or sensitive files.</p></div>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      {outcomeUnknown && <p role="status" className="rounded-lg border border-amber-400/20 bg-amber-500/[0.05] p-3 text-xs leading-relaxed text-amber-100">Keep this page open and check the same submission. Alpha will retry the exact saved-in-memory payload with the same operation ID; it will not start a second inquiry.</p>}
      {submitted && <p role="status" className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-sm text-emerald-200">Inquiry received. The project manager will review it. This does not create an account or grant access to a ticket.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-5">
        <p className="max-w-xs text-[11px] text-gray-500">{submitted ? 'Email ownership must be verified through a client invitation before ticket access is granted.' : !submissionEnabled ? unavailableMessage : 'Your inquiry will be sent for review. Submitting an email address does not grant ticket access.'}</p>
        <div className="flex gap-2"><button type="button" onClick={onCancel} className={secondary} disabled={isSubmitting || outcomeUnknown}>Cancel</button><button className={primary} type="submit" disabled={!submissionEnabled || isSubmitting || submitted}><Send size={14} />{isSubmitting ? 'Submitting…' : submitted ? 'Inquiry received' : outcomeUnknown ? 'Check same submission' : 'Submit inquiry'}</button></div>
      </div>
    </form>
  </section>;
}
