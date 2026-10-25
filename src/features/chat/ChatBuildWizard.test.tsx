import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });
vi.mock('@/features/live-build-room/OrchestrationWorkflowPanel', () => ({ ReviewDiff: () => null }));

import { ChatBuildWizard, buildRepositoriesLabel, continueChoice, planningFailureReason, wizardStepFor, type ChatBuildWizardProps } from './ChatBuildWizard';
import { buildHandoffs, type ProjectLiveBuild } from './useProjectLiveBuild';

const build = (status: ProjectLiveBuild['status'], stoppedReason?: string): ProjectLiveBuild => ({
  runId: 'run-1', status, revision: 1, repository: 'acme/shop-fe', goal: 'Build an informational shop with login', running: status === 'executing',
  canControl: true, agents: [],
  orchestration: {
    run: { id: 'run-1', status, revision: 1, planVersion: 1, goal: 'Build an informational shop with login', exclusions: [], repository: 'acme/shop-fe', stoppedReason, createdAt: '', updatedAt: '' },
    requirements: [],
    tasks: [{ id: 't1', title: 'Add the login page', description: '', kind: 'implementation', repository: 'acme/shop-fe', ownerName: 'Frontend Agent', status: 'pending', dependsOn: [], required: true, acceptanceCriteria: [], requiredChecks: [] }],
    attempts: [], findings: []
  } as unknown as ProjectLiveBuild['orchestration']
});

const noop = () => undefined;
const render = (overrides: Partial<ChatBuildWizardProps>) => renderToStaticMarkup(<ChatBuildWizard
  projectId="p1" build={null} failure={null} canStart canApprove canStop busy={null} error={null}
  onStart={noop} onApprove={noop} onStop={noop} onContinue={noop} onReply={noop} onRetry={noop} onDismiss={noop} onOpenReview={noop}
  {...overrides} />);

describe('the build panel above the message box', () => {
  it('offers a reviewable Security plan instead of blindly retrying missing audit evidence', () => {
    const html = render({ build: build('blocked', 'The task has no dependency audit findings.'), onAuditPlan: noop });
    expect(html).toContain('Plan with Security');
    expect(html).toContain('revised audit-and-fix plan for your review');
    expect(html).not.toContain('Fix and continue');
  });
  it('places each build state on its step', () => {
    expect(wizardStepFor(build('planning'))).toEqual({ step: 'plan', attention: false });
    expect(wizardStepFor(build('awaiting_plan_approval'))).toEqual({ step: 'approve', attention: true });
    expect(wizardStepFor(build('executing'))).toEqual({ step: 'build', attention: false });
    expect(wizardStepFor(build('blocked'))).toEqual({ step: 'build', attention: true });
    expect(wizardStepFor(build('awaiting_approval'))).toEqual({ step: 'review', attention: true });
    expect(wizardStepFor(build('publishing'))).toEqual({ step: 'publish', attention: false });
  });

  it('shows a planning failure with its reason and a way to try again', () => {
    const content = '**Build not started.** Task planning stopped before any specialist was launched. The configured planning model could not produce a plan.';
    const html = render({ failure: { messageId: 'm1', reason: planningFailureReason(content), request: 'Build an informational shop' } });
    expect(html).toContain('Build not started');
    expect(html).toContain('Task planning stopped before any specialist was launched.');
    expect(html).not.toContain('**');
    expect(html).toContain('Try again');
    expect(html).toContain('Change the request');
    expect(html).toContain('Dismiss');
  });

  it('directs plan approval to its tab without numbered approval questions', () => {
    const html = render({ build: build('awaiting_plan_approval') });
    expect(html).toContain('Plan ready for your approval');
    expect(html).toContain('type start in the Build review tab');
    expect(html).not.toContain('Start planned work');
    expect(html).not.toContain('Open the full plan');
    expect(html).toMatch(/aria-current="step"[^>]*>.*Approve/);
  });

  it('shows review status without combined approval or navigation choices', () => {
    const html = render({ build: build('awaiting_approval') });
    expect(html).toContain('Build review tab');
    expect(html).not.toContain('Approve and open the pull request');
    expect(html).not.toContain('Open the full review');
    expect(html).not.toContain('Ask for changes');
  });

  it('offers milestone planning retry without treating it as final validation', () => {
    const stopped = build('blocked', 'Milestone planning stopped before dispatch: Provider unavailable');
    stopped.orchestration.tasks.forEach(task => { task.status = 'accepted'; });
    expect(continueChoice(stopped)).toMatchObject({ label: 'Retry milestone planning' });
    expect(continueChoice(stopped)?.action).toBeUndefined();
  });

  it('shows why a blocked build stopped, and offers to fix and continue', () => {
    const html = render({ build: build('blocked', 'The login API contract is missing.') });
    expect(html).toContain('The build needs you');
    expect(html).toContain('The login API contract is missing.');
    expect(html).toContain('Fix and continue');
    expect(html).toContain('Tell the Orchestrator what to do');
  });

  it('does not offer to start a plan to a role that cannot', () => {
    const html = render({ build: build('awaiting_plan_approval'), canStart: false });
    expect(html).toContain('Your workspace role cannot start builds.');
  });

  it('shows a working build as the step bar alone, and labels every repository it touches', () => {
    const running = build('executing');
    running.orchestration.run.currentTaskId = 't2';
    running.orchestration.tasks.push({ ...running.orchestration.tasks[0], id: 't2', title: 'Add the login API', repository: 'acme/shop-be', ownerName: 'Backend Agent', status: 'running' });
    running.agents = [{ name: 'Backend Agent', state: 'running', currentTaskTitle: 'Add the login API' }] as unknown as ProjectLiveBuild['agents'];
    expect(buildRepositoriesLabel(running)).toBe('shop-fe, shop-be');
    const html = render({ build: running });
    expect(html).toContain('aria-label="Build steps"');
    expect(html).toContain('Pull request');
    // The "who is working on what" line lives in the side panel now, not above the message box.
    expect(html).not.toContain('Add the login API · shop-be');
    expect(html).not.toMatch(/>Backend Agent is working</);
  });

  it('offers to re-run the final checks when every task is done, and reports what the agents delivered', () => {
    const stopped = build('blocked', 'Every final check passed, but 1 blocking review finding is still open: “Token in local storage”.');
    const orchestration = stopped.orchestration as any;
    orchestration.tasks[0].status = 'accepted';
    orchestration.attempts = [{ id: 'a1', taskId: 't1', attemptNumber: 1, agentName: 'Frontend Agent', status: 'accepted', summary: 'Added the login page and its tests.', changedPaths: ['src/Login.tsx', 'tests/Login.spec.tsx'] }];
    orchestration.findings = [
      { id: 'f1', taskId: 't1', sourceTaskId: 'r1', severity: 'blocking', status: 'open', title: 'Token in local storage', createdAt: '' },
      { id: 'f2', taskId: 't1', sourceTaskId: 'r1', severity: 'warning', status: 'open', title: 'No login rate limit', createdAt: '' }
    ];
    orchestration.finalValidation = { status: 'passed', missingScripts: [], noOpenBlockingFindings: false, commands: [{ script: 'test', display: 'npm test', exitCode: 0, signal: null }] };
    orchestration.recovery = { category: 'final_validation', availableActions: ['explain_failure', 'recheck_prerequisite'], actionReasons: {} };
    expect(continueChoice(stopped)).toMatchObject({ label: 'Run the final checks again', action: 'recheck_prerequisite' });
    const html = render({ build: stopped });
    expect(html).toContain('Run the final checks again');
    expect(html).not.toContain('Fix and continue');
    expect(html).toContain('Added the login page and its tests.');
    expect(html).toContain('2 files changed');
    expect(html).toContain('1 blocking finding');
    expect(html).toContain('1 review warning');
  });

  it('does not offer to continue when the server allows no automatic step', () => {
    const stopped = build('blocked', 'The agent needs the API contract.');
    (stopped.orchestration as any).recovery = { category: 'project_code', availableActions: ['explain_failure', 'provide_guidance'], actionReasons: { repair_and_continue: 'Tell the agent where the contract is.' } };
    expect(continueChoice(stopped)).toBeNull();
    const html = render({ build: stopped });
    expect(html).not.toContain('Fix and continue');
    expect(html).toContain('Tell the agent where the contract is.');
  });
});

describe('agents handing work to each other', () => {
  it('links each dependency owned by another agent, and marks the one being worked on', () => {
    const task = (id: string, ownerAgentId: string, status: string, dependsOn: string[] = []) => ({ id, ownerAgentId, status, dependsOn });
    const handoffs = buildHandoffs({ tasks: [
      task('api', 'backend', 'accepted'),
      task('ui', 'frontend', 'running', ['api']),
      task('api-tests', 'backend', 'accepted', ['api']),
      task('review', 'security', 'pending', ['api', 'ui'])
    ] } as any);
    expect(handoffs).toEqual([
      { fromAgentId: 'backend', toAgentId: 'frontend', state: 'active' },
      { fromAgentId: 'backend', toAgentId: 'security', state: 'pending' },
      { fromAgentId: 'frontend', toAgentId: 'security', state: 'pending' }
    ]);
  });
});
