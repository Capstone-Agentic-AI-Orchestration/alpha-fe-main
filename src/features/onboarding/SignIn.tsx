import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CodeXml,
  DraftingCompass,
  FlaskConical,
  Github,
  Layers,
  Rocket,
  ScanEye,
  ServerCog,
  ShieldCheck,
  type LucideIcon
} from 'lucide-react';

import { Identity } from '@/shared/types';

/**
 * The hosted sign-in.
 *
 * Only the web build reaches this. The desktop app has no sign-in at all —
 * identity there is the machine's `gh` login, already resolved before the
 * window opens — so `authenticated` is never false and this never renders.
 *
 * Deliberately not a form. Alpha has no passwords of its own and no user
 * table: a person is their GitHub account, and their role is the team that
 * account belongs to in the workspace organisation. There is nothing to type.
 *
 * Nothing on this screen is personalised, because nothing can be: the daemon
 * answers an anonymous caller with `authenticated` and `signInUrl` only, so the
 * workspace org and the person's login are unknown until they come back.
 */

/** Reasons the daemon redirects back with, as `#alpha_error=...`. */
export type SignInError = 'no_team' | 'oauth_failed';

interface Props {
  identity: Identity;
  /** Set when a previous attempt bounced back with a reason. */
  error?: SignInError;
}

const ERROR_COPY: Record<SignInError, { title: string; detail: string }> = {
  /**
   * Distinct from `NoTeamAccess`, which is shown to someone already signed in.
   * Here there is no session to keep — sign-in itself was refused — so the
   * screen has to carry the explanation and the way back.
   */
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

/**
 * The agents a fresh workspace is seeded with, as brand material.
 *
 * Named by role, as the daemon names them (`sqliteService` seeds Architect,
 * Developer, Reviewer, Tester and Operator), not by the invented personas they
 * replaced. Hues follow each agent's seeded colour; `rgb` feeds the flash halo.
 */
const ROSTER: {
  name: string;
  does: string;
  Icon: LucideIcon;
  ring: string;
  tint: string;
  rgb: string;
}[] = [
  {
    name: 'Architect',
    does: 'Designs interfaces and module boundaries.',
    Icon: DraftingCompass,
    ring: 'border-indigo-400/40',
    tint: 'text-indigo-300',
    rgb: '129 140 248'
  },
  {
    name: 'Developer',
    does: 'Implements features across the stack.',
    Icon: CodeXml,
    ring: 'border-emerald-400/40',
    tint: 'text-emerald-300',
    rgb: '52 211 153'
  },
  {
    name: 'Reviewer',
    does: 'Audits diffs for correctness and security.',
    Icon: ScanEye,
    ring: 'border-amber-400/40',
    tint: 'text-amber-300',
    rgb: '251 191 36'
  },
  {
    name: 'Tester',
    does: 'Writes tests and reports coverage gaps.',
    Icon: FlaskConical,
    ring: 'border-pink-400/40',
    tint: 'text-pink-300',
    rgb: '244 114 182'
  },
  {
    name: 'Operator',
    does: 'Diagnoses failing CI and patches broken builds.',
    Icon: Rocket,
    ring: 'border-violet-400/40',
    tint: 'text-violet-300',
    rgb: '167 139 250'
  }
];

/**
 * Seconds per glint cycle; must match `signin-glint` / `signin-flash` in
 * tailwind.config.js.
 *
 * The glint's centre crosses the rail during the first 60% of the cycle, from
 * 10% above it to 10% below. With five equal rows, row `i` is centred at
 * (2i + 1) / 10 of the rail, so the glint reaches it at (i + 1) / 10 of the
 * cycle. The flash peaks 4% into its own keyframes, hence the offset.
 */
const GLINT_CYCLE_S = 6;
const flashDelay = (i: number) => `${(GLINT_CYCLE_S * ((i + 1) / 10 - 0.04)).toFixed(2)}s`;

/** The order someone moves through, so they know where they will land. */
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
  backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.07) 1px, transparent 1.5px)',
  backgroundSize: '24px 24px',
  maskImage: 'radial-gradient(ellipse 75% 65% at 50% 42%, #000 20%, transparent 75%)',
  WebkitMaskImage: 'radial-gradient(ellipse 75% 65% at 50% 42%, #000 20%, transparent 75%)'
};

const RAIL_FADE = 'linear-gradient(to bottom, transparent, #000 10%, #000 90%, transparent)';

/** Decorative page ground: a dot grid and two slow, soft light sources. */
const Backdrop: React.FC = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
    <div className="absolute inset-0" style={DOT_GRID} />
    <div
      className="absolute -left-[25vmax] -top-[30vmax] h-[80vmax] w-[80vmax] rounded-full motion-safe:animate-signin-drift"
      style={{ background: 'radial-gradient(circle, rgb(139 92 246 / 0.16), transparent 62%)' }}
    />
    <div
      className="absolute -bottom-[35vmax] -right-[30vmax] h-[75vmax] w-[75vmax] rounded-full motion-safe:animate-signin-drift"
      style={{
        background: 'radial-gradient(circle, rgb(99 102 241 / 0.10), transparent 60%)',
        animationDirection: 'alternate-reverse'
      }}
    />
  </div>
);

/** Wide screens only: what Alpha is, and the agents it ships with. */
const Showcase: React.FC = () => (
  <section aria-label="About Alpha" className="hidden lg:order-1 lg:block">
    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-violet-300/80 motion-safe:animate-signin-rise">
      AI agent orchestration
    </p>
    <p
      className="mt-5 max-w-[12ch] font-semibold leading-[1.02] tracking-[-0.035em] text-white motion-safe:animate-signin-rise"
      style={{ fontSize: 'clamp(2.75rem, 4.6vw, 4.25rem)', animationDelay: '60ms' }}
    >
      AI work,{' '}
      <span className="bg-gradient-to-r from-violet-300 to-indigo-200 bg-clip-text text-violet-300 [-webkit-text-fill-color:transparent]">
        coordinated.
      </span>
    </p>
    <p
      className="mt-6 max-w-md text-[15px] leading-relaxed text-gray-400 motion-safe:animate-signin-rise"
      style={{ animationDelay: '120ms' }}
    >
      One shared board for the people who plan the work and the AI agents that
      carry it out on developers&apos; own machines.
    </p>

    <div className="mt-12 max-w-md">
      <p
        id="sign-in-roster"
        className="font-mono text-[11px] uppercase tracking-[0.16em] text-gray-500 motion-safe:animate-signin-rise"
        style={{ animationDelay: '200ms' }}
      >
        Default agents
      </p>

      <div className="relative mt-4">
        {/* The rail, with a glint that hands off from one agent to the next. */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-[1.125rem] w-[2px] -translate-x-1/2 overflow-hidden bg-white/[0.07]"
          style={{ maskImage: RAIL_FADE, WebkitMaskImage: RAIL_FADE }}
        >
          <div
            className="absolute inset-0 -translate-y-[60%] motion-safe:animate-signin-glint"
            style={{
              backgroundImage:
                'linear-gradient(to bottom, transparent 40%, rgb(196 181 253) 50%, transparent 60%)'
            }}
          />
        </div>

        <ul aria-labelledby="sign-in-roster" className="grid auto-rows-fr">
          {ROSTER.map(({ name, does, Icon, ring, tint, rgb }, i) => (
            <li
              key={name}
              className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-4 py-2.5 motion-safe:animate-signin-rise"
              style={{ animationDelay: `${260 + i * 70}ms` }}
            >
              <span
                aria-hidden="true"
                className={`relative flex h-9 w-9 items-center justify-center rounded-full border bg-shell ${ring}`}
              >
                <span
                  className="absolute -inset-2.5 rounded-full opacity-0 motion-safe:animate-signin-flash"
                  style={{
                    background: `radial-gradient(circle, rgb(${rgb} / 0.5), rgb(${rgb} / 0) 68%)`,
                    animationDelay: flashDelay(i)
                  }}
                />
                <Icon className={`relative h-4 w-4 ${tint}`} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-100">{name}</p>
                <p className="text-[13px] leading-snug text-gray-500">{does}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </section>
);

const NextSteps: React.FC = () => (
  <div className="mt-7 border-t border-white/[0.06] pt-6">
    <h2 className="font-mono text-[11px] font-normal uppercase tracking-[0.16em] text-gray-500">
      What happens next
    </h2>
    <ol className="mt-4 space-y-4">
      {NEXT_STEPS.map((step, i) => (
        <li key={step.title} className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3">
          {i < NEXT_STEPS.length - 1 && (
            <span
              aria-hidden="true"
              className="absolute bottom-[-0.875rem] left-3 top-7 w-px bg-white/[0.08]"
            />
          )}
          <span
            aria-hidden="true"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] font-mono text-[11px] text-gray-400"
          >
            {i + 1}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-[13px] font-medium leading-snug text-gray-200">{step.title}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-gray-500">{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  </div>
);

export const SignIn: React.FC<Props> = ({ identity, error }) => {
  const problem = error ? ERROR_COPY[error] : undefined;

  return (
    /*
     * Sized to the viewport itself. App renders this directly, with no sized
     * parent, and `body` is `overflow-hidden` for the workspace shell — so the
     * screen claims the viewport and scrolls internally when a short one
     * cannot fit the card.
     */
    <div className="relative h-dvh overflow-hidden bg-canvas text-sm text-gray-300">
      <Backdrop />

      <div className="relative h-full overflow-y-auto">
        <main className="mx-auto grid min-h-full w-full max-w-6xl items-center gap-12 px-4 py-10 sm:px-8 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16 xl:gap-24">
          {/*
            First in the DOM so the heading and the sign-in control come first
            to a screen reader; placed on the right on wide screens. Never
            animated in: the control is usable from the first frame.
          */}
          <section
            aria-labelledby="sign-in-heading"
            className="w-full max-w-[26rem] justify-self-center lg:order-2"
          >
            <div className="relative rounded-3xl border border-white/10 bg-surface/80 p-6 shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-8">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-10 -top-px h-px bg-gradient-to-r from-transparent via-violet-300/60 to-transparent"
              />

              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-500/15 text-violet-300"
                >
                  <Layers className="h-[18px] w-[18px]" />
                </span>
                <span className="text-[15px] font-semibold tracking-tight text-white">Alpha</span>
                {/* The wide layout says this at display size beside the card. */}
                <span className="truncate text-[13px] text-gray-500 lg:hidden">
                  <span aria-hidden="true" className="text-gray-600">
                    ·
                  </span>{' '}
                  AI work, coordinated.
                </span>
              </div>

              <div className="mt-8 space-y-2">
                <h1 id="sign-in-heading" className="text-2xl font-semibold leading-tight text-white">
                  Sign in to Alpha
                </h1>
                <p className="leading-relaxed text-gray-400">
                  The board where your team plans the work and AI agents carry it out.
                </p>
              </div>

              {problem && (
                <div
                  role="alert"
                  className="mt-6 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-4"
                >
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-amber-100">{problem.title}</p>
                    <p className="text-[13px] leading-relaxed text-amber-100/75">{problem.detail}</p>
                  </div>
                </div>
              )}

              <div className="mt-6">
                {identity.signInUrl ? (
                  <a
                    href={identity.signInUrl}
                    aria-describedby="sign-in-trust"
                    className="group flex min-h-[3rem] w-full items-center justify-center gap-2.5 rounded-xl bg-white px-4 py-3 font-semibold text-gray-900 shadow-lg shadow-violet-500/10 transition duration-150 hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.99] active:bg-gray-300 motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    <Github aria-hidden="true" className="h-[18px] w-[18px]" />
                    Continue with GitHub
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 text-gray-500 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-gray-900 motion-reduce:transition-none"
                    />
                  </a>
                ) : (
                  /**
                   * No URL means the server has no OAuth credentials configured. A
                   * button that cannot work is worse than none: it reads as a bug in
                   * the app rather than a gap in the deployment.
                   */
                  <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-well/80 p-4">
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-gray-400"
                    >
                      <ServerCog className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 space-y-1.5 break-words">
                      <p className="font-medium text-gray-100">
                        GitHub sign-in is not configured on this server
                      </p>
                      <p className="text-[13px] leading-relaxed text-gray-400">
                        Set{' '}
                        <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[12px] text-gray-200">
                          GITHUB_CLIENT_ID
                        </code>{' '}
                        and{' '}
                        <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[12px] text-gray-200">
                          GITHUB_CLIENT_SECRET
                        </code>{' '}
                        in the server environment, then restart the server.
                      </p>
                      <p className="text-[13px] leading-relaxed text-gray-500">
                        This is a deployment setting. Nothing on your GitHub account needs to change.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <p id="sign-in-trust" className="mt-4 flex items-start gap-2 text-[13px] leading-relaxed text-gray-400">
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/80" />
                <span>
                  Alpha reads your organisation team membership to decide what you can
                  see. It never stores a password.
                </span>
              </p>

              {/* Only while there is a next: an unconfigured server has none. */}
              {identity.signInUrl && <NextSteps />}
            </div>
          </section>

          <Showcase />
        </main>
      </div>
    </div>
  );
};
