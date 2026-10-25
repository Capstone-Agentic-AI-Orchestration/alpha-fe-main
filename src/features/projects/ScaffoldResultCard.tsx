import React from 'react';
import { AlertTriangle, ExternalLink, GitBranch, Info, Rocket, X } from 'lucide-react';

import { CopyButton } from '@/shared/components/CopyButton';
import { HostingStatus, ScaffoldRepoResult } from '@/shared/types';

const DEPLOY_TARGET_LABEL: Record<'render' | 'vercel', string> = {
  render: 'Render',
  vercel: 'Vercel'
};

const HOSTING_STATE_LABEL: Record<HostingStatus['state'], string> = {
  ready: 'Ready',
  partial: 'Partially set up',
  not_set_up: 'Not set up',
  failed: 'Failed',
  unavailable: 'Unavailable'
};

/**
 * The compact read of hosting shown right after a repository is created —
 * the full detail (environment variables, GitHub Actions secrets, connected
 * repository) lives in the Hosting panel, not duplicated here.
 */
const HostingSummary: React.FC<{ hosting: HostingStatus }> = ({ hosting }) => {
  const platformLabel = hosting.platform ? DEPLOY_TARGET_LABEL[hosting.platform] : 'Hosting';
  // main and uat are the two environments worth linking to from a summary;
  // dev previews point at the same uat backend and add nothing here.
  const linkable = hosting.environments.filter(env => (env.branch === 'main' || env.branch === 'uat') && env.url);

  return (
    <div className="space-y-1.5 border-t border-divider pt-2.5">
      <p className="flex items-center gap-1.5 text-[11px] text-content-secondary">
        <Rocket className="h-3 w-3 text-link" aria-hidden />
        {platformLabel}
        <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] text-content-secondary">
          {HOSTING_STATE_LABEL[hosting.state]}
        </span>
      </p>

      {linkable.length > 0 && (
        <ul className="space-y-0.5">
          {linkable.map(env => (
            <li key={env.branch} className="flex items-center gap-1.5 text-[11px]">
              <span className="flex-shrink-0 font-mono text-content-muted">{env.branch}</span>
              <a
                href={env.url as string}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-w-0 items-center gap-1 text-link transition-colors hover:text-link-hover"
              >
                <span className="truncate">{(env.url as string).replace(/^https?:\/\//, '')}</span>
                <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden />
                <span className="sr-only">(opens site)</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {(hosting.state === 'failed' || hosting.state === 'unavailable') && (
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-status-warning">
          <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden />
          <span className="break-words">
            {hosting.error ||
              (hosting.state === 'unavailable'
                ? "Hosting isn't configured on the Alpha server yet."
                : 'Hosting setup failed.')}
          </span>
        </p>
      )}

      <p className="text-[11px] text-content-muted">See the Hosting panel in the project’s Previews tab.</p>
    </div>
  );
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
      className="motion-safe:animate-fade-in space-y-3 rounded-xl border border-status-success-border bg-status-success-subtle p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] text-status-success">Repository created</p>
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 font-mono text-xs text-content transition-colors hover:text-link-hover"
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
          className="rounded-md p-1 text-content-muted transition-colors hover:bg-surface-high hover:text-content"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <GitBranch className="h-3 w-3 text-content-muted" aria-hidden />
        {branches.map((branch, index) => (
          <React.Fragment key={branch}>
            {index > 0 && <span className="text-content-muted" aria-hidden>/</span>}
            <span className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-content-secondary">{branch}</span>
          </React.Fragment>
        ))}
        <span className="text-content-muted">— work lands on dev</span>
      </div>

      {result.protectionUnavailable && (
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-content-secondary">
          <Info className="mt-0.5 h-3 w-3 flex-shrink-0 text-content-muted" aria-hidden />
          <span>
            GitHub won't protect branches on this plan — Alpha only merges into uat/main by pull request.
          </span>
        </p>
      )}

      {result.cloneError && (
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-status-warning">
          <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden />
          <span>
            The repository was created, but this machine could not clone it:{' '}
            <span className="break-words font-mono">{result.cloneError}</span>
          </span>
        </p>
      )}

      {/* The platforms deploy through their own GitHub apps now, so this only
          appears when the server still asks for repository secrets. */}
      {result.requiredSecrets.length > 0 && (
        <div className="space-y-2 border-t border-divider pt-2.5">
          <p className="flex items-center gap-1.5 text-[11px] text-content-secondary">
            <Rocket className="h-3 w-3 text-link" aria-hidden />
            {result.deployTarget ? `Deploys to ${DEPLOY_TARGET_LABEL[result.deployTarget]} once these are set` : 'Required secrets'}
          </p>

          <div className="space-y-1">
            <p className="text-[10px] text-content-muted">Repository secrets</p>
            <ul className="space-y-1">
              {result.requiredSecrets.map(secret => (
                <li key={secret} className="flex items-center justify-between gap-2">
                  <code className="truncate font-mono text-[11px] text-content">{secret}</code>
                  <CopyButton value={secret} label={secret} />
                </li>
              ))}
            </ul>
          </div>

          {result.deployVariable && (
            <div className="space-y-1">
              <p className="text-[10px] text-content-muted">Repository variable</p>
              <div className="flex items-center justify-between gap-2">
                <code className="truncate font-mono text-[11px] text-content">{deployVariable} = true</code>
                <CopyButton value={deployVariable} label={deployVariable} />
              </div>
            </div>
          )}

          <a
            href={secretsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-link transition-colors hover:text-link-hover"
          >
            Open Settings → Secrets and variables
            <ExternalLink className="h-3 w-3" aria-hidden />
            <span className="sr-only">(opens GitHub)</span>
          </a>
        </div>
      )}

      {result.hosting ? (
        <HostingSummary hosting={result.hosting} />
      ) : (
        result.requiredSecrets.length === 0 &&
        !result.deployTarget && (
          <p className="border-t border-divider pt-2.5 text-[11px] text-content-muted">
            Deploys weren't requested for this repository.
          </p>
        )
      )}
    </section>
  );
};
