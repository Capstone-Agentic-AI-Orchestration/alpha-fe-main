import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiService } from '@/shared/services/apiService';
import { runnerSocket } from '@/shared/services/runnerSocket';
import type { LiveBuildOrchestrationStatus, LiveBuildRoomAgentCard, LiveBuildRoomOrchestration, LiveBuildRoomSnapshot } from '@/shared/types';

/** Builds that still hold the project's repositories, so the chat bar keeps showing them. */
export const OPEN_BUILD_STATUSES: LiveBuildOrchestrationStatus[] = [
  'planning', 'awaiting_plan_approval', 'executing', 'paused', 'validating',
  'awaiting_approval', 'publishing', 'cancelling', 'blocked', 'recovery_required'
];
/** Builds with an agent or the Orchestrator actively doing work. */
export const RUNNING_BUILD_STATUSES: LiveBuildOrchestrationStatus[] = ['planning', 'executing', 'validating', 'publishing', 'cancelling'];

export type BuildAgentState = 'running' | 'waiting' | 'review' | 'completed' | 'failed';

export interface BuildAgentNode {
  agentId: string;
  name: string;
  role: string;
  state: BuildAgentState;
  /** The task this agent is on now, or its next one. */
  currentTaskTitle?: string;
  tasks: Array<{ id: string; title: string; status: string }>;
  /** Live execution for this agent in this build, once it has started. */
  card?: LiveBuildRoomAgentCard;
}

export interface ProjectLiveBuild {
  runId: string;
  status: LiveBuildOrchestrationStatus;
  revision: number;
  repository: string;
  goal: string;
  running: boolean;
  canControl: boolean;
  agents: BuildAgentNode[];
  /** The full plan, checks and findings, for decisions made from the chat. */
  orchestration: LiveBuildRoomOrchestration;
}

const EVENTS = [
  'stage_update', 'log_chunk', 'run_activity', 'run_started', 'run_completed', 'run_failed', 'run_cancelled',
  'agent_call.activity', 'orchestration_event'
];

function stateFor(statuses: string[]): BuildAgentState {
  if (statuses.some(status => status === 'running')) return 'running';
  if (statuses.some(status => status === 'failed' || status === 'blocked')) return 'failed';
  if (statuses.some(status => status === 'submitted')) return 'review';
  if (statuses.length && statuses.every(status => ['accepted', 'cancelled', 'superseded'].includes(status))) return 'completed';
  return 'waiting';
}

/** One node per agent the plan assigned work to, in the order they first appear in the plan. */
export function buildAgentNodes(snapshot: LiveBuildRoomSnapshot): BuildAgentNode[] {
  const orchestration = snapshot.orchestration;
  if (!orchestration) return [];
  const runIds = new Set(orchestration.attempts.map(attempt => attempt.prototypeRunId).filter(Boolean));
  const byAgent = new Map<string, BuildAgentNode>();
  for (const task of orchestration.tasks) {
    const agentId = task.ownerAgentId ?? task.ownerName;
    const node = byAgent.get(agentId) ?? { agentId, name: task.ownerName, role: '', state: 'waiting' as BuildAgentState, tasks: [] };
    node.tasks.push({ id: task.id, title: task.title, status: task.status });
    byAgent.set(agentId, node);
  }
  return [...byAgent.values()].map(node => {
    const cards = snapshot.agentCards
      .filter(card => card.agentId === node.agentId && ((card.runId && runIds.has(card.runId)) || node.tasks.some(task => task.id === card.orchestrationTaskId)))
      .sort((a, b) => Date.parse(b.updatedAt ?? '') - Date.parse(a.updatedAt ?? ''));
    const card = cards.find(item => item.status === 'running') ?? cards[0];
    const active = node.tasks.find(task => task.status === 'running' || task.status === 'submitted')
      ?? node.tasks.find(task => ['pending', 'ready', 'blocked', 'failed'].includes(task.status));
    return {
      ...node,
      name: card?.agentName ?? node.name,
      role: card?.agentRole ?? '',
      state: stateFor(node.tasks.map(task => task.status)),
      currentTaskTitle: active?.title,
      card
    };
  });
}

/**
 * The project's open Orchestrator build, kept live for the chat bar.
 *
 * It reads the same Live Build Room snapshot as the room itself, so a build
 * started from another conversation still shows here. Socket events refresh
 * it straight away; a short poll covers anything the socket missed.
 */
export function useProjectLiveBuild(projectId: string | undefined, enabled: boolean) {
  const [snapshot, setSnapshot] = useState<LiveBuildRoomSnapshot | null>(null);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!projectId || !enabled) return;
    const request = ++requestRef.current;
    try {
      const next = await apiService.getLiveBuildRoom(projectId);
      if (request === requestRef.current) setSnapshot(next);
    } catch {
      // A room that cannot load leaves the bar on the chat's own activity.
    }
  }, [enabled, projectId]);

  useEffect(() => {
    setSnapshot(null);
    if (!projectId || !enabled) return undefined;
    void refresh();
    let debounce: number | undefined;
    const schedule = () => {
      if (debounce !== undefined) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => void refresh(), 350);
    };
    const unsubs = EVENTS.map(event => runnerSocket.on(event, schedule));
    return () => {
      if (debounce !== undefined) window.clearTimeout(debounce);
      unsubs.forEach(unsub => unsub());
    };
  }, [enabled, projectId, refresh]);

  const status = snapshot?.orchestration?.run.status;
  const open = Boolean(status && OPEN_BUILD_STATUSES.includes(status));
  const running = Boolean(status && RUNNING_BUILD_STATUSES.includes(status));

  useEffect(() => {
    if (!projectId || !enabled) return undefined;
    const timer = window.setTimeout(() => void refresh(), running ? 2_500 : open ? 8_000 : 30_000);
    return () => window.clearTimeout(timer);
  }, [enabled, open, projectId, refresh, running, snapshot]);

  // Stream tool output for agents that are working right now.
  const liveRunIds = useMemo(() => (snapshot?.agentCards ?? [])
    .filter(card => card.status === 'running' && card.runId)
    .map(card => card.runId!)
    .sort(), [snapshot]);
  const liveRunKey = liveRunIds.join(',');
  useEffect(() => {
    liveRunIds.forEach(runId => runnerSocket.subscribeToRunStream(runId));
    return () => liveRunIds.forEach(runId => runnerSocket.unsubscribeFromRunStream(runId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRunKey]);

  const build = useMemo<ProjectLiveBuild | null>(() => {
    const orchestration = snapshot?.orchestration;
    if (!snapshot || !orchestration || !open) return null;
    return {
      runId: orchestration.run.id,
      status: orchestration.run.status,
      revision: orchestration.run.revision,
      repository: orchestration.run.repository,
      goal: orchestration.run.goal,
      running,
      canControl: Boolean(snapshot.canControlOrchestration ?? snapshot.canRun),
      agents: buildAgentNodes(snapshot),
      orchestration
    };
  }, [open, running, snapshot]);

  return { build, refresh };
}

const STATUS_LABEL: Partial<Record<LiveBuildOrchestrationStatus, string>> = {
  planning: 'Planning the build',
  awaiting_plan_approval: 'Plan waiting for your approval',
  executing: 'Building',
  paused: 'Build paused',
  validating: 'Checking the build',
  awaiting_approval: 'Ready for your review',
  publishing: 'Publishing',
  cancelling: 'Stopping the build',
  blocked: 'Build needs you',
  recovery_required: 'Build needs you'
};

export function buildStatusLabel(build: ProjectLiveBuild): string {
  const running = build.agents.find(agent => agent.state === 'running');
  if (build.status === 'executing' && running) return running.name + ' is working';
  return STATUS_LABEL[build.status] ?? build.status.replace(/_/g, ' ');
}

