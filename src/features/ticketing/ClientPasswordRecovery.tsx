import { useState } from 'react';
import { ClientAuthShell } from './ClientAuthShell';
import { clientAccountApi } from './clientAccountApi';

export default function ClientPasswordRecovery() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  return <ClientAuthShell><h2>{sent ? 'Check your inbox.' : 'Reset your password'}</h2>
    {sent && <p className="ca-description">If an account exists for this email, a link is on its way.</p>}
    <form onSubmit={event => {
      event.preventDefault(); if (busy) return;
      setBusy(true); setError('');
      void clientAccountApi.recover(email.trim()).then(() => setSent(true)).catch(err => setError(err instanceof TypeError
        ? 'We could not connect to password recovery. Check your internet connection and try again.'
        : err instanceof Error ? err.message : 'Could not request a password link. Try again.')).finally(() => setBusy(false));
    }}><label className="ca-field"><span>Email address</span><input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => { setEmail(event.target.value); setSent(false); setError(''); }} disabled={busy} placeholder="you@example.com" /></label>
      <button type="submit" className="ca-submit" disabled={busy || sent}>{busy ? 'Requesting link…' : sent ? 'Link requested' : 'Send password link'}</button>
    </form>{error && <p className="ca-error" role="alert">{error}</p>}
    <a className="ca-link" href="/#/client">Back to sign in</a>
  </ClientAuthShell>;
}
