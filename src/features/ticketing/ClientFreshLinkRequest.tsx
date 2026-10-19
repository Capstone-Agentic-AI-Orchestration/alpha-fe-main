import { useState } from 'react';
import { clientAccountApi } from './clientAccountApi';

/**
 * Shown when an invitation or sign-in link no longer works. An already-active client
 * can get a fresh link by themselves; the answer never reveals whether the email exists.
 */
export function ClientFreshLinkRequest() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  return <section className="ca-fresh" aria-label="Get a fresh link">
    <h3 className="ca-description">Need a fresh link?</h3>
    {sent
      ? <p className="ca-notice" role="status">If this email has client access, a new one-time link is on its way. Check spam too. It can take a minute.</p>
      : <form onSubmit={event => {
        event.preventDefault(); if (busy || !email.trim()) return;
        setBusy(true); setError('');
        void clientAccountApi.recover(email.trim()).then(() => setSent(true))
          .catch(err => setError(err instanceof Error ? err.message : 'Could not request a new link. Try again.'))
          .finally(() => setBusy(false));
      }}>
        <label className="ca-field"><span>Your email address</span>
          <input type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy}
            onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <button type="submit" className="ca-submit" disabled={busy || !email.trim()}><span className="ca-submit-text">{busy ? 'Requesting link…' : 'Email me a fresh link'}</span></button>
      </form>}
    {error && <p className="ca-error" role="alert">{error}</p>}
    <p className="ca-notice">Opening your very first invitation after it expired? Ask your project manager to send a new invitation. They can do it with one click, and your inquiry stays as it is.</p>
  </section>;
}
