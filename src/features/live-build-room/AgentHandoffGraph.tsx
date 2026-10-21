import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock3, Code2, Minus, Plus, RadioTower, Scan, ShieldAlert } from 'lucide-react';
import type {
  LiveBuildRoomAgentCard,
  LiveBuildRoomHandoff,
  LiveBuildRoomOrchestration,
} from '@/shared/types';

type WorkflowTask = LiveBuildRoomOrchestration['tasks'][number];
type EdgeState = 'complete' | 'active' | 'pending' | 'attention';

interface AgentHandoffGraphProps {
  cards: LiveBuildRoomAgentCard[];
  allAgentCount: number;
  workflow?: LiveBuildRoomOrchestration | null;
  handoffs: LiveBuildRoomHandoff[];
  selectedExecutionId?: string | null;
  onSelect: (card: LiveBuildRoomAgentCard, trigger: HTMLButtonElement) => void;
  onClearFilters?: () => void;
}

interface WorkflowEdge {
  id: string;
  fromExecutionId: string;
  toExecutionId: string;
  state: EdgeState;
  feedback?: boolean;
  label?: string;
}

interface EdgeGeometry {
  id: string;
  path: string;
  labelX?: number;
  labelY?: number;
}

const edgeTone: Record<EdgeState, { stroke: string; marker: string }> = {
  complete: { stroke: '#34d399', marker: '#34d399' },
  active: { stroke: '#a78bfa', marker: '#a78bfa' },
  pending: { stroke: '#64748b', marker: '#64748b' },
  attention: { stroke: '#fbbf24', marker: '#fbbf24' },
};

function dependencyState(fromTask: WorkflowTask, toTask: WorkflowTask, toCard: LiveBuildRoomAgentCard): EdgeState {
  if (['failed', 'blocked'].includes(fromTask.status) || ['failed', 'blocked'].includes(toTask.status)) return 'attention';
  if (toCard.status === 'running' || toTask.status === 'running' || toTask.status === 'submitted') return 'active';
  if (fromTask.status === 'accepted' && toTask.status === 'accepted') return 'complete';
  return 'pending';
}

function taskState(task: WorkflowTask, card: LiveBuildRoomAgentCard): EdgeState {
  if (['failed', 'blocked'].includes(task.status) || card.status === 'failed') return 'attention';
  if (card.status === 'running' || task.status === 'running' || task.status === 'submitted') return 'active';
  if (task.status === 'accepted') return 'complete';
  return 'pending';
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
    if (seen.has(key)) return;
    seen.add(key);
    edges.push(edge);
  };

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
        label: 'correction',
      });
    }
  } else {
    const latestByPair = new Map<string, LiveBuildRoomHandoff>();
    const byAgent = new Map(cards.map(card => [card.agentId, card]));
    for (const handoff of handoffs) {
      if (!handoff.fromAgentId || !handoff.toAgentId) continue;
      const fromCard = byAgent.get(handoff.fromAgentId);
      const toCard = byAgent.get(handoff.toAgentId);
      if (!fromCard || !toCard) continue;
      const key = `${fromCard.executionId}->${toCard.executionId}`;
      const previous = latestByPair.get(key);
      if (!previous || Date.parse(handoff.createdAt) > Date.parse(previous.createdAt)) latestByPair.set(key, handoff);
    }
    for (const [key] of latestByPair) {
      const [fromExecutionId, toExecutionId] = key.split('->');
      const target = cards.find(card => card.executionId === toExecutionId);
      add({
        id: `handoff-${key}`,
        fromExecutionId,
        toExecutionId,
        state: target?.status === 'running' ? 'active' : target?.status === 'failed' ? 'attention' : 'complete',
      });
    }
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
  const unconnected = normalEdges.length === 0;
  if (unconnected && cards.length > 1) cards.forEach((card, index) => level.set(card.executionId, index));

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
  selected: boolean;
  onSelect: (trigger: HTMLButtonElement) => void;
  setNodeRef: (executionId: string, node: HTMLButtonElement | null) => void;
}> = ({ card, selected, onSelect, setNodeRef }) => {
  const latestActivity = card.activity.at(-1);
  const tone = card.status === 'completed'
    ? { border: 'border-emerald-400/35', text: 'text-emerald-200', dot: 'bg-emerald-300', icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Complete' }
    : card.status === 'running'
      ? { border: 'border-violet-300/55', text: 'text-violet-100', dot: 'bg-violet-300', icon: <RadioTower className="h-3.5 w-3.5" />, label: 'Running' }
      : card.status === 'review'
        ? { border: 'border-amber-300/40', text: 'text-amber-100', dot: 'bg-amber-300', icon: <ShieldAlert className="h-3.5 w-3.5" />, label: 'Review' }
        : card.status === 'failed'
          ? { border: 'border-rose-300/40', text: 'text-rose-100', dot: 'bg-rose-300', icon: <ShieldAlert className="h-3.5 w-3.5" />, label: 'Stopped' }
          : card.status === 'waiting'
            ? { border: 'border-sky-300/30', text: 'text-sky-100', dot: 'bg-sky-300', icon: <Clock3 className="h-3.5 w-3.5" />, label: 'Waiting' }
            : { border: 'border-white/10', text: 'text-slate-300', dot: 'bg-slate-500', icon: <Clock3 className="h-3.5 w-3.5" />, label: 'Ready' };

  return (
    <button
      ref={node => setNodeRef(card.executionId, node)}
      type="button"
      onClick={event => onSelect(event.currentTarget)}
      aria-pressed={selected}
      title={`Inspect ${card.agentName} · ${card.currentTask}`}
      className={`agent-flow-node group relative z-10 flex min-h-[174px] min-w-0 w-full flex-col rounded-2xl border bg-surface-100/95 p-3.5 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 ${tone.border} ${selected ? 'border-violet-300/80 bg-[#211a32] shadow-[0_0_30px_rgba(139,92,246,0.2)] ring-1 ring-violet-300/50' : 'hover:bg-surface-100'} ${card.status === 'running' && !card.isStale ? 'agent-flow-node--running' : ''}`}
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

      <span className={`mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${tone.border} ${tone.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot} ${card.status === 'running' && !card.isStale ? 'animate-pulse' : ''}`} />
        {tone.label}{card.progress > 0 && card.status === 'running' ? ` · ${Math.round(card.progress)}%` : ''}
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
  onSelect,
  onClearFilters,
}) => {
  const graphId = useId().replace(/:/g, '');
  const arrowId = `${graphId}-arrow`;
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const [viewportWidth, setViewportWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [stageSize, setStageSize] = useState({ width: 0, height: 360 });
  const [edgeGeometry, setEdgeGeometry] = useState<{ signature: string; items: EdgeGeometry[] }>({ signature: '', items: [] });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const edges = useMemo(() => buildEdges(cards, workflow, handoffs), [cards, handoffs, workflow]);
  const layers = useMemo(() => buildLayers(cards, edges, workflow), [cards, edges, workflow]);
  const nodeByExecution = useMemo(() => new Map(cards.map(card => [card.executionId, card])), [cards]);
  const handoffCount = edges.length;
  const minimumWidth = Math.max(1, layers.length) * 228 + Math.max(0, layers.length - 1) * 48 + 48;
  const stageWidth = Math.max(viewportWidth, minimumWidth);

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
      for (const edge of edges) {
        const from = nodeRefs.current.get(edge.fromExecutionId);
        const to = nodeRefs.current.get(edge.toExecutionId);
        if (!from || !to) continue;
        const fromRect = from.getBoundingClientRect();
        const toRect = to.getBoundingClientRect();
        const x1 = (fromRect.left + fromRect.width - stageRect.left) / zoom;
        const y1 = (fromRect.top + fromRect.height / 2 - stageRect.top) / zoom;
        const x2 = (toRect.left - stageRect.left) / zoom;
        const y2 = (toRect.top + toRect.height / 2 - stageRect.top) / zoom;
        if (edge.feedback) {
          const fromX = (fromRect.left + fromRect.width / 2 - stageRect.left) / zoom;
          const toX = (toRect.left + toRect.width / 2 - stageRect.left) / zoom;
          const fromY = (fromRect.bottom - stageRect.top) / zoom - 3;
          const toY = (toRect.bottom - stageRect.top) / zoom - 3;
          const laneY = Math.max(fromY, toY) + 38;
          nextGeometry.push({
            id: edge.id,
            path: `M ${fromX} ${fromY} C ${fromX} ${laneY}, ${toX} ${laneY}, ${toX} ${toY}`,
            labelX: (fromX + toX) / 2,
            labelY: laneY - 5,
          });
        } else {
          const bend = Math.max(26, Math.min(82, Math.abs(x2 - x1) * 0.45));
          nextGeometry.push({ id: edge.id, path: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}` });
        }
      }
      const signature = `${width}:${height}:${zoom}:${nextGeometry.map(item => `${item.id}:${item.path}`).join('|')}`;
      setStageSize(current => current.width === width && current.height === height ? current : { width, height });
      setEdgeGeometry(current => current.signature === signature ? current : { signature, items: nextGeometry });
    };
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(stage);
    nodeRefs.current.forEach(node => observer.observe(node));
    window.addEventListener('resize', schedule);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.cancelAnimationFrame(frame);
    };
  }, [cards, edges, layers, stageWidth, zoom]);

  const fitGraph = () => {
    const availableWidth = viewportRef.current?.clientWidth ?? viewportWidth;
    if (!availableWidth || !stageSize.width) return setZoom(1);
    setZoom(Math.max(0.7, Math.min(1, (availableWidth - 20) / stageSize.width)));
    viewportRef.current?.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  };

  const setNodeRef = (executionId: string, node: HTMLButtonElement | null) => {
    if (node) nodeRefs.current.set(executionId, node);
    else nodeRefs.current.delete(executionId);
  };

  const activeEdges = edges.filter(edge => edge.state === 'active').length;

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0c111a] shadow-[0_18px_60px_rgba(0,0,0,0.18)]" aria-labelledby={`${graphId}-title`} aria-describedby={handoffCount ? `${graphId}-connections` : undefined}>
      <div className="flex flex-col gap-3 border-b border-white/[0.07] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`${graphId}-title`} className="text-sm font-semibold text-white">Live agent workflow</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/[0.06] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-emerald-100"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Live</span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">Select an agent to inspect its activity, handoff, files, and tools.</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
          <div className="flex items-center gap-3 text-[10px] text-slate-400" aria-label={`${cards.length} of ${allAgentCount} agents shown, ${handoffCount} handoffs` }>
            <span><strong className="font-semibold text-slate-200">{cards.length}</strong>/{allAgentCount} agents</span>
            <span className="h-3 w-px bg-white/10" />
            <span><strong className="font-semibold text-violet-100">{handoffCount}</strong> handoffs{activeEdges > 0 ? ` · ${activeEdges} active` : ''}</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-white/[0.09] bg-white/[0.025] p-1" role="group" aria-label="Workflow zoom controls">
            <button type="button" onClick={() => setZoom(value => Math.max(0.7, Math.round((value - 0.1) * 10) / 10))} disabled={zoom <= 0.7} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:opacity-35" aria-label="Zoom out"><Minus className="h-3.5 w-3.5" /></button>
            <span className="w-10 text-center text-[10px] tabular-nums text-slate-300" aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom(value => Math.min(1.3, Math.round((value + 0.1) * 10) / 10))} disabled={zoom >= 1.3} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:opacity-35" aria-label="Zoom in"><Plus className="h-3.5 w-3.5" /></button>
            <span className="mx-1 h-4 w-px bg-white/10" />
            <button type="button" onClick={fitGraph} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-[10px] font-medium text-slate-300 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200"><Scan className="h-3 w-3" />Fit</button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-white/[0.055] px-4 py-2 text-[9px] text-slate-500" aria-label="Handoff legend">
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Complete</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />Active handoff</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-slate-500" />Waiting</span>
        {edges.some(edge => edge.state === 'attention') && <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" />Needs attention</span>}
        {edges.some(edge => edge.feedback) && <span className="inline-flex items-center gap-1.5"><span className="h-px w-4 border-t border-dashed border-violet-300" />Review correction</span>}
      </div>

      <div ref={viewportRef} className="relative max-h-[min(72vh,760px)] min-h-[320px] max-w-full overflow-auto overscroll-contain" tabIndex={0} aria-label="Scrollable agent workflow canvas">
        {cards.length ? <div className="relative" style={{ width: stageSize.width ? stageSize.width * zoom : stageWidth * zoom, height: stageSize.height * zoom }}>
          <div
            ref={stageRef}
            className="agent-flow-stage relative isolate grid min-h-[360px] items-stretch gap-12 px-6 py-8"
            style={{
              width: stageWidth,
              minHeight: stageSize.height,
              gridTemplateColumns: `repeat(${Math.max(1, layers.length)}, minmax(0, 1fr))`,
              paddingBottom: edges.some(edge => edge.feedback) ? 76 : undefined,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" viewBox={`0 0 ${Math.max(stageSize.width, stageWidth)} ${Math.max(stageSize.height, 360)}`} preserveAspectRatio="none" aria-hidden="true">
              <defs>
                {Object.entries(edgeTone).map(([state, tone]) => <marker key={state} id={`${arrowId}-${state}`} markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="strokeWidth"><path d="M1,1 L7,4.5 L1,8" fill="none" stroke={tone.marker} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></marker>)}
                <linearGradient id={`${graphId}-active`} x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#67e8f9" /></linearGradient>
              </defs>
              {edges.map(edge => {
                const geometry = edgeGeometry.items.find(item => item.id === edge.id);
                if (!geometry) return null;
                const tone = edgeTone[edge.state];
                return <g key={edge.id}>
                  <path d={geometry.path} fill="none" stroke={edge.state === 'active' ? `url(#${graphId}-active)` : tone.stroke} strokeWidth={edge.state === 'active' ? 2.2 : 1.7} strokeDasharray={edge.feedback || edge.state === 'pending' ? '6 7' : undefined} strokeLinecap="round" markerEnd={`url(#${arrowId}-${edge.state})`} opacity={edge.state === 'pending' ? 0.62 : 0.9} className={edge.state === 'active' ? 'agent-flow-edge--active' : ''} />
                  {edge.state === 'active' && !prefersReducedMotion && <circle r="3.3" fill="#a5f3fc" className="agent-flow-particle"><animateMotion dur="1.65s" repeatCount="indefinite" path={geometry.path} /></circle>}
                  {geometry.labelX !== undefined && geometry.labelY !== undefined && <text x={geometry.labelX} y={geometry.labelY} textAnchor="middle" className="fill-violet-200" fontSize="9" fontWeight="600">{edge.label}</text>}
                </g>;
              })}
            </svg>
            {layers.map((layer, layerIndex) => (
              <div key={`layer-${layerIndex}`} className="relative z-10 flex min-w-0 flex-col justify-center gap-4">
                {layer.map(card => <AgentNode
                  key={card.executionId}
                  card={card}
                  selected={selectedExecutionId === card.executionId}
                  setNodeRef={setNodeRef}
                  onSelect={trigger => onSelect(card, trigger)}
                />)}
              </div>
            ))}
          </div>
          <ol id={`${graphId}-connections`} className="sr-only" aria-label="Agent handoff connections">
            {edges.map(edge => <li key={`description-${edge.id}`}>
              {nodeByExecution.get(edge.fromExecutionId)?.agentName || 'An agent'} {edge.feedback ? 'returns a correction to' : 'hands work to'} {nodeByExecution.get(edge.toExecutionId)?.agentName || 'another agent'}; {edge.state}.
            </li>)}
          </ol>
        </div> : (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-5 py-10 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-slate-400"><Code2 className="h-5 w-5" /></div>
            <h3 className="mt-3 text-sm font-semibold text-slate-200">No agents match these filters</h3>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Clear the search or choose another status to see this build’s workflow.</p>
            {onClearFilters && <button type="button" onClick={onClearFilters} className="mt-3 min-h-9 rounded-lg border border-white/10 px-3 text-xs font-medium text-slate-200 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200">Clear filters</button>}
          </div>
        )}
      </div>
      {!handoffCount && cards.length > 0 && <div className="border-t border-white/[0.055] px-4 py-2.5 text-[10px] leading-4 text-slate-500">No connections are visible for these agents yet. Arrows follow task dependencies or recorded handoffs.</div>}
    </section>
  );
};
