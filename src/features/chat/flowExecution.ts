import type { AgentCall } from '@/shared/types';
import type { FlowBuild } from './OrchestratorFlow';

/** Assignment history is not execution. Count each currently running agent once. */
export function runningFlowAgentCount(calls: Pick<AgentCall, 'id' | 'agentId' | 'status'>[], build?: FlowBuild | null): number {
  return new Set([
    ...calls.filter(call => call.status === 'running').map(call => call.agentId || call.id),
    ...(build?.running ? build.agents.filter(agent => agent.state === 'running').map(agent => agent.agentId) : [])
  ]).size;
}
