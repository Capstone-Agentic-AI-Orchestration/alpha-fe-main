import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, ShieldCheck } from 'lucide-react';
import { PUBLIC_TICKET_INQUIRY_SCHEMA_VERSION } from './publicIntakeContract';
import type { PublicTicketInquiryPayload, PublicTicketInquiryResponse } from './publicIntakeContract';
import { PublicTicketIntakeApiError } from './publicIntakeApi';
import { composeInquiryDescription, INQUIRY_DETAILS_MAX_LENGTH, INQUIRY_LINKS_MAX_LENGTH, INQUIRY_PROMPTS } from './inquiryDetails';
import { useClientPageMotion } from './publicClient/useClientPageMotion';
import { input, primary, secondary } from './ticketUi';

export type InquiryNavigationState = { dirty: boolean; locked: boolean };

export function PublicInquiryForm({ onSubmit, onCancel, submissionEnabled = false, unavailableMessage = 'Inquiry submission is unavailable. Nothing is sent or saved.', onNavigationStateChange }: {
  /** Resolve only after the configured intake transport returns its generic receipt. */
  onSubmit: (value: PublicTicketInquiryPayload) => void | PublicTicketInquiryResponse | Promise<void | PublicTicketInquiryResponse>;
  onCancel: () => void;
  submissionEnabled?: boolean;
  unavailableMessage?: string;
  onNavigationStateChange?: (state: InquiryNavigationState) => void;
}) {
  const operationId = useRef(crypto.randomUUID());
  const retryPayload = useRef<PublicTicketInquiryPayload | null>(null);
  const submissionInFlight = useRef(false);
  const exitApproved = useRef(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [links, setLinks] = useState('');
  const [requestedDeadline, setRequestedDeadline] = useState('');
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [publicReference, setPublicReference] = useState<string | null>(null);
  const motionRef = useClientPageMotion();
  const locked = isSubmitting || outcomeUnknown;
  const fieldsDisabled = locked || submitted;
  const dirty = !submitted && Boolean(fullName || email || company || title || description || links || requestedDeadline);
  useEffect(() => {
    onNavigationStateChange?.({ dirty, locked });
  }, [dirty, locked, onNavigationStateChange]);
  useEffect(() => {
    if (!dirty && !locked) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (exitApproved.current) return;
      event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, locked]);
  const cancel = () => {
    if (locked) return;
    if (!dirty || window.confirm('Leave this inquiry? Your unsent details will be lost.')) {
      exitApproved.current = true;
      onCancel();
    }
  };

  return <div ref={motionRef} className="public-inquiry-body">
    <button type="button" onClick={cancel} disabled={locked} className="public-text-link public-back-link"><ArrowLeft size={15} />Back to Alpha entry</button>
    <div className="public-inquiry-intro" data-public-arrival><h1>Tell us what you need<span>.</span></h1><p>A good project starts with a conversation. Share your idea, the outcome you’re after, and what matters most. Your project manager will take it from here.</p></div>
    <form aria-label="Project inquiry" aria-busy={isSubmitting} className="public-inquiry-form" onInvalidCapture={() => setValidationError('Please complete the required fields and use a valid email address.')} onInput={() => setValidationError('')} onSubmit={event => {
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
          description: composeInquiryDescription(description, links),
          requestedDeadline: requestedDeadline || null,
        };
      retryPayload.current = payload;
      void Promise.resolve().then(() => onSubmit(payload)).then(result => {
          retryPayload.current = null;
          setOutcomeUnknown(false);
          setPublicReference(result && 'publicReference' in result ? result.publicReference ?? null : null);
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
          <input className={input} required maxLength={160} autoComplete="name" disabled={fieldsDisabled} value={fullName} onChange={event => { setFullName(event.target.value); operationId.current = crypto.randomUUID(); }} /></label>
        <label className="block space-y-2"><span className="text-xs font-medium text-gray-300">Email <span className="text-gray-500">(required)</span></span>
          <input className={input} type="email" required maxLength={254} autoComplete="email" disabled={fieldsDisabled} value={email} onChange={event => { setEmail(event.target.value); operationId.current = crypto.randomUUID(); }} /></label>
      </div>
      <label className="block space-y-2"><span className="text-xs font-medium text-gray-300">Company <span className="text-gray-500">(optional)</span></span>
        <input className={input} maxLength={160} autoComplete="organization" disabled={fieldsDisabled} value={company} onChange={event => { setCompany(event.target.value); operationId.current = crypto.randomUUID(); }} /></label>
      <label className="block space-y-2"><span className="text-xs font-medium text-gray-300">What do you need? <span className="text-gray-500">(required)</span></span>
        <input className={input} required maxLength={160} disabled={fieldsDisabled} value={title} onChange={event => { setTitle(event.target.value); operationId.current = crypto.randomUUID(); }} placeholder="A short summary" /></label>
      <label className="block space-y-2"><span className="text-xs font-medium text-gray-300">Details <span className="text-gray-500">(required)</span></span>
        <textarea className={`${input} min-h-36 resize-y`} required maxLength={INQUIRY_DETAILS_MAX_LENGTH} aria-describedby="inquiry-prompts" disabled={fieldsDisabled} value={description} onChange={event => { setDescription(event.target.value); operationId.current = crypto.randomUUID(); }} placeholder="Describe the outcome you’re looking for and any useful context." /></label>
      <div id="inquiry-prompts" className="rounded-lg bg-white/[0.03] p-3 text-xs leading-relaxed text-gray-400">
        <p className="font-medium text-gray-300">Not sure what to write? These help your project manager the most:</p>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4">{INQUIRY_PROMPTS.map(prompt => <li key={prompt}>{prompt}</li>)}</ul>
      </div>
      <label className="block space-y-2"><span className="text-xs font-medium text-gray-300">Links to reference material <span className="text-gray-500">(optional)</span></span>
        <textarea className={`${input} min-h-20 resize-y`} maxLength={INQUIRY_LINKS_MAX_LENGTH} disabled={fieldsDisabled} value={links} onChange={event => { setLinks(event.target.value); operationId.current = crypto.randomUUID(); }} placeholder="One per line: your current website, a shared folder, a design or example you like." />
        <span className="block text-[11px] text-gray-500">Files can be attached to your ticket once your project manager invites you and you sign in.</span></label>
      <label className="block max-w-xs space-y-2"><span className="text-xs font-medium text-gray-300">Requested target date <span className="text-gray-500">(optional, not guaranteed)</span></span>
        <input className={input} type="date" disabled={fieldsDisabled} value={requestedDeadline} onChange={event => { setRequestedDeadline(event.target.value); operationId.current = crypto.randomUUID(); }} /></label>
      <div className="flex items-start gap-2 rounded-lg bg-white/[0.03] p-3 text-xs leading-relaxed text-gray-400"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-gray-500" />
        <p>This starts a review, not development or an account. The email is unverified and cannot be used to access a ticket. Do not include passwords or sensitive files.</p></div>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      {validationError && <p role="alert" className="text-xs text-amber-200">{validationError}</p>}
      {outcomeUnknown && <p role="status" className="rounded-lg border border-amber-400/20 bg-amber-500/[0.05] p-3 text-xs leading-relaxed text-amber-100">Keep this page open and check the same submission. Alpha will retry the exact saved-in-memory payload with the same operation ID; it will not start a second inquiry.</p>}
      {submitted && <p role="status" className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-sm text-emerald-200">Inquiry received{publicReference ? <> · reference <span className="font-mono">{publicReference}</span></> : ''}. The project manager will review it. This does not create an account or grant access to a ticket.</p>}
      {submitted && <p className="text-xs leading-relaxed text-gray-400">If your PM invites you, open the email to verify this address and choose your password. After setup, return through client sign-in whenever you need to follow up.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-5">
        <p className="max-w-xs text-[11px] text-gray-500">{submitted ? 'Email ownership must be verified through a client invitation before ticket access is granted.' : !submissionEnabled ? unavailableMessage : 'Your inquiry will be sent for review. Submitting an email address does not grant ticket access.'}</p>
        <div className="flex gap-2"><button type="button" onClick={onCancel} className={secondary} disabled={isSubmitting || outcomeUnknown}>Cancel</button><button className={primary} type="submit" disabled={!submissionEnabled || isSubmitting || submitted}><Send size={14} />{isSubmitting ? 'Submitting…' : submitted ? 'Inquiry received' : outcomeUnknown ? 'Check same submission' : 'Submit inquiry'}</button></div>
      </div>
    </form>
  </div>;
}
