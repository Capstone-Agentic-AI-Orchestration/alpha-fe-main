import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { BuildNextStepCard, findingsToPolish, polishRequest } from './BuildNextStepCard';
import { approvalBlocker } from './useBuildApproval';
import { mergeIntoDev } from './useDevMerge';
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
  it('says the build is finished in a sentence, and asks whether to open the pull request', () => {
    const html = render(orchestration('awaiting_approval'));
    expect(html).toContain('The build is finished. All 2 tasks are done, and every check passed.');
    expect(html).toContain('Want me to open the pull request? You can also ask for changes first.');
    expect(html).toContain('>Open the pull request</button>');
    expect(html).toContain('>Ask for changes</button>');
    expect(html).toContain('>Review the changes</button>');
    expect(html).not.toContain('polish');
  });

  it('lists only findings about the product as things to polish, and offers to polish them first', () => {
    const findings = [
      { id: 'f1', status: 'open', severity: 'warning', title: 'Contact link uses an illustrative address', path: 'src/App.tsx' },
      { id: 'f2', status: 'open', severity: 'warning', title: 'Accepted handoff and patch record disagree' },
      { id: 'f3', status: 'resolved', severity: 'warning', title: 'Fixed already', path: 'src/App.css' }
    ];
    const value = orchestration('awaiting_approval', { findings, finalValidation: { status: 'failed', missingScripts: [], commands: [{ script: 'test', exitCode: 1, signal: null }] } });
    expect(findingsToPolish(value).map(finding => finding.id)).toEqual(['f1']);
    const html = render(value);
    expect(html).toContain('1 of 1 checks failed');
    expect(html).toContain('One thing you may want to polish first:');
    expect(html).toContain('Contact link uses an illustrative address');
    expect(html).not.toContain('Accepted handoff and patch record disagree');
    expect(html).toContain('Want me to open the pull request, or polish those first?');
    expect(html).toContain('>Polish them first</button>');
    expect(polishRequest(findingsToPolish(value))).toBe('Please polish these first:\n- Contact link uses an illustrative address (src/App.tsx)');
  });

  it('says why approval is not offered, rather than showing a button that cannot work', () => {
    const noRole = render(orchestration('awaiting_approval'), false);
    expect(noRole).toContain('A developer, PM, or admin must approve publication.');
    expect(noRole).not.toContain('>Open the pull request</button>');
    const blocked = render(orchestration('awaiting_approval', { findings: [{ id: 'f', status: 'open', severity: 'critical' }] }));
    expect(blocked).toContain('Blocking findings must be resolved before approval.');
    expect(blocked).not.toContain('>Open the pull request</button>');
  });

  it('shows the pull request it opened and what comes after', () => {
    const html = render(orchestration('completed', { run: { id: 'run-1', status: 'completed', revision: 13,
      publications: [{ repository: 'acme/web-fe', pullRequestUrl: 'https://github.com/acme/web-fe/pull/4' }] } }));
    expect(html).toContain('The pull request is open.');
    expect(html).toContain('https://github.com/acme/web-fe/pull/4');
    // Merging is a typed delivery action (or "merge it" in the chat), never done on GitHub by hand.
    expect(html).toContain('Merge it into dev once its checks pass');
    expect(html).toMatch(/<button type="button"[^>]*>(?:(?!<\/button>).)*Merge into dev<\/button>/);
    expect(html).not.toContain('on GitHub');
  });

  it('says an investigation needs no pull request', () => {
    const html = render(orchestration('completed', { tasks: [{ id: 't', title: 'Look', ownerName: 'Architect', status: 'accepted', required: true, kind: 'analysis' }] }));
    expect(html).toContain('The investigation is done.');
    expect(html).not.toContain('The pull request is open.');
  });

  it('says why publishing stopped and offers Retry, or a reply in the chat', () => {
    const html = render(orchestration('publishing', { run: { id: 'run-1', status: 'publishing', revision: 13,
      stoppedReason: 'GitHub refused the push to acme/web-fe.' } }));
    expect(html).toContain('GitHub refused the push to acme/web-fe.');
    expect(html).toContain('>Retry</button>');
    expect(html).toContain('or reply &#x27;retry&#x27; in the chat');
    expect(html).not.toContain('Opening the pull request');
    const noRole = render(orchestration('publishing', { run: { id: 'run-1', status: 'publishing', revision: 13, stoppedReason: 'Stopped.' } }), false);
    expect(noRole).not.toContain('>Retry</button>');
    expect(noRole).toContain('must approve publication');
  });

  it('says it is opening the pull request while publishing goes well', () => {
    const html = render(orchestration('publishing'));
    expect(html).toContain('Opening the pull request…');
    expect(html).not.toContain('Retry');
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

/** Merge into dev is the typed delivery action, at the revision just read, never chat text. */
describe('merging a finished build into dev', () => {
  const delivery = (stage: string, over: Record<string, unknown> = {}) => ({
    runId: 'run-1', projectId: 'p', revision: 7, stage, reason: 'Waiting for the required checks.', repairAttempts: 0,
    repositories: [{ repository: 'acme/web-fe', head: 'h', prUrl: 'https://github.com/acme/web-fe/pull/4', requiredChecks: [], checks: [] }],
    history: [], ...over
  });
  const api = (response: unknown, action = vi.fn(async () => delivery('dev_checks'))) => ({
    getOrchestrationDelivery: vi.fn(async () => response),
    orchestrationDeliveryAction: action
  }) as any;

  it('sends merge_dev with the current delivery revision and the idempotency key', async () => {
    const fake = api({ delivery: delivery('dev_approval'), canControl: true, canPromote: true });
    const outcome = await mergeIntoDev('p', 'run-1', 'key-1', fake);
    expect(fake.orchestrationDeliveryAction).toHaveBeenCalledWith('p', 'run-1', 'merge_dev', 7, 'key-1');
    expect(outcome).toEqual({ merged: true, message: 'Merged web-fe into dev. CI runs on dev next; promotion to UAT is a separate step.' });
  });

  it('says why it did not merge, and sends nothing, when the delivery is not ready', async () => {
    const fake = api({ delivery: delivery('pr_checks'), canControl: true, canPromote: true });
    expect(await mergeIntoDev('p', 'run-1', 'k', fake)).toEqual({ merged: false, message: 'Not ready to merge into dev: Waiting for the required checks.' });
    expect(fake.orchestrationDeliveryAction).not.toHaveBeenCalled();
  });

  it('says so when the role cannot merge or there is nothing to merge', async () => {
    expect((await mergeIntoDev('p', 'r', 'k', api({ delivery: delivery('dev_approval'), canControl: true, canPromote: false }))).message).toMatch(/role cannot merge/);
    expect((await mergeIntoDev('p', 'r', 'k', api({ delivery: null, canControl: true, canPromote: true }))).message).toBe('This build has no pull request to merge yet.');
  });

  it('turns a server refusal into the reason shown next to the button', async () => {
    const fake = api({ delivery: delivery('dev_approval'), canControl: true, canPromote: true }, vi.fn(async () => { throw new Error('The pull request head changed since review.'); }));
    expect(await mergeIntoDev('p', 'run-1', 'k', fake)).toEqual({ merged: false, message: 'Not merged: The pull request head changed since review.' });
  });
});
