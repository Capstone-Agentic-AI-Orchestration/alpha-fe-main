import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });
vi.mock('@/features/project-build-review/OrchestrationWorkflowPanel', () => ({ ReviewDiff: () => null }));

import type { ProjectBuildOrchestration, ResolvedWithoutYouItem } from '@/shared/types';
import { ReviewBody } from './ChatBuildBodies';
import { BuildNextStepCard } from './BuildNextStepCard';
import { ResolvedWithoutYouList, evidenceLink, resolutionKindLabel, resolvedWithoutYouSummary } from './ResolvedWithoutYou';

/**
 * What Alpha fixed on the person's behalf, shown when they review the build, so nothing resolved
 * without them ships unseen.
 */

const items: ResolvedWithoutYouItem[] = [
  { recoveryId: 'r1', taskId: 't1', taskTitle: 'Show bookings', status: 'retry_accepted', tier: 0,
    problem: 'formatDate is defined twice, so lint fails.', fix: 'Import formatDate from src/lib/date.ts.',
    evidence: [
      { source: 'repository', repository: 'acme/shop-fe', path: 'src/lib/date.ts', quote: 'export function formatDate(', commit: 'c'.repeat(40) },
      { source: 'product_picture', quote: 'Bookings show the local date.' }
    ], resolvedAt: '2026-11-24T10:04:00.000Z' },
  { recoveryId: 'r2', taskId: 't2', taskTitle: 'Bookings API', status: 'retrying', tier: 1,
    problem: 'The API returns dates as text.', fix: 'Return ISO dates from the bookings route.', evidence: [], resolvedAt: '2026-11-24T10:06:00.000Z' }
];

const orchestration = (resolvedWithoutYou?: ResolvedWithoutYouItem[]) => ({
  run: { id: 'run-1', status: 'awaiting_approval', revision: 3, planVersion: 1, goal: 'Bookings', exclusions: [], repository: 'acme/shop-fe', createdAt: '', updatedAt: '' },
  requirements: [], tasks: [], attempts: [], findings: [], artifacts: [], resolvedWithoutYou
}) as unknown as ProjectBuildOrchestration;

describe('resolved without you', () => {
  it('lists each fix with its task, problem, what Alpha did, its kind and evidence', () => {
    const html = renderToStaticMarkup(<ResolvedWithoutYouList items={items} />);
    for (const shown of ['Show bookings', 'formatDate is defined twice, so lint fails.', 'Import formatDate from src/lib/date.ts.',
      'Routine fix', 'Changed earlier finished work', 'Still being checked', 'shop-fe · src/lib/date.ts', 'export function formatDate(',
      'Product record:', 'Bookings show the local date.']) expect(html).toContain(shown);
    expect(html).not.toContain('Your product decision');
    expect(html).toContain(`href="https://github.com/acme/shop-fe/blob/${'c'.repeat(40)}/src/lib/date.ts"`);
  });

  it('links a cited file at the commit Alpha checked, with each path segment encoded', () => {
    const commit = 'a'.repeat(40);
    expect(evidenceLink({ source: 'repository', repository: 'acme/shop-fe', path: 'src/50% off/#new?.ts', quote: 'q', commit }))
      .toBe(`https://github.com/acme/shop-fe/blob/${commit}/src/50%25%20off/%23new%3F.ts`);
    // No checked commit (or not a commit id): no link, rather than one to a different version.
    expect(evidenceLink({ source: 'repository', repository: 'acme/shop-fe', path: 'src/a.ts', quote: 'q' })).toBeUndefined();
    expect(evidenceLink({ source: 'repository', repository: 'acme/shop-fe', path: 'src/a.ts', quote: 'q', commit: 'HEAD' })).toBeUndefined();
    expect(evidenceLink({ source: 'product_picture', quote: 'q' })).toBeUndefined();
  });

  it('summarises the list for the approval card', () => {
    expect(resolvedWithoutYouSummary(items)).toBe('Alpha fixed 2 problems without you (1 still being checked)');
    expect(resolvedWithoutYouSummary(items.slice(0, 1))).toBe('Alpha fixed 1 problem without you');
    expect(resolvedWithoutYouSummary([])).toBeUndefined();
    expect(resolutionKindLabel(0)).toBe('Routine fix');
    expect(resolutionKindLabel(1)).toBe('Changed earlier finished work');
  });

  it('shows on the approval card and in the build review', () => {
    const card = renderToStaticMarkup(<BuildNextStepCard projectId="p1" orchestration={orchestration(items)} canApprove onReview={() => undefined} onAskChanges={() => undefined} />);
    expect(card).toContain('Alpha fixed 2 problems without you');
    const review = renderToStaticMarkup(<ReviewBody projectId="p1" orchestration={orchestration(items)} />);
    expect(review).toContain('Resolved without you');
    expect(review).toContain('Return ISO dates from the bookings route.');
  });

  it('shows nothing when the server sent no list (clients never get one) or it is empty', () => {
    for (const list of [undefined, []]) {
      expect(renderToStaticMarkup(<BuildNextStepCard projectId="p1" orchestration={orchestration(list)} canApprove onReview={() => undefined} onAskChanges={() => undefined} />)).not.toContain('without you');
      expect(renderToStaticMarkup(<ReviewBody projectId="p1" orchestration={orchestration(list)} />)).not.toContain('Resolved without you');
    }
  });
});
