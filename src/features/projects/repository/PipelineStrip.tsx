import React, { useState } from 'react';
import { ArrowRight, ExternalLink, GitMerge, Info, Loader2 } from 'lucide-react';

import { apiService, parseApiError } from '@/shared/services/apiService';
import { PIPELINE_BRANCHES, PipelineBranch, PromoteResult, RepoCompare } from '@/shared/types';
import { describeRepoError } from './repoFormat';
import { RepoResource, useRepoResource } from './useRepoResource';

const STAGE_LABEL: Record<PipelineBranch, string> = {
  dev: 'Development',
  uat: 'Acceptance',
  main: 'Production'
};

type Step = { from: 'dev'; to: 'uat' } | { from: 'uat'; to: 'main' };
const STEPS: Step[] = [
  { from: 'dev', to: 'uat' },
  { from: 'uat', to: 'main' }
];

type Outcome = { kind: 'result'; result: PromoteResult } | { kind: 'error'; message: string };

interface PipelineStripProps {
  projectId: string;
  repo: string;
  /** Names of the branches the repository actually has. */
  branchNames: string[];
  selectedBranch: string | null;
  onSelectBranch: (branch: string) => void;
  /** Project managers and admins may open promotion pull requests. */
  canPromote: boolean;
  /** A promotion opened a pull request; the pull request list should reload. */
  onPromoted: () => void;
}

/**
 * dev → uat → main, with how far each stage is ahead of the next.
 *
 * Promotion never merges: it opens (or finds) the pull request that carries
 * the work one step on, and says which of those happened.
 */
export const PipelineStrip: React.FC<PipelineStripProps> = ({
  projectId,
  repo,
  branchNames,
  selectedBranch,
  onSelectBranch,
  canPromote,
  onPromoted
}) => {
  const has = (name: string) => branchNames.includes(name);
  const branchesKey = branchNames.join(',');

  const devToUat = useRepoResource<RepoCompare>(
    has('dev') && has('uat') ? () => apiService.compareRepoBranches(projectId, repo, 'uat', 'dev') : null,
    `${projectId}|${repo}|uat...dev|${branchesKey}`
  );
  const uatToMain = useRepoResource<RepoCompare>(
    has('uat') && has('main') ? () => apiService.compareRepoBranches(projectId, repo, 'main', 'uat') : null,
    `${projectId}|${repo}|main...uat|${branchesKey}`
  );
  const compares: Record<Step['from'], RepoResource<RepoCompare>> = { dev: devToUat, uat: uatToMain };

  const [running, setRunning] = useState<Step['from'] | null>(null);
  const [outcomes, setOutcomes] = useState<Partial<Record<Step['from'], Outcome>>>({});

  const promote = async (step: Step) => {
    setRunning(step.from);
    setOutcomes(prev => ({ ...prev, [step.from]: undefined }));
    try {
      const result = await apiService.promoteRepoBranch(projectId, repo, step);
      setOutcomes(prev => ({ ...prev, [step.from]: { kind: 'result', result } }));
      if (result.status !== 'nothing_to_promote') onPromoted();
      // The comparison is unchanged until the pull request merges, but a
      // "nothing to promote" answer means ours was stale.
      if (result.status === 'nothing_to_promote') compares[step.from].reload();
    } catch (err) {
      const { status } = parseApiError(err);
      const message = status === 403
        ? 'Only a project manager or an admin can promote.'
        : describeRepoError(err);
      setOutcomes(prev => ({ ...prev, [step.from]: { kind: 'error', message } }));
    } finally {
      setRunning(null);
    }
  };

  return (
    <ol
      aria-label="Promotion pipeline"
      className="grid gap-2 md:grid-cols-[minmax(6.5rem,auto)_minmax(0,1fr)_minmax(6.5rem,auto)_minmax(0,1fr)_minmax(6.5rem,auto)] md:items-stretch"
    >
      {PIPELINE_BRANCHES.map((branch, index) => {
        const step = STEPS[index];
        return (
          <React.Fragment key={branch}>
            <li className="min-w-0">
              <StageNode
                branch={branch}
                exists={has(branch)}
                selected={selectedBranch === branch}
                onSelect={() => onSelectBranch(branch)}
              />
            </li>
            {step && (
              <li className="min-w-0" aria-label={`${step.from} to ${step.to}`}>
                <StepLink
                  step={step}
                  compare={compares[step.from]}
                  missing={!has(step.from) ? step.from : !has(step.to) ? step.to : null}
                  canPromote={canPromote}
                  running={running === step.from}
                  busy={running !== null}
                  outcome={outcomes[step.from]}
                  onPromote={() => void promote(step)}
                />
              </li>
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
};

const StageNode: React.FC<{
  branch: PipelineBranch;
  exists: boolean;
  selected: boolean;
  onSelect: () => void;
}> = ({ branch, exists, selected, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    disabled={!exists}
    aria-pressed={selected}
    title={exists ? `Browse ${branch}` : `This repository has no ${branch} branch`}
    className={`flex h-full w-full flex-col items-start justify-center gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
      selected
        ? 'border-brand-400/50 bg-brand-500/10'
        : 'border-white/[0.08] bg-well hover:border-white/20'
    }`}
  >
    <span className="flex items-center gap-1.5 font-mono text-xs text-white">
      <span className={`h-1.5 w-1.5 rounded-full ${exists ? 'bg-emerald-400' : 'bg-gray-600'}`} aria-hidden />
      {branch}
    </span>
    <span className="text-[10px] text-gray-500">{exists ? STAGE_LABEL[branch] : 'Branch missing'}</span>
  </button>
);

const StepLink: React.FC<{
  step: Step;
  compare: RepoResource<RepoCompare>;
  /** A branch on either side that does not exist. */
  missing: string | null;
  canPromote: boolean;
  running: boolean;
  busy: boolean;
  outcome: Outcome | undefined;
  onPromote: () => void;
}> = ({ step, compare, missing, canPromote, running, busy, outcome, onPromote }) => {
  const ahead = compare.data?.aheadBy ?? 0;
  const behind = compare.data?.behindBy ?? 0;

  let summary: React.ReactNode;
  if (missing) {
    summary = <span className="text-gray-500">No {missing} branch to compare</span>;
  } else if (compare.loading && !compare.data) {
    summary = (
      <span className="inline-flex items-center gap-1.5 text-gray-500">
        <Loader2 className="h-3 w-3 motion-safe:animate-spin" aria-hidden /> Comparing…
      </span>
    );
  } else if (compare.error) {
    summary = <span className="text-amber-300">{compare.error}</span>;
  } else if (compare.data) {
    summary = ahead > 0 ? (
      <span className="text-gray-200">
        <span className="font-mono">{step.from}</span> is{' '}
        <span className="font-semibold tabular-nums text-white">{ahead}</span> commit{ahead === 1 ? '' : 's'} ahead of{' '}
        <span className="font-mono">{step.to}</span>
      </span>
    ) : (
      <span className="text-gray-500">
        <span className="font-mono">{step.to}</span> has everything on <span className="font-mono">{step.from}</span>
      </span>
    );
  }

  return (
    <div className="flex h-full flex-col justify-center gap-1.5 rounded-lg border border-dashed border-white/[0.08] px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-[11px]">
          <ArrowRight className="h-3 w-3 flex-shrink-0 text-gray-600 max-md:rotate-90" aria-hidden />
          {summary}
          {compare.data && behind > 0 && (
            <span className="text-gray-500">· {behind} behind</span>
          )}
        </p>
        {canPromote && !missing && (
          <button
            type="button"
            onClick={onPromote}
            disabled={busy || compare.loading || !compare.data || ahead === 0}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-2.5 py-1 text-[11px] font-medium text-on-accent transition-colors hover:bg-brand-600 disabled:opacity-40"
          >
            {running ? <Loader2 className="h-3 w-3 motion-safe:animate-spin" aria-hidden /> : <GitMerge className="h-3 w-3" aria-hidden />}
            {running ? 'Promoting…' : `Promote ${step.from} → ${step.to}`}
          </button>
        )}
      </div>
      <div aria-live="polite" className="text-[11px]">
        {outcome && <PromoteOutcome step={step} outcome={outcome} />}
      </div>
    </div>
  );
};

const PromoteOutcome: React.FC<{ step: Step; outcome: Outcome }> = ({ step, outcome }) => {
  if (outcome.kind === 'error') {
    return <p role="alert" className="text-amber-300">{outcome.message}</p>;
  }
  const { result } = outcome;
  if (result.status === 'nothing_to_promote') {
    return (
      <p className="flex items-center gap-1.5 text-gray-400">
        <Info className="h-3 w-3" aria-hidden /> Nothing to promote — {step.to} already has everything on {step.from}.
      </p>
    );
  }
  const opened = result.status === 'opened';
  const commits = opened ? result.commits : undefined;
  return (
    <p className={opened ? 'text-emerald-300' : 'text-gray-300'}>
      {opened ? 'Opened ' : 'Already open: '}
      <a
        href={result.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 underline decoration-white/20 underline-offset-2 transition-colors hover:text-white"
      >
        pull request #{result.number}
        <ExternalLink className="h-3 w-3" aria-hidden />
        <span className="sr-only">(opens GitHub)</span>
      </a>
      {opened && typeof commits === 'number' && ` with ${commits} commit${commits === 1 ? '' : 's'}`}
    </p>
  );
};
