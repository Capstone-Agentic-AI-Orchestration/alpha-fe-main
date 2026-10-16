import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Check, Send, ShieldCheck } from 'lucide-react';
import { PUBLIC_TICKET_INQUIRY_SCHEMA_VERSION } from './publicIntakeContract';
import type { PublicTicketInquiryPayload } from './publicIntakeContract';
import { PublicTicketIntakeApiError } from './publicIntakeApi';
import { useClientPageMotion } from './publicClient/useClientPageMotion';

export type InquiryNavigationState = { dirty: boolean; locked: boolean };

export function PublicInquiryForm({ onSubmit, onCancel, submissionEnabled = false, unavailableMessage = 'Inquiry submission is unavailable. Nothing is sent or saved.', onNavigationStateChange }: {
  /** Resolve only after the configured intake transport returns its generic receipt. */
  onSubmit: (value: PublicTicketInquiryPayload) => void | Promise<void>;
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
  const [requestedDeadline, setRequestedDeadline] = useState('');
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const motionRef = useClientPageMotion();
  const locked = isSubmitting || outcomeUnknown;
  const fieldsDisabled = locked || submitted;
  const dirty = !submitted && Boolean(fullName || email || company || title || description || requestedDeadline);
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
      <fieldset className="public-form-section" disabled={fieldsDisabled}>
        <legend><span>01</span>Your project</legend>
        <label className="public-field"><span>What do you need? <span>(required)</span></span>
          <input className="public-input" required maxLength={160} value={title} onChange={event => { setTitle(event.target.value); operationId.current = crypto.randomUUID(); }} placeholder="A short summary of your project" /></label>
        <label className="public-field public-details-field"><span>Details <span>(required)</span></span>
          <textarea className="public-input public-inquiry-textarea" rows={10} required maxLength={6000} value={description} onChange={event => { setDescription(event.target.value); operationId.current = crypto.randomUUID(); }} placeholder={'What would you like to build or improve?\n\nTell us who it’s for, the result you want, and any useful context. It’s okay if you’re still figuring out the details.'} aria-describedby="inquiry-details-hint" /></label>
        <div id="inquiry-details-hint" className="public-field-meta"><span>A few thoughtful details help us understand the bigger picture.</span><span>{description.length.toLocaleString()} / 6,000</span></div>
      </fieldset>
      <fieldset className="public-form-section" disabled={fieldsDisabled}>
        <legend><span>02</span>How to reach you</legend>
        <p className="public-fieldset-note">Your project manager will use these details to follow up.</p>
        <div className="public-form-columns">
          <label className="public-field"><span>Your name <span>(required)</span></span>
            <input className="public-input" required maxLength={160} autoComplete="name" value={fullName} onChange={event => { setFullName(event.target.value); operationId.current = crypto.randomUUID(); }} /></label>
          <label className="public-field"><span>Email <span>(required)</span></span>
            <input className="public-input" type="email" required maxLength={254} autoComplete="email" value={email} onChange={event => { setEmail(event.target.value); operationId.current = crypto.randomUUID(); }} /></label>
        </div>
        <label className="public-field"><span>Company <span>(optional)</span></span>
          <input className="public-input" maxLength={160} autoComplete="organization" value={company} onChange={event => { setCompany(event.target.value); operationId.current = crypto.randomUUID(); }} /></label>
      </fieldset>
      <fieldset className="public-form-section" disabled={fieldsDisabled}>
        <legend><span>03</span>Timing &amp; review</legend>
        <label className="public-field public-date-field"><span>Requested target date <span>(optional, not guaranteed)</span></span>
          <input className="public-input" type="date" value={requestedDeadline} onChange={event => { setRequestedDeadline(event.target.value); operationId.current = crypto.randomUUID(); }} /></label>
        <div className="public-notice"><ShieldCheck size={18} /><p>This starts a review, not development or an account. Your email must be verified through an invitation before you can access tickets. Please leave out passwords and sensitive information.</p></div>
      </fieldset>
      {validationError && <p role="alert" className="public-error">{validationError}</p>}
      {error && <p role="alert" className="public-error">{error}</p>}
      {outcomeUnknown && <div role="status" className="public-notice public-notice-warning"><ShieldCheck size={18} /><p>We couldn’t confirm the receipt. Keep this page open and choose “Check same submission” to check your original inquiry without starting another one. Your details are temporarily locked to keep that check consistent.</p></div>}
      {submitted && <div role="status" className="public-notice public-notice-success"><Check size={20} /><p><strong>Inquiry received.</strong> The project manager will review it. This does not create an account or grant access to a ticket.</p></div>}
      <div className="public-form-actions">
        <p>{submitted ? 'Email ownership must be verified through a client invitation before ticket access is granted.' : !submissionEnabled ? unavailableMessage : 'Ready when you are. Your inquiry goes to the project manager for review.'}</p>
        <div><button type="button" onClick={cancel} className="public-button public-button-secondary" disabled={locked}>{submitted ? 'Back to client access' : 'Cancel'}{submitted && <ArrowUpRight size={15} />}</button><button className="public-button public-button-primary" type="submit" disabled={!submissionEnabled || isSubmitting || submitted}><Send size={16} />{isSubmitting ? 'Submitting…' : submitted ? 'Inquiry received' : outcomeUnknown ? 'Check same submission' : 'Submit inquiry'}</button></div>
      </div>
    </form>
  </div>;
}
