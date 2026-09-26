import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Github,
  LockKeyhole,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
  X
} from 'lucide-react';
import alphaMarkUrl from '@/assets/alpha-mark.png';
import { apiService } from '@/shared/services/apiService';
import { GitHubProfile, Identity, IdentityStatus } from '@/shared/types';

interface Props {
  identity?: Identity;
  identityStatus: IdentityStatus;
  onRetry: () => Promise<void> | void;
  onClose?: () => void;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'starting'; profileId?: string }
  | {
      kind: 'waiting';
      profileId?: string;
      targetLogin?: string;
      flow: 'device' | 'oauth';
      code?: string;
      url: string;
      startedAt: number;
    }
  | { kind: 'finishing'; profileId?: string };

const POLL_MS = 2500;
const CODE_LIFETIME_MS = 15 * 60 * 1000;

function initials(profile: Pick<GitHubProfile, 'login' | 'name'>): string {
  const source = profile.name?.trim() || profile.login;
  return source.slice(0, 2).toUpperCase();
}

/**
 * Chrome-style account choice for the packaged desktop app.
 *
 * Profiles are remembered as non-secret account metadata. Choosing one always
 * starts a fresh GitHub authorization, so a remembered card never acts as an
 * unattended sign-in or silently reuses another person's session. Hosted
 * desktop builds include the selected login in the OAuth handoff; standalone
 * builds retain the device-flow fallback.
 */
export const ProfilePicker: React.FC<Props> = ({ identity, identityStatus, onRetry, onClose }) => {
  const [profiles, setProfiles] = useState<GitHubProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const attempt = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loginStarted = useRef(false);

  const refreshProfiles = useCallback(async () => {
    setProfilesLoading(true);
    try {
      const result = await apiService.listGitHubProfiles();
      const nextProfiles = Array.isArray(result.profiles) ? result.profiles : [];
      setProfiles(nextProfiles);
      setSelectedProfileId(current => (
        current && nextProfiles.some(profile => profile.id === current)
          ? current
          : (nextProfiles.find(profile => profile.active) ?? nextProfiles[0])?.id ?? null
      ));
    } catch {
      // Older daemons do not have the profile endpoint yet. The add-account
      // flow still works, and the empty state explains what to do.
      setProfiles([]);
    } finally {
      setProfilesLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProfiles();
    return () => {
      attempt.current++;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshProfiles]);

  const cancel = () => {
    attempt.current++;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    setPhase({ kind: 'idle' });
  };

  const copyCode = async () => {
    if (phase.kind !== 'waiting' || !phase.code) return;
    await navigator.clipboard.writeText(phase.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const startLogin = async (profile?: GitHubProfile) => {
    cancel();
    const mine = ++attempt.current;
    loginStarted.current = true;
    setError(null);
    setPhase({ kind: 'starting', profileId: profile?.id });

    try {
      const started = await apiService.startGitHubLogin(profile?.login);
      if (attempt.current !== mine) return;
      const startedAtTime = Date.now();
      setPhase({
        kind: 'waiting',
        profileId: profile?.id,
        targetLogin: started.targetLogin ?? profile?.login,
        flow: started.flow ?? 'device',
        ...(started.code ? { code: started.code } : {}),
        url: started.verificationUrl,
        startedAt: startedAtTime
      });
      window.open(started.verificationUrl, '_blank', 'noopener,noreferrer');

      pollRef.current = setInterval(async () => {
        if (attempt.current !== mine) return;
        if (Date.now() - startedAtTime > CODE_LIFETIME_MS) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setPhase({ kind: 'idle' });
          setError('That GitHub code expired. Start the sign-in again to get a new one.');
          return;
        }
        try {
          const auth = await apiService.checkGitHubAuth();
          if (attempt.current !== mine) return;
          if (!auth.authenticated) {
            if (auth.error) {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
              setPhase({ kind: 'idle' });
              setError(auth.error);
            }
            return;
          }
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;

          // The selected card is a visual promise. Do not silently sign the
          // person into a different account because GitHub was open elsewhere.
          const authenticatedLogin = auth.username?.toLowerCase();
          const accountMismatch = profile && (
            (Boolean(auth.profileId) && auth.profileId !== profile.id) ||
            (Boolean(authenticatedLogin) && authenticatedLogin !== profile.login.toLowerCase())
          );
          if (accountMismatch) {
            await apiService.githubLogout();
            await onRetry();
            await refreshProfiles();
            setPhase({ kind: 'idle' });
            setError(`GitHub signed in as @${auth.username ?? 'another account'}. Choose Add account or try again with @${profile.login}.`);
            return;
          }

          setPhase({ kind: 'finishing', profileId: profile?.id });
          await onRetry();
          await refreshProfiles();
          // A sign-in must not carry the previous account's cached workspace,
          // chat, or permission state into the new session -- from the startup
          // gate as much as from the in-app switcher. AppProvider reconciled
          // the saved workspace once, on mount, while signed out; skipping the
          // reload here left the old account's workspace id on every request,
          // and the daemon refused them all with "You do not have access to
          // the requested workspace."
          window.location.reload();
        } catch (err) {
          if (attempt.current === mine) {
            setPhase({ kind: 'idle' });
            setError(err instanceof Error ? err.message : 'GitHub sign-in could not be completed.');
          }
        }
      }, POLL_MS);
    } catch (err) {
      if (attempt.current !== mine) return;
      setPhase({ kind: 'idle' });
      setError(err instanceof Error ? err.message : 'GitHub sign-in could not start.');
    }
  };

  const closePicker = () => {
    if (!onClose || busy || waiting) return;
    // Starting a switch invalidates the desktop session before GitHub grants
    // the replacement token. Reload into the gate instead of returning to a
    // shell whose cached identity no longer matches the backend.
    if (loginStarted.current) {
      window.location.reload();
      return;
    }
    onClose();
  };

  const remove = async (profile: GitHubProfile) => {
    setRemoving(profile.id);
    setError(null);
    try {
      await apiService.removeGitHubProfile(profile.id);
      await refreshProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove this profile.');
    } finally {
      setRemoving(null);
    }
  };

  const waiting = phase.kind === 'waiting';
  const busy = phase.kind === 'starting' || phase.kind === 'finishing';
  const isGate = !onClose;
  const selectedProfile = profiles.find(profile => profile.id === selectedProfileId) ?? null;
  const phaseProfile = phase.kind !== 'idle' && phase.profileId
    ? profiles.find(profile => profile.id === phase.profileId) ?? null
    : null;
  const authorizationLogin = phase.kind === 'waiting'
    ? phase.targetLogin ?? phaseProfile?.login
    : phase.kind !== 'idle'
      ? phaseProfile?.login
      : selectedProfile?.login;
  const addingAccount = phase.kind !== 'idle' && !phase.profileId;
  const currentAccount = identity?.login;
  const statusCopy = identityStatus === 'unreachable'
    ? 'The local engine is still waking up. You can choose an account and try again.'
    : 'Your account, organization role, and workspaces come from GitHub.';

  return (
    <>
      <div
        className={`profile-picker-backdrop pointer-events-none fixed inset-0 overflow-hidden ${isGate ? 'z-0' : 'z-[100]'}`}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-canvas" />
        <div className="absolute left-1/2 top-[-18rem] h-[34rem] w-[48rem] -translate-x-1/2 rounded-full bg-brand-500/[0.07] blur-3xl" />
        <div className="absolute bottom-[-22rem] right-[-10rem] h-[34rem] w-[34rem] rounded-full bg-sky-400/[0.035] blur-3xl" />
      </div>

      <div className={`profile-picker-canvas text-gray-100 ${isGate ? 'z-10' : 'profile-picker-canvas--overlay'}`}>
        <main className="profile-picker-content relative z-10 min-h-[100dvh] w-full max-w-3xl">
          <header className="mb-7 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] shadow-[0_12px_34px_-20px_rgba(139,92,246,0.7)]">
                <img src={alphaMarkUrl} alt="Alpha" className="h-8 w-7 object-contain" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Alpha desktop</p>
                <p className="text-sm font-medium text-gray-200">A workspace for coordinated delivery</p>
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={closePicker}
                disabled={busy || waiting}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-gray-400 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white disabled:cursor-wait disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Back to Alpha
              </button>
            )}
          </header>

          <section className="rounded-[1.35rem] border border-white/[0.10] bg-surface/90 p-5 shadow-[0_32px_90px_-48px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-8">
            <div className="max-w-xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-400/20 bg-brand-400/[0.08] px-2.5 py-1 text-[11px] font-medium text-brand-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Secure GitHub sign-in
              </div>
              <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-[2rem]">
                {onClose ? 'Switch Alpha profile' : 'Choose your Alpha profile'}
              </h1>
              <p className="mt-2 max-w-[58ch] text-sm leading-6 text-gray-400">
                {statusCopy} {currentAccount && onClose ? `You are currently using @${currentAccount}. ` : ''}Select a remembered account or add another one. Alpha asks GitHub to confirm the account every time you continue.
              </p>
            </div>

            <div className="mt-8">
              <div className="mb-3 flex items-center justify-between gap-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Profiles on this device</p>
                <button
                  type="button"
                  onClick={() => void refreshProfiles()}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-gray-500 transition hover:bg-white/[0.05] hover:text-gray-200"
                  title="Refresh remembered profiles"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${profilesLoading ? 'animate-spin motion-reduce:animate-none' : ''}`} />
                  Refresh
                </button>
              </div>

              {profilesLoading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[0, 1].map(index => (
                    <div key={index} className="h-[6.25rem] animate-pulse rounded-xl border border-white/[0.08] bg-white/[0.035] motion-reduce:animate-none" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {profiles.map(profile => {
                    const selected = selectedProfileId === profile.id;
                    return (
                      <div
                        key={profile.id}
                        className={`group relative min-w-0 rounded-xl border transition duration-200 motion-reduce:transform-none ${selected
                          ? 'border-brand-300/45 bg-brand-400/[0.07] ring-1 ring-brand-300/15'
                          : 'border-white/[0.09] bg-white/[0.035] hover:-translate-y-0.5 hover:border-brand-300/40 hover:bg-white/[0.06]'}`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedProfileId(profile.id)}
                          disabled={busy || waiting || removing === profile.id}
                          aria-pressed={selected}
                          aria-label={`Select GitHub account @${profile.login}`}
                          className="flex min-h-[6.25rem] w-full min-w-0 items-center gap-3 p-3.5 pr-3 text-left disabled:cursor-wait disabled:opacity-60"
                        >
                          {profile.avatarUrl ? (
                            <img src={profile.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl border border-white/10 object-cover" />
                          ) : (
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-brand-500/15 text-sm font-semibold text-brand-200">
                              {initials(profile)}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-white">{profile.name || profile.login}</span>
                            <span className="mt-0.5 block truncate font-mono text-xs text-gray-500">@{profile.login}</span>
                            <span className="mt-1 block text-[11px] text-gray-500">{selected ? 'Ready to authorize on GitHub' : profile.active ? 'Current account' : 'Select this account'}</span>
                          </span>
                          {selected ? (
                            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-500/15 px-2.5 py-1 text-[11px] font-medium text-brand-200">
                              Selected <Check className="h-3 w-3" />
                            </span>
                          ) : profile.active ? (
                            <span className="shrink-0 rounded-full bg-white/[0.05] px-2 py-1 text-[10px] text-gray-500">Current</span>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(profile)}
                          disabled={busy || waiting || removing === profile.id}
                          className="absolute right-1.5 top-1.5 rounded-md p-1.5 text-gray-600 opacity-0 transition hover:bg-red-400/10 hover:text-red-300 focus-visible:opacity-100 group-hover:opacity-100 disabled:cursor-wait disabled:opacity-40"
                          aria-label={`Remove @${profile.login} from this device`}
                          title="Remove profile from this device"
                        >
                          {removing === profile.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => void startLogin()}
                    disabled={busy || waiting}
                    className="flex min-h-[6.25rem] items-center gap-3 rounded-xl border border-dashed border-white/[0.16] bg-transparent p-3.5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-brand-300/50 hover:bg-brand-400/[0.05] motion-reduce:transform-none disabled:cursor-wait disabled:opacity-60"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-gray-400">
                      <Plus className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-gray-200">Add another account</span>
                      <span className="mt-1 block text-xs leading-5 text-gray-500">Use a different GitHub identity</span>
                    </span>
                  </button>
                </div>
              )}
            </div>

            {profiles.length === 0 && !profilesLoading && (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-white/[0.08] bg-well/70 p-3.5 text-xs leading-5 text-gray-500">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" />
                <p>No profiles are remembered yet. Choose “Add another account” to open GitHub authentication.</p>
              </div>
            )}

            <div className="mt-5 grid grid-cols-[auto_1px_auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-white/[0.10] bg-well/50 p-3.5 sm:gap-4 sm:p-4">
              <Github className="h-8 w-8 text-white" aria-hidden="true" />
              <span className="h-10 w-px bg-white/[0.08]" aria-hidden="true" />
              <LockKeyhole className="h-6 w-6 text-brand-400" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {authorizationLogin
                    ? `Authorize @${authorizationLogin} on GitHub`
                    : addingAccount
                      ? phase.kind === 'waiting' && phase.flow === 'device' ? 'Finish signing in on GitHub' : 'Sign in with another GitHub account'
                      : 'Choose a profile to continue'}
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-400">
                  {authorizationLogin
                    ? `GitHub will confirm @${authorizationLogin} before Alpha switches accounts.`
                    : addingAccount
                      ? 'Alpha will refresh the signed-in account after GitHub confirms it.'
                      : 'Select a remembered profile or add another GitHub account.'}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              <button
                type="button"
                onClick={() => selectedProfile && void startLogin(selectedProfile)}
                disabled={!selectedProfile || busy || waiting || profilesLoading}
                className="flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-brand-400/50 bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_34px_-20px_rgba(139,92,246,0.9)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300/80 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span>{selectedProfile ? `Continue with @${selectedProfile.login}` : 'Choose a profile to continue'}</span>
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => void startLogin()}
                disabled={busy || waiting}
                className="flex min-h-11 w-full items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.025] px-4 py-2.5 text-sm font-medium text-gray-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300/70 disabled:cursor-wait disabled:opacity-50"
              >
                Use another account
              </button>
            </div>

            <div className="mt-3 min-h-[3.5rem]" aria-live="polite">
              {waiting && phase.kind === 'waiting' && (
                <div className="mt-5 rounded-xl border border-brand-300/25 bg-brand-400/[0.07] p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {phase.flow === 'oauth'
                          ? `Authorize ${phase.targetLogin ? `@${phase.targetLogin}` : 'your GitHub account'} on GitHub`
                          : 'Finish signing in on GitHub'}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-gray-400">
                        {phase.flow === 'oauth'
                          ? phase.targetLogin
                            ? `GitHub opened an account chooser for @${phase.targetLogin}. Select that account, then approve Alpha.`
                            : 'GitHub opened an account chooser. Select the account you want to use, then approve Alpha.'
                          : 'A browser window opened. Enter this one-time code to confirm the account.'}
                      </p>
                    </div>
                    <button type="button" onClick={cancel} className="rounded-md p-1.5 text-gray-500 transition hover:bg-white/[0.06] hover:text-gray-200" aria-label="Cancel GitHub sign-in">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {phase.flow === 'device' && phase.code && (
                      <>
                        <code className="rounded-lg border border-white/10 bg-black/25 px-4 py-2.5 font-mono text-xl font-semibold tracking-[0.18em] text-white">{phase.code}</code>
                        <button type="button" onClick={() => void copyCode()} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-white/[0.06] hover:text-white">
                          {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                          {copied ? 'Copied' : 'Copy code'}
                        </button>
                      </>
                    )}
                    <a href={phase.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-brand-200 transition hover:text-brand-100">
                      Open GitHub <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-gray-500" role="status" aria-live="polite">
                    <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                    {phase.flow === 'oauth'
                      ? `Waiting for ${phase.targetLogin ? `@${phase.targetLogin}` : 'GitHub'} authorization…`
                      : 'Waiting for GitHub approval…'}
                  </div>
                </div>
              )}

              {phase.kind === 'starting' && (
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-well/70 px-4 py-3 text-xs text-gray-400" role="status">
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> Opening secure GitHub sign-in…
                </div>
              )}

              {phase.kind === 'finishing' && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/[0.07] px-4 py-3 text-xs text-emerald-200" role="status">
                  <Check className="h-4 w-4" /> GitHub confirmed your account. Loading your workspace…
                </div>
              )}

              {error && (
                <div className="max-h-[4.25rem] overflow-y-auto rounded-lg border border-red-300/20 bg-red-400/[0.07] px-3 py-2 text-xs leading-5 text-red-200" role="alert">
                  <div className="flex items-start gap-2.5">
                    <Github className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-7 flex items-center justify-between gap-4 border-t border-white/[0.07] pt-4 text-[11px] leading-5 text-gray-600">
              <span>Alpha never asks for your GitHub password. Authentication happens on GitHub.</span>
              <span className="hidden shrink-0 items-center gap-1.5 sm:inline-flex"><Github className="h-3.5 w-3.5" /> {waiting && phase.kind === 'waiting' && phase.flow === 'oauth' ? 'GitHub OAuth' : 'GitHub device flow'}</span>
            </div>
          </section>
        </main>
      </div>
    </>
  );
};
