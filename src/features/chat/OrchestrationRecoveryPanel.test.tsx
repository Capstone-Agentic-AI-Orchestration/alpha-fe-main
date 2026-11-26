import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LiveBuildRecoveryProjection } from '@/shared/types';
import { OrchestrationRecoveryPanel } from './OrchestrationRecoveryPanel';

const recovery = (overrides: Partial<LiveBuildRecoveryProjection> = {}): LiveBuildRecoveryProjection => ({
  id: 'recovery-1', runId: 'run-1', phase: 'waiting_for_user', category: 'project_code', code: 'acceptance_project_code',
  summary: 'This task replaced test cases (“renders a custom title”) in tests/unit/App.spec.tsx.',
  taskId: 'storefront', taskTitle: 'Build the storefront', taskRevision: 5, attemptsUsed: 3, repairBudget: 4, episodeNumber: 1, revision: 2,
  createdAt: '', updatedAt: '', availableActions: ['explain_failure', 'provide_guidance', 'retire_tests', 'cancel_build'], actionReasons: {},
  retirableTests: [{ path: 'tests/unit/App.spec.tsx', titles: ['renders a custom title'] }],
  ...overrides
});

const render = (projection: LiveBuildRecoveryProjection, canControl = true) => renderToStaticMarkup(
  <OrchestrationRecoveryPanel projectId="p1" runId="run-1" runRevision={9} taskRevision={5} recovery={projection} canControl={canControl} />);

describe('retiring obsolete tests from the recovery panel', () => {
  it('offers to retire the tests the stop named, asking before it acts', () => {
    const html = render(recovery());
    expect(html).toContain('Retire tests');
    // The confirmation, with the exact tests, opens only on the first click.
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Tests to retire');
  });

  it('does not offer it without named tests, or to someone who cannot change the build', () => {
    expect(render(recovery({ retirableTests: [] }))).not.toContain('Retire tests');
    expect(render(recovery({ availableActions: ['explain_failure', 'provide_guidance'], retirableTests: undefined }))).not.toContain('Retire tests');
    expect(render(recovery(), false)).not.toContain('Retire tests');
  });
});
