import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, LockKeyhole, ShieldCheck } from 'lucide-react';
import { clientPortalHref, publicInquiryHref, publicInquirySlug } from '@/features/ticketing/publicIntakeApi';
import { ClientPublicShell } from '@/features/ticketing/publicClient/ClientPublicShell';
import { InquiryWorkflow } from '@/features/ticketing/publicClient/InquiryWorkflow';
import { useClientPageMotion } from '@/features/ticketing/publicClient/useClientPageMotion';

function readSlug(): string {
  return typeof window === 'undefined' ? '' : publicInquirySlug(window.location);
}

/** Pineapple's public landing design, linked to Alphaexplora's current inquiry and password-auth routes. */
export default function ClientLandingPage() {
  const [slug, setSlug] = useState(readSlug);
  const motionRef = useClientPageMotion();
  const inquiry = publicInquiryHref(slug);
  const clientSignIn = clientPortalHref(slug);

  useEffect(() => {
    const updateSlug = () => setSlug(readSlug());
    window.addEventListener('hashchange', updateSlug);
    window.addEventListener('popstate', updateSlug);
    return () => {
      window.removeEventListener('hashchange', updateSlug);
      window.removeEventListener('popstate', updateSlug);
    };
  }, []);

  return <ClientPublicShell slug={slug}>
    <div ref={motionRef}>
      <section className="public-hero public-container">
        <div className="public-hero-copy" data-public-arrival>
          <h1>A clear start for<br />your next project<span>.</span></h1>
          <p className="public-hero-description">Bring the idea. Your project manager will help make the next step clear, then you can follow the work shared with you in Alphaexplora.</p>
          <a className="public-button public-button-primary public-hero-cta" href={inquiry}>Start a project inquiry <ArrowUpRight size={19} /></a>
          <p className="public-cta-note">No account is needed to ask about a project.</p>
          <div className="public-hero-footnote"><span className="public-fine-rule" /><p>One place for the request.<br /><strong>One place to stay in the loop.</strong></p></div>
        </div>

        <section aria-label="Client sign in" className="public-access-card" data-public-arrival>
          <div className="public-card-heading"><span className="public-icon-tile"><LockKeyhole size={22} /></span><span>Already invited?</span></div>
          <h2>Sign in to your requests</h2>
          <p>Sign in with the email and password you set up from your project manager’s invitation.</p>
          <div className="public-signin-form">
            <a className="public-button public-button-primary" href={clientSignIn}>Go to client sign in <ArrowUpRight size={17} /></a>
          </div>
          <div className="public-notice"><ShieldCheck size={17} /><p>An inquiry does not create an account or grant access. If your project manager invites you, follow the email to verify your access or continue with your existing password.</p></div>
          <p className="public-small-copy">Already have a password? <a href={clientSignIn}>Sign in to your client portal.</a></p>
        </section>
      </section>

      <div className="public-assurances public-container">
        {['A project manager reviews every inquiry', 'Only invited clients can sign in', 'Your project stays private'].map(label => <span key={label}><Check size={16} />{label}</span>)}
      </div>

      <InquiryWorkflow />

      <section className="public-questions public-container" aria-labelledby="client-questions-heading">
        <div><h2 id="client-questions-heading">Before you begin.</h2><p>A few things to know about your client space.</p></div>
        <div className="public-question-list">
          <details><summary>Do I need an account to send an inquiry?</summary><p>No. Send an inquiry and a project manager will review it. The inquiry does not create an account or start work.</p></details>
          <details><summary>When can I sign in?</summary><p>After a project manager reviews your inquiry and invites the same email address, open the email link to verify your access and finish setup. If you already have a password, keep using it to sign in.</p></details>
          <details><summary>What can I see after I’m invited?</summary><p>Only the requests and project preview your project manager shares with you. Private project work and notes stay private.</p></details>
        </div>
      </section>

      <div className="public-container flex flex-wrap justify-end gap-4 pb-8 text-xs">
        <a className="public-text-link" href="/#/team">Team sign in <ArrowUpRight size={14} /></a>
      </div>
    </div>
  </ClientPublicShell>;
}
