import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });
vi.mock('@/features/project-build-review/OrchestrationWorkflowPanel', () => ({ ReviewDiff: () => null }));
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
    expect(html).toContain('A developer, PM, or admin must approve publication.');
    expect(html).not.toContain('Approve and open pull request');
    expect(html).toContain('tell Alpha in the main chat whether to push this revision');
    expect(html).not.toContain('<input');
  });
  it('offers the decision as buttons, with a summary of the build at the top', () => {
    const build = fixture('awaiting_approval');
    build.orchestration.tasks = [{ id: 't', title: 'Landing page', ownerName: 'Frontend Agent', status: 'accepted', required: true, kind: 'frontend' }] as any;
    build.orchestration.finalValidation = { status: 'passed', missingScripts: [], commands: [{ script: 'test', exitCode: 0, signal: null }, { script: 'lint', exitCode: 0, signal: null }] } as any;
    const html = renderToStaticMarkup(<BuildReviewTab projectId="p" build={build} canStart canApprove busy={false} error={null} onAskChanges={() => undefined} />);
    expect(html).toContain('Ready for your review');
    expect(html).toContain('Approve and open pull request');
    expect(html).toContain('Ask for changes');
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
