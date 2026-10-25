import { describe, expect, it } from 'vitest';
import type { LiveBuildRoomSnapshot } from '@/shared/types';
import { buildAgentNodes, snapshotBelongsToThread } from './useProjectLiveBuild';

describe('chat build isolation', () => {
  it('only accepts build snapshots that identify the selected thread as their origin', () => {
    const snapshot = { orchestration: { run: { originChatThreadId: 'thread-a' } } } as any;
    expect(snapshotBelongsToThread(snapshot, 'thread-a')).toBe(true);
    expect(snapshotBelongsToThread(snapshot, 'thread-b')).toBe(false);
    expect(snapshotBelongsToThread({ orchestration: { run: {} } } as any, 'thread-a')).toBe(false);
    expect(snapshotBelongsToThread(snapshot)).toBe(true);
  });
});

describe('buildAgentNodes', () => {
  it('waits for a dispatch record before showing working and retains assignment boundaries', () => {
    const task = { id: 'api', title: 'API', status: 'running', ownerAgentId: 'backend', ownerName: 'Backend Agent',
      kind: 'backend', assignmentReason: 'Server expertise', repository: 'test/api',
      scope: { includePaths: ['src/**'], excludePaths: ['src/generated/**'] }, requiredChecks: ['test'], dependsOn: ['brief'] };
    const snapshot = { agentCards: [], orchestration: { tasks: [task], attempts: [] } } as any;
    expect(buildAgentNodes(snapshot)[0]).toMatchObject({ state: 'waiting', tasks: [{ id: 'api', assignmentReason: 'Server expertise', scope: task.scope, requiredChecks: ['test'], dependsOn: ['brief'] }] });
    snapshot.orchestration.attempts.push({ taskId: 'api', status: 'starting' });
    expect(buildAgentNodes(snapshot)[0].state).toBe('waiting');
    snapshot.orchestration.attempts[0] = { taskId: 'api', status: 'running', prototypeRunId: 'run-1' };
    expect(buildAgentNodes(snapshot)[0].state).toBe('running');
  });
  it('collects every file each agent changed, from its attempts, reports and live activity', () => {
    const snapshot = {
      agentCards: [{
        executionId: 'run-1', agentId: 'agent-frontend', agentName: 'Frontend Agent', agentRole: 'Frontend Agent',
        status: 'running', orchestrationTaskId: 'frontend', activity: [{ kind: 'file_change', paths: ['src/App.css'] }], filePaths: ['src/App.tsx']
      }],
      orchestration: {
        tasks: [
          { id: 'backend', title: 'API', status: 'accepted', ownerAgentId: 'agent-backend', ownerName: 'Backend Agent' },
          { id: 'frontend', title: 'UI', status: 'running', ownerAgentId: 'agent-frontend', ownerName: 'Frontend Agent' }
        ],
        attempts: [
          { id: 'a1', taskId: 'backend', status: 'accepted', changedPaths: ['src/transactions.ts', 'src/app.ts'], report: { deliverables: [{ paths: ['tests/unit/transactions.spec.ts'] }] } },
          { id: 'a2', taskId: 'backend', status: 'cancelled', changedPaths: ['src/abandoned.ts'] },
          { id: 'a3', taskId: 'frontend', status: 'running', changedPaths: ['src/App.tsx'] }
        ]
      }
    } as unknown as LiveBuildRoomSnapshot;

    const nodes = buildAgentNodes(snapshot);
    expect(nodes.find(node => node.agentId === 'agent-backend')?.changedFiles)
      .toEqual(['src/app.ts', 'src/transactions.ts', 'tests/unit/transactions.spec.ts']);
    expect(nodes.find(node => node.agentId === 'agent-frontend')?.changedFiles).toEqual(['src/App.css', 'src/App.tsx']);
  });
});



describe('stopped task history', () => {
  it('does not call a cancelled task done or discard its history', () => {
    const snapshot = { agentCards: [], orchestration: { tasks: [{ id: 't', title: 'Stopped', status: 'cancelled', ownerAgentId: 'a' }], attempts: [] } } as any;
    expect(buildAgentNodes(snapshot)[0]).toMatchObject({ state: 'waiting', tasks: [{ status: 'cancelled' }] });
  });
});
