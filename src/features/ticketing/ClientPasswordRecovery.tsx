import { useState } from 'react';
import { ClientAuthShell } from './ClientAuthShell';
import { clientAccountApi } from './clientAccountApi';

export default function ClientPasswordRecovery() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  return <ClientAuthShell><h2>{sent ? 'Check your inbox.' : 'Reset your password'}</h2><p className="ca-description">{sent
    ? 'If this email has an active client account, we’ll send a password link. Check your spam folder too. You do not need to send another inquiry.'
    : 'Enter the email your project manager invited. Your account and existing requests will stay together.'}</p>
    <form onSubmit={event => {
      event.preventDefault(); if (busy) return;
      setBusy(true); setError('');
      void clientAccountApi.recover(email.trim()).then(() => setSent(true)).catch(err => setError(err instanceof TypeError
        ? 'We could not connect to password recovery. Check your internet connection and try again.'
        : err instanceof Error ? err.message : 'Could not request a password link. Try again.')).finally(() => setBusy(false));
    }}><label className="ca-field"><span>Email address</span><input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => { setEmail(event.target.value); setSent(false); setError(''); }} disabled={busy} placeholder="you@example.com" /></label>
      <button type="submit" className="ca-submit" disabled={busy || sent}>{busy ? 'Requesting link…' : sent ? 'Link requested' : 'Send password link'}</button>
    </form>{error && <p className="ca-error" role="alert">{error}</p>}
    <p className="ca-notice">An inquiry alone does not activate access. Your project manager must first invite you. If the invitation expired before you set up your password, ask your project manager to resend it.</p>
    <a className="ca-link" href="/#/client">Back to sign in</a>
  </ClientAuthShell>;
}
