import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });
vi.mock('@/features/project-build-review/OrchestrationWorkflowPanel', () => ({ ReviewDiff: () => null }));
vi.mock('@/features/project-build-review/OrchestrationPlanPreview', () => ({ OrchestrationPlanPreview: () => null }));
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
  it('explains publication permissions next to the chat footer', () => {
    const html = render('awaiting_approval', false);
    expect(html).toContain('A developer, PM, or admin must approve publication.');
    expect(html).not.toContain('Approve and open pull request');
    expect(html).toContain('Approve or ask for changes in the chat');
    expect(html).not.toContain('<input');
  });
  it('is read only: a summary of the build, and the decision is left to the chat', () => {
    const build = fixture('awaiting_approval');
    build.orchestration.tasks = [{ id: 't', title: 'Landing page', ownerName: 'Frontend Agent', status: 'accepted', required: true, kind: 'frontend' }] as any;
    build.orchestration.finalValidation = { status: 'passed', missingScripts: [], commands: [{ script: 'test', exitCode: 0, signal: null }, { script: 'lint', exitCode: 0, signal: null }] } as any;
    const html = renderToStaticMarkup(<BuildReviewTab projectId="p" build={build} canStart canApprove busy={false} error={null} />);
    expect(html).toContain('Ready for your review');
    expect(html).toContain('Approve or ask for changes in the chat');
    expect(html).not.toContain('Approve and open pull request');
    expect(html).not.toContain('Ask for changes<');
    // The only button left in the panel is the plan document's (mocked out here).
    expect(html).not.toContain('<button');
    expect(html).toContain('1/1');
    expect(html).toContain('2/2');
    expect(html).toContain('checks passed');
  });
  it('does not offer approval while a blocking finding is open', () => {
    const build = fixture('awaiting_approval');
    build.orchestration.findings = [{ id: 'f', status: 'open', severity: 'blocking', title: 'Secret in code' }] as any;
    const html = renderToStaticMarkup(<BuildReviewTab projectId="p" build={build} canStart canApprove busy={false} error={null} />);
    expect(html).toContain('Blocking findings must be resolved before approval.');
    expect(html).not.toContain('Approve and open pull request');
  });
  it('says why publishing is stuck while it is publishing, or that it is still opening', () => {
    const stuck = fixture('publishing');
    stuck.orchestration.run.stoppedReason = 'acme/api has no changes, so no pull request was opened for it.';
    const html = renderToStaticMarkup(<BuildReviewTab projectId="p" build={stuck} canStart canApprove busy={false} error={null} />);
    expect(html).toContain('acme/api has no changes, so no pull request was opened for it.');
    expect(html.match(/acme\/api has no changes/g)).toHaveLength(1);
    expect(html).not.toContain('Opening the pull request');
    expect(html).not.toContain('<button');
    expect(render('publishing')).toContain('Opening the pull request…');
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
    expect(html).toContain('Pull request opened');
    expect(html).toContain('>Done<');
  });
});
