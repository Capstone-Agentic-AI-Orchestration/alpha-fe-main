import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Copy, Check, ExternalLink } from 'lucide-react';
import { apiService, parseApiError } from '@/shared/services/apiService';
import type { CodexAlphaSignInState, RuntimeEngine } from '@/shared/types';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';

interface IsolationViewProps {
  isolation: NonNullable<RuntimeEngine['isolation']>;
  /** Present only when this person may sign Codex in or out on this desktop. */
  signIn?: CodexAlphaSignInState | null;
  busy?: boolean;
  error?: string | null;
  copied?: boolean;
  onStart?: () => void;
  onCancel?: () => void;
  onSignOut?: () => void;
  onCopyCode?: (code: string) => void;
}

/** What the developer sees: whether agents share their setup, and the Codex sign-in steps. */
export const RuntimeIsolationView: React.FC<IsolationViewProps> = ({
  isolation, signIn, busy = false, error, copied = false, onStart, onCancel, onSignOut, onCopyCode
}) => {
  const Icon = isolation.isolated ? ShieldCheck : ShieldAlert;
  return (
    <Card className={`p-3.5 space-y-2.5 ${isolation.isolated ? 'bg-surface border-divider' : 'bg-status-warning-subtle border-status-warning-border'}`}>
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isolation.isolated ? 'text-status-success' : 'text-status-warning'}`} aria-hidden="true" />
        <div className="space-y-1">
          <div className="text-[11px] font-medium text-content">
            {isolation.isolated ? 'Kept separate from your personal setup' : 'Shares your personal setup'}
          </div>
          <p className="text-[11px] text-content-secondary leading-relaxed">{isolation.detail}</p>
        </div>
      </div>

      {signIn?.status === 'waiting' && signIn.verificationUrl && signIn.userCode && (
        <div className="rounded-lg bg-well border border-divider p-2.5 space-y-2 text-[11px]">
          <div className="text-content-secondary">Open the link, sign in, and enter this one-time code. It expires in 15 minutes.</div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-content tracking-wider" aria-label="One-time code">{signIn.userCode}</span>
            <Button size="sm" variant="ghost" type="button" onClick={() => onCopyCode?.(signIn.userCode!)} className="h-7 text-[11px]">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy code'}</span>
            </Button>
          </div>
          <a href={signIn.verificationUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-selected-content hover:underline">
            Open sign-in page <ExternalLink className="w-3 h-3" />
          </a>
          <div>
            <Button size="sm" variant="ghost" type="button" disabled={busy} onClick={onCancel} className="h-7 text-[11px]">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {(signIn?.status === 'failed' || signIn?.status === 'expired') && signIn.error && (
        <p className="text-[11px] text-status-danger">{signIn.error}</p>
      )}
      {error && <p className="text-[11px] text-status-danger">{error}</p>}

      {signIn && signIn.status !== 'waiting' && (
        signIn.status === 'signed_in' ? (
          <Button size="sm" variant="ghost" type="button" disabled={busy} onClick={onSignOut} className="h-7 text-[11px]">
            Sign Codex out of Alpha
          </Button>
        ) : (
          <Button size="sm" variant="outline" type="button" disabled={busy} onClick={onStart} className="h-7 text-[11px]">
            {busy ? 'Starting…' : 'Sign in to Codex for Alpha'}
          </Button>
        )
      )}
    </Card>
  );
};

/**
 * Whether agents on this runtime run without the developer's personal setup
 * (instructions, skills, plugins, MCP servers), and for Codex the sign-in
 * that makes it so. Polls only this desktop's own daemon while a sign-in waits.
 */
export const RuntimeIsolationPanel: React.FC<{
  runtime: RuntimeEngine;
  /** Only people who manage runtimes on this desktop can sign Codex in or out. */
  allowSignIn?: boolean;
  onSignedIn?: () => void;
}> = ({ runtime, allowSignIn = false, onSignedIn }) => {
  const [signIn, setSignIn] = useState<CodexAlphaSignInState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const offersCodexSignIn = allowSignIn && runtime.id === 'codex';

  useEffect(() => {
    if (!offersCodexSignIn) return;
    let cancelled = false;
    apiService.getCodexAlphaSignIn().then(state => { if (!cancelled) setSignIn(state); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [offersCodexSignIn]);

  useEffect(() => {
    if (signIn?.status !== 'waiting') return;
    const timer = window.setInterval(() => {
      apiService.getCodexAlphaSignIn().then(state => {
        setSignIn(state);
        if (state.status === 'signed_in') onSignedIn?.();
      }).catch(() => undefined);
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [signIn?.status, onSignedIn]);

  if (!runtime.isolation) return null;

  const run = async (action: () => Promise<CodexAlphaSignInState>) => {
    setBusy(true);
    setError(null);
    try {
      const state = await action();
      setSignIn(state);
      if (state.status === 'signed_in' || state.status === 'signed_out') onSignedIn?.();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch { /* clipboard unavailable; the code stays visible */ }
  };

  return (
    <RuntimeIsolationView
      isolation={runtime.isolation}
      signIn={offersCodexSignIn ? signIn : null}
      busy={busy}
      error={error}
      copied={copied}
      onStart={() => void run(apiService.startCodexAlphaSignIn)}
      onCancel={() => void run(apiService.cancelCodexAlphaSignIn)}
      onSignOut={() => void run(apiService.signOutCodexAlphaSignIn)}
      onCopyCode={code => void copyCode(code)}
    />
  );
};

