import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Send, ShieldCheck } from 'lucide-react';
import { PUBLIC_TICKET_INQUIRY_SCHEMA_VERSION } from './publicIntakeContract';
import type { PublicTicketInquiryPayload, PublicTicketInquiryResponse } from './publicIntakeContract';
import { PublicTicketIntakeApiError } from './publicIntakeApi';
import { composeInquiryDescription, INQUIRY_DETAILS_MAX_LENGTH, INQUIRY_LINKS_MAX_LENGTH } from './inquiryDetails';
import { useClientPageMotion } from './publicClient/useClientPageMotion';

/** The backend stores one `fullName` (max 160), so the two parts plus a space must fit. */
const FIRST_NAME_MAX_LENGTH = 80;
const LAST_NAME_MAX_LENGTH = 79;

export type InquiryNavigationState = { dirty: boolean; locked: boolean };

export function PublicInquiryForm({ onSubmit, onCancel, submissionEnabled = false, unavailableMessage = 'Submission is unavailable.', onNavigationStateChange, status }: {
  /** Availability lines shown under the heading, beside the form. */
  status?: ReactNode;
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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [links, setLinks] = useState('');
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [publicReference, setPublicReference] = useState<string | null>(null);
  const motionRef = useClientPageMotion();
  const locked = isSubmitting || outcomeUnknown;
  const fieldsDisabled = locked || submitted;
  const dirty = !submitted && Boolean(firstName || lastName || email || company || title || description || links);
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
      <div className="public-inquiry-intro" data-public-arrival><h1>Tell us what you need<span>.</span></h1></div>
      {status}
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
          fullName: `${firstName.trim()} ${lastName.trim()}`,
          email,
          company: company.trim() || null,
          title,
          description: composeInquiryDescription(description, links),
          requestedDeadline: null,
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
      <label className="ca-field"><span>First name</span>
        <input required maxLength={FIRST_NAME_MAX_LENGTH} autoComplete="given-name" disabled={fieldsDisabled} value={firstName} onChange={event => { setFirstName(event.target.value); operationId.current = crypto.randomUUID(); }} /></label>
      <label className="ca-field"><span>Last name</span>
        <input required maxLength={LAST_NAME_MAX_LENGTH} autoComplete="family-name" disabled={fieldsDisabled} value={lastName} onChange={event => { setLastName(event.target.value); operationId.current = crypto.randomUUID(); }} /></label>
      <label className="ca-field"><span>Company <span>(optional)</span></span>
        <input maxLength={160} autoComplete="organization" disabled={fieldsDisabled} value={company} onChange={event => { setCompany(event.target.value); operationId.current = crypto.randomUUID(); }} /></label>
      <label className="ca-field"><span>Email</span>
        <input type="email" required maxLength={254} autoComplete="email" disabled={fieldsDisabled} value={email} onChange={event => { setEmail(event.target.value); operationId.current = crypto.randomUUID(); }} /></label>
      <label className="ca-field iq-wide"><span>What do you need?</span>
        <input required maxLength={160} disabled={fieldsDisabled} value={title} onChange={event => { setTitle(event.target.value); operationId.current = crypto.randomUUID(); }} placeholder="A short summary" /></label>
      <label className="ca-field iq-wide iq-details"><span>Details</span>
        <textarea required maxLength={INQUIRY_DETAILS_MAX_LENGTH} disabled={fieldsDisabled} value={description} onChange={event => { setDescription(event.target.value); operationId.current = crypto.randomUUID(); }} placeholder="What should it do, and for whom?" /></label>
      <label className="ca-field iq-wide"><span>Links to reference material <span>(optional)</span></span>
        <textarea rows={2} className="iq-links" maxLength={INQUIRY_LINKS_MAX_LENGTH} disabled={fieldsDisabled} value={links} onChange={event => { setLinks(event.target.value); operationId.current = crypto.randomUUID(); }} placeholder="One link per line" /></label>
      <p className="iq-hint iq-wide iq-notice"><ShieldCheck size={14} aria-hidden="true" />Don’t include passwords or sensitive files.</p>
      {error && <p role="alert" className="ca-error iq-wide">{error}</p>}
      {validationError && <p role="alert" className="ca-error is-warning iq-wide">{validationError}</p>}
      {outcomeUnknown && <p role="status" className="ca-error is-warning iq-wide">We couldn’t confirm it was received. Use “Check inquiry status” before trying again.</p>}
      {submitted && <p role="status" className="ca-error is-success iq-wide">Inquiry received{publicReference ? <> · reference <span className="font-mono">{publicReference}</span></> : ''}. Your project manager will be in touch.</p>}
      <div className="iq-actions iq-wide">
        <p>{!submitted && !submissionEnabled && unavailableMessage ? unavailableMessage : null}</p>
        <div><button type="button" onClick={cancel} className="ca-link iq-cancel min-h-[44px]" disabled={locked}>Cancel</button><button className="ca-submit min-h-[44px]" type="submit" disabled={!submissionEnabled || isSubmitting || submitted}><span className="ca-submit-text">{isSubmitting ? 'Submitting…' : submitted ? 'Inquiry received' : outcomeUnknown ? 'Check inquiry status' : 'Submit inquiry'}</span><span className="ca-submit-icon"><Send size={15} /></span></button></div>
      </div>
    </form>
  </div>;
}

