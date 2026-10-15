import { ArrowDown, ArrowUpRight, Check, MessageSquare, ShieldCheck } from 'lucide-react';
import alphaMark from '@/assets/alpha-mark.png';
import { clientLandingHref, clientPortalHref, publicInquiryHref, publicInquirySlug } from '@/features/ticketing/publicIntakeApi';
import './clientLanding.css';

const steps = [
  ['01', 'Inquiry', 'Tell us what you need with the existing project inquiry form.'],
  ['02', 'PM review', 'Your project manager reviews the request and follows up if details are missing.'],
  ['03', 'Invitation', 'When your request is approved, your PM invites the email address you provided.'],
  ['04', 'Account setup', 'Verify the invitation, choose a password, and open your client portal.'],
];

/** The previous marketing layout, connected to Alpha's real client entry routes. */
export default function ClientLandingPage() {
  const slug = typeof window === 'undefined' ? '' : publicInquirySlug(window.location);
  const inquiry = publicInquiryHref(slug);
  const login = clientPortalHref(slug);

  return <main className="client-landing">
    <nav aria-label="Main navigation" className="cl-nav">
      <div className="cl-nav-inner">
        <a className="cl-brand" href={clientLandingHref(slug)}><img src={alphaMark} alt="" />Alpha</a>
        <a className="cl-nav-process" href="#how-it-works">How it works</a>
        <div className="cl-nav-actions"><a href={login}>Client sign in</a><a className="cl-nav-start" href={inquiry}>Send an inquiry</a></div>
      </div>
    </nav>

    <section className="cl-hero">
      <div className="cl-hero-grid" aria-hidden="true" />
      <div className="cl-hero-inner">
        <div className="cl-hero-copy">
          <h1>Your request.<br /><span>Our next step.</span></h1>
          <p>Start with what you need. Your project manager will help clarify the request, then you can follow approved updates in your client portal.</p>
          <div className="cl-hero-cta"><a className="cl-primary" href={inquiry}>Start an inquiry <ArrowUpRight size={17} /></a></div>
          <p className="cl-hero-note">Already invited? <a href={login}>Sign in to your portal</a></p>
        </div>

        <div className="cl-hero-scene" role="img" aria-label="Illustration of a request moving from inquiry to client portal">
          <div className="cl-scene-orbit cl-scene-orbit-one" />
          <div className="cl-scene-orbit cl-scene-orbit-two" />
          <div className="cl-scene-glow" />
          <div className="cl-scene-card">
            <div className="cl-scene-heading"><span>ALPHA / CLIENT WORKFLOW</span><span className="cl-scene-indicator" /></div>
            <div className="cl-scene-line"><span><Check size={14} /></span><div><strong>Project inquiry</strong><small>Your request is received</small></div><b>01</b></div>
            <div className="cl-scene-line"><span><MessageSquare size={14} /></span><div><strong>PM review</strong><small>Clarify and approve the request</small></div><b>02</b></div>
            <div className="cl-scene-line"><span><ShieldCheck size={14} /></span><div><strong>Client portal</strong><small>Access stays tied to your account</small></div><b>03</b></div>
            <div className="cl-scene-footer">An illustrative view of the client journey</div>
          </div>
          <div className="cl-scene-tag cl-scene-tag-top">A request, together</div>
          <div className="cl-scene-tag cl-scene-tag-bottom">Private by design</div>
        </div>
      </div>
      <a className="cl-scroll-hint" href="#request-flow"><span>See how a request moves</span><ArrowDown size={14} /></a>
    </section>

    <section className="cl-flow" id="request-flow" aria-labelledby="cl-flow-title">
      <div className="cl-flow-head"><p className="cl-eyebrow">From inquiry to portal</p><h2 id="cl-flow-title">Your request, step by step.</h2><p>Account access begins after your PM approves the request and sends an invitation.</p></div>
      <article className="cl-terminal" aria-label="Illustrative client request workflow">
        <header className="cl-terminal-bar"><span className="cl-terminal-dots"><i /><i /><i /></span><span>alpha / client access</span><span className="cl-terminal-index">WORKFLOW</span></header>
        <div className="cl-terminal-body">{steps.map(([number, title, body]) => <div className="cl-terminal-row" key={number}><span className="cl-terminal-number">{number}</span><span className="cl-terminal-prompt">›</span><div><strong>{title}</strong><p>{body}</p></div><Check size={15} className="cl-terminal-check" /></div>)}</div>
        <footer className="cl-terminal-foot"><span>Client access is invitation-only</span><span>Requests stay with their verified email account</span></footer>
      </article>
    </section>

    <section className="cl-process" id="how-it-works" aria-labelledby="cl-process-heading">
      <div className="cl-process-inner"><div className="cl-process-head"><p className="cl-eyebrow">The flow</p><h2 id="cl-process-heading">How it works</h2></div>
        <ol className="cl-step-list">{steps.map(([number, title, body]) => <li key={number}><span className="cl-step-number">{number}</span><h3>{title}</h3><p>{body}</p><ArrowUpRight size={15} aria-hidden="true" /></li>)}</ol>
      </div>
    </section>

    <section className="cl-cta" id="cta" aria-labelledby="cl-cta-heading">
      <div className="cl-cta-inner"><div className="cl-cta-terminal"><div className="cl-cta-terminal-bar"><span className="cl-terminal-dots"><i /><i /><i /></span><span>alpha / start an inquiry</span></div><div className="cl-cta-terminal-body"><p><span>›</span> Open the project inquiry form</p><p><span>›</span> Share the outcome you need</p><p><span>›</span> Your PM will review and follow up</p></div></div>
        <div className="cl-cta-copy"><p className="cl-eyebrow">Start with a conversation</p><h2 id="cl-cta-heading">What do you<br />need help with?</h2><p>Use the same inquiry form Alpha already provides. No account is needed to send your first request.</p><a className="cl-primary" href={inquiry}>Open inquiry form <ArrowUpRight size={17} /></a><div className="cl-cta-note"><ShieldCheck size={14} />Your PM must invite you before portal access begins.</div></div>
      </div>
    </section>

    <footer className="cl-footer"><div className="cl-footer-inner"><div className="cl-footer-brand"><a className="cl-brand" href={clientLandingHref(slug)}><img src={alphaMark} alt="" />Alpha</a><p>AI work, coordinated.</p></div><div className="cl-footer-col"><h3>Client</h3><a href="#how-it-works">How it works</a><a href={inquiry}>Send an inquiry</a><a href={login}>Client sign in</a></div><div className="cl-footer-col"><h3>Team</h3><a href="/#/team">Team sign in</a><a href="https://alphaexplora.com" target="_blank" rel="noopener noreferrer">Alphaexplora</a></div><div className="cl-footer-bottom"><span>© {new Date().getFullYear()} Alpha</span><span>Client access is limited to requests shared with you.</span></div></div></footer>
  </main>;
}
