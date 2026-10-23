import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });
vi.mock('@/features/live-build-room/OrchestrationWorkflowPanel', () => ({ ReviewDiff: () => null }));

import { ChatBuildWizard, buildRepositoriesLabel, planningFailureReason, wizardStepFor, type ChatBuildWizardProps } from './ChatBuildWizard';
import type { ProjectLiveBuild } from './useProjectLiveBuild';

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
  onStart={noop} onApprove={noop} onStop={noop} onContinue={noop} onReply={noop} onRetry={noop} onDismiss={noop} onOpenRoom={noop}
  {...overrides} />);

describe('the build panel above the message box', () => {
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

  it('asks for plan approval with numbered choices', () => {
    const html = render({ build: build('awaiting_plan_approval') });
    expect(html).toContain('Plan ready for your approval');
    expect(html).toContain('Add the login page');
    expect(html).toContain('Start planned work');
    expect(html).toContain('Stop and plan something else');
    expect(html).toMatch(/aria-current="step"[^>]*>.*Approve/);
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

  it('names the repository of the task being worked on, not only the first one', () => {
    const running = build('executing');
    running.orchestration.run.currentTaskId = 't2';
    running.orchestration.tasks.push({ ...running.orchestration.tasks[0], id: 't2', title: 'Add the login API', repository: 'acme/shop-be', ownerName: 'Backend Agent', status: 'running' });
    running.agents = [{ name: 'Backend Agent', state: 'running', currentTaskTitle: 'Add the login API' }] as unknown as ProjectLiveBuild['agents'];
    expect(buildRepositoriesLabel(running)).toBe('shop-fe, shop-be');
    const html = render({ build: running });
    expect(html).toContain('Add the login API · shop-be');
  });
});
