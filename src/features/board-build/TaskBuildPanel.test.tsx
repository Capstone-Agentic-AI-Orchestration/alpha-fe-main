import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FeatureSpecRecord, Issue, ProjectBuildOrchestration } from '@/shared/types';

vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });

let role: 'dev' | 'pm' = 'dev';
let orchestration: ProjectBuildOrchestration | null = null;
vi.mock('@/app/AppContext', () => ({
  useApp: () => ({
    role,
    can: (capability: string) => role === 'dev' || !['run_builds', 'manage_chat'].includes(capability),
    startIssueBuild: vi.fn(),
    applySavedIssue: vi.fn()
  })
}));
vi.mock('@/shared/desktop', async importOriginal => ({ ...(await importOriginal<typeof import('@/shared/desktop')>()), isDesktop: true }));
vi.mock('@/features/chat/BuildReviewTab', () => ({ BuildReviewTab: () => <p>Build details content</p> }));
vi.mock('@/features/chat/ChatBuildBodies', () => ({ ReviewBody: () => null }));
vi.mock('@/features/chat/OrchestrationDeliveryPanel', () => ({ OrchestrationDeliveryPanel: () => <p>Delivery status</p> }));
vi.mock('@/features/chat/OrchestrationRecoveryPanel', () => ({ OrchestrationRecoveryPanel: () => <p>Recovery choices</p> }));
vi.mock('@/features/chat/useProjectLiveBuild', () => ({ buildAgentNodes: () => [] }));
vi.mock('./useTaskBuild', async importOriginal => ({
  ...(await importOriginal<typeof import('./useTaskBuild')>()),
  useTaskBuild: () => ({
    snapshot: orchestration ? { canControlOrchestration: true } : null,
    orchestration, loadError: '', refresh: vi.fn(), canControl: true, open: true, running: false
  }),
  useBuildConversation: () => ({ threadId: 'task-abc', messages: [], sending: false, error: '', privateToOwner: false, ask: vi.fn() })
}));

import { TaskBuildPanel } from './TaskBuildPanel';
import { FeatureSpecPanel } from './FeatureSpecPanel';

const issue: Issue = {
  id: 'i1', identifier: 'WEB-19', title: 'Empty states', description: 'Add them.', status: 'todo', priority: 'medium',
  projectId: 'p1', labels: ['alpha:epic'], comments: [], subtasks: [], createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z'
};

function build(status: ProjectBuildOrchestration['run']['status']): ProjectBuildOrchestration {
  return {
    run: { id: 'run-1', status, revision: 7, planVersion: 1, goal: 'Empty states', exclusions: ['No tour.'], repository: 'acme/web', createdAt: '', updatedAt: '' },
    requirements: [
      { id: 'REQ-1', description: 'An empty board explains tasks. Acceptance: (1) A heading shows.' },
      { id: 'REQ-2', description: 'The empty state offers to create a task. Acceptance: (1) The button opens the dialog.' }
    ],
    tasks: [{ id: 't1', title: 'Add the empty state component', description: '', kind: 'frontend', repository: 'acme/web', ownerName: 'Frontend Agent Fixture',
      assignmentReason: '', dependsOn: [], requirementIds: ['REQ-1', 'REQ-2'], acceptanceCriteria: [], requiredChecks: [], scope: { includePaths: [], excludePaths: [] },
      required: true, status: status === 'awaiting_plan_approval' ? 'pending' : 'accepted', revision: 1, attemptCount: 1 }],
    attempts: [{ id: 'a1', taskId: 't1', attemptNumber: 1, agentName: 'Frontend Agent Fixture', status: 'accepted', changedPaths: ['src/EmptyState.tsx'],
      report: { requirementCoverage: [{ requirementId: 'REQ-1', evidence: 'EmptyState renders the heading.' }], criteriaEvidence: [], deliverables: [], reportedChecks: [], blockers: [] } }],
    artifacts: [], findings: []
  } as unknown as ProjectBuildOrchestration;
}

const render = () => renderToStaticMarkup(
  <TaskBuildPanel issue={issue} build={{ issueId: 'i1', projectId: 'p1', runId: 'run-1', status: orchestration!.run.status, updatedAt: '' }}
    canStartBuild specState="approved" onPlanBuild={() => undefined} />
);

describe('task build panel', () => {
  it('shows the plan in plain steps with approve and change, without agent names', () => {
    orchestration = build('awaiting_plan_approval');
    const html = render();
    for (const shown of ['The plan is ready', 'Add the empty state component', 'Out of scope: No tour.', 'Approve plan and build', 'Revise plan', 'Plan', 'Approve', 'Pull request']) {
      expect(html).toContain(shown);
    }
    expect(html.replace(/Build details content/, '')).not.toContain('Frontend Agent Fixture');
  });

  it('offers review decisions with changed files and checklist evidence', () => {
    orchestration = build('awaiting_approval');
    orchestration.tasks.push({ ...orchestration.tasks[0], id: 'validation', kind: 'validation', title: 'Check current work' });
    orchestration.attempts.push({ ...orchestration.attempts[0], id: 'validation-result', taskId: 'validation' });
    const html = render();
    for (const shown of ['ready for your review', 'src/EmptyState.tsx', 'Approve and open pull request', 'Send back', '1 of 2 with evidence', 'EmptyState renders the heading.', 'An empty board explains tasks.']) {
      expect(html).toContain(shown);
    }
    expect(html).not.toContain('Acceptance: (1)');
  });
  it('does not count historical accepted attempts as current validation evidence', () => {
    orchestration = build('blocked');
    orchestration.attempts.push({ ...orchestration.attempts[0], id: 'new-failed-attempt', attemptNumber: 2, status: 'failed' });
    expect(render()).toContain('0 of 2 with evidence');
    expect(render()).not.toContain('Retry run');
  });

  it('hands a stopped build to the recovery choices', () => {
    orchestration = build('recovery_required');
    orchestration.recovery = { id: 'r1' } as ProjectBuildOrchestration['recovery'];
    expect(render()).toContain('Recovery choices');
  });

  it('keeps build details and build decisions away from roles that cannot run builds', () => {
    role = 'pm';
    try {
      orchestration = build('awaiting_plan_approval');
      const html = render();
      expect(html).not.toContain('Approve plan');
      expect(html).not.toContain('Build details');
      orchestration = build('awaiting_approval');
      expect(render()).not.toContain('Approve and open pull request');
      expect(render()).not.toContain('Send back');
    } finally {
      role = 'dev';
    }
  });
});

describe('feature spec panel', () => {
  const record = (over: Partial<FeatureSpecRecord> = {}): FeatureSpecRecord => ({
    issueId: 'i1', version: 1, status: 'draft', stale: false, updatedBy: 'maya', updatedAt: '',
    spec: {
      schemaVersion: 1, epicTitle: 'Empty states', summary: 'Developers see what to do next.',
      personas: [{ id: 'P1', name: 'Developer', goal: 'Start quickly.' }],
      journeys: [{ id: 'J1', personaId: 'P1', title: 'Open an empty board', steps: ['Open the project', 'Create the first task'] }],
      requirements: [{ id: 'REQ-1', behavior: 'An empty board explains tasks.', acceptanceCriteria: ['A heading shows.'], journeyIds: ['J1'] }],
      exclusions: [], openQuestions: ['Link to docs?']
    },
    ...over
  });
  const spec = (value: FeatureSpecRecord | null) => ({
    record: value, loaded: true, busy: null, error: '', reload: vi.fn(), draft: vi.fn(), revise: vi.fn(), save: vi.fn(), approve: vi.fn(), remove: vi.fn()
  }) as unknown as Parameters<typeof FeatureSpecPanel>[0]['spec'];

  it('shows personas, journeys and the checklist, and holds approval until questions are answered', () => {
    const html = renderToStaticMarkup(<FeatureSpecPanel issue={issue} spec={spec(record())} />);
    for (const shown of ['Draft', 'As a <span class="font-medium text-content">developer</span>, start quickly.', 'Open the project → Create the first task', 'REQ-1', 'Answer these before approving', 'Link to docs?']) {
      expect(html).toContain(shown);
    }
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*Approve spec/);
  });

  it('flags an approved spec that no longer matches the task', () => {
    const html = renderToStaticMarkup(<FeatureSpecPanel issue={issue} spec={spec(record({ status: 'approved', stale: true, spec: { ...record().spec, openQuestions: [] } }))} />);
    expect(html).toContain('Out of date');
    expect(html).toContain('approve it again before the next build');
  });
});
