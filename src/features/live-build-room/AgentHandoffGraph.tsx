import React, { Suspense, lazy, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGesture } from '@use-gesture/react';
import { CheckCircle2, Clock3, Code2, Minus, Plus, RadioTower, Scan, ShieldAlert } from 'lucide-react';
import type {
  LiveBuildRoomAgentCard,
  LiveBuildRoomHandoff,
  LiveBuildRoomOrchestration,
} from '@/shared/types';
import type { WorkflowCurveConnection, WorkflowSceneNode } from './AgentWorkflowScene3D';
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

function taskTone(status: string): { label: string; color: string } {
  if (status === 'accepted' || status === 'completed') return { label: 'Complete', color: '#34d399' };
  if (status === 'running' || status === 'submitted') return { label: 'Running', color: '#a78bfa' };
  if (status === 'failed' || status === 'blocked') return { label: 'Needs attention', color: '#fb7185' };
  if (status === 'review') return { label: 'Review', color: '#fbbf24' };
  return { label: 'Waiting', color: '#60a5fa' };
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
      className={`agent-flow-node group absolute z-20 flex min-h-[112px] min-w-0 flex-col rounded-xl border bg-[#10141e]/90 px-3 py-2.5 text-center shadow-[0_14px_38px_rgba(0,0,0,0.42)] backdrop-blur-xl transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 ${stateTone.border} ${selected ? 'border-violet-300/80 bg-[#211a32] shadow-[0_0_30px_rgba(139,92,246,0.3)] ring-1 ring-violet-300/50' : 'hover:bg-[#181a29]'}`}
    >
      <span className="block truncate text-[13px] font-semibold text-white">{card.agentName}</span>
      <span className="mt-0.5 block truncate text-[10px] text-slate-400">{card.agentRole || 'Specialist agent'}</span>
      <span className={`mt-2 inline-flex items-center justify-center gap-1.5 text-[10px] font-semibold ${stateTone.text}`}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${stateTone.dot} ${(card.status === 'running' || receivingContext || handingOff) && !card.isStale ? 'animate-pulse' : ''}`} />
        {stateTone.label}{card.progress > 0 && card.status === 'running' && !receivingContext && !handingOff ? ` · ${Math.round(card.progress)}%` : ''}
      </span>
      <span className="mt-1 line-clamp-2 break-words text-[10px] leading-4 text-slate-300">{card.currentTask}</span>
      <span className="mt-2 flex items-center justify-center gap-1 text-[9px] text-slate-500"><span className={`h-1 w-1 rounded-full ${latestActivity ? stateTone.dot : 'bg-slate-600'}`} />{card.isStale ? 'No recent signal' : latestActivity ? 'Activity recorded' : 'Awaiting activity'}</span>
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
  const stageWidth = Math.max(viewportWidth, maxLayerSize * 215 + 160, 820);
  const positionedCards = useMemo(() => layers.flatMap((layer, depth) => layer.map((card, index) => ({
    card,
    x: stageWidth * (index + 1) / (layer.length + 1),
    y: 420 + depth * 235,
  }))), [layers, stageWidth]);
  const taskLeaves = useMemo(() => {
    const lastRow = positionedCards.filter(position => position.y === positionedCards.at(-1)?.y);
    const focus = lastRow.find(position => position.card.executionId === selectedExecutionId)
      ?? lastRow.find(position => position.card.status === 'running')
      ?? lastRow[0];
    if (!focus) return [];
    const assigned = workflow?.tasks.filter(task => task.ownerAgentId === focus.card.agentId).slice(-3) ?? [];
    const tasks = assigned.length ? assigned.map(task => ({ id: task.id, title: task.title, status: task.status }))
      : [{ id: `current-${focus.card.executionId}`, title: focus.card.currentTask, status: focus.card.status }];
    return tasks.filter(task => task.title).map((task, index) => ({
      ...task,
      card: focus.card,
      x: Math.max(78, Math.min(stageWidth - 78, focus.x + (index - (tasks.length - 1) / 2) * 136)),
      y: focus.y + 190,
    }));
  }, [positionedCards, selectedExecutionId, stageWidth, workflow?.tasks]);
  const stageHeight = Math.max(620, 340 + layers.length * 235 + (edges.some(edge => edge.feedback) ? 64 : 0), ...taskLeaves.map(leaf => leaf.y + 150));
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
      const start: [number, number] = [stageWidth / 2, 190];
      for (const position of rootTargets) {
        const end: [number, number] = [position.x, position.y - 67];
        const distance = Math.max(50, (end[1] - start[1]) * 0.55);
        const control1: [number, number] = [start[0], start[1] + distance];
        const control2: [number, number] = [end[0], end[1] - distance * 0.55];
        nextGeometry.push({ id: `root-${position.card.executionId}`, start, control1, control2, end });
      }
      for (const edge of edges) {
        const from = nodeRefs.current.get(edge.fromExecutionId);
        const to = nodeRefs.current.get(edge.toExecutionId);
        if (!from || !to) continue;
        const fromRect = from.getBoundingClientRect();
        const toRect = to.getBoundingClientRect();
        const start = point(centerX(fromRect), fromRect.bottom);
        const end = edge.feedback ? point(centerX(toRect), toRect.bottom) : point(centerX(toRect), toRect.top - 28);
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
    for (const leaf of taskLeaves) {
      const start: [number, number] = [positionedCards.find(position => position.card.executionId === leaf.card.executionId)?.x ?? leaf.x, leaf.y - 74];
      const end: [number, number] = [leaf.x, leaf.y - 13];
      const active = leaf.status === 'running' || leaf.status === 'submitted';
      connections.push({ id: `taskbranch-${leaf.id}`, start, control1: [start[0], start[1] + 36], control2: [end[0], end[1] - 30], end, color: taskTone(leaf.status).color, active, muted: !active && leaf.status !== 'accepted' && leaf.status !== 'completed', indicator: 'TASK' });
    }
    return connections;
  }, [edgeGeometry, edges, positionedCards, rootTargets, selectedConnectionId, taskLeaves]);
  const sceneNodes = useMemo<WorkflowSceneNode[]>(() => [
    { id: 'orchestrator', center: [stageWidth / 2, 160], color: '#9c6dff', active: activeConnectionCount > 0 || cards.some(card => card.status === 'running'), selected: false },
    ...positionedCards.map(({ card, x, y }) => ({
      id: card.executionId,
      center: [x, y - 40] as [number, number],
      color: cardToneColor(card),
      active: card.status === 'running' && !card.isStale,
      selected: selectedExecutionId === card.executionId,
    })),
    ...taskLeaves.map(leaf => ({ id: `task:${leaf.id}`, center: [leaf.x, leaf.y] as [number, number], color: taskTone(leaf.status).color, active: leaf.status === 'running' || leaf.status === 'submitted', selected: false, kind: 'task' as const })),
  ], [activeConnectionCount, cards, positionedCards, selectedExecutionId, stageWidth, taskLeaves]);

  const bindViewport = useGesture({
    onDrag: ({ delta: [dx, dy], event }) => {
      if ((event.target as HTMLElement).closest('button')) return;
      const viewport = viewportRef.current;
      if (viewport) { viewport.scrollLeft -= dx; viewport.scrollTop -= dy; }
    },
    onWheel: ({ delta: [, dy], event }) => {
      event.preventDefault();
      hasManualZoom.current = true;
      setZoom(value => Math.max(0.5, Math.min(1.4, value - dy * 0.001)));
    },
    onPinch: ({ offset: [scale], event }) => {
      event.preventDefault();
      hasManualZoom.current = true;
      setZoom(Math.max(0.5, Math.min(1.4, scale)));
    },
  }, { drag: { filterTaps: true }, pinch: { scaleBounds: { min: 0.5, max: 1.4 }, from: () => [zoom, 0] }, eventOptions: { passive: false } });

  const selectConnection = (id: string, trigger: HTMLElement) => {
    const selection = selectionByConnectionId.get(id);
    if (selection) onSelectConnection?.(selection, trigger);
  };
  const selectTask = (id: string) => {
    const leaf = taskLeaves.find(item => item.id === id);
    const trigger = leaf && nodeRefs.current.get(leaf.card.executionId);
    if (leaf && trigger) onSelect(leaf.card, trigger);
  };
  const selectSceneConnection = (id: string) => {
    if (id.startsWith('taskbranch-')) selectTask(id.slice('taskbranch-'.length));
    else selectConnection(id, stageRef.current ?? document.body);
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

      <div {...bindViewport()} ref={viewportRef} className="relative max-h-[min(76vh,860px)] min-h-[320px] max-w-full overflow-auto overscroll-contain" style={{ touchAction: 'none' }} tabIndex={0} aria-label="Agent workflow canvas. Drag to pan, wheel or pinch to zoom.">
        {cards.length ? <div className="relative" style={{ width: stageWidth * zoom, height: stageHeight * zoom }}>
          <div
            ref={stageRef}
            className="agent-flow-stage relative isolate overflow-hidden"
            tabIndex={-1}
            style={{ width: stageWidth, height: stageHeight, transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          >
            {visible && webglAvailable && !sceneFailed ? <WorkflowSceneBoundary onError={() => setSceneFailed(true)}>
              <Suspense fallback={<div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_18%,rgba(124,58,237,0.14),transparent_52%)]" />}>
                <AgentWorkflowScene3D width={stageWidth} height={stageHeight} connections={sceneConnections} nodes={sceneNodes} active={activeConnectionCount > 0 || cards.some(card => card.status === 'running' && !card.isStale)} reduceMotion={prefersReducedMotion} onSelect={selectSceneConnection} onSelectNode={id => { if (id === 'orchestrator') { if (rootNodeRef.current) onSelectOrchestrator?.(rootNodeRef.current); } else if (id.startsWith('task:')) selectTask(id.slice('task:'.length)); else { const card = nodeByExecution.get(id); const trigger = nodeRefs.current.get(id); if (card && trigger) onSelect(card, trigger); } }} />
              </Suspense>
            </WorkflowSceneBoundary> : visible && <Workflow2DFallback graphId={graphId} width={stageWidth} height={stageHeight} connections={sceneConnections} reduceMotion={prefersReducedMotion} onSelect={selectSceneConnection} />}

            <button
              ref={rootNodeRef}
              type="button"
              onClick={event => onSelectOrchestrator?.(event.currentTarget)}
              disabled={!onSelectOrchestrator}
              title={currentTask?.assignmentReason || workflow?.run.goal || 'Alpha routes tasks and coordinates specialist agents'}
              style={{ left: stageWidth / 2, top: 24, width: Math.min(270, stageWidth - 48), transform: 'translateX(-50%)' }}
              className="absolute z-20 flex min-h-[76px] flex-col items-center justify-center rounded-xl border border-violet-300/25 bg-[#141522]/90 px-3 py-2 text-center shadow-[0_0_32px_rgba(139,92,246,0.18)] backdrop-blur-xl transition hover:border-violet-200/55 hover:bg-[#1b1830]/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:cursor-default"
              aria-label={`Alpha Orchestrator. ${currentTask ? `Routing ${currentTask.title} to ${currentTask.ownerName}.` : `Run status ${workflow?.run.status || 'live'}.`}${onSelectOrchestrator ? ' Open orchestration plan.' : ''}`}
            >
              <span className="text-[13px] font-semibold text-white">Orchestrator</span>
              <span className="mt-1 block max-w-full truncate text-[10px] text-slate-300">{currentTask ? `Routing · ${currentTask.ownerName}` : `${cards.length} agents · ${workflow?.run.status.replace(/_/g, ' ') || 'coordinating'}`}</span>
              <span className="mt-0.5 text-[10px] text-violet-200/75">Click to see activity →</span>
            </button>

            {positionedCards.map(({ card, x, y }) => <AgentNode
              key={card.executionId}
              card={card}
              handoffs={visibleHandoffs}
              selected={selectedExecutionId === card.executionId}
              setNodeRef={setNodeRef}
              style={{ left: x, top: y, width: Math.min(188, stageWidth - 32), transform: 'translateX(-50%)' }}
              onSelect={trigger => onSelect(card, trigger)}
            />)}

            {taskLeaves.map(leaf => <button
              key={leaf.id}
              type="button"
              onClick={() => selectTask(leaf.id)}
              title={`Inspect ${leaf.title} with ${leaf.card.agentName}`}
              style={{ left: leaf.x, top: leaf.y + 24, width: 130, transform: 'translateX(-50%)' }}
              className="absolute z-20 flex min-h-[76px] flex-col items-center rounded-lg border border-white/[0.11] bg-[#10141d]/90 px-2.5 py-2 text-center shadow-[0_12px_24px_rgba(0,0,0,0.34)] backdrop-blur-lg transition-colors hover:border-violet-300/50 hover:bg-[#171a27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200"
            >
              <span className="line-clamp-2 text-[10px] font-medium leading-4 text-slate-100">{leaf.title}</span>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-[9px]" style={{ color: taskTone(leaf.status).color }}><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: taskTone(leaf.status).color }} />{taskTone(leaf.status).label}</span>
            </button>)}

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
