import React, { useState } from 'react';
import { Github, Terminal, RefreshCw, ExternalLink, Copy, Check, Laptop } from 'lucide-react';

import { Identity } from '@/shared/types';

/**
 * The first thing a new teammate sees, when GitHub is not reachable yet.
 *
 * Alpha ships as one executable, but `gh` is not inside it — and every GitHub
 * call the daemon makes shells out to `gh`: identity, teams, the board, the
 * write path. So someone who downloads the installer and nothing else gets a
 * working app with no name, no role, and an empty board that never fills.
 *
 * Without this they would have to guess. `missing` and `signed_out` need
 * different actions — install a tool, or run a command — so the daemon reports
 * which and this shows only the relevant one.
 */

interface Props {
  identity: Identity;
  onRetry: () => Promise<void> | void;
  onContinueLocally: () => void;
}

const INSTALL_COMMAND = 'winget install --id GitHub.cli';
const LOGIN_COMMAND = 'gh auth login';

export const GitHubSetup: React.FC<Props> = ({ identity, onRetry, onContinueLocally }) => {
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

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
              password and has no account of its own — it uses the GitHub CLI you already use to
              push code.
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-white/5 bg-well p-4">
          {missing && (
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
                  className="text-brand-300 hover:underline"
                >
                  cli.github.com
                </a>
                .
              </p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
              {missing ? '2 · Sign in' : 'Sign in'}
            </p>
            <Command text={LOGIN_COMMAND} />
            <p className="text-[11px] leading-relaxed text-gray-600">
              Opens your browser. Choose <span className="text-gray-400">HTTPS</span> and authorise
              — the token goes to your operating system&apos;s keyring, never to Alpha.
            </p>
          </div>
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
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-xs font-semibold text-on-accent transition-colors hover:bg-brand-600"
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
            <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
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
