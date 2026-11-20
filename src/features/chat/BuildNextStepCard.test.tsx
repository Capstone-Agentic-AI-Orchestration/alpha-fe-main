import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { BuildNextStepCard } from './BuildNextStepCard';
import { approvalBlocker } from './useBuildApproval';
import type { ProjectBuildOrchestration } from '@/shared/types';

const orchestration = (status: string, over: Record<string, unknown> = {}) => ({
  run: { id: 'run-1', status, revision: 13 },
  tasks: [
    { id: 't1', title: 'Landing page', ownerName: 'Frontend Agent', status: 'accepted', required: true, kind: 'frontend' },
    { id: 't2', title: 'Review it', ownerName: 'Security Agent', status: 'accepted', required: true, kind: 'review' }
  ],
  attempts: [],
  findings: [],
  finalValidation: { status: 'passed', missingScripts: [], commands: [{ script: 'test', exitCode: 0, signal: null }, { script: 'lint', exitCode: 0, signal: null }] },
  ...over
}) as unknown as ProjectBuildOrchestration;

const render = (value: ProjectBuildOrchestration, canApprove = true) => renderToStaticMarkup(<BuildNextStepCard projectId="p"
  orchestration={value} canApprove={canApprove} onReview={() => undefined} onAskChanges={() => undefined} />);

/** After a build, the conversation says it is done and what to do next. */
describe('the next step under a finished build', () => {
  it('says the build is finished, sums it up, and offers review, approval and changes', () => {
    const html = render(orchestration('awaiting_approval'));
    expect(html).toContain('Build finished · ready for your review');
    expect(html).toContain('2 of 2 tasks done · 2 of 2 checks passed · no open findings');
    expect(html).toContain('Next:');
    expect(html).toContain('Review changes');
    expect(html).toContain('Approve and open pull request');
    expect(html).toContain('Ask for changes');
  });

  it('says why approval is not offered, rather than showing a button that cannot work', () => {
    const noRole = render(orchestration('awaiting_approval'), false);
    expect(noRole).toContain('A developer, PM, or admin must approve publication.');
    expect(noRole).not.toContain('Approve and open pull request');
    const blocked = render(orchestration('awaiting_approval', { findings: [{ id: 'f', status: 'open', severity: 'critical' }] }));
    expect(blocked).toContain('Blocking findings must be resolved before approval.');
    expect(blocked).toContain('1 open finding');
    expect(blocked).not.toContain('Approve and open pull request');
  });

  it('shows the pull request it opened and what comes after', () => {
    const html = render(orchestration('completed', { run: { id: 'run-1', status: 'completed', revision: 13,
      publications: [{ repository: 'acme/web-fe', pullRequestUrl: 'https://github.com/acme/web-fe/pull/4' }] } }));
    expect(html).toContain('Done · pull request opened');
    expect(html).toContain('https://github.com/acme/web-fe/pull/4');
    expect(html).toContain('merge it on GitHub');
  });

  it('says an investigation needs no pull request', () => {
    const html = render(orchestration('completed', { tasks: [{ id: 't', title: 'Look', ownerName: 'Architect', status: 'accepted', required: true, kind: 'analysis' }] }));
    expect(html).toContain('Investigation complete');
    expect(html).not.toContain('pull request opened');
  });

  it('shows nothing while the build is still running', () => {
    expect(render(orchestration('executing'))).toBe('');
  });
});

describe('when approval is offered', () => {
  it('needs a role that may publish and no blocking or critical finding left open', () => {
    expect(approvalBlocker(orchestration('awaiting_approval'), true)).toBeNull();
    expect(approvalBlocker(orchestration('awaiting_approval'), false)).toMatch(/must approve publication/);
    expect(approvalBlocker(orchestration('awaiting_approval', { findings: [{ id: 'f', status: 'open', severity: 'blocking' }] }), true)).toMatch(/Blocking findings/);
    expect(approvalBlocker(orchestration('awaiting_approval', { findings: [{ id: 'f', status: 'resolved', severity: 'blocking' }] }), true)).toBeNull();
    expect(approvalBlocker(orchestration('awaiting_approval', { findings: [{ id: 'f', status: 'open', severity: 'minor' }] }), true)).toBeNull();
  });
});
