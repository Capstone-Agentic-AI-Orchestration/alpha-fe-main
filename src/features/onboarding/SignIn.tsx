import React from 'react';
import { Github, AlertTriangle } from 'lucide-react';

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
      'Your account signed in, but belongs to no team that grants one. ' +
      'Ask an organisation owner to add you to a team, then sign in again.'
  },
  oauth_failed: {
    title: 'Sign-in did not complete',
    detail:
      'GitHub did not return a usable response. This is usually a expired ' +
      'attempt — starting again normally resolves it.'
  }
};

export const SignIn: React.FC<Props> = ({ identity, error }) => {
  const problem = error ? ERROR_COPY[error] : undefined;

  return (
    <div className="flex h-full items-center justify-center bg-canvas p-8 text-sm text-gray-300">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/10 bg-surface p-8">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-gray-100">Alpha</h1>
          <p className="text-gray-400">AI work, coordinated.</p>
        </div>

        {problem && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="space-y-1">
              <p className="font-medium text-amber-200">{problem.title}</p>
              <p className="text-xs leading-relaxed text-amber-100/70">{problem.detail}</p>
            </div>
          </div>
        )}

        {identity.signInUrl ? (
          <a
            href={identity.signInUrl}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-white px-4 py-3 font-medium text-gray-900 transition hover:bg-gray-200"
          >
            <Github className="h-4 w-4" />
            Continue with GitHub
          </a>
        ) : (
          /**
           * No URL means the server has no OAuth credentials configured. A
           * button that cannot work is worse than none: it reads as a bug in
           * the app rather than a gap in the deployment.
           */
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-gray-400">
            GitHub sign-in is not configured on this server. Set
            <code className="mx-1 rounded bg-black/40 px-1.5 py-0.5 text-gray-300">
              GITHUB_CLIENT_ID
            </code>
            and
            <code className="mx-1 rounded bg-black/40 px-1.5 py-0.5 text-gray-300">
              GITHUB_CLIENT_SECRET
            </code>
            in the server environment.
          </div>
        )}

        <p className="text-xs leading-relaxed text-gray-500">
          Alpha reads your organisation team membership to decide what you can
          see. It never stores a password.
        </p>
      </div>
    </div>
  );
};
