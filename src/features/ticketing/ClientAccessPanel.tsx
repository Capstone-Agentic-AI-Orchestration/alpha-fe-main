import { useState } from 'react';
import { LockKeyhole, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import alphaMarkUrl from '@/assets/alpha-mark.png';
import { input, primary, secondary } from './ticketUi';

/** Email-link sign-in for previously activated, ticket-scoped client accounts. */
export function ClientAccessPanel({ unavailable, error, signInError, signInSent, signingIn, onRetry, onRequestSignIn }: {
  unavailable: boolean;
  error: string;
  signInError: string;
  signInSent: boolean;
  signingIn: boolean;
  onRetry: () => void;
  onRequestSignIn: (email: string) => void;
}) {
  const [email, setEmail] = useState('');
  return <main className="min-h-dvh bg-canvas font-sans text-gray-300">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-shell px-5 py-4 md:px-8">
      <a href="/#/client" className="flex items-center gap-3"><img src={alphaMarkUrl} alt="Alpha" className="h-8 w-8 object-contain" /><span className="text-sm font-semibold text-white">Alpha <span className="ml-2 font-normal text-gray-500">Client portal</span></span></a>
      <a href="/#/request" className="text-xs text-gray-400 hover:text-white">Have a new inquiry?</a>
    </header>
    <section className="mx-auto grid w-full max-w-4xl gap-8 px-5 py-12 md:grid-cols-2 md:gap-12 md:py-20">
      <div className="space-y-5 md:pt-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/20 bg-brand-500/[0.08] px-3 py-1 text-[11px] text-brand-300"><ShieldCheck size={13} />Invitation-only web access</span>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Your requests.<br />One place to follow up.</h1>
        <p className="max-w-sm text-sm leading-relaxed text-gray-400">View the status and details of the specific tickets your project manager has shared with you.</p>
        <ul className="space-y-3 text-xs text-gray-400">
          {['Only tickets explicitly granted to your account', 'No access to internal projects or developer work', 'No GitHub account or desktop download'].map(label => <li key={label} className="flex items-center gap-2"><ShieldCheck size={14} className="shrink-0 text-brand-300" />{label}</li>)}
        </ul>
      </div>
      <section aria-label="Client sign-in" className="rounded-2xl border border-white/[0.08] bg-surface p-6 shadow-xl md:p-8">
        <span className="inline-flex rounded-xl bg-brand-500/10 p-3 text-brand-300"><LockKeyhole size={22} /></span>
        <h2 className="mt-5 text-xl font-semibold text-white">Access your tickets</h2>
        <p className="mt-2 text-xs leading-relaxed text-gray-400">Enter the email address your project manager invited. Alpha will send a one-time sign-in link if that address has active client access.</p>
        <form className="mt-6" onSubmit={event => { event.preventDefault(); onRequestSignIn(email.trim()); }}>
          <label className="block space-y-2"><span className="text-xs font-medium text-gray-300">Email address</span>
            <span className="relative block"><Mail size={15} className="absolute left-3 top-3 text-gray-600" /><input type="email" required maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} disabled={unavailable || signingIn} placeholder="you@example.com" aria-describedby="client-access-availability" className={`${input} pl-10 disabled:cursor-not-allowed disabled:opacity-60`} /></span>
          </label>
          <button type="submit" disabled={unavailable || signingIn || !email.trim()} className={`${primary} mt-3 w-full`}>{signingIn ? 'Sending…' : 'Send sign-in link'}</button>
        </form>
        <p id="client-access-availability" role="status" className="mt-4 rounded-lg border border-amber-400/15 bg-amber-500/[0.04] p-3 text-[11px] leading-relaxed text-amber-100/80">
          {unavailable ? 'Secure client sign-in is temporarily unavailable.' : signInSent ? 'If this email has active client access, Alpha will attempt to send a one-time link. If it does not arrive, contact your project manager.' : 'New client accounts are invitation-only. A sign-in link does not create an account or grant access.'}
        </p>
        {signInError && <p role="alert" className="mt-3 text-[11px] leading-relaxed text-rose-200">{signInError}</p>}
        {error && <p className="mt-3 text-[11px] leading-relaxed text-gray-500">{error}</p>}
        <button type="button" onClick={onRetry} className={`${secondary} mt-4 w-full`}><RefreshCw size={13} />Check access again</button>
        {import.meta.env.DEV && <a href="/?ticketing-preview=client" className="mt-4 block text-center text-[11px] text-brand-300 hover:text-brand-200">Inspect the client UI with fictional sample tickets</a>}
      </section>
    </section>
    <footer className="mx-auto max-w-4xl border-t border-white/[0.06] px-5 py-5 text-[11px] text-gray-500">Your client access never opens internal workspaces, repositories, developer controls or private PM notes.</footer>
  </main>;
}
