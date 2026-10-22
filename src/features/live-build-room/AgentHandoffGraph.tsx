import React, { Suspense, lazy, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock3, Code2, Minus, Plus, RadioTower, Scan, ShieldAlert } from 'lucide-react';
import type {
  LiveBuildRoomAgentCard,
  LiveBuildRoomHandoff,
  LiveBuildRoomOrchestration,
} from '@/shared/types';
import type { WorkflowCurveConnection } from './AgentWorkflowScene3D';
import { supportsWebGL } from '@/features/chat/orchestratorSceneLayout';

const AgentWorkflowScene3D = lazy(() => import('./AgentWorkflowScene3D').then(module => ({ default: module.AgentWorkflowScene3D })));

type WorkflowTask = LiveBuildRoomOrchestration['tasks'][number];
type EdgeState = 'complete' | 'active' | 'pending' | 'attention';

interface AgentHandoffGraphProps {
  cards: LiveBuildRoomAgentCard[];
  allAgentCount: number;
  workflow?: LiveBuildRoomOrchestration | null;
  handoffs: LiveBuildRoomHandoff[];
  selectedExecutionId?: string | null;
  selectedConnectionId?: string | null;
  visible?: boolean;
  onSelect: (card: LiveBuildRoomAgentCard, trigger: HTMLButtonElement) => void;
  onSelectConnection?: (selection: WorkflowConnectionSelection, trigger: HTMLElement) => void;
  onSelectOrchestrator?: (trigger: HTMLButtonElement) => void;
  onClearFilters?: () => void;
}

interface WorkflowEdge {
  id: string;
  fromExecutionId: string;
  toExecutionId: string;
  state: EdgeState;
  feedback?: boolean;
  handoffId?: string;
  taskId?: string;
}

interface EdgeGeometry {
  id: string;
  start: [number, number];
  control1: [number, number];
  control2: [number, number];
  end: [number, number];
}

export interface WorkflowConnectionSelection {
  id: string;
  kind: 'orchestrator' | 'handoff' | 'dependency';
  fromExecutionId?: string;
  toExecutionId: string;
  handoffId?: string;
  taskId?: string;
  feedback?: boolean;
}

const edgeTone: Record<EdgeState, { stroke: string }> = {
  complete: { stroke: '#34d399' },
  active: { stroke: '#a78bfa' },
  pending: { stroke: '#64748b' },
  attention: { stroke: '#fbbf24' },
};

class WorkflowSceneBoundary extends React.Component<{ onError: () => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

const Workflow2DFallback: React.FC<{
  graphId: string;
  width: number;
  height: number;
  connections: WorkflowCurveConnection[];
  reduceMotion: boolean;
  onSelect: (id: string) => void;
}> = ({ graphId, width, height, connections, reduceMotion, onSelect }) => (
  <>
    <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>{connections.map((connection, index) => <marker key={connection.id} id={`${graphId}-arrow-${index}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M 0 0 L 8 4 L 0 8 Z" fill={connection.color} />
      </marker>)}</defs>
      {connections.map((connection, index) => {
        const d = `M ${connection.start[0]} ${connection.start[1]} C ${connection.control1[0]} ${connection.control1[1]}, ${connection.control2[0]} ${connection.control2[1]}, ${connection.end[0]} ${connection.end[1]}`;
        return <g key={connection.id}>
          <path d={d} fill="none" stroke={connection.color} strokeWidth={connection.selected ? 2.5 : connection.active ? 2 : 1.3} strokeDasharray={connection.feedback || connection.muted ? '5 7' : undefined} opacity={connection.muted ? 0.45 : connection.active || connection.selected ? 0.9 : 0.62} markerEnd={`url(#${graphId}-arrow-${index})`} />
          <path d={d} fill="none" stroke="transparent" strokeWidth="16" pointerEvents="stroke" className="pointer-events-auto cursor-pointer" onClick={event => { event.stopPropagation(); onSelect(connection.id); }} />
          {connection.active && !reduceMotion && <circle r="3.2" fill="#f5f3ff">
            <animateMotion dur="2.4s" repeatCount="indefinite" path={d} />
          </circle>}
        </g>;
      })}
    </svg>
    <div className="sr-only" role="status">3D graphics are unavailable. Use the workflow connection list to inspect handoffs.</div>
  </>
);

function cardToneColor(card: LiveBuildRoomAgentCard): string {
  if (card.status === 'completed') return '#34d399';
  if (card.status === 'running') return '#a78bfa';
  if (card.status === 'review') return '#fbbf24';
  if (card.status === 'failed') return '#fb7185';
  if (card.status === 'waiting') return '#60a5fa';
  return '#94a3b8';
}

function dependencyState(fromTask: WorkflowTask, toTask: WorkflowTask, toCard: LiveBuildRoomAgentCard): EdgeState {
  if (['failed', 'blocked'].includes(fromTask.status) || ['failed', 'blocked'].includes(toTask.status)) return 'attention';
  if (!toCard.isStale && (toCard.status === 'running' || toTask.status === 'running' || toTask.status === 'submitted')) return 'active';
  if (fromTask.status === 'accepted' && toTask.status === 'accepted') return 'complete';
  return 'pending';
}

function taskState(task: WorkflowTask, card: LiveBuildRoomAgentCard): EdgeState {
  if (['failed', 'blocked'].includes(task.status) || card.status === 'failed') return 'attention';
  if (!card.isStale && (card.status === 'running' || task.status === 'running' || task.status === 'submitted')) return 'active';
  if (task.status === 'accepted') return 'complete';
  return 'pending';
}

function handoffMatchesCards(handoff: LiveBuildRoomHandoff, cards: LiveBuildRoomAgentCard[]): boolean {
  return cards.some(card =>
    card.executionId === handoff.executionId ||
    Boolean(handoff.agentCallId && card.agentCallId === handoff.agentCallId) ||
    Boolean(handoff.squadRunId && card.squadRunId === handoff.squadRunId)
  );
}

function buildEdges(
  cards: LiveBuildRoomAgentCard[],
  workflow: LiveBuildRoomOrchestration | null | undefined,
  handoffs: LiveBuildRoomHandoff[],
): WorkflowEdge[] {
  const cardForTask = (taskId: string, agentId?: string) =>
    cards.find(card => card.orchestrationTaskId === taskId) ??
    (agentId ? cards.find(card => card.agentId === agentId) : undefined);
  const edges: WorkflowEdge[] = [];
  const seen = new Set<string>();
  const add = (edge: WorkflowEdge) => {
    if (edge.fromExecutionId === edge.toExecutionId) return;
    const key = `${edge.fromExecutionId}->${edge.toExecutionId}:${edge.feedback ? 'feedback' : 'handoff'}`;
    if (seen.has(key)) {
      const previous = edges.find(item => item.fromExecutionId === edge.fromExecutionId && item.toExecutionId === edge.toExecutionId && Boolean(item.feedback) === Boolean(edge.feedback));
      if (previous && edge.handoffId) previous.handoffId = edge.handoffId;
      if (previous && edge.taskId && !previous.taskId) previous.taskId = edge.taskId;
      return;
    }
    seen.add(key);
    edges.push(edge);
  };

  const latestHandoffByPair = new Map<string, LiveBuildRoomHandoff>();
  const cardByAgent = new Map(cards.map(card => [card.agentId, card]));
  for (const handoff of handoffs) {
    if (!handoff.fromAgentId || !handoff.toAgentId) continue;
    const fromCard = cardByAgent.get(handoff.fromAgentId);
    const toCard = cardByAgent.get(handoff.toAgentId);
    if (!fromCard || !toCard) continue;
    const key = `${fromCard.executionId}->${toCard.executionId}`;
    const previous = latestHandoffByPair.get(key);
    if (!previous || Date.parse(handoff.createdAt) > Date.parse(previous.createdAt)) latestHandoffByPair.set(key, handoff);
  }

  if (workflow) {
    const taskById = new Map(workflow.tasks.map(task => [task.id, task]));
    for (const task of workflow.tasks) {
      const toCard = task.ownerAgentId ? cardForTask(task.id, task.ownerAgentId) : undefined;
      if (!toCard) continue;
      for (const dependencyId of task.dependsOn) {
        const dependency = taskById.get(dependencyId);
        if (!dependency?.ownerAgentId) continue;
        const fromCard = cardForTask(dependency.id, dependency.ownerAgentId);
        if (!fromCard) continue;
        add({
          id: `dependency-${dependency.id}-${task.id}`,
          fromExecutionId: fromCard.executionId,
          toExecutionId: toCard.executionId,
          state: dependencyState(dependency, task, toCard),
          handoffId: latestHandoffByPair.get(`${fromCard.executionId}->${toCard.executionId}`)?.id,
          taskId: task.id,
        });
      }
    }

    // A review correction is a real return handoff. Keep it out of the layout
    // ranking so the feedback arrow does not turn the directed plan into a loop.
    for (const correction of workflow.tasks.filter(task => task.correctionOfTaskId && task.ownerAgentId)) {
      const reviewedTask = taskById.get(correction.correctionOfTaskId!);
      if (!reviewedTask?.ownerAgentId) continue;
      const reviewerTask = workflow.tasks.find(task =>
        task.ownerAgentId && task.ownerAgentId !== reviewedTask.ownerAgentId && task.dependsOn.includes(reviewedTask.id));
      if (!reviewerTask?.ownerAgentId) continue;
      const reviewerCard = cardForTask(reviewerTask.id, reviewerTask.ownerAgentId);
      const correctionCard = cardForTask(correction.id, correction.ownerAgentId);
      if (!reviewerCard || !correctionCard) continue;
      add({
        id: `correction-${reviewerTask.id}-${correction.id}`,
        fromExecutionId: reviewerCard.executionId,
        toExecutionId: correctionCard.executionId,
        state: taskState(correction, correctionCard),
        feedback: true,
        handoffId: latestHandoffByPair.get(`${reviewerCard.executionId}->${correctionCard.executionId}`)?.id,
        taskId: correction.id,
      });
    }
  }

  for (const [key, handoff] of latestHandoffByPair) {
    const [fromExecutionId, toExecutionId] = key.split('->');
    const target = cards.find(card => card.executionId === toExecutionId);
    add({
      id: `handoff-${handoff.id}`,
      fromExecutionId,
      toExecutionId,
      state: target?.status === 'running' && !target.isStale ? 'active' : target?.status === 'failed' ? 'attention' : target?.status === 'waiting' || target?.status === 'idle' || target?.isStale ? 'pending' : 'complete',
      handoffId: handoff.id,
      taskId: target?.orchestrationTaskId,
    });
  }

  return edges;
}

function buildLayers(cards: LiveBuildRoomAgentCard[], edges: WorkflowEdge[], workflow?: LiveBuildRoomOrchestration | null) {
  if (!cards.length) return [] as LiveBuildRoomAgentCard[][];
  const cardOrder = new Map(cards.map((card, index) => [card.executionId, index]));
  const normalEdges = edges.filter(edge => !edge.feedback);
  const incoming = new Map(cards.map(card => [card.executionId, 0]));
  const outgoing = new Map(cards.map(card => [card.executionId, [] as string[]]));
  for (const edge of normalEdges) {
    if (!incoming.has(edge.fromExecutionId) || !incoming.has(edge.toExecutionId)) continue;
    outgoing.get(edge.fromExecutionId)!.push(edge.toExecutionId);
    incoming.set(edge.toExecutionId, incoming.get(edge.toExecutionId)! + 1);
  }

  const queue = cards.filter(card => incoming.get(card.executionId) === 0).map(card => card.executionId);
  const level = new Map(cards.map(card => [card.executionId, 0]));
  const visited = new Set<string>();
  while (queue.length) {
    const from = queue.shift()!;
    if (visited.has(from)) continue;
    visited.add(from);
    for (const to of outgoing.get(from) ?? []) {
      level.set(to, Math.max(level.get(to) ?? 0, (level.get(from) ?? 0) + 1));
      incoming.set(to, incoming.get(to)! - 1);
      if (incoming.get(to) === 0) queue.push(to);
    }
  }

  const planOrder = new Map<string, number>();
  workflow?.tasks.forEach((task, index) => {
    if (task.ownerAgentId && !planOrder.has(task.ownerAgentId)) planOrder.set(task.ownerAgentId, index);
  });
  const maxLevel = Math.max(0, ...cards.map(card => level.get(card.executionId) ?? 0));
  const layers = Array.from({ length: maxLevel + 1 }, () => [] as LiveBuildRoomAgentCard[]);
  for (const card of cards) layers[level.get(card.executionId) ?? 0].push(card);
  layers.forEach(layer => layer.sort((left, right) => {
    const planDelta = (planOrder.get(left.agentId) ?? Number.MAX_SAFE_INTEGER) - (planOrder.get(right.agentId) ?? Number.MAX_SAFE_INTEGER);
    return planDelta || (cardOrder.get(left.executionId) ?? 0) - (cardOrder.get(right.executionId) ?? 0);
  }));
  return layers;
}

const AgentNode: React.FC<{
  card: LiveBuildRoomAgentCard;
  handoffs: LiveBuildRoomHandoff[];
  selected: boolean;
  onSelect: (trigger: HTMLButtonElement) => void;
  setNodeRef: (executionId: string, node: HTMLButtonElement | null) => void;
  style?: React.CSSProperties;
}> = ({ card, handoffs, selected, onSelect, setNodeRef, style }) => {
  const latestActivity = card.activity.at(-1);
  const tone = card.status === 'completed'
    ? { border: 'border-emerald-400/35', text: 'text-emerald-200', dot: 'bg-emerald-300', icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Complete' }
    : card.status === 'running'
      ? { border: 'border-violet-300/55', text: 'text-violet-100', dot: 'bg-violet-300', icon: <RadioTower className="h-3.5 w-3.5" />, label: 'Running' }
      : card.status === 'review'
        ? { border: 'border-amber-300/40', text: 'text-amber-100', dot: 'bg-amber-300', icon: <ShieldAlert className="h-3.5 w-3.5" />, label: 'Review' }
        : card.status === 'failed'
          ? { border: 'border-rose-300/40', text: 'text-rose-100', dot: 'bg-rose-300', icon: <ShieldAlert className="h-3.5 w-3.5" />, label: 'Failed' }
          : card.status === 'waiting'
            ? { border: 'border-sky-300/30', text: 'text-sky-100', dot: 'bg-sky-300', icon: <Clock3 className="h-3.5 w-3.5" />, label: 'Waiting' }
            : { border: 'border-white/10', text: 'text-slate-300', dot: 'bg-slate-500', icon: <Clock3 className="h-3.5 w-3.5" />, label: 'Ready' };
  const latestInbound = handoffs.filter(handoff => handoff.toAgentId === card.agentId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  const latestOutbound = handoffs.filter(handoff => handoff.fromAgentId === card.agentId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  const inboundAt = Date.parse(latestInbound?.createdAt ?? '') || 0;
  const outboundAt = Date.parse(latestOutbound?.createdAt ?? '') || 0;
  const latestActivityAt = Date.parse(latestActivity?.createdAt ?? '') || 0;
  const receivingContext = inboundAt > 0 && inboundAt >= outboundAt && inboundAt >= latestActivityAt && (card.status === 'running' || card.status === 'waiting');
  const handingOff = outboundAt > 0 && outboundAt > inboundAt && outboundAt >= latestActivityAt && (card.status === 'running' || card.status === 'waiting');
  const stateTone = receivingContext
    ? { ...tone, border: 'border-sky-300/40', text: 'text-sky-100', dot: 'bg-sky-300', label: 'Receiving context' }
    : handingOff
      ? { ...tone, border: 'border-cyan-300/40', text: 'text-cyan-100', dot: 'bg-cyan-300', label: 'Handing off' }
      : tone;

  return (
    <button
      ref={node => setNodeRef(card.executionId, node)}
      type="button"
      onClick={event => onSelect(event.currentTarget)}
      aria-pressed={selected}
      title={`Inspect ${card.agentName} · ${card.currentTask}`}
      style={style}
      className={`agent-flow-node group absolute z-20 flex min-h-[174px] min-w-0 flex-col rounded-2xl border bg-surface-100/95 p-3.5 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 ${stateTone.border} ${selected ? 'border-violet-300/80 bg-[#211a32] shadow-[0_0_30px_rgba(139,92,246,0.2)] ring-1 ring-violet-300/50' : 'hover:bg-surface-100'} ${card.status === 'running' && !card.isStale ? 'agent-flow-node--running' : ''}`}
    >
      <span className="flex min-w-0 items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-violet-400/10 text-violet-100" style={{ backgroundColor: `${card.color || '#8b5cf6'}22` }}>
            {card.avatar ? <img src={card.avatar} alt="" className="h-full w-full object-cover" /> : <Code2 className="h-4 w-4" />}
          </span>
          <span className="min-w-0">
            <span className="block break-words text-[13px] font-semibold leading-[18px] text-white [overflow-wrap:anywhere]">{card.agentName}</span>
            <span className="mt-0.5 block truncate text-[10px] text-slate-500">{card.agentRole || 'Specialist agent'}</span>
          </span>
        </span>
        {card.isStale && <span title="No execution activity has been recorded for five minutes" className="shrink-0 rounded-full border border-amber-300/30 bg-amber-300/[0.06] px-1.5 py-1 text-[9px] font-semibold text-amber-100">No signal</span>}
      </span>

      <span className={`mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${stateTone.border} ${stateTone.text}`}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${stateTone.dot} ${(card.status === 'running' || receivingContext || handingOff) && !card.isStale ? 'animate-pulse' : ''}`} />
        {stateTone.label}{card.progress > 0 && card.status === 'running' && !receivingContext && !handingOff ? ` · ${Math.round(card.progress)}%` : ''}
      </span>

      <span className="mt-2.5 min-w-0 flex-1">
        <span className="block text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-500">Current task</span>
        <span className="mt-1 line-clamp-2 block break-words text-[11px] leading-[17px] text-slate-200 [overflow-wrap:anywhere]">{card.currentTask}</span>
      </span>

      {card.status === 'running' && card.progress > 0 && <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/[0.08]" aria-label={`${Math.round(card.progress)} percent complete`}>
        <span className="block h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300 transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(100, card.progress))}%` }} />
      </span>}
      <span className="mt-2 flex min-w-0 items-center gap-1.5 border-t border-white/[0.07] pt-2 text-[9px] text-slate-500">
        {latestActivity && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${latestActivity.kind === 'error' ? 'bg-rose-300' : latestActivity.kind === 'handoff' ? 'bg-cyan-300' : latestActivity.kind === 'tool' || latestActivity.kind === 'tool_result' ? 'bg-sky-300' : 'bg-violet-300'}`} />}
        <span className="min-w-0 flex-1 truncate" title={latestActivity?.message}>{latestActivity?.message || (card.runId ? 'No recent activity' : 'Waiting for this agent to start')}</span>
        <span className="shrink-0">{card.orchestrationAttemptNumber ? `Attempt ${card.orchestrationAttemptNumber}` : ''}</span>
      </span>
    </button>
  );
};

export const AgentHandoffGraph: React.FC<AgentHandoffGraphProps> = ({
  cards,
  allAgentCount,
  workflow,
  handoffs,
  selectedExecutionId,
  selectedConnectionId,
  visible = true,
  onSelect,
  onSelectConnection,
  onSelectOrchestrator,
  onClearFilters,
}) => {
  const graphId = useId().replace(/:/g, '');
  const [webglAvailable] = useState(() => supportsWebGL());
  const [sceneFailed, setSceneFailed] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rootNodeRef = useRef<HTMLButtonElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const [viewportWidth, setViewportWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [stageSize, setStageSize] = useState({ width: 0, height: 360 });
  const [edgeGeometry, setEdgeGeometry] = useState<{ signature: string; items: EdgeGeometry[] }>({ signature: '', items: [] });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const hasManualZoom = useRef(false);

  const visibleHandoffs = useMemo(() => handoffs.filter(handoff => handoffMatchesCards(handoff, cards)), [cards, handoffs]);
  const edges = useMemo(() => buildEdges(cards, workflow, visibleHandoffs), [cards, visibleHandoffs, workflow]);
  const layers = useMemo(() => buildLayers(cards, edges, workflow), [cards, edges, workflow]);
  const nodeByExecution = useMemo(() => new Map(cards.map(card => [card.executionId, card])), [cards]);
  const handoffCount = edges.filter(edge => Boolean(edge.handoffId)).length;
  const maxLayerSize = Math.max(1, ...layers.map(layer => layer.length));
  const stageWidth = Math.max(viewportWidth, maxLayerSize * 232 + 272, 820);
  const stageHeight = Math.max(590, 212 + layers.length * 238 + (edges.some(edge => edge.feedback) ? 64 : 0));
  const positionedCards = useMemo(() => layers.flatMap((layer, depth) => layer.map((card, index) => ({
    card,
    x: stageWidth * (index + 1) / (layer.length + 1),
    y: 240 + depth * 238,
  }))), [layers, stageWidth]);
  const incomingExecutions = useMemo(() => new Set(edges.filter(edge => !edge.feedback).map(edge => edge.toExecutionId)), [edges]);
  const rootTargets = useMemo(() => {
    const rootCards = positionedCards.filter(position => !incomingExecutions.has(position.card.executionId));
    return rootCards.length ? rootCards : positionedCards.slice(0, 1);
  }, [incomingExecutions, positionedCards]);
  const connectionCount = edges.length + rootTargets.length;
  const currentTask = workflow ? workflow.tasks.find(task => task.id === workflow.run.currentTaskId) : undefined;

  useEffect(() => {
    if (!viewportWidth || hasManualZoom.current) return;
    setZoom(Math.max(0.62, Math.min(1, (viewportWidth - 24) / stageWidth)));
  }, [stageWidth, viewportWidth]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const updateWidth = () => setViewportWidth(current => current === viewport.clientWidth ? current : viewport.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const viewport = viewportRef.current;
    if (!stage || !viewport) return undefined;
    let frame = 0;
    const measure = () => {
      const stageRect = stage.getBoundingClientRect();
      const width = stage.offsetWidth;
      const height = Math.max(stage.offsetHeight, 360);
      const nextGeometry: EdgeGeometry[] = [];
      const point = (x: number, y: number): [number, number] => [(x - stageRect.left) / zoom, (y - stageRect.top) / zoom];
      const centerX = (rect: DOMRect) => rect.left + rect.width / 2;
      const root = rootNodeRef.current?.getBoundingClientRect();
      if (root) {
        const start = point(centerX(root), root.bottom);
        for (const position of rootTargets) {
          const targetNode = nodeRefs.current.get(position.card.executionId);
          if (!targetNode) continue;
          const target = targetNode.getBoundingClientRect();
          const end = point(centerX(target), target.top);
          const distance = Math.max(30, (end[1] - start[1]) * 0.42);
          const control1: [number, number] = [start[0], start[1] + distance];
          const control2: [number, number] = [end[0], end[1] - distance * 0.4];
          nextGeometry.push({ id: `root-${position.card.executionId}`, start, control1, control2, end });
        }
      }
      for (const edge of edges) {
        const from = nodeRefs.current.get(edge.fromExecutionId);
        const to = nodeRefs.current.get(edge.toExecutionId);
        if (!from || !to) continue;
        const fromRect = from.getBoundingClientRect();
        const toRect = to.getBoundingClientRect();
        const start = point(centerX(fromRect), fromRect.bottom);
        const end = edge.feedback ? point(centerX(toRect), toRect.bottom) : point(centerX(toRect), toRect.top);
        let control1: [number, number];
        let control2: [number, number];
        if (edge.feedback) {
          const laneY = Math.max(start[1], end[1]) + 36;
          control1 = [start[0], laneY];
          control2 = [end[0], laneY];
        } else {
          const vertical = Math.max(36, (end[1] - start[1]) * 0.42);
          control1 = [start[0], start[1] + vertical];
          control2 = [end[0], end[1] - vertical * 0.4];
        }
        nextGeometry.push({
          id: edge.id,
          start,
          control1,
          control2,
          end,
        });
      }
      const signature = `${width}:${height}:${zoom}:${nextGeometry.map(item => `${item.id}:${item.start.join(',')}:${item.control1.join(',')}:${item.control2.join(',')}:${item.end.join(',')}`).join('|')}`;
      setStageSize(current => current.width === width && current.height === height ? current : { width, height });
      setEdgeGeometry(current => current.signature === signature ? current : { signature, items: nextGeometry });
    };
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(stage);
    if (rootNodeRef.current) observer.observe(rootNodeRef.current);
    nodeRefs.current.forEach(node => observer.observe(node));
    window.addEventListener('resize', schedule);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.cancelAnimationFrame(frame);
    };
  }, [cards, edges, layers, rootTargets, stageHeight, stageWidth, zoom]);

  const fitGraph = () => {
    const availableWidth = viewportRef.current?.clientWidth ?? viewportWidth;
    if (!availableWidth || !stageSize.width) return setZoom(1);
    hasManualZoom.current = true;
    setZoom(Math.max(0.5, Math.min(1, (availableWidth - 20) / stageSize.width)));
    viewportRef.current?.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  };

  const setNodeRef = (executionId: string, node: HTMLButtonElement | null) => {
    if (node) nodeRefs.current.set(executionId, node);
    else nodeRefs.current.delete(executionId);
  };

  const activeEdges = edges.filter(edge => edge.state === 'active').length;
  const activeRootConnections = rootTargets.filter(position => position.card.status === 'running' && !position.card.isStale).length;
  const activeConnectionCount = activeEdges + activeRootConnections;
  const selectionByConnectionId = useMemo(() => {
    const result = new Map<string, WorkflowConnectionSelection>();
    for (const position of rootTargets) result.set(`root-${position.card.executionId}`, {
      id: `root-${position.card.executionId}`,
      kind: 'orchestrator',
      toExecutionId: position.card.executionId,
      taskId: position.card.orchestrationTaskId || workflow?.run.currentTaskId,
    });
    for (const edge of edges) result.set(edge.id, {
      id: edge.id,
      kind: edge.handoffId ? 'handoff' : 'dependency',
      fromExecutionId: edge.fromExecutionId,
      toExecutionId: edge.toExecutionId,
      handoffId: edge.handoffId,
      taskId: edge.taskId,
      feedback: edge.feedback,
    });
    return result;
  }, [edges, rootTargets, workflow?.run.currentTaskId]);
  const sceneConnections = useMemo<WorkflowCurveConnection[]>(() => {
    const geometryById = new Map(edgeGeometry.items.map(item => [item.id, item]));
    const connections: WorkflowCurveConnection[] = [];
    for (const position of rootTargets) {
      const id = `root-${position.card.executionId}`;
      const geometry = geometryById.get(id);
      if (!geometry) continue;
      const active = position.card.status === 'running' && !position.card.isStale;
      connections.push({ id, start: geometry.start, control1: geometry.control1, control2: geometry.control2, end: geometry.end, color: cardToneColor(position.card), active, muted: position.card.status === 'waiting' || position.card.status === 'idle', indicator: 'PLAN', selected: selectedConnectionId === id });
    }
    for (const edge of edges) {
      const geometry = geometryById.get(edge.id);
      if (!geometry) continue;
      connections.push({
        id: edge.id,
        start: geometry.start,
        control1: geometry.control1,
        control2: geometry.control2,
        end: geometry.end,
        color: edgeTone[edge.state].stroke,
        active: edge.state === 'active',
        muted: edge.state === 'pending',
        feedback: edge.feedback,
        indicator: edge.handoffId ? 'CTX' : undefined,
        selected: selectedConnectionId === edge.id,
      });
    }
    return connections;
  }, [edgeGeometry, edges, rootTargets, selectedConnectionId]);

  const selectConnection = (id: string, trigger: HTMLElement) => {
    const selection = selectionByConnectionId.get(id);
    if (selection) onSelectConnection?.(selection, trigger);
  };
  const connectionDescriptions = [
    ...rootTargets.map(({ card }) => ({ id: `root-${card.executionId}`, label: `Orchestrator routes work to ${card.agentName}.` })),
    ...edges.map(edge => ({
      id: edge.id,
      label: `${nodeByExecution.get(edge.fromExecutionId)?.agentName || 'An agent'} ${edge.feedback ? 'returns a correction to' : 'hands work to'} ${nodeByExecution.get(edge.toExecutionId)?.agentName || 'another agent'}; ${edge.state}.`,
    })),
  ];

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0c111a] shadow-[0_18px_60px_rgba(0,0,0,0.18)]" aria-labelledby={`${graphId}-title`} aria-describedby={cards.length ? `${graphId}-connections` : undefined}>
      <div className="flex flex-col gap-3 border-b border-white/[0.07] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`${graphId}-title`} className="text-sm font-semibold text-white">Live agent workflow</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/[0.06] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-emerald-100"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Live</span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">Follow work and context through the tree. Select a node or connection to inspect its history.</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
          <div className="flex items-center gap-3 text-[10px] text-slate-400" aria-label={`${cards.length} of ${allAgentCount} agents shown, ${connectionCount} connections and ${handoffCount} recorded handoffs`}>
            <span><strong className="font-semibold text-slate-200">{cards.length}</strong>/{allAgentCount} agents</span>
            <span className="h-3 w-px bg-white/10" />
            <span><strong className="font-semibold text-violet-100">{connectionCount}</strong> connections · {handoffCount} handoffs{activeConnectionCount > 0 ? ` · ${activeConnectionCount} active` : ''}</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-white/[0.09] bg-white/[0.025] p-1" role="group" aria-label="Workflow zoom controls">
            <button type="button" onClick={() => { hasManualZoom.current = true; setZoom(value => Math.max(0.5, Math.round((value - 0.1) * 10) / 10)); }} disabled={zoom <= 0.5} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:opacity-35" aria-label="Zoom out"><Minus className="h-3.5 w-3.5" /></button>
            <span className="w-10 text-center text-[10px] tabular-nums text-slate-300" aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => { hasManualZoom.current = true; setZoom(value => Math.min(1.3, Math.round((value + 0.1) * 10) / 10)); }} disabled={zoom >= 1.3} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:opacity-35" aria-label="Zoom in"><Plus className="h-3.5 w-3.5" /></button>
            <span className="mx-1 h-4 w-px bg-white/10" />
            <button type="button" onClick={fitGraph} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-[10px] font-medium text-slate-300 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200"><Scan className="h-3 w-3" />Fit</button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-white/[0.055] px-4 py-2 text-[9px] text-slate-500" aria-label="Handoff legend">
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Complete</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />Active · moving context</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-slate-500" />Waiting</span>
        {edges.some(edge => edge.state === 'attention') && <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" />Needs attention</span>}
        {edges.some(edge => edge.feedback) && <span className="inline-flex items-center gap-1.5"><span className="h-px w-4 border-t border-dashed border-violet-300" />Review correction</span>}
      </div>

      <div ref={viewportRef} className="relative max-h-[min(72vh,760px)] min-h-[320px] max-w-full overflow-auto overscroll-contain" tabIndex={0} aria-label="Scrollable agent workflow canvas">
        {cards.length ? <div className="relative" style={{ width: stageWidth * zoom, height: stageHeight * zoom }}>
          <div
            ref={stageRef}
            className="agent-flow-stage relative isolate overflow-hidden"
            tabIndex={-1}
            style={{ width: stageWidth, height: stageHeight, transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          >
            {visible && webglAvailable && !sceneFailed ? <WorkflowSceneBoundary onError={() => setSceneFailed(true)}>
              <Suspense fallback={<div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_18%,rgba(124,58,237,0.14),transparent_52%)]" />}>
                <AgentWorkflowScene3D width={stageWidth} height={stageHeight} connections={sceneConnections} active={activeConnectionCount > 0 || cards.some(card => card.status === 'running' && !card.isStale)} reduceMotion={prefersReducedMotion} onSelect={id => selectConnection(id, stageRef.current ?? document.body)} />
              </Suspense>
            </WorkflowSceneBoundary> : visible && <Workflow2DFallback graphId={graphId} width={stageWidth} height={stageHeight} connections={sceneConnections} reduceMotion={prefersReducedMotion} onSelect={id => selectConnection(id, stageRef.current ?? document.body)} />}

            <button
              ref={rootNodeRef}
              type="button"
              onClick={event => onSelectOrchestrator?.(event.currentTarget)}
              disabled={!onSelectOrchestrator}
              title={currentTask?.assignmentReason || workflow?.run.goal || 'Alpha routes tasks and coordinates specialist agents'}
              style={{ left: stageWidth / 2, top: 28, width: Math.min(370, stageWidth - 48), transform: 'translateX(-50%)' }}
              className="absolute z-20 flex min-h-[88px] items-center gap-3 rounded-2xl border border-violet-300/30 bg-[#11101c]/90 px-4 py-3 text-left shadow-[0_0_42px_rgba(139,92,246,0.18)] backdrop-blur-md transition hover:border-violet-200/55 hover:bg-[#171326]/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:cursor-default"
              aria-label={`Alpha Orchestrator. ${currentTask ? `Routing ${currentTask.title} to ${currentTask.ownerName}.` : `Run status ${workflow?.run.status || 'live'}.`}${onSelectOrchestrator ? ' Open orchestration plan.' : ''}`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-violet-200/35 bg-violet-500/20 text-lg font-bold text-violet-50 shadow-[0_0_22px_rgba(139,92,246,0.42)]">A</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[12px] font-semibold text-white">Alpha Orchestrator<span className="rounded-full border border-violet-200/20 bg-violet-300/[0.08] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-violet-100">Root</span></span>
                <span className="mt-1 block truncate text-[10px] text-slate-400">{currentTask ? `Routing · ${currentTask.ownerName} · ${currentTask.title}` : `${cards.length} specialists · ${workflow?.run.status.replace(/_/g, ' ') || 'coordinating live work'}`}</span>
                <span className="mt-1 block text-[9px] text-violet-200/70">Run {workflow?.run.status.replace(/_/g, ' ') || 'live'} · selects next agent · passes context</span>
              </span>
            </button>

            {positionedCards.map(({ card, x, y }) => <AgentNode
              key={card.executionId}
              card={card}
              handoffs={visibleHandoffs}
              selected={selectedExecutionId === card.executionId}
              setNodeRef={setNodeRef}
              style={{ left: x, top: y, width: Math.min(232, stageWidth - 32), transform: 'translateX(-50%)' }}
              onSelect={trigger => onSelect(card, trigger)}
            />)}

            <ol id={`${graphId}-connections`} className="sr-only" aria-label="Interactive agent workflow connections">
              {connectionDescriptions.map(connection => <li key={connection.id}>
                <button type="button" onClick={event => selectConnection(connection.id, event.currentTarget)}>{connection.label} Inspect connection details.</button>
              </li>)}
            </ol>
          </div>
        </div> : (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-5 py-10 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-slate-400"><Code2 className="h-5 w-5" /></div>
            <h3 className="mt-3 text-sm font-semibold text-slate-200">No agents match these filters</h3>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Clear the search or choose another status to see this build’s workflow.</p>
            {onClearFilters && <button type="button" onClick={onClearFilters} className="mt-3 min-h-9 rounded-lg border border-white/10 px-3 text-xs font-medium text-slate-200 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200">Clear filters</button>}
          </div>
        )}
      </div>
      {!connectionCount && cards.length > 0 && <div className="border-t border-white/[0.055] px-4 py-2.5 text-[10px] leading-4 text-slate-500">The Orchestrator is connected to each root agent. Dependency and handoff paths appear as work moves between specialists.</div>}
    </section>
  );
};
