import React, { useEffect, useState } from 'react';
import { CloudOff, RotateCw } from 'lucide-react';

import { AlphaStartupLoader } from './AlphaStartupLoader';

/**
 * What the web build shows before it knows who you are.
 *
 * It used to show the workspace. With no answer from `/me` there is no
 * identity, and with no identity AppContext falls back to the 'pm' role -- so
 * a signed-out visitor, or anyone who arrived while the API was asleep, landed
 * in a PM workspace full of sample data. Nothing real leaked, because every
 * request still failed with 401, but it looked like it had, and it hid the
 * sign-in screen behind any network hiccup.
 *
 * Only the web build reaches this. The desktop keeps its offline shell: its
 * daemon is local, and a failed request there means it is still starting.
 */

interface Props {
  status: 'loading' | 'unreachable';
  onRetry: () => void;
}

/**
 * When "connecting" starts explaining itself.
 *
 * Render's free tier sleeps after a quiet spell and takes up to a minute to
 * wake, so a long wait is normal and should say so -- but most loads answer
 * well inside this, and a sentence that flashes up and vanishes is noise.
 */
const SLOW_AFTER_MS = 4000;

export const ConnectingScreen: React.FC<Props> = ({ status, onRetry }) => {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (status !== 'loading') return;
    setSlow(false);
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  if (status === 'loading') {
    return <AlphaStartupLoader
      label="Connecting to Alpha"
      detail={slow ? 'The server may take a moment to wake up. This page continues on its own.' : undefined}
    />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6 text-sm text-gray-300">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-8">
        <div role="alert" className="space-y-5">
          <div className="flex items-start gap-3">
            <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
            <div className="space-y-1.5">
              <h1 className="text-base font-semibold text-gray-100">
                Can&rsquo;t reach Alpha&rsquo;s server
              </h1>
              <p className="text-xs leading-relaxed text-gray-400">
                Alpha shows nothing until it knows who you are. Check your connection and
                try again. If it keeps failing, the server may be restarting or down.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-content px-4 py-3 font-medium text-canvas transition hover:bg-content-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      </div>
    </main>
  );
};
