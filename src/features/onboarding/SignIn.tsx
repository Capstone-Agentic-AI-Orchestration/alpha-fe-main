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

import alphaMarkUrl from '@/assets/alpha-mark.png';
import { Identity } from '@/shared/types';

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
    title: 'Your GitHub account has no Alpha role',
    detail:
      'Alpha takes your role from your team in the workspace organisation. ' +
      'Your account signed in, but it belongs to no team that grants one. ' +
      'Ask an organisation owner to add you to a team, then sign in again.'
  },
  oauth_failed: {
    title: 'Sign-in did not complete',
    detail:
      'GitHub did not return a usable response. This is usually an expired ' +
      'attempt, and starting again normally resolves it.'
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

const NEXT_STEPS: { title: string; detail: string }[] = [
  {
    title: 'GitHub confirms it is you',
    detail: 'The first time, it asks you to authorise Alpha.'
  },
  {
    title: 'Your team sets your role',
    detail: 'Project managers, clients and admins work on the board, here.'
  },
  {
    title: 'Developers continue on the desktop',
    detail: 'Agents run on your own machine, so the web app points you to the installer.'
  }
];

const DOT_GRID: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgb(var(--c-white) / 0.055) 1px, transparent 1.5px)',
  backgroundSize: '24px 24px',
  maskImage: 'radial-gradient(ellipse 76% 68% at 48% 44%, #000 18%, transparent 76%)',
  WebkitMaskImage: 'radial-gradient(ellipse 76% 68% at 48% 44%, #000 18%, transparent 76%)'
};

const RAIL_FADE = 'linear-gradient(to bottom, transparent, #000 10%, #000 90%, transparent)';

/** Low-contrast theme-tinted ground, with motion removed for reduced-motion users. */
const Backdrop: React.FC = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
    <div className="absolute inset-0" style={DOT_GRID} />
    <div
      className="absolute -left-[26rem] -top-[28rem] h-[58rem] w-[58rem] rounded-full motion-safe:animate-signin-drift"
      style={{ background: 'radial-gradient(circle, rgb(var(--ui-link) / 0.13), transparent 63%)' }}
    />
    <div
      className="absolute -bottom-[31rem] -right-[26rem] h-[58rem] w-[58rem] rounded-full motion-safe:animate-signin-drift"
      style={{
        background: 'radial-gradient(circle, rgb(var(--ui-focus) / 0.08), transparent 62%)',
        animationDirection: 'alternate-reverse'
      }}
    />
  </div>
);

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
    <section aria-label="About Alpha" className="w-full max-w-[29rem] justify-self-center lg:order-1">
      <p className="font-mono text-[10px] uppercase tracking-[0.17em] text-link motion-safe:animate-signin-rise">
        AI agent orchestration
      </p>
      <h2
        className="mt-4 max-w-[12ch] text-[clamp(2.5rem,4vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-content motion-safe:animate-signin-rise"
        style={{ animationDelay: '60ms' }}
      >
        AI work, <span className="text-link">orchestrated.</span>
      </h2>
      <p
        className="mt-4 max-w-md text-sm leading-relaxed text-content-secondary motion-safe:animate-signin-rise"
        style={{ animationDelay: '120ms' }}
      >
        One shared board for the people who plan the work and the AI agents that
        carry it out on developers&apos; own machines.
      </p>

      <div className="mt-8 max-w-md motion-safe:animate-signin-rise" style={{ animationDelay: '180ms' }}>
        <div className="flex items-center justify-between gap-3">
          <p id="sign-in-roster" className="font-mono text-[10px] uppercase tracking-[0.17em] text-content-muted">
            Default agents
          </p>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-content-muted">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${isPlaying ? 'bg-link motion-safe:animate-pulse' : 'bg-content-muted'}`}
              />
              {prefersReducedMotion ? 'Motion off' : isPlaying ? 'Handoff running' : 'Handoff paused'}
            </span>
            {!prefersReducedMotion && (
              <button
                type="button"
                aria-label={isPlaying ? 'Pause handoff sequence' : 'Resume handoff sequence'}
                aria-pressed={!isPlaying}
                onClick={() => setIsPlaying((playing) => !playing)}
                className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium text-content-muted transition-colors hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
              >
                {isPlaying ? <Pause aria-hidden="true" className="h-3 w-3" /> : <Play aria-hidden="true" className="h-3 w-3" />}
                {isPlaying ? 'Pause' : 'Resume'}
              </button>
            )}
          </div>
        </div>

        <div className="relative mt-3 grid max-w-[27rem] grid-cols-[minmax(0,11rem)_minmax(0,1fr)] items-center gap-4 sm:gap-5">
          {/* A visible guide line carries one bright glint through the five timed node pulses. */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-5 z-0 w-px -translate-x-1/2 overflow-hidden bg-link/25"
            style={{ maskImage: RAIL_FADE, WebkitMaskImage: RAIL_FADE }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-5 top-3 z-0 h-3 w-[3px] rounded-full bg-link shadow-[0_0_10px_rgb(var(--ui-link)/0.8)] transition-transform duration-700 ease-in-out motion-reduce:transition-none"
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
                  className={`group grid min-h-9 w-full grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 rounded-md border px-1 text-left transition-colors duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none ${
                    isActive
                      ? 'border-divider bg-selected/35 text-content'
                      : 'border-transparent text-content-secondary hover:bg-surface/55 hover:text-content'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`relative flex h-7 w-7 items-center justify-center rounded-full border bg-shell transition-colors duration-500 ${
                      isActive ? 'border-link/60 text-link' : 'border-divider text-content-muted group-hover:text-content-secondary'
                    }`}
                  >
                    <span
                      className={`absolute -inset-2.5 rounded-full opacity-0 ${isActive ? 'motion-safe:animate-signin-flash' : ''}`}
                      style={{
                        background: 'radial-gradient(circle, rgb(var(--ui-link) / 0.48), rgb(var(--ui-link) / 0) 68%)'
                      }}
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
            className="min-h-[9.5rem] border-l border-link/40 py-2 pl-4 text-content-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <div key={activeRole} className="motion-safe:animate-signin-role-change">
              <h3 className="text-sm font-semibold text-content">{selected.name}</h3>
              <p className="mt-2 max-w-[15ch] text-[12px] leading-relaxed">{selected.does}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const NextSteps: React.FC = () => (
  <div className="mt-5 border-t border-divider pt-4">
    <h2 className="font-mono text-[10px] font-normal uppercase tracking-[0.17em] text-content-muted">
      What happens next
    </h2>
    <ol className="mt-3 space-y-3">
      {NEXT_STEPS.map((step, i) => (
        <li key={step.title} className="relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2.5">
          {i < NEXT_STEPS.length - 1 && (
            <span aria-hidden="true" className="absolute bottom-[-0.75rem] left-[0.6rem] top-6 w-px bg-divider" />
          )}
          <span
            aria-hidden="true"
            className="flex h-5 w-5 items-center justify-center rounded-md border border-divider bg-well font-mono text-[10px] text-content-muted"
          >
            {i + 1}
          </span>
          <div className="min-w-0 pt-px">
            <p className="text-[12px] font-medium leading-snug text-content">{step.title}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-content-muted">{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  </div>
);

export const SignIn: React.FC<Props> = ({ identity, error }) => {
  const problem = error ? ERROR_COPY[error] : undefined;

  return (
    <div className="relative h-dvh overflow-hidden bg-canvas text-sm text-content">
      <Backdrop />

      <div className="relative h-full overflow-y-auto">
        <main className="mx-auto grid min-h-full w-full max-w-[64rem] items-center gap-8 px-4 py-7 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:gap-12 xl:gap-16">
          {/* DOM order prioritises the sign-in control for screen readers; wide layouts place it on the right. */}
          <section aria-labelledby="sign-in-heading" className="w-full max-w-[25rem] justify-self-center lg:order-2">
            <div className="relative rounded-2xl border border-divider bg-surface/95 p-5 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-6">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-link/50 to-transparent"
              />

              <div className="flex min-w-0 items-center gap-2.5">
                <img src={alphaMarkUrl} alt="" className="h-8 w-8 shrink-0 object-contain invert dark:invert-0" />
                <span className="text-sm font-semibold tracking-tight text-content">Alpha</span>
                <span className="truncate text-[12px] text-content-muted lg:hidden">
                  <span aria-hidden="true" className="text-content-muted">·</span> AI work, orchestrated.
                </span>
              </div>

              <div className="mt-6 space-y-1.5">
                <h1 id="sign-in-heading" className="text-xl font-semibold leading-tight tracking-tight text-content">
                  Sign in to Alpha
                </h1>
                <p className="text-[13px] leading-relaxed text-content-secondary">
                  The board where your team plans the work and AI agents carry it out.
                </p>
              </div>

              {problem && (
                <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-status-warning-border bg-status-warning-subtle p-3.5">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-content">{problem.title}</p>
                    <p className="text-[12px] leading-relaxed text-content-secondary">{problem.detail}</p>
                  </div>
                </div>
              )}

              <div className="mt-5">
                {identity.signInUrl ? (
                  <a
                    href={identity.signInUrl}
                    aria-describedby="sign-in-trust"
                    className="group flex min-h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-content px-4 py-2.5 font-semibold text-canvas shadow-sm transition duration-150 hover:bg-content-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    <Github aria-hidden="true" className="h-[17px] w-[17px]" />
                    Continue with GitHub
                    <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </a>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl border border-divider bg-well/80 p-3.5">
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-divider bg-surface text-content-muted">
                      <ServerCog className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 space-y-1.5 break-words">
                      <p className="font-medium text-content">GitHub sign-in is not configured on this server</p>
                      <p className="text-[12px] leading-relaxed text-content-secondary">
                        Set{' '}
                        <code className="rounded bg-code px-1.5 py-0.5 font-mono text-[11px] text-code-content">GITHUB_CLIENT_ID</code>
                        {' '}and{' '}
                        <code className="rounded bg-code px-1.5 py-0.5 font-mono text-[11px] text-code-content">GITHUB_CLIENT_SECRET</code>
                        {' '}in the server environment, then restart the server.
                      </p>
                      <p className="text-[12px] leading-relaxed text-content-muted">
                        This is a deployment setting. Nothing on your GitHub account needs to change.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <p id="sign-in-trust" className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-content-secondary">
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-status-success" />
                <span>
                  Alpha reads your organisation team membership to decide what you can
                  see. It never stores a password.
                </span>
              </p>

              {identity.signInUrl && <NextSteps />}
            </div>
          </section>

          <Showcase />
        </main>
      </div>
    </div>
  );
};
