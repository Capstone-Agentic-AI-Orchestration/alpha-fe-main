import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });
vi.mock('@/features/live-build-room/OrchestrationWorkflowPanel', () => ({ ReviewDiff: () => null }));
import { BuildReviewTab } from './BuildReviewTab';
import type { ProjectLiveBuild } from './useProjectLiveBuild';
const fixture = (status: ProjectLiveBuild['status']) => ({ runId: 'r', status, revision: 3, repository: 'acme/web', agents: [],
  orchestration: { run: { id: 'r', status, planVersion: 1, exclusions: [] }, requirements: [], tasks: [], attempts: [], findings: [], finalValidation: { status: 'passed', commands: [], missingScripts: [] } }
}) as unknown as ProjectLiveBuild;
const render = (status: ProjectLiveBuild['status'], allowed = true) => renderToStaticMarkup(<BuildReviewTab projectId="p" build={fixture(status)} canStart={allowed} canApprove={allowed} busy={false} error={null} />);
describe('build review tab', () => {
  it('keeps the plan readable and directs approval to main chat', () => {
    const html = render('awaiting_plan_approval');
    expect(html).toContain('You can use your own words');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('Approve and open the pull request');
  });
  it('explains publication permissions instead of showing a disabled approval choice', () => {
    const html = render('awaiting_approval', false);
    expect(html).toContain('A project manager or admin must approve publication.');
    expect(html).toContain('authorize pushing this revision');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('Open the full review');
  });
  it('shows completed read-only results without a publication approval input', () => {
    const html = render('completed');
    expect(html).toContain('no pull request is needed');
    expect(html).not.toContain('Publication approval command');
    expect(html).not.toContain('Plan approval command');
  });
  it('keeps a completed pull request readable on the right after chat publication', () => {
    const build = fixture('completed');
    build.orchestration.run.publication = { repository: 'acme/web', pullRequestUrl: 'https://github.com/acme/web/pull/1' } as any;
    const html = renderToStaticMarkup(<BuildReviewTab projectId="p" build={build} canStart canApprove busy={false} error={null} />);
    expect(html).toContain('https://github.com/acme/web/pull/1');
    expect(html).toContain('Open pull request'); expect(html).not.toContain('<input');
  });
});
