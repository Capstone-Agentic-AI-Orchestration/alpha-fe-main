import type { ReactNode } from 'react';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { publicInquiryHref, publicInquirySlug } from './publicIntakeApi';
import { ClientPublicShell } from './publicClient/ClientPublicShell';
import './clientAuth.css';

/** How a client reaches the portal; the visitor is at the last step. */
const ACCESS_PATH = ['Inquiry', 'Review', 'Invite', 'Portal'];

/** Open, container-free layout shared by sign in, password recovery and invitation setup. */
export function ClientAuthShell({ children, variant }: Readonly<{ children: ReactNode; variant?: 'sign-in' }>) {
  const slug = typeof window === 'undefined' ? '' : publicInquirySlug(window.location);
  return <ClientPublicShell slug={slug} page="access">
    <section className={`ca-auth-layout public-container${variant === 'sign-in' ? ' ca-auth-layout--sign-in' : ''}`} aria-label="Client account access">
      <div className="ca-brand-copy">
        <p className="ca-eyebrow">Your client portal</p>
        <h1>Your requests.<br /><span>One clear view.</span></h1>
        <p>See the requests your project manager has shared with you, follow updates, and keep the details together.</p>
      </div>
      <section className="ca-form-side" aria-label="Sign in or manage your account">
        <div className="ca-form">{children}</div>
        <footer className="ca-footer"><a href={publicInquiryHref(slug)}>New to Alphaexplora? Send an inquiry</a><a href="/#/team">Team sign in <ArrowUpRight size={12} /></a></footer>
      </section>
      <div className="ca-path" role="group" aria-label="How client access works">
        <ol className="ca-path-rail">
          {ACCESS_PATH.map((step, index) => {
            const here = index === ACCESS_PATH.length - 1;
            return <li key={step} className={here ? 'is-here' : undefined} aria-current={here ? 'step' : undefined}><i /><span>{step}</span></li>;
          })}
        </ol>
        <ul className="ca-path-lines">
          <li>Your project manager reviews your request.</li>
          <li>You verify the invited email.</li>
          <li>Your account shows requests shared with you.</li>
        </ul>
        <p className="ca-path-note"><ShieldCheck size={13} /> Only requests shared with your account appear here.</p>
      </div>
    </section>
  </ClientPublicShell>;
}
