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
  tasks: Array<{ id: string; title: string; status: string; kind?: string; assignmentReason?: string;
    repository?: string; scope?: { includePaths: string[]; excludePaths: string[] }; requiredChecks?: string[]; dependsOn?: string[] }>;
  /** Live execution for this agent in this build, once it has started. */
  card?: LiveBuildRoomAgentCard;
  /** Every file this agent changed in this build, across its tasks and attempts. */
  changedFiles: string[];
  audits?: import('@/shared/types').DependencyAuditSummary[];
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

export function needsSecurityAuditPlan(build: ProjectLiveBuild | null): boolean {
  return build?.status === 'blocked' && /audit|vulnerab/i.test(build.orchestration.run.stoppedReason ?? '') &&
    /dependency|package|npm/i.test(build.orchestration.run.stoppedReason ?? '') &&
    !build.orchestration.tasks.some(task => task.required && task.dependencyAudit?.purpose === 'baseline');
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

/** Work passed from one agent to another: a task that waits on a task a different agent owns. */
export interface BuildHandoff {
  fromAgentId: string;
  toAgentId: string;
  /** active: the receiver is working on it now; done: the receiving task is accepted. */
  state: 'pending' | 'active' | 'done';
}

const HANDOFF_RANK: Record<BuildHandoff['state'], number> = { pending: 0, done: 1, active: 2 };

/** Who hands work to whom in this build, one entry per pair of agents, read from the plan's dependencies. */
export function buildHandoffs(orchestration: Pick<LiveBuildRoomOrchestration, 'tasks'>): BuildHandoff[] {
  const byId = new Map(orchestration.tasks.map(task => [task.id, task]));
  const pairs = new Map<string, BuildHandoff>();
  for (const task of orchestration.tasks) {
    if (!task.ownerAgentId || ['cancelled', 'superseded'].includes(task.status)) continue;
    for (const dependencyId of task.dependsOn) {
      const from = byId.get(dependencyId)?.ownerAgentId;
      if (!from || from === task.ownerAgentId) continue;
      const state: BuildHandoff['state'] = ['running', 'submitted'].includes(task.status) ? 'active' : task.status === 'accepted' ? 'done' : 'pending';
      const key = from + '>' + task.ownerAgentId;
      const existing = pairs.get(key);
      if (!existing || HANDOFF_RANK[state] > HANDOFF_RANK[existing.state]) pairs.set(key, { fromAgentId: from, toAgentId: task.ownerAgentId, state });
    }
  }
  return [...pairs.values()];
}

/** One node per agent the plan assigned work to, in the order they first appear in the plan. */
export function buildAgentNodes(snapshot: LiveBuildRoomSnapshot): BuildAgentNode[] {
  const orchestration = snapshot.orchestration;
  if (!orchestration) return [];
  const runIds = new Set(orchestration.attempts.map(attempt => attempt.prototypeRunId).filter(Boolean));
  const byAgent = new Map<string, BuildAgentNode>();
  for (const task of orchestration.tasks) {
    const agentId = task.ownerAgentId ?? task.ownerName;
    const node = byAgent.get(agentId) ?? { agentId, name: task.ownerName, role: '', state: 'waiting' as BuildAgentState, tasks: [], changedFiles: [] };
    node.tasks.push({ id: task.id, title: task.title, status: task.status, kind: task.kind,
      assignmentReason: task.assignmentReason, repository: task.repository, scope: task.scope,
      requiredChecks: task.requiredChecks, dependsOn: task.dependsOn });
    byAgent.set(agentId, node);
  }
  return [...byAgent.values()].map(node => {
    const cards = snapshot.agentCards
      .filter(card => card.agentId === node.agentId && ((card.runId && runIds.has(card.runId)) || node.tasks.some(task => task.id === card.orchestrationTaskId)))
      .sort((a, b) => Date.parse(b.updatedAt ?? '') - Date.parse(a.updatedAt ?? ''));
    const card = cards.find(item => item.status === 'running') ?? cards[0];
    const active = node.tasks.find(task => task.status === 'running' || task.status === 'submitted')
      ?? node.tasks.find(task => ['pending', 'ready', 'blocked', 'failed'].includes(task.status));
    const taskIds = new Set(node.tasks.map(task => task.id));
    const changedFiles = [...new Set([
      ...orchestration.attempts
        .filter(attempt => taskIds.has(attempt.taskId) && attempt.status !== 'cancelled')
        .flatMap(attempt => [
          ...(attempt.changedPaths ?? []),
          ...(attempt.report?.deliverables ?? []).flatMap(deliverable => deliverable.paths ?? [])
        ]),
      ...cards.flatMap(item => [
        ...(item.filePaths ?? []),
        ...item.activity.filter(entry => entry.kind === 'file_change').flatMap(entry => entry.paths ?? [])
      ])
    ].filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return {
      ...node,
      name: card?.agentName ?? node.name,
      role: card?.agentRole ?? '',
      state: stateFor(node.tasks.map(task => task.status === 'running' &&
        !orchestration.attempts.some(attempt => attempt.taskId === task.id && attempt.prototypeRunId && attempt.status === 'running') &&
        !cards.some(item => item.orchestrationTaskId === task.id && item.status === 'running') ? 'ready' : task.status)),
      currentTaskTitle: active?.title,
      audits: orchestration.attempts.filter(attempt => taskIds.has(attempt.taskId)).flatMap(attempt => attempt.dependencyAudits ?? []),
      card,
      changedFiles
    };
  });
}

/** Fail closed if an old or malformed room response does not belong to this chat. */
export function snapshotBelongsToThread(snapshot: LiveBuildRoomSnapshot | null, threadId?: string | null): boolean {
  return !threadId || snapshot?.orchestration?.run.originChatThreadId === threadId;
}

/** The originating chat's open Orchestrator build, kept live for its chat bar. */
export function useProjectLiveBuild(projectId: string | undefined, enabled: boolean, threadId?: string | null) {
  const scopeKey = `${projectId ?? ''}:${threadId ?? ''}`;
  const [loaded, setLoaded] = useState<{ key: string; snapshot: LiveBuildRoomSnapshot } | null>(null);
  // A thread switch hides the previous response synchronously, before effects run.
  const snapshot = loaded?.key === scopeKey ? loaded.snapshot : null;
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!projectId || !enabled) return;
    const request = ++requestRef.current;
    try {
      const next = await apiService.getLiveBuildRoom(projectId, undefined, threadId ?? undefined);
      if (request === requestRef.current) setLoaded({ key: scopeKey, snapshot: next });
    } catch {
      // A room that cannot load leaves the bar on the chat's own activity.
    }
  }, [enabled, projectId, scopeKey, threadId]);

  useEffect(() => {
    setLoaded(null);
    if (!projectId || !enabled) return undefined;
    void refresh();
    let debounce: number | undefined;
    const schedule = () => {
      if (debounce !== undefined) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => void refresh(), 350);
    };
    const unsubs = EVENTS.map(event => runnerSocket.on(event, schedule));
    return () => {
      requestRef.current += 1;
      if (debounce !== undefined) window.clearTimeout(debounce);
      unsubs.forEach(unsub => unsub());
    };
  }, [enabled, projectId, refresh, scopeKey]);

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
    if (!snapshot || !orchestration || !open || !snapshotBelongsToThread(snapshot, threadId)) return null;
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
  }, [open, running, snapshot, threadId]);

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

