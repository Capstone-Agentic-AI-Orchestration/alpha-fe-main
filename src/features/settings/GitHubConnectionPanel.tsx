import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Github, CheckCircle2, AlertTriangle, Copy, Check, ExternalLink, LogOut, Loader2 } from 'lucide-react';
import { apiService } from '@/shared/services/apiService';

/**
 * Scopes Alpha actually exercises. Each one is tied to a feature so the UI can
 * explain *why* it is being asked for rather than showing a bare list.
 */
const REQUIRED_SCOPES = [
  { id: 'repo', reason: 'Create, clone and push project repositories' },
  { id: 'workflow', reason: 'Read GitHub Actions runs in the Delivery view' },
  { id: 'read:org', reason: 'List organisations you can create repos under' }
] as const;

type AuthState = {
  authenticated: boolean;
  username?: string;
  protocol?: string;
  scopes?: string[];
  tokenSource?: 'keyring' | 'env' | 'oauth' | 'github_app';
  envVarName?: string;
  cliMissing?: boolean;
  mode?: 'cli' | 'rest' | 'github_app';
  appInstalled?: boolean;
};

/**
 * GitHub connection for the current Alpha profile.
 *
 * The desktop profile picker remembers public account metadata so a shared
 * Windows user can choose the right GitHub identity. Every profile selection
 * still opens GitHub authentication; this panel manages the active profile's
 * connection and never exposes its credential to the renderer.
 */
export const GitHubConnectionPanel: React.FC = () => {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [pending, setPending] = useState<{
    code?: string;
    verificationUrl: string;
    flow?: 'device' | 'oauth';
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      return await apiService.checkGitHubAuth().then(next => {
        setAuth(next);
        return next;
      });
    } catch {
      // The daemon being unreachable is not the same as being signed out.
      setAuth(null);
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const started = await apiService.startGitHubLogin();
      setPending(started);
      window.open(started.verificationUrl, '_blank', 'noopener,noreferrer');

      // `gh` is now waiting on GitHub. Poll until the user finishes in the
      // browser, then stop — no ambient polling once we have an answer.
      pollRef.current = setInterval(async () => {
        const next = await refresh();
        if (next?.authenticated) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setPending(null);
          // A different account may have just signed in. Reboot the app so no
          // workspace, board, or permission state from the previous one
          // survives -- the same rule the profile picker follows.
          window.location.reload();
        }
      }, 2500);
    } catch (err: any) {
      setError(err?.message ?? 'Could not start GitHub sign-in');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiService.githubLogout();
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? 'Could not sign out');
    } finally {
      setBusy(false);
    }
  };

  const copyCode = () => {
    if (!pending?.code) return;
    void navigator.clipboard.writeText(pending.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const granted = auth?.scopes ?? [];
  const missing = REQUIRED_SCOPES.filter(s => !granted.includes(s.id));

  // A stale GH_TOKEN / GITHUB_TOKEN beats the keyring, so "Connect" would
  // appear to work and change nothing. Offer the actual remedy instead.
  const envBlocked = !auth?.authenticated && !!auth?.envVarName;
  const envInUse = auth?.authenticated && auth.tokenSource === 'env';

  return (
    <div className="p-6 rounded-2xl bg-surface/50 border border-divider space-y-5">
      <div className="flex items-start gap-3">
        <Github className="w-5 h-5 text-content mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-content">GitHub</h3>
          <p className="text-xs text-content-secondary mt-1 leading-relaxed">
            Required for creating project repositories, cloning, and pull requests.
            Alpha uses the GitHub account you explicitly confirmed in the profile
            picker, so the active role and repository access stay aligned.
          </p>
        </div>

        {auth?.authenticated ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-status-success bg-status-success-subtle border border-status-success-border rounded-full px-3 py-1 flex-shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" /> Connected
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-content-secondary bg-surface-raised border border-divider rounded-full px-3 py-1 flex-shrink-0">
            Not connected
          </span>
        )}
      </div>

      {/* --- GitHub CLI not installed: the first-run state for a teammate --- */}
      {auth?.cliMissing && (
        <div className="rounded-lg bg-status-warning-subtle border border-status-warning-border p-3 space-y-2">
          <p className="text-xs text-status-warning leading-relaxed">
            GitHub CLI isn&apos;t installed on this machine. Alpha uses it to sign you in,
            so nothing is stored here — install it once, then come back to this page.
          </p>
          <code className="block text-[11px] font-mono text-status-warning bg-well rounded px-2 py-1.5 select-all">
            winget install GitHub.cli
          </code>
          <a
            href="https://cli.github.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-status-warning hover:text-status-warning"
          >
            Or download from cli.github.com
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* --- An environment variable is overriding the keyring --- */}
      {envBlocked && (
        <div className="rounded-lg bg-status-danger-subtle border border-status-danger-border p-3 space-y-2">
          <p className="text-xs text-status-danger leading-relaxed">
            <strong>{auth?.envVarName}</strong> is set in this machine&apos;s environment
            and holds a token GitHub rejected. It takes priority over any saved sign-in,
            so connecting again will not help until it is cleared.
          </p>
          <code className="block text-[11px] font-mono text-status-danger bg-well rounded px-2 py-1.5 select-all">
            PowerShell: Remove-Item Env:\{auth?.envVarName}
          </code>
          <p className="text-[11px] text-content-secondary">
            Then restart Alpha so it no longer inherits the variable.
          </p>
        </div>
      )}

      {envInUse && (
        <p className="text-xs text-content-secondary bg-surface-raised border border-divider rounded-lg px-3 py-2 leading-relaxed">
          Signed in from the <strong className="font-mono">{auth?.envVarName}</strong> environment
          variable rather than a saved sign-in. Disconnect will not remove it — clear the
          variable instead.
        </p>
      )}

      {/* --- Connected --- */}
      {auth?.authenticated && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs">
            <div>
              <div className="text-content-muted uppercase tracking-wider text-[10px] font-semibold">Account</div>
              <div className="text-content font-mono mt-0.5">{auth.username ?? 'unknown'}</div>
            </div>
            <div>
              <div className="text-content-muted uppercase tracking-wider text-[10px] font-semibold">Git protocol</div>
              <div className="text-content font-mono mt-0.5">{auth.protocol ?? 'https'}</div>
            </div>
          </div>

          <div>
            <div className="text-content-muted uppercase tracking-wider text-[10px] font-semibold mb-2">
              Permissions
            </div>
            <div className="space-y-1.5">
              {REQUIRED_SCOPES.map(scope => {
                const ok = granted.includes(scope.id);
                return (
                  <div key={scope.id} className="flex items-start gap-2 text-xs">
                    {ok ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-status-success mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-status-warning mt-0.5 flex-shrink-0" />
                    )}
                    <span className={`font-mono ${ok ? 'text-content-secondary' : 'text-status-warning'}`}>{scope.id}</span>
                    <span className="text-content-muted">— {scope.reason}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {missing.length > 0 && (
            <div className="rounded-lg bg-status-warning-subtle border border-status-warning-border p-3 space-y-2">
              <p className="text-xs text-status-warning leading-relaxed">
                <strong>{missing.map(m => m.id).join(', ')}</strong>{' '}
                {missing.length === 1 ? 'is' : 'are'} missing. Features that need{' '}
                {missing.length === 1 ? 'it' : 'them'} will fail until you grant{' '}
                {missing.length === 1 ? 'it' : 'them'}.
              </p>
              <code className="block text-[11px] font-mono text-status-warning bg-well rounded px-2 py-1.5 select-all">
                gh auth refresh -h github.com -s {missing.map(m => m.id).join(',')}
              </code>
            </div>
          )}

          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="flex items-center gap-2 text-xs font-semibold text-content-secondary hover:text-content bg-surface-raised hover:bg-surface-high border border-divider rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out of this profile
          </button>
        </div>
      )}

      {/* --- GitHub authorization in flight --- */}
      {pending && (
        <div className="rounded-lg bg-selected border border-divider p-4 space-y-3">
          <p className="text-xs text-content-secondary">
            {pending.flow === 'oauth'
              ? 'Choose the GitHub account you want to use and approve Alpha. This panel updates itself once you&apos;re done.'
              : 'Enter this one-time code on GitHub. This panel updates itself once you&apos;re done.'}
          </p>
          {pending.flow !== 'oauth' && pending.code && (
            <div className="flex items-center gap-2">
              <code className="text-lg font-mono font-bold tracking-[0.2em] text-content bg-well rounded-lg px-4 py-2 select-all">
                {pending.code}
              </code>
              <button
                type="button"
                onClick={copyCode}
                aria-label="Copy code"
                className="p-2 rounded-lg bg-surface-raised hover:bg-surface-high border border-divider text-content-secondary hover:text-content transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-status-success" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}
          <a
            href={pending.verificationUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-link hover:text-link-hover"
          >
            Open {pending.verificationUrl.replace('https://', '')}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <div className="flex items-center gap-2 text-xs text-content-muted">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Waiting for you to approve…
          </div>
        </div>
      )}

      {/* --- Not connected --- */}
      {!auth?.authenticated && !pending && !envBlocked && !auth?.cliMissing && (
        <button
          type="button"
          onClick={connect}
          disabled={busy}
          className="flex items-center gap-2 text-xs font-semibold text-on-action bg-action hover:bg-action-hover rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
          Connect to GitHub
        </button>
      )}

      {error && (
        <p className="text-xs text-status-danger bg-status-danger-subtle border border-status-danger-border rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {auth === null && !error && (
        <p className="text-xs text-content-muted">
          Can&apos;t reach the local engine — GitHub status is unavailable.
        </p>
      )}
    </div>
  );
};
