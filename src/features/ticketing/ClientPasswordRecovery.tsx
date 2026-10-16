import { useState } from 'react';
import { ClientAuthShell } from './ClientAuthShell';
import { clientAccountApi } from './clientAccountApi';

export default function ClientPasswordRecovery() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  return <ClientAuthShell><h2>{sent ? 'Check your inbox.' : 'Let’s get you back in.'}</h2><p className="ca-description">{sent
    ? 'If this email has active client access, a one-time password setup or recovery link will be sent. Check spam too. You do not need to submit another inquiry.'
    : 'Enter your invited email to set up or reset your password. Your account and existing requests will stay together.'}</p>
    <form onSubmit={event => {
      event.preventDefault(); if (busy) return;
      setBusy(true); setError('');
      void clientAccountApi.recover(email.trim()).then(() => setSent(true)).catch(err => setError(err instanceof Error ? err.message : 'Could not request recovery. Try again.')).finally(() => setBusy(false));
    }}><label className="ca-field"><span>Email address</span><input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => { setEmail(event.target.value); setSent(false); }} disabled={busy} placeholder="you@example.com" /></label>
      <button type="submit" className="ca-submit" disabled={busy || sent}>{busy ? 'Requesting link…' : sent ? 'Link requested' : 'Send password link'}</button>
    </form>{error && <p className="ca-error" role="alert">{error}</p>}
    <p className="ca-notice">An inquiry alone does not activate access. Your PM must first invite you. If an invitation expired before you activated it, ask your PM to resend it.</p>
    <a className="ca-link" href="/#/client">Back to sign in</a>
  </ClientAuthShell>;
}
