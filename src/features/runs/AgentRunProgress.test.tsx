import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PrototypeRun } from '@/shared/types';

vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });

const run: PrototypeRun = {
  id: 'run-1',
  issueId: 'issue-1',
  projectId: 'p1',
  agentId: 'a1',
  status: 'awaiting_approval',
  plan: [],
  currentStageIndex: 0,
  stages: [{ id: 'tests', label: 'Running tests', description: 'Testing', status: 'success', logs: ['RAW-LOG-LINE only in the stage log'] }],
  activities: [{ id: 'run-1:activity:0', sequence: 0, kind: 'tool', message: 'Ran the test suite', createdAt: '2026-10-31T01:00:00Z' }],
  testSummary: '12 tests passed',
  changedFiles: 3,
  insertions: 40,
  deletions: 7,
  createdAt: '2026-10-31T01:00:00Z',
  updatedAt: '2026-10-31T01:05:00Z'
} as PrototypeRun;

vi.mock('@/app/AppContext', () => ({
  useApp: () => ({
    prototypeRuns: [run],
    cancelPrototypeRun: vi.fn(),
    retryPrototypeRun: vi.fn(),
    setActiveTab: vi.fn(),
    setNotificationPanelOpen: vi.fn()
  })
}));
vi.mock('@/features/runs/RemoteActivity', () => ({ RemoteActivity: () => null }));
vi.mock('@/features/runs/HostingApprovals', () => ({ HostingApprovals: () => null }));
vi.mock('@/shared/services/runnerSocket', () => ({ runnerSocket: { subscribeToRunStream: vi.fn(), unsubscribeFromRunStream: vi.fn() } }));

import { AgentRunProgress } from './AgentRunProgress';

describe('Agent run panel', () => {
  it('shows the outcome without repeating the raw log', () => {
    const html = renderToStaticMarkup(<AgentRunProgress issueId="issue-1" />);
    expect(html).toContain('Ran the test suite');
    expect(html).toContain('12 tests passed');
    expect(html).toContain('across 3 files');
    expect(html).not.toContain('Run details');
    expect(html).not.toContain('RAW-LOG-LINE');
  });
});
