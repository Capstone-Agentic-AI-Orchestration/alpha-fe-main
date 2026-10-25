import { describe, expect, it } from 'vitest';
import { runningFlowAgentCount } from './flowExecution';
import type { FlowBuild } from './OrchestratorFlow';
const build = (running: boolean, states: string[]) => ({ running, agents: states.map((state, index) => ({ agentId: 'agent-' + index, state })) } as FlowBuild);
describe('flow execution count', () => {
  it('does not present cancelled build assignments or completed calls as running', () => {
    expect(runningFlowAgentCount([{ id: 'old', agentId: 'agent-0', status: 'completed' }], build(false, ['completed', 'ready']))).toBe(0);
    expect(runningFlowAgentCount([], build(false, ['running', 'failed']))).toBe(0);
  });
  it('counts actual execution, including the coordinator, and deduplicates overlapping records', () => {
    expect(runningFlowAgentCount([
      { id: 'call', agentId: 'agent-0', status: 'running' },
      { id: 'coordinator', agentId: 'alpha', status: 'running' },
      { id: 'queued', agentId: 'agent-2', status: 'queued' }
    ], build(true, ['running', 'running', 'ready']))).toBe(3);
  });
  it('resets when execution ends and waits for a confirmed running record to count again', () => {
    expect(runningFlowAgentCount([], build(true, ['running']))).toBe(1);
    expect(runningFlowAgentCount([], build(false, ['completed']))).toBe(0);
    expect(runningFlowAgentCount([], build(true, ['ready']))).toBe(0);
    expect(runningFlowAgentCount([], build(true, ['running']))).toBe(1);
  });
});
