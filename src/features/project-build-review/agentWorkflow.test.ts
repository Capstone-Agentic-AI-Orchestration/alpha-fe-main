import { describe, expect, it } from 'vitest';
import type { ProjectBuildActivity, ProjectBuildAgentCard, ProjectBuildOrchestration, ProjectBuildSnapshot } from '@/shared/types';
import { layoutAgentHierarchy } from './agentWorkflowLayout';
import { describeAgentActivity, latestAgentAction } from './agentActivityPresentation';
import { agentActivityScope } from './agentActivityScope';
import { taskBranchGeometry, workflowPathSegments } from './workflowPaths';

function activity(id: string, detail: string, kind: ProjectBuildActivity['kind'] = 'tool'): ProjectBuildActivity {
  return { id, sequence: 1, kind, toolName: 'Bash', message: kind === 'tool' ? 'Running command' : 'Tool finished', detail, createdAt: '2026-10-24T08:00:00Z' };
}
function card(agentId: string, runId = agentId): ProjectBuildAgentCard {
  return { executionId: `run:${runId}`, runId, agentId, agentName: agentId, agentRole: 'Specialist', source: 'agent_run', sourceLabel: 'Build', status: 'running', progress: 0, currentTask: 'Assigned work', activity: [activity('command', `build-${runId}`)] };
}
function task(id: string, ownerAgentId: string, status: ProjectBuildOrchestration['tasks'][number]['status'] = 'pending'): ProjectBuildOrchestration['tasks'][number] {
  return { id, ownerAgentId, title: id, status, ownerName: ownerAgentId, description: '', kind: 'implementation', repository: 'app', assignmentReason: 'Assigned specialist', dependsOn: [], requirementIds: [], acceptanceCriteria: [], requiredChecks: [], scope: { includePaths: [], excludePaths: [] }, required: true, revision: 1, attemptCount: 0 };
}

describe('agent hierarchy', () => {
  it('keeps specialists on the same level when statuses, card order, and dependencies change', () => {
    const cards = [card('frontend'), card('backend'), card('qa')];
    const tasks = [task('ui', 'frontend'), task('api', 'backend'), task('verify', 'qa')];
    const expanded = new Set(['frontend']);
    const before = layoutAgentHierarchy(cards, tasks, expanded, 900);
    cards[0].status = 'completed';
    cards[1].status = 'running';
    tasks[1].dependsOn = ['ui'];
    const after = layoutAgentHierarchy([...cards].reverse(), tasks, expanded, 900);
    expect(after.positionedCards.map(({ card, x, y }) => [card.agentId, x, y])).toEqual(before.positionedCards.map(({ card, x, y }) => [card.agentId, x, y]));
    expect(new Set(after.positionedCards.map(item => item.y)).size).toBe(1);
  });

  it('expands every assigned task without the old three-task truncation or overlapping labels', () => {
    const tasks = Array.from({ length: 8 }, (_, i) => task(`task-${i}`, 'frontend'));
    const layout = layoutAgentHierarchy([card('frontend'), card('backend')], tasks, new Set(['frontend', 'backend']), 900);
    expect(layout.taskLeaves.filter(leaf => leaf.task)).toHaveLength(8);
    for (const leaf of layout.taskLeaves) {
      expect(leaf.x - 72).toBeGreaterThanOrEqual(0);
      expect(leaf.x + 72).toBeLessThanOrEqual(layout.width);
      expect(leaf.y + 100).toBeLessThan(layout.height);
      for (const other of layout.taskLeaves.filter(item => item !== leaf && item.y === leaf.y)) expect(Math.abs(leaf.x - other.x)).toBeGreaterThanOrEqual(158);
    }
    expect(layoutAgentHierarchy([card('frontend')], tasks, new Set(), 390).taskLeaves).toEqual([]);
  });

  it('connects task paths to the spheres and routes around names and preceding task rows', () => {
    const tasks = Array.from({ length: 8 }, (_, i) => task(`task-${i}`, 'frontend'));
    const layout = layoutAgentHierarchy([card('frontend'), card('backend')], tasks, new Set(['frontend', 'backend']), 900);
    const labels = [
      ...layout.positionedCards.map(node => ({ x: node.x, y: node.y, halfWidth: 102, height: 36 })),
      ...layout.taskLeaves.map(leaf => ({ x: leaf.x, y: leaf.y + 24, halfWidth: 72, height: 44 })),
    ];
    for (const leaf of layout.taskLeaves) {
      const parent = layout.positionedCards.find(node => node.card.executionId === leaf.card.executionId)!;
      const geometry = taskBranchGeometry(parent, leaf);
      expect(Math.hypot(geometry.start[0] - parent.x, geometry.start[1] - (parent.y - 40))).toBe(24);
      expect(geometry.end).toEqual([leaf.x, leaf.y - 15]);
      const segments = workflowPathSegments({ id: leaf.id, ...geometry, color: '#a78bfa', active: true, muted: false });
      for (const segment of segments) for (let step = 0; step <= 30; step++) {
        const t = step / 30, u = 1 - t;
        const point = [0, 1].map(axis => u ** 3 * segment.start[axis] + 3 * u ** 2 * t * segment.control1[axis] + 3 * u * t ** 2 * segment.control2[axis] + t ** 3 * segment.end[axis]);
        for (const label of labels) expect(point[0] > label.x - label.halfWidth && point[0] < label.x + label.halfWidth && point[1] > label.y && point[1] < label.y + label.height).toBe(false);
      }
    }
  });
});

describe('recorded commands', () => {
  it('reads actual shell commands and preserves the entire result payload', () => {
    expect(describeAgentActivity(activity('a', 'npm run build')).command).toBe('npm run build');
    const detail = JSON.stringify({ input: { command: 'npm test' }, stdout: '2 tests failed', exitCode: 1 });
    expect(describeAgentActivity(activity('b', detail, 'tool_result'))).toEqual({ command: 'npm test', exitCode: 1, detail, output: '2 tests failed' });
    expect(describeAgentActivity(activity('c', 'Tool finished', 'tool_result')).exitCode).toBeUndefined();
  });

  it('does not label file edits as shell commands, and chooses the latest action by timestamp', () => {
    const edit = { ...activity('edit', 'src/App.tsx'), toolName: 'Edit', kind: 'file_change' as const };
    expect(describeAgentActivity(edit).command).toBeUndefined();
    const agent = card('frontend');
    agent.activity = [{ ...edit, createdAt: '2026-10-24T08:05:00Z', message: 'Edited src/App.tsx' }, ...agent.activity];
    expect(latestAgentAction(agent).text).toBe('Edited src/App.tsx');
  });
});

describe('inspector activity scope', () => {
  const first = card('frontend', 'ui-run');
  const second = card('frontend', 'test-run');
  const previousBuild = card('frontend', 'previous-build');
  const snapshot = {
    agentCards: [first, second, previousBuild, card('backend')],
    orchestration: {
      tasks: [task('ui', 'frontend', 'accepted'), task('tests', 'frontend', 'running'), task('unstarted', 'frontend')],
      attempts: [
        { id: 'one', taskId: 'ui', agentId: 'frontend', prototypeRunId: first.runId, changedPaths: ['src/App.tsx'] },
        { id: 'two', taskId: 'tests', agentId: 'frontend', prototypeRunId: second.runId, changedPaths: ['src/App.test.tsx'] },
      ],
    },
  } as unknown as ProjectBuildSnapshot;

  it('includes all this build’s agent executions and excludes other builds and agents', () => {
    const scope = agentActivityScope(snapshot, second);
    expect(scope.activityCard.activity.map(event => event.detail)).toEqual(['build-test-run', 'build-ui-run']);
    expect(scope.activityCard.filePaths).toEqual(['src/App.tsx', 'src/App.test.tsx']);
  });

  it('isolates a task or producing run and leaves unstarted tasks empty', () => {
    expect(agentActivityScope(snapshot, second, 'ui').activityCard.activity.map(event => event.detail)).toEqual(['build-ui-run']);
    expect(agentActivityScope(snapshot, second, 'unstarted').activityCard.activity).toEqual([]);
    expect(agentActivityScope(snapshot, second, 'unstarted').activityCard.filePaths).toEqual([]);
    expect(agentActivityScope(snapshot, first, null, true).relatedCards).toEqual([first]);
  });
});
