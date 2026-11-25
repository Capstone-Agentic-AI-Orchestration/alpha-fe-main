import React, { useEffect, useState } from 'react';
import { ExternalLink, LogIn, TerminalSquare } from 'lucide-react';
import { apiService, parseApiError } from '@/shared/services/apiService';
import type { ClaudeSignInState } from '@/shared/types';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';

/** Runtimes whose CLI signs in interactively, so Alpha opens it in a terminal window. */
const SIGN_IN_WINDOW_LABEL: Record<string, string> = {
  antigravity: 'Antigravity',
  opencode: 'OpenCode'
};

/** Whether this runtime has an in-app sign-in. */
export const offersInAppSignIn = (runtimeId: string): boolean =>
  runtimeId === 'claude' || runtimeId in SIGN_IN_WINDOW_LABEL;

interface ClaudeSignInViewProps {
  state: ClaudeSignInState | null;
  busy?: boolean;
  error?: string | null;
  code?: string;
  onCodeChange?: (code: string) => void;
  onStart?: () => void;
  onSubmitCode?: () => void;
  onCancel?: () => void;
}

/** The Claude subscription sign-in steps. */
export const ClaudeSignInView: React.FC<ClaudeSignInViewProps> = ({
  state, busy = false, error, code = '', onCodeChange, onStart, onSubmitCode, onCancel
}) => (
  <div className="space-y-2 rounded-lg border border-divider bg-surface-raised/40 px-3 py-2.5 text-xs">
    {state?.status === 'signed_in' && <p className="text-content-secondary">Claude Code is signed in on this desktop.</p>}

    {state?.status === 'waiting' && (
      <div className="space-y-2">
        <p className="text-content-secondary">A browser tab opened. Finish signing in there and Alpha picks it up by itself.</p>
        {state.verificationUrl && (
          <>
            <p className="text-content-muted">If no tab opened, open the sign-in page, then paste the code it shows.</p>
            <a href={state.verificationUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-link hover:underline">
              Open sign-in page <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <form className="flex gap-2" onSubmit={event => { event.preventDefault(); onSubmitCode?.(); }}>
              <Input value={code} onChange={event => onCodeChange?.(event.target.value)} placeholder="Paste the code" aria-label="Code from Claude's sign-in page" className="h-8 flex-1 font-mono text-xs" />
              <Button type="submit" size="sm" variant="outline" disabled={busy || !code.trim()}>Submit code</Button>
            </form>
          </>
        )}
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancel} className="h-7 text-[11px]">Cancel</Button>
      </div>
    )}

    {(state?.status === 'failed' || state?.status === 'expired') && state.error && <p className="text-status-danger">{state.error}</p>}
    {error && <p className="text-status-danger">{error}</p>}

    {state?.status !== 'signed_in' && state?.status !== 'waiting' && (
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onStart}>
        <LogIn className="h-3.5 w-3.5" />{busy ? 'Starting…' : 'Sign in with your Claude subscription'}
      </Button>
    )}
  </div>
);

const ClaudeSignIn: React.FC<{ onSignedIn?: () => void }> = ({ onSignedIn }) => {
  const [state, setState] = useState<ClaudeSignInState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiService.getClaudeSignIn().then(next => { if (!cancelled) setState(next); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  // Poll only this desktop's own daemon, and only while a sign-in waits.
  useEffect(() => {
    if (state?.status !== 'waiting') return;
    const timer = window.setInterval(() => {
      apiService.getClaudeSignIn().then(next => {
        setState(next);
        if (next.status === 'signed_in') onSignedIn?.();
      }).catch(() => undefined);
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [state?.status, onSignedIn]);

  const run = async (action: () => Promise<ClaudeSignInState>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      setState(next);
      if (next.status === 'signed_in') onSignedIn?.();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ClaudeSignInView
      state={state}
      busy={busy}
      error={error}
      code={code}
      onCodeChange={setCode}
      onStart={() => void run(apiService.startClaudeSignIn)}
      onSubmitCode={() => void run(() => apiService.submitClaudeSignInCode(code.trim())).then(() => setCode(''))}
      onCancel={() => void run(apiService.cancelClaudeSignIn)}
    />
  );
};

const SignInWindow: React.FC<{ runtimeId: string }> = ({ runtimeId }) => {
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = SIGN_IN_WINDOW_LABEL[runtimeId];

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiService.openRuntimeSignInWindow(runtimeId);
      setOpened(true);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-divider bg-surface-raised/40 px-3 py-2.5 text-xs">
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void open()}>
        <TerminalSquare className="h-3.5 w-3.5" />{busy ? 'Opening…' : `Open ${label} sign-in`}
      </Button>
      {opened && <p className="text-content-secondary">A window opened with {label}. Sign in there, close the window, then press Check providers.</p>}
      {error && <p className="text-status-danger">{error}</p>}
    </div>
  );
};

/** Sign a runtime in to its subscription without leaving Alpha. The CLI keeps its own credentials. */
export const ProviderSignIn: React.FC<{ runtimeId: string; onSignedIn?: () => void }> = ({ runtimeId, onSignedIn }) => {
  if (runtimeId === 'claude') return <ClaudeSignIn onSignedIn={onSignedIn} />;
  if (runtimeId in SIGN_IN_WINDOW_LABEL) return <SignInWindow runtimeId={runtimeId} />;
  return null;
};

