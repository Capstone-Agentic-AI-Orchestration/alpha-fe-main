import { describe, expect, it } from 'vitest';
import type { LiveBuildRoomSnapshot } from '@/shared/types';
import { buildAgentNodes } from './useProjectLiveBuild';

describe('buildAgentNodes', () => {
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

