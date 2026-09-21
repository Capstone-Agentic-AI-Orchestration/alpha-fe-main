import React, { useEffect, useRef, useState } from 'react';
import {
  Github,
  Terminal,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Laptop,
  Loader2,
  AlertTriangle
} from 'lucide-react';

import { Identity } from '@/shared/types';
import { apiService } from '@/shared/services/apiService';

/**
 * The first thing a new teammate sees, when GitHub is not reachable yet.
 *
 * Every GitHub call the daemon makes shells out to `gh`: identity, teams, the
 * board, the write path. The installer now bundles `gh`, so the usual state
 * here is `signed_out`, and signing in happens in the app: the daemon starts
 * `gh auth login --web`, this shows the one-time code and opens GitHub's
 * device page, and polls until the browser approves. No terminal.
 *
 * `missing` -- no `gh` at all -- still shows the install step. That is a
 * development checkout without the bundled binary, not what a teammate who
 * installed Alpha should ever see.
 */

interface Props {
  identity: Identity;
  onRetry: () => Promise<void> | void;
  onContinueLocally: () => void;
}

const INSTALL_COMMAND = 'winget install --id GitHub.cli';
const LOGIN_COMMAND = 'gh auth login';

/** How often to ask whether the browser has approved. */
const POLL_MS = 3000;
/** GitHub device codes expire after fifteen minutes. */
const CODE_LIFETIME_MS = 15 * 60 * 1000;

type Phase =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'waiting'; code: string; url: string; startedAt: number }
  | { kind: 'finishing' }
  | { kind: 'error'; message: string };

export const GitHubSetup: React.FC<Props> = ({ identity, onRetry, onContinueLocally }) => {
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  // Set when the component unmounts or the attempt is cancelled, so a poll in
  // flight cannot act on an attempt nobody is waiting for any more.
  const attempt = useRef(0);
  // The provider recreates onRetry on every render. Held in a ref so the poll
  // below restarts only when the sign-in phase changes, not on each of those.
  const onRetryRef = useRef(onRetry);
  onRetryRef.current = onRetry;

  const missing = identity.github === 'missing';

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const retry = async () => {
    setChecking(true);
    try {
      await onRetry();
    } finally {
      setChecking(false);
    }
  };

  const startSignIn = async () => {
    const mine = ++attempt.current;
    setPhase({ kind: 'starting' });
    try {
      const { code, verificationUrl } = await apiService.startGitHubLogin();
      if (attempt.current !== mine) return;
      setPhase({ kind: 'waiting', code, url: verificationUrl, startedAt: Date.now() });
      // The desktop shell hands web links to the system browser.
      window.open(verificationUrl, '_blank');
    } catch (err) {
      if (attempt.current !== mine) return;
      setPhase({
        kind: 'error',
        message: err instanceof Error ? err.message : 'GitHub sign-in could not start.'
      });
    }
  };

  const cancel = () => {
    attempt.current++;
    setPhase({ kind: 'idle' });
  };

  // Poll while a code is showing, until the browser approves or the code expires.
  useEffect(() => {
    if (phase.kind !== 'waiting') return;
    const mine = attempt.current;

    const timer = window.setInterval(async () => {
      if (Date.now() - phase.startedAt > CODE_LIFETIME_MS) {
        window.clearInterval(timer);
        if (attempt.current === mine) {
          setPhase({ kind: 'error', message: 'That code expired before it was approved. Start again for a new one.' });
        }
        return;
      }
      try {
        const auth = await apiService.checkGitHubAuth();
        if (!auth.authenticated || attempt.current !== mine) return;
        window.clearInterval(timer);
        setPhase({ kind: 'finishing' });
        await onRetryRef.current();
      } catch {
        // A missed poll is not a failure; the next one asks again.
      }
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => () => { attempt.current++; }, []);

  const Command = ({ text }: { text: string }) => (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-well px-3 py-2">
      <Terminal className="h-3.5 w-3.5 shrink-0 text-gray-500" />
      <code className="flex-1 font-mono text-[12px] text-brand-200">{text}</code>
      <button
        type="button"
        onClick={() => copy(text)}
        title="Copy"
        className="shrink-0 rounded p-1 text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
      >
        {copied === text ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );

  const signInPanel = () => {
    switch (phase.kind) {
      case 'starting':
        return (
          <div role="status" className="flex items-center gap-2 text-[13px] text-gray-300">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Starting GitHub sign-in…
          </div>
        );

      case 'waiting':
        return (
          <div className="space-y-3">
            <p className="text-[12px] leading-relaxed text-gray-400">
              Your browser has opened GitHub. Enter this code there and approve:
            </p>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-well px-4 py-3">
              <code className="font-mono text-2xl font-semibold tracking-[0.2em] text-white">{phase.code}</code>
              <button
                type="button"
                onClick={() => copy(phase.code)}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
              >
                {copied === phase.code ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === phase.code ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-gray-400">
              <span className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Waiting for you to approve in the browser…
              </span>
              <a href={phase.url} target="_blank" rel="noreferrer" className="text-brand-200 hover:underline">
                Open the page again
              </a>
              <button type="button" onClick={cancel} className="text-gray-500 hover:text-gray-300">
                Cancel
              </button>
            </div>
          </div>
        );

      case 'finishing':
        return (
          <div role="status" className="flex items-center gap-2 text-[13px] text-emerald-300">
            <Check className="h-4 w-4" aria-hidden="true" />
            Signed in. Loading your workspace…
          </div>
        );

      case 'error':
        return (
          <div className="space-y-3">
            <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
              <p className="text-[12px] leading-relaxed text-amber-100/80">{phase.message}</p>
            </div>
            <SignInButton onClick={startSignIn} label="Try again" />
          </div>
        );

      default:
        return <SignInButton onClick={startSignIn} label="Sign in with GitHub" />;
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-canvas p-8 text-sm text-gray-300">
      <div className="w-full max-w-lg space-y-5 rounded-2xl border border-white/10 bg-surface p-7">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white">
            <Github className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-semibold text-white">
              {missing ? 'Connect Alpha to GitHub' : 'Sign in to GitHub'}
            </h1>
            <p className="text-[13px] leading-relaxed text-gray-400">
              Alpha takes your identity, your role and the shared board from GitHub. It stores no
              password and has no account of its own — your sign-in is kept by your operating
              system&apos;s keyring, never by Alpha.
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-white/5 bg-well p-4">
          {missing ? (
            <>
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
                  1 · Install the GitHub CLI
                </p>
                <Command text={INSTALL_COMMAND} />
                <p className="text-[11px] text-gray-600">
                  Or download it from{' '}
                  <a
                    href="https://cli.github.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-200 hover:underline"
                  >
                    cli.github.com
                  </a>
                  , then choose &ldquo;I&apos;ve done this&rdquo; below.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">2 · Sign in</p>
                <p className="text-[11px] text-gray-600">Appears here once the CLI is installed.</p>
              </div>
            </>
          ) : (
            <>
              {signInPanel()}
              {phase.kind === 'idle' && (
                <p className="text-[11px] leading-relaxed text-gray-600">
                  Prefer a terminal? <code className="font-mono text-gray-400">{LOGIN_COMMAND}</code>, then
                  choose &ldquo;I&apos;ve done this&rdquo;.
                </p>
              )}
            </>
          )}
        </div>

        {/*
          Alpha still works without this — the board is local until it can
          reach GitHub. Saying so stops the screen reading as a hard blocker.
        */}
        <p className="text-[12px] leading-relaxed text-gray-500">
          GitHub is optional for solo work. Continue in local mode now; you can connect later from
          Settings. The board will stay on this machine: no shared issues, no role from your team,
          and nothing your teammates do will appear.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onContinueLocally}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3.5 py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            <Laptop className="h-3.5 w-3.5" />
            Continue in local mode
          </button>
          <button
            type="button"
            onClick={retry}
            disabled={checking}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3.5 py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin motion-reduce:animate-none' : ''}`} />
            {checking ? 'Checking…' : "I've done this"}
          </button>
          <a
            href="https://cli.github.com/manual/gh_auth_login"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3.5 py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Help
          </a>
        </div>
      </div>
    </div>
  );
};

/** The primary action, shared by the first attempt and a retry. */
const SignInButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-white px-4 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-well"
  >
    <Github className="h-4 w-4" aria-hidden="true" />
    {label}
  </button>
);
