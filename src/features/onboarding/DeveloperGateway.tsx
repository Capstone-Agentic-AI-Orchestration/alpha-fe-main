import React from 'react';
import { Monitor, Download, LogOut } from 'lucide-react';

import { Identity } from '@/shared/types';

/**
 * What a developer sees when they sign in to the web app.
 *
 * Developers work in the desktop app, and not as a preference. The web build
 * runs in a browser tab: it has no filesystem, cannot spawn `claude` or `agy`,
 * and has no working copy to run them against. Every developer surface in
 * Alpha depends on at least one of those.
 *
 * So the honest answer is not a degraded workspace, it is a signpost. A
 * developer who lands here has done nothing wrong — the web app is simply the
 * project manager's half of the product.
 *
 * Their session is real and stays valid; the desktop app will find the same
 * account. Sign-out is offered anyway, for a shared machine.
 */

interface Props {
  identity: Identity;
  /** Where the server serves the installer from. */
  downloadUrl: string;
  onSignOut: () => Promise<void> | void;
}

export const DeveloperGateway: React.FC<Props> = ({ identity, downloadUrl, onSignOut }) => (
  <div className="flex h-full items-center justify-center bg-canvas p-8 text-sm text-gray-300">
    <div className="w-full max-w-lg space-y-6 rounded-2xl border border-white/10 bg-surface p-8">
      <div className="flex items-start gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400">
          <Monitor className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h1 className="font-semibold text-gray-100">Alpha for developers runs on the desktop</h1>
          <p className="text-xs leading-relaxed text-gray-400">
            Signed in as <span className="text-gray-200">{identity.login}</span>. Your
            developer tools need a local checkout and the AI CLIs on your machine,
            which a browser tab cannot reach.
          </p>
        </div>
      </div>

      <a
        href={downloadUrl}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-white px-4 py-3 font-medium text-gray-900 transition hover:bg-gray-200"
      >
        <Download className="h-4 w-4" />
        Download Alpha for Desktop
      </a>

      <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-gray-400">
        <p className="font-medium text-gray-300">After installing</p>
        <p>
          Sign in with the same GitHub account. The desktop app picks up your
          projects and issues from here — the board is shared, the work is local.
        </p>
      </div>

      <button
        type="button"
        onClick={() => void onSignOut()}
        className="flex items-center gap-2 text-xs text-gray-500 transition hover:text-gray-300"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </button>
    </div>
  </div>
);
