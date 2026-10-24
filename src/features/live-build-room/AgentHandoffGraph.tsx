import React, { Suspense, lazy, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGesture } from '@use-gesture/react';
import { ChevronDown, Code2, GitBranch, Minus, Plus, Scan } from 'lucide-react';
import type {
  LiveBuildRoomAgentCard,
  LiveBuildRoomHandoff,
  LiveBuildRoomOrchestration,
} from '@/shared/types';
import { taskBranchGeometry, workflowSvgPath, type WorkflowCurveConnection, type WorkflowSceneNode } from './workflowPaths';
import { layoutAgentHierarchy } from './agentWorkflowLayout';
import { useAnimatedAgentHierarchy } from './useAnimatedAgentHierarchy';
import { latestAgentAction } from './agentActivityPresentation';
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
  selectedTaskId?: string | null;
  selectedOrchestrator?: boolean;
  visible?: boolean;
  onSelect: (card: LiveBuildRoomAgentCard, trigger: HTMLButtonElement, taskId?: string) => void;
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
  nodes: WorkflowSceneNode[];
  reduceMotion: boolean;
  onSelect: (id: string) => void;
}> = ({ graphId, width, height, connections, nodes, reduceMotion, onSelect }) => (
  <>
    <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs><radialGradient id={`${graphId}-orb`} cx="30%" cy="25%"><stop offset="0" stopColor="white" stopOpacity="0.85" /><stop offset="0.3" stopColor="currentColor" /><stop offset="1" stopColor="#111827" /></radialGradient>{connections.map((connection, index) => <marker key={connection.id} id={`${graphId}-arrow-${index}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M 0 0 L 8 4 L 0 8 Z" fill={connection.color} />
      </marker>)}</defs>
      {connections.map((connection, index) => {
        const d = workflowSvgPath(connection);
        return <g key={connection.id}>
          <path d={d} fill="none" stroke={connection.color} strokeWidth={connection.selected ? 2.5 : connection.active ? 2 : 1.3} strokeDasharray={connection.feedback || connection.muted ? '5 7' : undefined} opacity={connection.muted ? 0.45 : connection.active || connection.selected ? 0.9 : 0.62} markerEnd={`url(#${graphId}-arrow-${index})`} />
          <path d={d} fill="none" stroke="transparent" strokeWidth="16" pointerEvents="stroke" className="pointer-events-auto cursor-pointer" onClick={event => { event.stopPropagation(); onSelect(connection.id); }} />
          {!reduceMotion && <circle r={connection.active ? 3.2 : 1.5} fill={connection.active ? '#f5f3ff' : connection.color} opacity={connection.active ? 1 : 0.5}>
            <animateMotion dur={connection.active ? '2.4s' : '8s'} repeatCount="indefinite" path={d} />
          </circle>}
        </g>;
      })}
      {nodes.map(node => <g key={node.id} transform={`translate(${node.center.join(' ')})`} style={{ color: node.color }}>
        <circle r={node.id === 'orchestrator' ? 32 : node.kind === 'task' ? 15 : 25} fill={`url(#${graphId}-orb)`} stroke={node.color} />
      </g>)}
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
  if (status === 'running') return { label: 'Running', color: '#a78bfa' };
  if (status === 'submitted') return { label: 'In review', color: '#fbbf24' };
  if (status === 'cancelled' || status === 'superseded') return { label: status === 'cancelled' ? 'Cancelled' : 'Superseded', color: '#94a3b8' };
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

const AgentNode: React.FC<{
  card: LiveBuildRoomAgentCard;
  tasks: WorkflowTask[];
  expanded: boolean;
  onToggle: () => void;
  selected: boolean;
  onSelect: (trigger: HTMLButtonElement) => void;
  setNodeRef: (executionId: string, node: HTMLButtonElement | null) => void;
  style?: React.CSSProperties;
}> = ({ card, tasks, expanded, onToggle, selected, onSelect, setNodeRef, style }) => {
  const latestAction = latestAgentAction(card);
  const label = card.isStale ? 'No recent signal' : ({ running: 'Running', completed: 'Complete', waiting: 'Waiting', review: 'Review', failed: 'Failed', idle: 'Ready' })[card.status];
  const completed = tasks.filter(task => task.status === 'accepted').length;
  return <div className="absolute z-20 flex items-center justify-center gap-0.5" style={style}>
    <button ref={node => setNodeRef(card.executionId, node)} type="button" onClick={event => onSelect(event.currentTarget)} aria-pressed={selected}
      title={`${card.agentName} · ${label} · ${latestAction.text}`}
      className={`agent-flow-node inline-flex min-h-9 min-w-0 items-center gap-2 rounded-full px-2.5 py-1 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 ${selected ? 'bg-violet-300/10 text-violet-100' : 'bg-[#080b14]/85 text-slate-200 hover:bg-violet-300/[0.06] hover:text-white'}`}>
      <span className="max-w-[136px] truncate">{card.agentName}</span>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: card.isStale ? '#94a3b8' : cardToneColor(card) }} aria-hidden="true" />
      <span className="sr-only">{label}. Inspect activity.</span>
    </button>
    <button type="button" onClick={onToggle} aria-expanded={expanded} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${card.agentName} tasks`}
      title={`${completed} / ${tasks.length || 1} tasks complete. ${expanded ? 'Collapse' : 'Expand'} tasks.`}
      className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/5 hover:text-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200">
      <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
    </button>
  </div>;
};

export const AgentHandoffGraph: React.FC<AgentHandoffGraphProps> = ({
  cards,
  allAgentCount,
  workflow,
  handoffs,
  selectedExecutionId,
  selectedConnectionId,
  selectedTaskId,
  selectedOrchestrator = false,
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
  const taskNodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(() => new Set());
  const [showHandoffs, setShowHandoffs] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const hasManualZoom = useRef(false);
  const fitMode = useRef(false);

  const visibleHandoffs = useMemo(() => handoffs.filter(handoff => handoffMatchesCards(handoff, cards)), [cards, handoffs]);
  const edges = useMemo(() => buildEdges(cards, workflow, visibleHandoffs), [cards, visibleHandoffs, workflow]);
  const nodeByExecution = useMemo(() => new Map(cards.map(card => [card.executionId, card])), [cards]);
  const handoffCount = edges.filter(edge => Boolean(edge.handoffId)).length;
  const hierarchy = useMemo(
    () => layoutAgentHierarchy(cards, workflow?.tasks ?? [], expandedAgents, viewportWidth),
    [cards, workflow?.tasks, expandedAgents, viewportWidth]);
  const { width: stageWidth, height: stageHeight, positionedCards, taskLeaves } = useAnimatedAgentHierarchy(hierarchy, prefersReducedMotion);
  const rootTargets = positionedCards;
  const connectionCount = edges.length + rootTargets.length;
  const currentTask = workflow ? workflow.tasks.find(task => task.id === workflow.run.currentTaskId) : undefined;

  useEffect(() => {
    if (!viewportWidth || (hasManualZoom.current && !fitMode.current)) return;
    setZoom(Math.max(fitMode.current ? 0.25 : 0.55, Math.min(1, (viewportWidth - 24) / stageWidth, viewportHeight ? (viewportHeight - 24) / stageHeight : 1)));
  }, [stageWidth, stageHeight, viewportWidth, viewportHeight]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const updateWidth = () => { setViewportWidth(current => current === viewport.clientWidth ? current : viewport.clientWidth); setViewportHeight(viewport.clientHeight); };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (hasManualZoom.current) return;
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollLeft = Math.max(0, (stageWidth * zoom - viewport.clientWidth) / 2);
  }, [viewportWidth, stageWidth, zoom]);

  const fitGraph = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    hasManualZoom.current = true;
    fitMode.current = true;
    setZoom(Math.max(0.25, Math.min(1, (viewport.clientWidth - 24) / stageWidth, (viewport.clientHeight - 24) / stageHeight)));
    viewport.scrollTo({ left: 0, top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  };
  const toggleAgent = (agentId: string) => setExpandedAgents(previous => {
    const next = new Set(previous);
    if (next.has(agentId)) next.delete(agentId); else next.add(agentId);
    return next;
  });

  const setNodeRef = (executionId: string, node: HTMLButtonElement | null) => {
    if (node) nodeRefs.current.set(executionId, node);
    else nodeRefs.current.delete(executionId);
  };

  const activeEdges = edges.filter(edge => edge.state === 'active' && Boolean(edge.handoffId) && (showHandoffs || edge.id === selectedConnectionId)).length;
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
    const connections: WorkflowCurveConnection[] = [];
    for (const position of rootTargets) {
      const id = `root-${position.card.executionId}`;
      const start: [number, number] = [stageWidth / 2, 192];
      const end: [number, number] = [position.x, position.y - 65];
      const active = position.card.status === 'running' && !position.card.isStale;
      connections.push({ id, start, end, control1: [start[0], 260], control2: [end[0], 255], color: cardToneColor(position.card), active, muted: position.card.isStale || position.card.status === 'waiting' || position.card.status === 'idle', selected: selectedConnectionId === id });
    }
    for (const edge of edges.filter(edge => showHandoffs || edge.id === selectedConnectionId)) {
      const from = positionedCards.find(position => position.card.executionId === edge.fromExecutionId);
      const to = positionedCards.find(position => position.card.executionId === edge.toExecutionId);
      if (!from || !to) continue;
      const direction = to.x >= from.x ? 1 : -1;
      const start: [number, number] = [from.x + direction * 17, from.y - 57];
      const end: [number, number] = [to.x - direction * 17, to.y - 57];
      const lane = Math.min(start[1], end[1]) - (edge.feedback ? 110 : 75);
      connections.push({ id: edge.id, start, end, control1: [start[0], lane], control2: [end[0], lane], color: edgeTone[edge.state].stroke,
        active: edge.state === 'active' && Boolean(edge.handoffId), muted: edge.state === 'pending', feedback: true,
        indicator: edge.handoffId ? 'CTX' : undefined, selected: selectedConnectionId === edge.id });
    }
    for (const leaf of taskLeaves) {
      const parent = positionedCards.find(position => position.card.executionId === leaf.card.executionId);
      if (!parent) continue;
      const active = leaf.status === 'running' && !leaf.card.isStale;
      connections.push({ id: `taskbranch-${leaf.id}`, ...taskBranchGeometry(parent, leaf),
        color: taskTone(leaf.status).color, active, muted: !active && leaf.status !== 'accepted' && leaf.status !== 'completed', selected: selectedTaskId === leaf.id });
    }
    return connections;
  }, [edges, positionedCards, rootTargets, selectedConnectionId, selectedTaskId, showHandoffs, stageWidth, taskLeaves]);
  const sceneNodes = useMemo<WorkflowSceneNode[]>(() => [
    { id: 'orchestrator', center: [stageWidth / 2, 160], color: '#9c6dff', active: cards.some(card => card.status === 'running' && !card.isStale), selected: selectedOrchestrator },
    ...positionedCards.map(({ card, x, y }) => ({
      id: card.executionId,
      center: [x, y - 40] as [number, number],
      color: cardToneColor(card),
      active: card.status === 'running' && !card.isStale,
      selected: selectedExecutionId === card.executionId,
    })),
    ...taskLeaves.map(leaf => ({ id: `task:${leaf.id}`, center: [leaf.x, leaf.y] as [number, number], color: taskTone(leaf.status).color, active: leaf.status === 'running' && !leaf.card.isStale, selected: selectedTaskId === leaf.id, kind: 'task' as const })),
  ], [activeConnectionCount, cards, positionedCards, selectedExecutionId, selectedTaskId, selectedOrchestrator, stageWidth, taskLeaves]);

  const bindViewport = useGesture({
    onDrag: ({ delta: [dx, dy], event }) => {
      if ((event.target as HTMLElement).closest('button') || ('pointerType' in event && event.pointerType === 'touch') || event.type.startsWith('touch')) return;
      const viewport = viewportRef.current;
      if (viewport) { viewport.scrollLeft -= dx; viewport.scrollTop -= dy; }
    },
    onWheel: ({ delta: [, dy], event }) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      hasManualZoom.current = true;
      fitMode.current = false;
      setZoom(value => Math.max(0.25, Math.min(1.4, value - dy * 0.001)));
    },
    onPinch: ({ offset: [scale], event }) => {
      event.preventDefault();
      hasManualZoom.current = true;
      fitMode.current = false;
      setZoom(Math.max(0.25, Math.min(1.4, scale)));
    },
  }, { drag: { filterTaps: true }, pinch: { scaleBounds: { min: 0.25, max: 1.4 }, from: () => [zoom, 0] }, eventOptions: { passive: false } });

  const selectAgent = (card: LiveBuildRoomAgentCard, trigger: HTMLButtonElement, taskId?: string) => {
    onSelect(card, trigger, taskId);
  };
  const selectConnection = (id: string, trigger: HTMLElement) => {
    const selection = selectionByConnectionId.get(id);
    if (selection) onSelectConnection?.(selection, trigger);
  };
  const selectTask = (id: string) => {
    const leaf = taskLeaves.find(item => item.id === id);
    const trigger = taskNodeRefs.current.get(id) ?? (leaf && nodeRefs.current.get(leaf.card.executionId));
    if (leaf && trigger) selectAgent(leaf.card, trigger, leaf.task?.id);
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
          <p className="mt-1 text-[11px] leading-4 text-slate-500">Orchestrator → agents → tasks. Select an orb or label to inspect commands, output, and files.</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
          <div className="flex items-center gap-3 text-[10px] text-slate-400" aria-label={`${cards.length} of ${allAgentCount} agents shown, ${connectionCount} connections and ${handoffCount} recorded handoffs`}>
            <span><strong className="font-semibold text-slate-200">{cards.length}</strong>/{allAgentCount} agents</span>
            <span className="h-3 w-px bg-white/10" />
            <span><strong className="font-semibold text-violet-100">{connectionCount}</strong> connections · {handoffCount} handoffs{activeConnectionCount > 0 ? ` · ${activeConnectionCount} active` : ''}</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-white/[0.09] bg-white/[0.025] p-1" role="group" aria-label="Workflow zoom controls">
            <button type="button" onClick={() => { hasManualZoom.current = true; fitMode.current = false; setZoom(value => Math.max(0.25, Math.round((value - 0.1) * 10) / 10)); }} disabled={zoom <= 0.25} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:opacity-35" aria-label="Zoom out"><Minus className="h-3.5 w-3.5" /></button>
            <span className="w-10 text-center text-[10px] tabular-nums text-slate-300" aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => { hasManualZoom.current = true; fitMode.current = false; setZoom(value => Math.min(1.3, Math.round((value + 0.1) * 10) / 10)); }} disabled={zoom >= 1.3} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:opacity-35" aria-label="Zoom in"><Plus className="h-3.5 w-3.5" /></button>
            <span className="mx-1 h-4 w-px bg-white/10" />
            <button type="button" onClick={fitGraph} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-[10px] font-medium text-slate-300 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200"><Scan className="h-3 w-3" />Fit</button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-white/[0.055] px-4 py-2 text-[9px] text-slate-500" aria-label="Handoff legend">
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Complete</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />Working</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-sky-400" />Waiting</span>
        {edges.some(edge => edge.state === 'attention') && <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" />Needs attention</span>}
        {edges.some(edge => edge.feedback) && <span className="inline-flex items-center gap-1.5"><span className="h-px w-4 border-t border-dashed border-violet-300" />Review correction</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.055] px-4 py-2">
        <button type="button" onClick={() => setExpandedAgents(new Set(cards.map(card => card.agentId)))} className="min-h-8 rounded-md px-2 text-[10px] text-slate-400 hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-violet-200">Expand tasks</button>
        <button type="button" onClick={() => setExpandedAgents(new Set())} className="min-h-8 rounded-md px-2 text-[10px] text-slate-400 hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-violet-200">Collapse tasks</button>
        <button type="button" aria-pressed={showHandoffs} onClick={() => setShowHandoffs(value => !value)} className={`ml-auto inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-[10px] focus-visible:ring-2 focus-visible:ring-violet-200 ${showHandoffs ? 'bg-violet-400/10 text-violet-200' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><GitBranch className="h-3 w-3" />Handoff paths</button>
      </div>

      <div {...bindViewport()} ref={viewportRef} className="agent-flow-viewport relative h-[clamp(440px,68vh,760px)] max-w-full overflow-auto overscroll-contain" style={{ touchAction: 'pan-x pan-y' }} tabIndex={0} aria-label="Agent workflow canvas. Drag or scroll to pan. Control-wheel or pinch to zoom.">
        {cards.length ? <div className="relative mx-auto" style={{ width: stageWidth * zoom, height: stageHeight * zoom }}>
          <div
            ref={stageRef}
            className="agent-flow-stage relative isolate overflow-hidden"
            tabIndex={-1}
            style={{ width: stageWidth, height: stageHeight, transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          >
            {visible && webglAvailable && !sceneFailed ? <WorkflowSceneBoundary onError={() => setSceneFailed(true)}>
              <Suspense fallback={<Workflow2DFallback graphId={graphId} width={stageWidth} height={stageHeight} connections={sceneConnections} nodes={sceneNodes} reduceMotion onSelect={selectSceneConnection} />}>
                <AgentWorkflowScene3D width={stageWidth} height={stageHeight} connections={sceneConnections} nodes={sceneNodes} active={activeConnectionCount > 0 || cards.some(card => card.status === 'running' && !card.isStale)} reduceMotion={prefersReducedMotion} onSelect={selectSceneConnection} onSelectNode={id => { if (id === 'orchestrator') { if (rootNodeRef.current) onSelectOrchestrator?.(rootNodeRef.current); } else if (id.startsWith('task:')) selectTask(id.slice('task:'.length)); else { const card = nodeByExecution.get(id); const trigger = nodeRefs.current.get(id); if (card && trigger) selectAgent(card, trigger); } }} />
              </Suspense>
            </WorkflowSceneBoundary> : visible && <Workflow2DFallback graphId={graphId} width={stageWidth} height={stageHeight} connections={sceneConnections} nodes={sceneNodes} reduceMotion={prefersReducedMotion} onSelect={selectSceneConnection} />}

            <button
              ref={rootNodeRef}
              type="button"
              onClick={event => onSelectOrchestrator?.(event.currentTarget)}
              disabled={!onSelectOrchestrator}
              aria-pressed={selectedOrchestrator}
              title={`${workflow?.run.status.replace(/_/g, ' ') || 'Coordinating'}${currentTask ? ` · ${currentTask.title}` : ''}`}
              style={{ left: stageWidth / 2, top: 88, transform: 'translateX(-50%)' }}
              className="absolute z-20 inline-flex min-h-9 items-center gap-2 rounded-full bg-[#080b14]/85 px-3 py-1 text-[14px] font-medium text-slate-100 transition-colors hover:bg-violet-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 aria-pressed:bg-violet-300/10 aria-pressed:text-violet-100 disabled:cursor-default"
              aria-label={`Alpha Orchestrator. ${workflow?.run.status.replace(/_/g, ' ') || 'Coordinating'}. Inspect orchestration activity.`}
            >
              <span>Orchestrator</span>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: workflow?.run.status === 'completed' ? '#34d399' : workflow?.run.status === 'failed' ? '#fb7185' : workflow?.run.status === 'paused' ? '#fbbf24' : '#a78bfa' }} aria-hidden="true" />
            </button>

            {positionedCards.map(({ card, assigned, expanded, x, y }) => <AgentNode
              key={card.executionId}
              card={card}
              tasks={assigned}
              expanded={expanded}
              onToggle={() => toggleAgent(card.agentId)}
              selected={selectedExecutionId === card.executionId}
              setNodeRef={setNodeRef}
              style={{ left: x, top: y, width: 204, transform: 'translateX(-50%)' }}
              onSelect={trigger => selectAgent(card, trigger)}
            />)}

            {taskLeaves.map(leaf => <button
              key={leaf.id}
              ref={node => { if (node) taskNodeRefs.current.set(leaf.id, node); else taskNodeRefs.current.delete(leaf.id); }}
              type="button"
              onClick={() => selectTask(leaf.id)}
              title={`Inspect ${leaf.title} with ${leaf.card.agentName}`}
              style={{ left: leaf.x, top: leaf.y + 24, width: 144, transform: 'translateX(-50%)' }}
              aria-pressed={selectedTaskId === leaf.id}
              className={`absolute z-20 inline-flex min-h-9 items-start justify-center gap-1.5 rounded-lg bg-[#080b14]/85 px-2 py-1.5 text-center transition-colors hover:bg-violet-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 ${selectedTaskId === leaf.id ? 'text-violet-100' : 'text-slate-300'}`}
            >
              <span className="line-clamp-2 text-[11px] font-medium leading-4">{leaf.title}</span>
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: taskTone(leaf.status).color }} aria-hidden="true" />
              <span className="sr-only">{taskTone(leaf.status).label}</span>
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
