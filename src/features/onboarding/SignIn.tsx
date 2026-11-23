import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CodeXml,
  DraftingCompass,
  FlaskConical,
  Github,
  Pause,
  Play,
  Rocket,
  ScanEye,
  ServerCog,
  ShieldCheck,
  type LucideIcon
} from 'lucide-react';

import { BRAND_FULL_LOGO, BRAND_NAME } from '@/brand/brand';
import { BrandBackdrop } from '@/brand/BrandBackdrop';
import { Identity } from '@/shared/types';
import '@/features/ticketing/clientDesignTokens.css';
import '@/features/ticketing/publicClient/clientPublic.css';
import './teamSignIn.css';

/**
 * The hosted sign-in. Alpha has no passwords of its own: a person is their
 * GitHub account, and their role comes from the team they belong to.
 */
export type SignInError = 'no_team' | 'oauth_failed';

interface Props {
  identity: Identity;
  /** Set when a previous attempt bounced back with a reason. */
  error?: SignInError;
}

const ERROR_COPY: Record<SignInError, { title: string; detail: string }> = {
  no_team: {
    title: 'No Alpha role yet',
    detail: 'Ask an organisation owner to add you to a team, then sign in again.'
  },
  oauth_failed: {
    title: 'Sign-in didn’t finish',
    detail: 'Try again.'
  }
};

/** Roles seeded in every new workspace. */
const ROSTER: { name: string; does: string; Icon: LucideIcon }[] = [
  { name: 'Architect', does: 'Designs interfaces and module boundaries.', Icon: DraftingCompass },
  { name: 'Developer', does: 'Implements features across the stack.', Icon: CodeXml },
  { name: 'Reviewer', does: 'Audits diffs for correctness and security.', Icon: ScanEye },
  { name: 'Tester', does: 'Writes tests and reports coverage gaps.', Icon: FlaskConical },
  { name: 'Operator', does: 'Diagnoses failing CI and patches broken builds.', Icon: Rocket }
];

/** Five roles advance every 1.2s, keeping the handoff loop on a six-second cycle. */
const HANDOFF_STEP_MS = 1200;

const RAIL_FADE = 'linear-gradient(to bottom, transparent, #000 10%, #000 90%, transparent)';

/** Compact role explorer with keyboard-accessible tabs and a handoff animation. */
const Showcase: React.FC = () => {
  const [activeRole, setActiveRole] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const [isPlaying, setIsPlaying] = useState(() =>
    !(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  );
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => {
      setPrefersReducedMotion(preference.matches);
      if (preference.matches) setIsPlaying(false);
    };
    preference.addEventListener('change', updatePreference);
    return () => preference.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (!isPlaying || prefersReducedMotion) return;
    const timer = window.setTimeout(
      () => setActiveRole((current) => (current + 1) % ROSTER.length),
      HANDOFF_STEP_MS
    );
    return () => window.clearTimeout(timer);
  }, [activeRole, isPlaying, prefersReducedMotion]);

  const selectRole = (index: number, moveFocus = false) => {
    const nextIndex = (index + ROSTER.length) % ROSTER.length;
    setActiveRole(nextIndex);
    setIsPlaying(false);
    if (moveFocus) tabRefs.current[nextIndex]?.focus();
  };

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | undefined;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        nextIndex = index + 1;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        nextIndex = index - 1;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = ROSTER.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    selectRole(nextIndex, true);
  };

  const selected = ROSTER[activeRole];

  return (
    <section aria-label="About Alpha" className="team-sign-in-showcase">
      <p className="team-sign-in-accent font-mono text-[10px] uppercase tracking-[0.17em] motion-safe:animate-signin-rise">
        AI agent orchestration
      </p>
      <h2
        className="team-sign-in-hero motion-safe:animate-signin-rise"
        style={{ animationDelay: '60ms' }}
      >
        AI work, <span className="team-sign-in-accent">orchestrated.</span>
      </h2>

      <div className="mt-8 max-w-md motion-safe:animate-signin-rise" style={{ animationDelay: '180ms' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p id="sign-in-roster" className="font-mono text-[10px] uppercase tracking-[0.17em] team-sign-in-muted">
            Default agents
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] team-sign-in-muted">
              <span
                aria-hidden="true"
                className={`team-sign-in-status-dot ${isPlaying ? 'is-playing motion-safe:animate-pulse' : ''}`}
              />
              {prefersReducedMotion ? 'Motion off' : isPlaying ? 'Handoff running' : 'Handoff paused'}
            </span>
            {!prefersReducedMotion && (
              <button
                type="button"
                aria-label={isPlaying ? 'Pause handoff sequence' : 'Resume handoff sequence'}
                aria-pressed={!isPlaying}
                onClick={() => setIsPlaying((playing) => !playing)}
                className="team-sign-in-muted inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium"
              >
                {isPlaying ? <Pause aria-hidden="true" className="h-3 w-3" /> : <Play aria-hidden="true" className="h-3 w-3" />}
                {isPlaying ? 'Pause' : 'Resume'}
              </button>
            )}
          </div>
        </div>

        <div className="relative mt-3 grid max-w-[27rem] grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 sm:gap-5">
          {/* A visible guide line carries one bright glint through the five timed node pulses. */}
          <div
            aria-hidden="true"
            className="team-sign-in-rail absolute inset-y-0 left-5 z-0 w-px -translate-x-1/2"
            style={{ maskImage: RAIL_FADE, WebkitMaskImage: RAIL_FADE }}
          />
          <span
            aria-hidden="true"
            className="team-sign-in-glint pointer-events-none absolute left-5 top-3 z-0 h-3 w-[3px] rounded-full transition-transform duration-700 ease-in-out motion-reduce:transition-none"
            style={{ transform: `translate3d(-50%, ${activeRole * 40}px, 0)` }}
          />

          <div role="tablist" aria-labelledby="sign-in-roster" aria-orientation="vertical" className="relative z-10 grid gap-1">
            {ROSTER.map(({ name, Icon }, i) => {
              const isActive = activeRole === i;
              return (
                <button
                  key={name}
                  ref={(node) => { tabRefs.current[i] = node; }}
                  id={`sign-in-role-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="sign-in-role-panel"
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => selectRole(i)}
                  onFocus={() => setIsPlaying(false)}
                  onKeyDown={(event) => onTabKeyDown(event, i)}
                  className="team-sign-in-role grid min-h-9 w-full grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 rounded-md border px-1 text-left transition-colors motion-reduce:transition-none"
                >
                  <span
                    aria-hidden="true"
                    className="team-sign-in-role-icon relative flex h-7 w-7 items-center justify-center rounded-full border"
                  >
                    <span
                      className={`team-sign-in-role-flash absolute -inset-2.5 rounded-full opacity-0 ${isActive ? 'motion-safe:animate-signin-flash' : ''}`}
                    />
                    <Icon className="relative h-3.5 w-3.5" />
                  </span>
                  <span className="text-[12px] font-medium">{name}</span>
                </button>
              );
            })}
          </div>

          <div
            id="sign-in-role-panel"
            role="tabpanel"
            aria-labelledby={`sign-in-role-${activeRole}`}
            tabIndex={0}
            className="team-sign-in-role-panel min-h-[9.5rem] border-l py-2 pl-4"
          >
            <div key={activeRole} className="motion-safe:animate-signin-role-change">
              <h3 className="text-sm font-semibold">{selected.name}</h3>
              <p className="team-sign-in-muted mt-2 max-w-[20ch] text-[12px] leading-relaxed">{selected.does}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export const SignIn: React.FC<Props> = ({ identity, error }) => {
  const problem = error ? ERROR_COPY[error] : undefined;

  return (
    <div className="alpha-public team-sign-in">
      <BrandBackdrop />

      <div className="relative z-[1] h-dvh overflow-y-auto">
        <main className="public-container team-sign-in-layout">
          <section aria-labelledby="sign-in-heading" className="team-sign-in-form">
            <img src={BRAND_FULL_LOGO.url} alt={BRAND_NAME} width={168} height={56} className="team-sign-in-logo" />
            <p className="team-sign-in-tagline team-sign-in-muted">AI work, orchestrated.</p>
            <h1 id="sign-in-heading">Sign in to team workspace</h1>

            {problem && (
              <div role="alert" className="team-sign-in-notice is-warning mt-4 flex items-start gap-3 rounded-xl border p-3.5">
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 team-sign-in-warning" />
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold">{problem.title}</p>
                  <p className="team-sign-in-muted text-[12px] leading-relaxed">{problem.detail}</p>
                </div>
              </div>
            )}

            <div className="mt-5">
              {identity.signInUrl ? (
                <a
                  href={identity.signInUrl}
                  aria-describedby="sign-in-trust"
                  className="team-sign-in-action group inline-flex min-h-12 items-center justify-center gap-3 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors motion-reduce:transition-none"
                >
                  <Github aria-hidden="true" className="h-[17px] w-[17px]" />
                  Continue with GitHub
                  <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </a>
              ) : (
                <div className="team-sign-in-notice flex items-start gap-3 rounded-xl border p-3.5">
                  <span aria-hidden="true" className="team-sign-in-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                    <ServerCog className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 space-y-1.5 break-words">
                    <p className="font-medium">GitHub sign-in is not configured on this server</p>
                    <p className="team-sign-in-muted text-[12px] leading-relaxed">
                      Set{' '}
                      <code className="rounded px-1.5 py-0.5 font-mono text-[11px]">GITHUB_CLIENT_ID</code>
                      {' '}and{' '}
                      <code className="rounded px-1.5 py-0.5 font-mono text-[11px]">GITHUB_CLIENT_SECRET</code>
                      {' '}in the server environment, then restart the server.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <p id="sign-in-trust" className="team-sign-in-muted mt-4 flex items-start gap-2 text-[12px] leading-relaxed">
              <ShieldCheck aria-hidden="true" className="team-sign-in-shield mt-0.5 h-4 w-4 shrink-0" />
              <span>Your GitHub team sets your role.</span>
            </p>
          </section>

          <Showcase />
        </main>
      </div>
    </div>
  );
};
