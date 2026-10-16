import type { ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, ShieldCheck } from 'lucide-react';
import alphaMark from '@/assets/alpha-mark.png';
import { clientLandingHref, publicInquiryHref, publicInquirySlug } from './publicIntakeApi';
import './clientAuth.css';

export function ClientAuthShell({ children }: { children: ReactNode }) {
  const slug = typeof window === 'undefined' ? '' : publicInquirySlug(window.location);
  return <main className="client-auth">
    <aside className="ca-brand">
      <a href={clientLandingHref(slug)} className="ca-logo"><img src={alphaMark} alt="" /><span>Alpha</span></a>
      <div className="ca-brand-copy"><p className="ca-eyebrow">Your client portal</p><h1>Your requests.<br /><span>One clear view.</span></h1><p>See the requests your project manager has shared with you, follow updates, and keep the details together.</p></div>
      <div className="ca-journey" aria-label="How client access works">
        <div className="ca-journey-head"><span>CLIENT ACCESS</span><span>INVITATION → PORTAL</span></div>
        <div className="ca-journey-grid"><span>INQUIRY</span><span>REVIEW</span><span>INVITE</span><span>PORTAL</span></div>
        <div className="ca-journey-lines"><p><i /> Your PM reviews your request.</p><p><i /> You verify the invited email.</p><p><i /> Your account opens the shared ticket.</p></div>
        <p className="ca-journey-note"><ShieldCheck size={13} /> Only requests shared with your account appear here.</p>
      </div>
    </aside>
    <section className="ca-form-side">
      <a href={clientLandingHref(slug)} className="ca-back"><ArrowLeft size={14} />Back to home</a>
      <div className="ca-card-outer"><div className="ca-card">{children}</div></div>
      <footer className="ca-footer"><a href={publicInquiryHref(slug)}>New to Alpha? Send an inquiry</a><a href="/#/team">Team sign in <ArrowUpRight size={12} /></a></footer>
    </section>
  </main>;
}
