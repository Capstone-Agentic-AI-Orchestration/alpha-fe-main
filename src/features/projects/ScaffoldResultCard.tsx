import React from 'react';
import { AlertTriangle, ExternalLink, GitBranch, Info, Rocket, X } from 'lucide-react';

import { CopyButton } from '@/shared/components/CopyButton';
import { ScaffoldRepoResult } from '@/shared/types';

const DEPLOY_TARGET_LABEL: Record<'render' | 'vercel', string> = {
  render: 'Render',
  vercel: 'Vercel'
};

interface ScaffoldResultCardProps {
  result: ScaffoldRepoResult;
  onDismiss: () => void;
}

/**
 * What a new repository needs from a person before it is fully working.
 *
 * The scaffold does everything it can on its own. What is left — deploy
 * secrets, a variable that switches deploys on — only the repository's owner
 * can set, so the card lists each value with a copy button and links straight
 * to the settings page where it goes.
 */
export const ScaffoldResultCard: React.FC<ScaffoldResultCardProps> = ({ result, onDismiss }) => {
  const branches = result.branches.length > 0 ? result.branches : ['dev', 'uat', 'main'];
  const secretsUrl = `${result.url.replace(/\/$/, '')}/settings/secrets/actions`;
  const deployVariable = result.deployVariable ?? 'ALPHAORCH_DEPLOY';

  return (
    <section
      aria-label={`Created ${result.nameWithOwner}`}
      className="motion-safe:animate-fade-in space-y-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] text-emerald-300">Repository created</p>
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 font-mono text-xs text-white transition-colors hover:text-brand-400"
          >
            <span className="truncate">{result.nameWithOwner}</span>
            <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden />
            <span className="sr-only">(opens GitHub)</span>
          </a>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Dismiss ${result.nameWithOwner}`}
          className="rounded-md p-1 text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <GitBranch className="h-3 w-3 text-gray-500" aria-hidden />
        {branches.map((branch, index) => (
          <React.Fragment key={branch}>
            {index > 0 && <span className="text-gray-600" aria-hidden>/</span>}
            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-gray-300">{branch}</span>
          </React.Fragment>
        ))}
        <span className="text-gray-500">— work lands on dev</span>
      </div>

      {result.protectionUnavailable && (
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-gray-400">
          <Info className="mt-0.5 h-3 w-3 flex-shrink-0 text-gray-500" aria-hidden />
          <span>
            GitHub won't protect branches on this plan — Alpha only merges into uat/main by pull request.
          </span>
        </p>
      )}

      {result.cloneError && (
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-300">
          <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden />
          <span>
            The repository was created, but this machine could not clone it:{' '}
            <span className="break-words font-mono">{result.cloneError}</span>
          </span>
        </p>
      )}

      {result.deployTarget ? (
        <div className="space-y-2 border-t border-white/5 pt-2.5">
          <p className="flex items-center gap-1.5 text-[11px] text-gray-300">
            <Rocket className="h-3 w-3 text-brand-400" aria-hidden />
            Deploys to {DEPLOY_TARGET_LABEL[result.deployTarget]} once these are set
          </p>

          {result.requiredSecrets.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-gray-500">Repository secrets</p>
              <ul className="space-y-1">
                {result.requiredSecrets.map(secret => (
                  <li key={secret} className="flex items-center justify-between gap-2">
                    <code className="truncate font-mono text-[11px] text-gray-200">{secret}</code>
                    <CopyButton value={secret} label={secret} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-[10px] text-gray-500">Repository variable</p>
            <div className="flex items-center justify-between gap-2">
              <code className="truncate font-mono text-[11px] text-gray-200">{deployVariable} = true</code>
              <CopyButton value={deployVariable} label={deployVariable} />
            </div>
          </div>

          <a
            href={secretsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-brand-400 transition-colors hover:text-brand-100"
          >
            Open Settings → Secrets and variables
            <ExternalLink className="h-3 w-3" aria-hidden />
            <span className="sr-only">(opens GitHub)</span>
          </a>
        </div>
      ) : (
        <p className="border-t border-white/5 pt-2.5 text-[11px] text-gray-500">
          Deploys weren't requested for this repository.
        </p>
      )}
    </section>
  );
};
