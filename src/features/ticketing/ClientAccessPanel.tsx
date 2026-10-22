import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, LockKeyhole, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { publicInquiryHref, publicInquirySlug } from './publicIntakeApi';
import { ClientPublicShell } from './publicClient/ClientPublicShell';
import { InquiryWorkflow } from './publicClient/InquiryWorkflow';
import { useClientPageMotion } from './publicClient/useClientPageMotion';

/** Email-link sign-in for previously activated, ticket-scoped client accounts. */
export function ClientAccessPanel({ checking = false, unavailable, error, signInError, signInSent, signingIn, onRetry, onRequestSignIn }: {
  checking?: boolean;
  unavailable: boolean;
  error: string;
  signInError: string;
  signInSent: boolean;
  signingIn: boolean;
  onRetry: () => void;
  onRequestSignIn: (email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const motionRef = useClientPageMotion();
  const [slug, setSlug] = useState(() => typeof window === 'undefined' ? '' : publicInquirySlug(window.location));
  useEffect(() => {
    const updateSlug = () => setSlug(publicInquirySlug(window.location));
    window.addEventListener('hashchange', updateSlug);
    window.addEventListener('popstate', updateSlug);
    return () => {
      window.removeEventListener('hashchange', updateSlug);
      window.removeEventListener('popstate', updateSlug);
    };
  }, []);
  const disabled = checking || unavailable || signingIn;
  return <ClientPublicShell slug={slug} page="access">
    <div ref={motionRef}>
      <section className="public-hero public-container">
        <div className="public-hero-copy" data-public-arrival>
          <h1>A clear start for<br />your next project<span>.</span></h1>
          <p className="public-hero-description">Bring the idea. We’ll help make the next step clear. Start a conversation with your project manager, then follow the work shared with you in Alphaexplora.</p>
          <a className="public-button public-button-primary public-hero-cta" href={publicInquiryHref(slug)}>Start a project inquiry <ArrowUpRight size={19} /></a>
          <p className="public-cta-note">No account needed to send an inquiry.</p>
          <div className="public-hero-footnote"><span className="public-fine-rule" /><p>One place for the brief.<br /><strong>One place to stay in the loop.</strong></p></div>
        </div>
        <section aria-label="Client sign-in" className="public-access-card" data-public-arrival>
          <div className="public-card-heading"><span className="public-icon-tile"><LockKeyhole size={22} /></span><span>Already invited?</span></div>
          <h2>See your shared requests</h2>
          <p>Use the email your project manager invited to view requests and updates shared with you.</p>
          <form className="public-signin-form" onSubmit={event => { event.preventDefault(); if (!disabled) onRequestSignIn(email.trim()); }} aria-busy={checking || signingIn}>
            <label className="public-field"><span>Email address</span><span className="public-input-icon"><Mail size={17} /><input className="public-input" type="email" required maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} disabled={disabled} placeholder="you@example.com" aria-describedby="client-access-availability" /></span></label>
            <button type="submit" disabled={disabled || !email.trim()} className="public-button public-button-primary">{checking ? 'Checking secure access…' : signingIn ? 'Sending…' : 'Send sign-in link'}<ArrowUpRight size={17} /></button>
          </form>
          <div id="client-access-availability" role="status" className={`public-notice ${unavailable ? 'public-notice-warning' : signInSent ? 'public-notice-success' : ''}`}><ShieldCheck size={17} /><p>{checking ? 'Checking your sign-in…' : unavailable ? 'Client sign-in is temporarily unavailable. Try again or contact your project manager.' : signInSent ? 'If this email has active client access, Alphaexplora will attempt to send a one-time link. If it does not arrive, contact your project manager.' : 'Already sent an inquiry? Your project manager must review it and invite you before you can sign in. A sign-in link will not create access.'}</p></div>
          {signInError && <p role="alert" className="public-error">{signInError}</p>}
          {error && <p className="public-small-copy">{error}</p>}
          <button type="button" onClick={onRetry} disabled={checking || signingIn} className="public-recheck"><RefreshCw size={14} />Check access again</button>
          {import.meta.env.DEV && <a href="/?ticketing-preview=client" className="public-preview-link">Preview with fictional sample tickets <ArrowUpRight size={12} /></a>}
        </section>
      </section>
      <div className="public-assurances public-container">{['Only requests shared with you', 'No account needed to inquire', 'Your private notes stay private'].map(label => <span key={label}><Check size={16} />{label}</span>)}</div>
      <InquiryWorkflow />
      <section className="public-questions public-container" aria-labelledby="client-questions-heading">
        <div><h2 id="client-questions-heading">Before you begin.</h2><p>A few things to know about your client space.</p></div>
        <div className="public-question-list">
          <details><summary>Do I need an account to send an inquiry?</summary><p>No. Send an inquiry for a project manager to review. It does not create an account or start work.</p></details>
          <details><summary>What can I see after I’m invited?</summary><p>Only the requests and project preview your project manager shares with you. Private project work and notes stay private.</p></details>
          <details><summary>My sign-in link hasn’t arrived. What next?</summary><p>Check that you used your invited email address and look in your spam folder. If the link still doesn’t arrive, contact your project manager to check your client access.</p></details>
        </div>
      </section>
    </div>
  </ClientPublicShell>;
}
