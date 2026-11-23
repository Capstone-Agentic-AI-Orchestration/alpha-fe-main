import React from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';

import { githubLink } from '@/shared/lib/githubLink';
import type { ResolvedWithoutYouEvidence, ResolvedWithoutYouItem } from '@/shared/types';

/**
 * Problems the Orchestrator fixed on its own during a build, shown when the person reviews it so
 * nothing resolved on their behalf ships unseen. Team only: the server sends the list only to the
 * team, and the list renders nothing without it.
 */

/** Plain words for how far-reaching a fix was. */
export function resolutionKindLabel(tier: number): string {
  return tier >= 1 ? 'Changed earlier finished work' : 'Routine fix';
}

/** "Alpha fixed 2 problems without you", or nothing when there were none. */
export function resolvedWithoutYouSummary(items: readonly ResolvedWithoutYouItem[] | undefined): string | undefined {
  if (!items?.length) return undefined;
  const pending = items.filter(item => item.status === 'retrying').length;
  const fixed = `Alpha fixed ${items.length} ${items.length === 1 ? 'problem' : 'problems'} without you`;
  return pending ? `${fixed} (${pending} still being checked)` : fixed;
}

function EvidenceLine({ evidence }: { evidence: ResolvedWithoutYouEvidence }) {
  if (evidence.source === 'product_picture') {
    return <li className="break-words"><span className="font-medium text-content-secondary">Your product decision:</span> “{evidence.quote}”</li>;
  }
  const url = githubLink(`https://github.com/${evidence.repository}/blob/HEAD/${evidence.path}`);
  return <li className="break-words">
    <span className="font-mono text-[10px] text-link">{evidence.repository.split('/').pop()} · {evidence.path}</span>
    {url && <a href={url} target="_blank" rel="noopener noreferrer" className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-link hover:text-link-hover">
      Open on GitHub<ExternalLink aria-hidden="true" className="h-2.5 w-2.5" />
    </a>}
    {evidence.quote && <span className="mt-0.5 block whitespace-pre-wrap font-mono text-[10px] text-content-muted">{evidence.quote}</span>}
  </li>;
}

/** One fix: the task, the problem, what Alpha did and what it relied on. */
function ResolvedItem({ item }: { item: ResolvedWithoutYouItem }) {
  return <li className="space-y-1 px-3 py-2.5">
    <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-content">{item.taskTitle ?? 'Build task'}</span>
      <span className="shrink-0 rounded-full bg-status-info-subtle px-2 py-0.5 text-[10px] font-medium text-status-info">{resolutionKindLabel(item.tier)}</span>
      {item.status === 'retrying' && <span className="shrink-0 rounded-full bg-status-warning-subtle px-2 py-0.5 text-[10px] font-medium text-status-warning">Still being checked</span>}
    </div>
    <p className="text-[11px] leading-5 text-content-secondary"><span className="font-medium text-content">Problem:</span> {item.problem}</p>
    <p className="whitespace-pre-wrap text-[11px] leading-5 text-content-secondary"><span className="font-medium text-content">What Alpha did:</span> {item.fix}</p>
    {item.evidence.length > 0 && <details className="text-[10px] text-content-muted">
      <summary className="cursor-pointer">Why Alpha was sure ({item.evidence.length})</summary>
      <ul className="mt-1.5 space-y-1.5 pl-1">{item.evidence.map((evidence, index) => <EvidenceLine key={index} evidence={evidence} />)}</ul>
    </details>}
  </li>;
}

/** The full list, for the build review. */
export const ResolvedWithoutYouList: React.FC<{ items?: ResolvedWithoutYouItem[] }> = ({ items }) => {
  if (!items?.length) return null;
  return <div className="space-y-1.5">
    <p className="text-[11px] leading-4 text-content-muted">Each fix went back to the same specialist and passed the same checks and review as the rest of the work.</p>
    <ul className="divide-y divide-divider overflow-hidden rounded-lg border border-divider bg-surface-raised">
      {items.map(item => <ResolvedItem key={item.recoveryId} item={item} />)}
    </ul>
  </div>;
};

/** A folded summary for the approval card, opening to the same list. */
export const ResolvedWithoutYouSummary: React.FC<{ items?: ResolvedWithoutYouItem[] }> = ({ items }) => {
  const summary = resolvedWithoutYouSummary(items);
  if (!summary) return null;
  return <details className="mt-2 rounded-lg border border-divider bg-well px-2.5 py-2 text-[11px]">
    <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-content"><Sparkles className="h-3.5 w-3.5 shrink-0 text-status-info" aria-hidden="true" />{summary}</summary>
    <div className="mt-2"><ResolvedWithoutYouList items={items} /></div>
  </details>;
};
