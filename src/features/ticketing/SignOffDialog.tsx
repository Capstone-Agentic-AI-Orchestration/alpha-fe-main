import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './projectStages.css';

export interface SignOffDialogProps {
  title: string;
  /** What is being approved or signed, shown above the consent. */
  children: ReactNode;
  consent: string;
  confirmLabel: string;
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: (fullName: string) => void;
}

/**
 * A typed-name sign-off: the reader ticks the consent and types their full
 * name. The server records the name, the time and a hash of exactly what was
 * shown. Used to approve a POC, sign a contract, accept the final delivery and
 * accept a quote.
 */
export function SignOffDialog({ title, children, consent, confirmLabel, busy, error = '', onCancel, onConfirm }: Readonly<SignOffDialogProps>) {
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState('');
  const id = useId();
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    nameInput.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [busy, onCancel]);
  const trimmed = name.trim();
  const ready = agreed && trimmed.length >= 2 && !busy;
  return createPortal(<div className="ps-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <form className="ps-dialog" role="dialog" aria-modal="true" aria-labelledby={id + '-title'}
      onSubmit={event => { event.preventDefault(); if (ready) onConfirm(trimmed); }}>
      <header className="ps-dialog-head">
        <h2 id={id + '-title'}>{title}</h2>
        <button type="button" className="ps-icon-button" onClick={onCancel} disabled={busy} aria-label="Close"><X size={16} aria-hidden="true" /></button>
      </header>
      <div className="ps-dialog-body">{children}</div>
      <label className="ps-consent">
        <input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} disabled={busy} />
        <span>{consent}</span>
      </label>
      <label className="ps-field">
        <span>Your full name</span>
        <input ref={nameInput} value={name} onChange={event => setName(event.target.value)} maxLength={200} autoComplete="name" disabled={busy}
          placeholder="Type your full name to sign" />
      </label>
      <p className="ps-hint">Your name, the date and time, and exactly what you saw are recorded.</p>
      {error && <p role="alert" className="ps-error">{error}</p>}
      <footer className="ps-dialog-foot">
        <button type="button" className="ps-button" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="submit" className="ps-button is-primary" disabled={!ready}>{busy ? 'Saving…' : confirmLabel}</button>
      </footer>
    </form>
  </div>, document.body);
}
