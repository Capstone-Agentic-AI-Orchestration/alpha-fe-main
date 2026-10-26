import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Send, ShieldCheck } from 'lucide-react';
import { PUBLIC_TICKET_INQUIRY_SCHEMA_VERSION } from './publicIntakeContract';
import type { PublicTicketInquiryPayload, PublicTicketInquiryResponse } from './publicIntakeContract';
import { PublicTicketIntakeApiError } from './publicIntakeApi';
import { composeInquiryDescription, INQUIRY_DETAILS_MAX_LENGTH, INQUIRY_LINKS_MAX_LENGTH, INQUIRY_PROMPTS } from './inquiryDetails';
import { useClientPageMotion } from './publicClient/useClientPageMotion';

export type InquiryNavigationState = { dirty: boolean; locked: boolean };

export function PublicInquiryForm({ onSubmit, onCancel, submissionEnabled = false, unavailableMessage = 'Inquiry submission is unavailable. Nothing is sent or saved.', onNavigationStateChange, status, guide }: {
  /** Availability lines shown under the intro, beside the form. */
  status?: ReactNode;
  /** What happens next, shown under the status. */
  guide?: ReactNode;
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

  return <div ref={motionRef} className="iq-layout">
    <div className="iq-copy">
      <button type="button" onClick={cancel} disabled={locked} className="ca-link iq-back"><ArrowLeft size={15} />Back to Alphaexplora entry</button>
      <div className="public-inquiry-intro" data-public-arrival><p className="ca-eyebrow">Project inquiry</p><h1>Tell us what you need<span>.</span></h1><p>A good project starts with a conversation. Share your idea, the outcome you’re after, and what matters most. Your project manager will take it from here.</p></div>
      {status}
      {guide}
    </div>
    <form aria-label="Project inquiry" aria-busy={isSubmitting} className="ca-form iq-form" onInvalidCapture={() => setValidationError('Please complete the required fields and use a valid email address.')} onInput={() => { setValidationError(''); setError(''); }} onSubmit={event => {
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
      <label className="ca-field"><span>Your name <span>(required)</span></span>
        <input required maxLength={160} autoComplete="name" disabled={fieldsDisabled} value={fullName} onChange={event => { setFullName(event.target.value); operationId.current = crypto.randomUUID(); }} /></label>
      <label className="ca-field"><span>Email <span>(required)</span></span>
        <input type="email" required maxLength={254} autoComplete="email" disabled={fieldsDisabled} value={email} onChange={event => { setEmail(event.target.value); operationId.current = crypto.randomUUID(); }} /></label>
      <label className="ca-field"><span>Company <span>(optional)</span></span>
        <input maxLength={160} autoComplete="organization" disabled={fieldsDisabled} value={company} onChange={event => { setCompany(event.target.value); operationId.current = crypto.randomUUID(); }} /></label>
      <label className="ca-field"><span>Target date <span>(optional, not guaranteed)</span></span>
        <input type="date" disabled={fieldsDisabled} value={requestedDeadline} onChange={event => { setRequestedDeadline(event.target.value); operationId.current = crypto.randomUUID(); }} /></label>
      <label className="ca-field iq-wide"><span>What do you need? <span>(required)</span></span>
        <input required maxLength={160} disabled={fieldsDisabled} value={title} onChange={event => { setTitle(event.target.value); operationId.current = crypto.randomUUID(); }} placeholder="A short summary" /></label>
      <label className="ca-field iq-wide iq-details"><span>Details <span>(required)</span></span>
        <textarea required maxLength={INQUIRY_DETAILS_MAX_LENGTH} aria-describedby="inquiry-prompts" disabled={fieldsDisabled} value={description} onChange={event => { setDescription(event.target.value); operationId.current = crypto.randomUUID(); }} placeholder="Describe the outcome you’re looking for and any useful context." /></label>
      <p id="inquiry-prompts" className="iq-hint iq-wide iq-prompts">Not sure what to write? These help your project manager the most:{INQUIRY_PROMPTS.map(prompt => <span key={prompt}>{prompt}</span>)}</p>
      <label className="ca-field iq-wide"><span>Links to reference material <span>(optional)</span></span>
        <textarea rows={2} className="iq-links" maxLength={INQUIRY_LINKS_MAX_LENGTH} disabled={fieldsDisabled} value={links} onChange={event => { setLinks(event.target.value); operationId.current = crypto.randomUUID(); }} placeholder="One per line: your website, a shared folder, an example you like" /></label>
      <p className="iq-hint iq-wide iq-notice"><ShieldCheck size={14} aria-hidden="true" />This sends your request for review. It does not start work or create an account. You can sign in after your project manager invites you and you verify this email. Do not include passwords or sensitive files. Files can be added to your request after your project manager invites you and you sign in.</p>
      {error && <p role="alert" className="ca-error iq-wide">{error}</p>}
      {validationError && <p role="alert" className="ca-error is-warning iq-wide">{validationError}</p>}
      {outcomeUnknown && <p role="status" className="ca-error is-warning iq-wide">We could not confirm whether your inquiry was received. Choose “Check inquiry status” below before trying again; this avoids sending a duplicate.</p>}
      {submitted && <p role="status" className="ca-error is-success iq-wide">Inquiry received{publicReference ? <> · reference <span className="font-mono">{publicReference}</span></> : ''}. Your project manager will review it. This does not create an account or give you portal access yet.</p>}
      {submitted && <p className="iq-hint iq-wide">If your project manager invites you, follow the email to verify your access. If this is your first time, you can choose a password; otherwise, keep using your current one.</p>}
      <div className="iq-actions iq-wide">
        <p>{submitted ? 'You must verify your email from your project manager’s invitation before you can sign in.' : !submissionEnabled ? unavailableMessage : 'Your project manager will review this request. An email address alone does not create portal access.'}</p>
        <div><button type="button" onClick={cancel} className="ca-link iq-cancel min-h-[44px]" disabled={locked}>Cancel</button><button className="ca-submit min-h-[44px]" type="submit" disabled={!submissionEnabled || isSubmitting || submitted}><span className="ca-submit-text">{isSubmitting ? 'Submitting…' : submitted ? 'Inquiry received' : outcomeUnknown ? 'Check inquiry status' : 'Submit inquiry'}</span><span className="ca-submit-icon"><Send size={15} /></span></button></div>
      </div>
    </form>
  </div>;
}

