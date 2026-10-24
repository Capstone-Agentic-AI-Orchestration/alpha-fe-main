import type { ReactNode } from 'react';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { publicInquiryHref, publicInquirySlug } from './publicIntakeApi';
import { ClientPublicShell } from './publicClient/ClientPublicShell';
import './clientAuth.css';

export function ClientAuthShell({ children }: { children: ReactNode }) {
  const slug = typeof window === 'undefined' ? '' : publicInquirySlug(window.location);
  return <ClientPublicShell slug={slug} page="access">
    <section className="ca-auth-layout public-container" aria-label="Client account access">
      <aside className="ca-brand">
        <div className="ca-brand-copy"><p className="ca-eyebrow">Your client portal</p><h1>Your requests.<br /><span>One clear view.</span></h1><p>See the requests your project manager has shared with you, follow updates, and keep the details together.</p></div>
        <div className="ca-journey" aria-label="How client access works">
        <div className="ca-journey-head"><span>CLIENT ACCESS</span><span>INVITATION → PORTAL</span></div>
        <div className="ca-journey-grid"><span>INQUIRY</span><span>REVIEW</span><span>INVITE</span><span>PORTAL</span></div>
        <div className="ca-journey-lines"><p><i /> Your project manager reviews your request.</p><p><i /> You verify the invited email.</p><p><i /> Your account shows requests shared with you.</p></div>
        <p className="ca-journey-note"><ShieldCheck size={13} /> Only requests shared with your account appear here.</p>
        </div>
      </aside>
      <section className="ca-form-side" aria-label="Sign in or manage your account">
        <div className="ca-card-outer"><div className="ca-card">{children}</div></div>
        <footer className="ca-footer"><a href={publicInquiryHref(slug)}>New to Alphaexplora? Send an inquiry</a><a href="/#/team">Team sign in <ArrowUpRight size={12} /></a></footer>
      </section>
    </section>
  </ClientPublicShell>;
}
