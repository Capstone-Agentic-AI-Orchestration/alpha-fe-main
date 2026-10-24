import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import { publicInquiryHref, publicInquirySlug } from './publicIntakeApi';
import { ClientPublicShell } from './publicClient/ClientPublicShell';
import { InquiryWorkflow } from './publicClient/InquiryWorkflow';
import { useClientPageMotion } from './publicClient/useClientPageMotion';

/** Static access guidance for the fictional ticket preview; real clients use password sign-in. */
export function ClientAccessPanel({ checking = false, unavailable, error, onRetry }: {
  checking?: boolean;
  unavailable: boolean;
  error: string;
  onRetry: () => void;
}) {
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
  const disabled = checking;
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
          <h2>Sign in with your password</h2>
          <p>A project manager must review your inquiry and invite you first. Open the invitation email to verify your email and choose a password. After setup, use that email and password whenever you return.</p>
          <a className="public-button public-button-primary" href="/#/client">Go to client sign in <ArrowUpRight size={17} /></a>
          <div role="status" className={`public-notice ${unavailable ? 'public-notice-warning' : ''}`}>
            <ShieldCheck size={17} />
            <p>{checking ? 'Checking client access…' : unavailable ? error || 'Client access is temporarily unavailable. Try again or contact your project manager.' : 'This is a sample preview. Real client access uses an invited email address and password—not a sign-in email link.'}</p>
          </div>
          <button type="button" onClick={onRetry} disabled={disabled} className="public-recheck"><RefreshCw size={14} />Check access again</button>
          {import.meta.env.DEV && <a href="/?ticketing-preview=client" className="public-preview-link">Preview with fictional sample tickets <ArrowUpRight size={12} /></a>}
        </section>
      </section>
      <div className="public-assurances public-container">{['Only requests shared with you', 'No account needed to inquire', 'Your private notes stay private'].map(label => <span key={label}><Check size={16} />{label}</span>)}</div>
      <InquiryWorkflow />
      <section className="public-questions public-container" aria-labelledby="client-questions-heading">
        <div><h2 id="client-questions-heading">Before you begin.</h2><p>A few things to know about your client space.</p></div>
        <div className="public-question-list">
          <details><summary>Do I need an account to send an inquiry?</summary><p>No. Send an inquiry for a project manager to review. It does not create an account or start work.</p></details>
          <details><summary>When can I sign in?</summary><p>After a project manager reviews your inquiry and invites the same email address, open the invitation, verify your email, and choose a password. Then sign in with that email and password.</p></details>
          <details><summary>What can I see after I’m invited?</summary><p>Only the requests and project preview your project manager shares with you. Private project work and notes stay private.</p></details>
        </div>
      </section>
    </div>
  </ClientPublicShell>;
}
