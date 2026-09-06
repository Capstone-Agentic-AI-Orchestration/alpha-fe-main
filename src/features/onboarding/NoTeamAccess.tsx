import React, { useState } from 'react';
import { ShieldOff, RefreshCw, ExternalLink } from 'lucide-react';

import { Identity } from '@/shared/types';

/**
 * Shown instead of the workspace when GitHub grants this account no role.
 *
 * Alpha takes a person's role from their team membership in the workspace
 * organisation. Someone in the org but on no team used to fall through to `pm`
 * — the most permissive role in the product — so the absence of a decision
 * granted more than any decision would have.
 *
 * A screen rather than an empty workspace, for two reasons. `ROLE_TABS[role]`
 * drives navigation and its first entry is the default tab, so a role with no
 * tabs renders nothing at all and looks broken. And "you have no access" is
 * something to say plainly, with the fix and who can perform it, rather than
 * leave someone to infer from a blank page.
 */

interface Props {
  identity: Identity;
  /** Re-resolve identity, for after someone has been added to a team. */
  onRetry: () => Promise<void> | void;
}

export const NoTeamAccess: React.FC<Props> = ({ identity, onRetry }) => {
  const [checking, setChecking] = useState(false);

  const retry = async () => {
    setChecking(true);
    try {
      await onRetry();
    } finally {
      setChecking(false);
    }
  };

  const org = identity.workspaceOrg;

  return (
    <div className="flex h-full items-center justify-center bg-[#0E0E12] p-8 text-sm text-gray-300">
      <div className="w-full max-w-lg space-y-5 rounded-2xl border border-white/10 bg-[#14151B] p-7">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <ShieldOff className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-semibold text-white">You don&apos;t have a role yet</h1>
            <p className="text-[13px] leading-relaxed text-gray-400">
              <span className="font-mono text-gray-300">{identity.login}</span> is a member of{' '}
              <span className="font-mono text-gray-300">{org}</span> but isn&apos;t on a team that
              Alpha recognises, so there&apos;s nothing it can let you do yet.
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-white/5 bg-[#0A0B0E] p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
            What unlocks it
          </p>
          <p className="text-[13px] leading-relaxed text-gray-400">
            An organisation owner adds you to{' '}
            <span className="font-mono text-brand-300">developers</span> or{' '}
            <span className="font-mono text-brand-300">project-managers</span>. Alpha reads your
            role from that membership — there&apos;s no separate Alpha account and nothing else to
            set up.
          </p>
        </div>

        {/*
          The teams they *are* on, when there are any. Someone in `qa-team`
          reasonably believes they are on a team, and saying which ones Alpha
          can see turns a flat refusal into something they can act on.
        */}
        {identity.teams && identity.teams.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
              Teams Alpha can see for you in {org}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {identity.teams.filter(t => t.org === org).map(t => (
                <span
                  key={t.slug}
                  className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-gray-400"
                >
                  {t.slug}
                </span>
              ))}
              {identity.teams.filter(t => t.org === org).length === 0 && (
                <span className="text-[12px] text-gray-500">None.</span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={retry}
            disabled={checking}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking…' : 'Check again'}
          </button>
          {org && (
            <a
              href={`https://github.com/orgs/${org}/teams`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3.5 py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Teams on GitHub
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
