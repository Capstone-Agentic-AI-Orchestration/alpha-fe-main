import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });
vi.mock('@/features/project-build-review/OrchestrationWorkflowPanel', () => ({ ReviewDiff: () => null }));

import { ChatBuildWizard, buildRefusalFrom, buildRepositoriesLabel, continueChoice, planningFailureReason, wizardStepFor, type ChatBuildWizardProps } from './ChatBuildWizard';
import { ApiRequestError } from '@/shared/services/apiService';
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
  onStop={noop} onContinue={noop} onReply={noop} onRetry={noop} onDismiss={noop} onOpenReview={noop}
  {...overrides} />);

describe('the build panel above the message box', () => {
  it('shows a stopped build\'s saved recovery with every action the recovery panel has', () => {
    const blocked = build('blocked', 'The specialist reported a blocker: The scoped project file tool rejected replacement of src/App.tsx.');
    blocked.orchestration.recovery = { id: 'rec-1', runId: 'run-1', phase: 'waiting_for_user', category: 'project_code', code: 'task_project_code',
      summary: 'A tool stopped the task.', taskId: 't1', taskTitle: 'Add the login page', attemptsUsed: 1, repairBudget: 2, episodeNumber: 1, revision: 1,
      createdAt: '', updatedAt: '', availableActions: ['explain_failure', 'review_saved_changes', 'repair_and_continue', 'provide_guidance', 'keep_paused', 'cancel_build'], actionReasons: {} };
    const html = render({ build: blocked, threadId: 'thread-1' });
    for (const label of ['Explain issue', 'Retry failed step', 'Provide direction', 'Review saved changes', 'Keep paused', 'Cancel build']) expect(html).toContain(label);
    expect(html).not.toContain('>Tell the Orchestrator what to do<');
    expect(html.match(/Stop the build/g) ?? []).toHaveLength(0);
  });

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

  it('shows a refused start as its reason and buttons, never a raw API error', () => {
    const html = render({ build: build('awaiting_plan_approval'), onStartPlan: noop, error: 'API Error [409]: raw',
      refusal: { message: 'This plan cannot start yet: No task is assigned to selected repository acme/api.', actions: ['ask_orchestrator', 'open_plan', 'stop_plan'] } });
    expect(html).toContain('This plan cannot start yet: No task is assigned to selected repository acme/api.');
    expect(html).toContain('>Tell the Orchestrator what to do<');
    expect(html).toContain('>Open the plan<');
    expect(html.match(/>Stop plan</g)).toHaveLength(1);
    expect(html).not.toContain('API Error');
  });

  it('says what the Orchestrator changed when it fixed the plan before starting', () => {
    const html = render({ build: build('awaiting_plan_approval'), onStartPlan: noop,
      correction: { runId: 'run-1', planVersion: 2, changes: ['Removed "Check the API".', 'Added "Session check" in web.'] } });
    expect(html.replace(/<!-- -->/g, '')).toContain('The Orchestrator fixed the plan before it could start (v2). What changed:');
    expect(html).toContain('Removed &quot;Check the API&quot;.');
    expect(html).toContain('>Start plan<');
  });

  it('turns only a failed request with next steps into a refusal', () => {
    expect(buildRefusalFrom(new ApiRequestError(409, 'API Error [409]: This plan cannot start yet.', 'plan_needs_you', false, null, ['stop_plan'])))
      .toEqual({ message: 'This plan cannot start yet.', actions: ['stop_plan'] });
    expect(buildRefusalFrom(new ApiRequestError(500, 'API Error [500]: boom'))).toBeNull();
    expect(buildRefusalFrom(new Error('offline'))).toBeNull();
  });

  it('lets the person stop a plan waiting for approval, not only start it', () => {
    const html = render({ build: build('awaiting_plan_approval'), onStartPlan: noop });
    expect(html).toContain('>Stop plan<');
    expect(html).toContain('No code has changed. The plan is dropped.');
    expect(render({ build: build('awaiting_plan_approval'), onStartPlan: noop, canStop: false })).not.toContain('>Stop plan<');
  });

  it('folds a running build to its header, and keeps its stop button there', () => {
    const html = render({ build: build('executing') });
    expect(html).toContain('Build in progress');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Stop the build</button>');
    expect(html).not.toContain('Agents stop at the next safe point.</');
    expect(render({ build: build('executing'), stopArmed: true })).toContain('Click again to stop</button>');
    expect(render({ build: build('executing'), canStop: false })).not.toContain('Stop the build');
  });

  it('offers Start plan and Ask for changes on a plan waiting for approval', () => {
    const html = render({ build: build('awaiting_plan_approval'), onStartPlan: noop });
    expect(html).toContain('Plan ready for your approval');
    expect(html).toContain('>Start plan<');
    expect(html).toContain('>Ask for changes<');
    expect(html).not.toContain('tell Alpha in the main chat whether to start it');
    expect(html).not.toContain('Open the full plan');
    // The step track is on the Orchestrator bar now, not above the message box.
    expect(html).not.toContain('aria-label="Build steps"');
  });

  it('shows why a plan did not start, inline, next to its buttons', () => {
    const html = render({ build: build('awaiting_plan_approval'), onStartPlan: noop, error: 'The plan changed since you opened it. Refresh and try again.' });
    expect(html).toMatch(/role="alert"[^>]*>The plan changed since you opened it\. Refresh and try again\.</);
    expect(html).toContain('>Start plan<');
  });

  it('marks Start plan busy while it starts', () => {
    const html = render({ build: build('awaiting_plan_approval'), onStartPlan: noop, busy: 'start' });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Start plan/);
  });

  // A finished build's next step is a card under its message, not a panel over the message box.
  it('stays out of the way once the build is ready for review or publishing', () => {
    expect(render({ build: build('awaiting_approval') })).toBe('');
    expect(render({ build: build('publishing') })).toBe('');
  });

  it('offers milestone planning retry without treating it as final validation', () => {
    const stopped = build('blocked', 'Milestone planning stopped before dispatch: Provider unavailable');
    stopped.orchestration.tasks.forEach(task => { task.status = 'accepted'; });
    expect(continueChoice(stopped)).toMatchObject({ label: 'Retry milestone planning' });
    expect(continueChoice(stopped)?.action).toBeUndefined();
  });

  it('offers no retry when the working copy and its checkpoint are lost, and says why', () => {
    const reason = 'Build working copy lost: The org/api working copy is no longer connected to C:/projects/api. Stop this build and start a new one.';
    const lost = build('blocked', reason);
    expect(continueChoice(lost)).toBeNull();
    const html = render({ build: lost });
    expect(html).toContain('Stop this build and start a new one.');
    expect(html).not.toContain('Retry milestone planning');
    expect(html).not.toContain('Fix and continue');
  });

  it('shows why a blocked build stopped, and offers to fix and continue', () => {
    const html = render({ build: build('blocked', 'The login API contract is missing.') });
    expect(html).toContain('The build needs you');
    expect(html).toContain('The login API contract is missing.');
    expect(html).toContain('Fix and continue');
    expect(html).toContain('Tell the Orchestrator what to do');
  });

  it('does not offer to start a plan to a role that cannot', () => {
    const html = render({ build: build('awaiting_plan_approval'), canStart: false, onStartPlan: noop });
    expect(html).toContain('Your workspace role cannot start builds.');
    expect(html).not.toContain('>Start plan<');
    // Asking for changes is still a message, which the Orchestrator answers.
    expect(html).toContain('>Ask for changes<');
  });

  it('shows a working build as a one-line header, and labels every repository it touches', () => {
    const running = build('executing');
    running.orchestration.run.currentTaskId = 't2';
    running.orchestration.tasks.push({ ...running.orchestration.tasks[0], id: 't2', title: 'Add the login API', repository: 'acme/shop-be', ownerName: 'Backend Agent', status: 'running' });
    running.agents = [{ name: 'Backend Agent', state: 'running', currentTaskTitle: 'Add the login API' }] as unknown as ProjectLiveBuild['agents'];
    expect(buildRepositoriesLabel(running)).toBe('shop-fe, shop-be');
    const html = render({ build: running });
    expect(html).toContain('Build in progress');
    expect(html).not.toContain('aria-label="Build steps"');
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
    (stopped.orchestration as any).recovery = { id: 'rec-2', runId: 'run-1', phase: 'waiting_for_user', code: 'task_project_code', summary: 'The agent needs the API contract.', attemptsUsed: 1, repairBudget: 2, episodeNumber: 1, revision: 1, createdAt: '', updatedAt: '',
      category: 'project_code', availableActions: ['explain_failure', 'provide_guidance'], actionReasons: { repair_and_continue: 'Tell the agent where the contract is.' } };
    expect(continueChoice(stopped)).toBeNull();
    const html = render({ build: stopped });
    expect(html).not.toContain('Fix and continue');
    expect(html).toContain('Tell the agent where the contract is.');
  });
});

describe('a build kept from starting', () => {
  const failure = { messageId: 'm1', reason: 'Waiting for the existing blocked build using acme/shop-be.', request: 'Build the expense tasks' };

  it('names the build in the way and offers to stop it and plan this request', () => {
    const html = render({ failure: { ...failure, blocker: { runId: 'run-old', status: 'blocked', repository: 'acme/shop-be', issueIdentifier: 'PRO-108' } }, onStopBlocker: noop, onOpenBlocker: noop });
    expect(html).toContain('PRO-108 is using acme/shop-be');
    expect(html).toContain('Stop PRO-108 and plan this');
    expect(html).toContain('Open PRO-108');
    expect(html).toContain('Keep waiting');
    expect(html).not.toContain('Try again');
  });

  it('puts Dismiss in the header instead of among the choices', () => {
    const html = render({ failure });
    expect(html).toContain('aria-label="Dismiss"');
    expect(html).toContain('Try again');
    expect(html).not.toContain('>Dismiss<');
  });

  it('asks for a second click before stopping', () => {
    expect(render({ build: build('blocked', 'Waiting for you.') })).toContain('Stop the build');
    expect(render({ build: build('blocked', 'Waiting for you.'), stopArmed: true })).toContain('Click again to stop');
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
