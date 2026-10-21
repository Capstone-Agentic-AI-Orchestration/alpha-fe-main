import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Bot, ChevronDown } from 'lucide-react';

import { AgentCall, ProjectChatAgent } from '@/shared/types';
import type { BuildAgentNode, BuildAgentState } from './useProjectLiveBuild';

/** The project's open Orchestrator build, drawn beside the chat's own agents. */
export interface FlowBuild {
  runId: string;
  label: string;
  running: boolean;
  agents: BuildAgentNode[];
}

interface OrchestratorFlowProps {
  calls: AgentCall[];
  agents: ProjectChatAgent[];
  isWorking: boolean;
  /** Shown as the panel title: the project name, or Alpha for general chat. */
  title: string;
  selectedCallId?: string | null;
  onSelectCall?: (callId: string | null) => void;
  build?: FlowBuild | null;
  selectedBuildAgentId?: string | null;
  onSelectBuildAgent?: (agentId: string | null) => void;
}

interface WaveAgent {
  id: string;
  initial: string;
  /** Orb colour as "r, g, b". */
  tone: string;
  /** Working right now: brighter glow and a comet along its line. */
  active: boolean;
}

interface WaveState {
  expanded: boolean;
  working: boolean;
  agents: WaveAgent[];
  hoveredId: string | null;
  selectedId: string | null;
  hubId: string;
  flashRgb: string | null;
  flashAmount: number;
}

interface NodePosition {
  id: string;
  x: number;
  y: number;
  r: number;
}

const LIVE_STATUSES: AgentCall['status'][] = ['queued', 'running', 'awaiting_confirmation'];
const HUB_ID = 'orchestrator-hub';
const BUILD_PREFIX = 'build:';
const SUCCESS_RGB = '52, 211, 153';
const ERROR_RGB = '244, 63, 94';
const FLASH_HOLD_MS = 1200;
const FLASH_FADE_MS = 1800;

/**
 * Alpha's own chat turns are the Orchestrator at work, so they belong to the
 * centre orb. Every other call is a specialist agent and gets its own node.
 */
export function isOrchestratorCall(call: AgentCall): boolean {
  return call.squadId === 'alpha-chat' || call.agentId === 'alpha-assistant';
}

function callStatus(status: AgentCall['status']): string {
  switch (status) {
    case 'queued': return 'Queued';
    case 'running': return 'Working';
    case 'awaiting_confirmation': return 'Awaiting approval';
    case 'completed': return 'Complete';
    case 'failed': return 'Needs attention';
    case 'cancelled': return 'Stopped';
    default: return status;
  }
}

function callStatusTone(status: AgentCall['status']): string {
  if (status === 'running') return 'text-violet-100 bg-violet-400/15';
  if (status === 'queued') return 'text-sky-200 bg-sky-400/10';
  if (status === 'awaiting_confirmation') return 'text-amber-200 bg-amber-400/10';
  if (status === 'completed') return 'text-emerald-200 bg-emerald-400/10';
  if (status === 'failed') return 'text-rose-200 bg-rose-400/10';
  return 'text-gray-300 bg-white/[0.06]';
}

/**
 * Calls to show: every call from the newest request (an @mention chat turn or
 * a Call Agent request), plus any call that is still live. The calls arrive
 * newest first.
 */
function latestChatTurn(calls: AgentCall[]) {
  if (!calls.length) return [];
  const latest = calls[0];
  const fromLatest = latest.messageId
    ? calls.filter(call => call.messageId === latest.messageId)
    : [latest];
  const live = calls.filter(call => LIVE_STATUSES.includes(call.status));
  const seen = new Set<string>();
  return [...live, ...fromLatest]
    .filter(call => (seen.has(call.id) ? false : (seen.add(call.id), true)))
    .slice(0, 9);
}

/** Height of the dot surface at a point; u runs left to right, v runs back to front. */
function waveAt(u: number, v: number, t: number): number {
  return Math.sin(u * 5.5 + t + v * 1.8) * 0.55
    + Math.sin(u * 11 - t * 1.3 + v * 3.2) * 0.22
    + Math.cos(v * 4 + t * 0.7 + u * 2.4) * 0.3;
}

/** Blends an "r, g, b" colour toward the outcome colour by amount (0 to 1). */
function mix(base: string, target: string | null, amount: number): string {
  if (!target || amount <= 0) return base;
  const from = base.split(',').map(Number);
  const to = target.split(',').map(Number);
  return from.map((value, index) => Math.round(value + (to[index] - value) * amount)).join(', ');
}

// Agents sit on alternating sides of the Orchestrator, moving outward.
const AGENT_OFFSETS = [0.18, -0.18, 0.3, -0.3, 0.4, -0.4, 0.24, -0.24];

function toneFor(status: AgentCall['status']): string {
  if (status === 'failed') return '251, 113, 133';
  if (status === 'completed') return '110, 231, 183';
  if (status === 'awaiting_confirmation') return '252, 211, 77';
  return '167, 139, 250';
}

function buildTone(state: BuildAgentState): string {
  if (state === 'failed') return '251, 113, 133';
  if (state === 'completed') return '110, 231, 183';
  if (state === 'review') return '252, 211, 77';
  if (state === 'waiting') return '125, 211, 252';
  return '167, 139, 250';
}

const BUILD_STATE_LABEL: Record<BuildAgentState, string> = {
  running: 'Working',
  waiting: 'Waiting',
  review: 'Being checked',
  completed: 'Done',
  failed: 'Needs attention'
};

function buildStateTone(state: BuildAgentState): string {
  if (state === 'running') return 'text-violet-100 bg-violet-400/15';
  if (state === 'waiting') return 'text-sky-200 bg-sky-400/10';
  if (state === 'review') return 'text-amber-200 bg-amber-400/10';
  if (state === 'completed') return 'text-emerald-200 bg-emerald-400/10';
  return 'text-rose-200 bg-rose-400/10';
}

/** A soft glass sphere: light from the upper left, colour toward the rim. */
function drawOrb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, tone: string, highlight = 'rgba(255, 255, 255, 0.95)') {
  const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  body.addColorStop(0, highlight);
  body.addColorStop(0.28, 'rgba(' + tone + ', 0.95)');
  body.addColorStop(0.75, 'rgba(' + tone + ', 0.55)');
  body.addColorStop(1, 'rgba(46, 16, 101, 0.85)');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(' + tone + ', 0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, tone: string, strength: number) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
  glow.addColorStop(0, 'rgba(' + tone + ', ' + strength + ')');
  glow.addColorStop(0.45, 'rgba(' + tone + ', ' + strength * 0.35 + ')');
  glow.addColorStop(1, 'rgba(' + tone + ', 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.strokeStyle = 'rgba(221, 214, 254, 0.85)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawWave(canvas: HTMLCanvasElement, state: WaveState, seconds: number): NodePosition[] {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  if (width < 1 || height < 1) return [];
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const { expanded, working, agents, hoveredId, selectedId, hubId, flashRgb, flashAmount } = state;
  const t = seconds * (working ? 1.5 : 0.65);
  const cols = Math.max(24, Math.min(170, Math.floor(width / 8)));
  const rows = expanded ? 24 : 7;
  const amp = height * (expanded ? 0.13 : 0.16) * (working ? 1.25 : 1);
  const centerY = height * (expanded ? 0.6 : 0.5);
  const depth = height * (expanded ? 0.42 : 0.38);
  const pointAt = (u: number, v: number) => {
    const wave = waveAt(u, v, t);
    return {
      x: width / 2 + (u - 0.5) * width * (0.82 + v * 0.36),
      y: centerY + (v - 0.5) * depth - wave * amp * (0.6 + v * 0.6),
      wave
    };
  };

  // The wave is purple, lighter while working, and briefly takes the outcome colour.
  ctx.fillStyle = 'rgb(' + mix(working ? '167, 139, 250' : '139, 92, 246', flashRgb, flashAmount) + ')';
  for (let j = 0; j < rows; j++) {
    const v = j / (rows - 1);
    for (let i = 0; i < cols; i++) {
      const u = i / (cols - 1);
      const { x, y, wave } = pointAt(u, v);
      const crest = Math.min(1, Math.max(0, (wave + 1.1) / 2.2));
      const edge = Math.min(1, u * 6, (1 - u) * 6);
      ctx.globalAlpha = (0.1 + v * 0.5) * (0.4 + crest * 0.8) * edge * (1 + flashAmount * 0.35);
      const r = 0.45 + v * 0.9 + crest * 0.35;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  ctx.globalAlpha = 1;
  if (!expanded) return [];

  const hub = pointAt(0.5, 0.62);
  const breathe = (Math.sin(seconds * (working ? 2.4 : 1.2)) + 1) / 2;
  const core = 13 + breathe * 1.5 + (hoveredId === hubId ? 2 : 0);
  ctx.lineCap = 'round';

  const positions: NodePosition[] = agents.map((agent, index) => {
    const offset = AGENT_OFFSETS[index % AGENT_OFFSETS.length];
    const node = pointAt(0.5 + offset, 0.58 + (index % 2) * 0.08);
    return { id: agent.id, x: node.x, y: node.y, r: agent.id === hoveredId ? 13 : 11 };
  });

  // Connections first, so orbs sit on top of their lines.
  agents.forEach((agent, index) => {
    const node = positions[index];
    const { tone, active } = agent;
    const midX = (hub.x + node.x) / 2;
    const midY = Math.min(hub.y, node.y) - 26;
    const line = ctx.createLinearGradient(hub.x, hub.y, node.x, node.y);
    line.addColorStop(0, 'rgba(196, 181, 253, ' + (active ? 0.55 : 0.22) + ')');
    line.addColorStop(1, 'rgba(' + tone + ', ' + (active ? 0.7 : 0.3) + ')');
    ctx.strokeStyle = line;
    ctx.lineWidth = agent.id === hoveredId ? 1.6 : 1.1;
    ctx.beginPath();
    ctx.moveTo(hub.x, hub.y);
    ctx.quadraticCurveTo(midX, midY, node.x, node.y);
    ctx.stroke();
    if (active) {
      // A soft comet travels out from the Orchestrator to the agent.
      for (let k = 0; k < 4; k++) {
        const p = ((seconds * 0.55 + index * 0.27) % 1) - k * 0.025;
        if (p < 0) continue;
        const px = (1 - p) * (1 - p) * hub.x + 2 * (1 - p) * p * midX + p * p * node.x;
        const py = (1 - p) * (1 - p) * hub.y + 2 * (1 - p) * p * midY + p * p * node.y;
        ctx.fillStyle = 'rgba(237, 233, 254, ' + (0.9 - k * 0.22) + ')';
        ctx.beginPath();
        ctx.arc(px, py, 2.2 - k * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  agents.forEach((agent, index) => {
    const node = positions[index];
    const { tone, active } = agent;
    const hovered = agent.id === hoveredId;
    drawGlow(ctx, node.x, node.y, node.r * (active || hovered ? 2.6 : 2), tone, active || hovered ? 0.4 : 0.22);
    drawOrb(ctx, node.x, node.y, node.r, tone, 'rgba(245, 243, 255, 0.9)');
    if (agent.id === selectedId) drawRing(ctx, node.x, node.y, node.r + 5);
    ctx.fillStyle = 'rgba(30, 16, 60, 0.9)';
    ctx.font = '700 10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(agent.initial, node.x, node.y + 0.5);
  });

  // The Orchestrator: a breathing glass orb with soft ripples and two satellites.
  const hubGlow = mix('139, 92, 246', flashRgb, flashAmount);
  const hubTone = mix('167, 139, 250', flashRgb, flashAmount);
  const ringTone = mix('196, 181, 253', flashRgb, flashAmount);
  drawGlow(ctx, hub.x, hub.y, core * 4.4, hubGlow, (working ? 0.34 : 0.24) + flashAmount * 0.2);
  const ripples = working ? 3 : 2;
  for (let k = 0; k < ripples; k++) {
    const phase = (seconds * (working ? 0.55 : 0.3) + k / ripples) % 1;
    ctx.strokeStyle = 'rgba(' + ringTone + ', ' + (1 - phase) * 0.28 + ')';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(hub.x, hub.y, core + phase * core * 2.4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(' + ringTone + ', 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(hub.x, hub.y, core * 1.9, 0, Math.PI * 2);
  ctx.stroke();
  drawOrb(ctx, hub.x, hub.y, core, hubTone);
  if (selectedId === hubId) drawRing(ctx, hub.x, hub.y, core + 6);
  for (let k = 0; k < 2; k++) {
    const angle = seconds * (working ? 1.6 : 0.7) + k * Math.PI;
    const sx = hub.x + Math.cos(angle) * core * 1.9;
    const sy = hub.y + Math.sin(angle) * core * 1.9;
    drawGlow(ctx, sx, sy, 7, ringTone, 0.5);
    ctx.fillStyle = 'rgba(245, 243, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  positions.push({ id: hubId, x: hub.x, y: hub.y, r: core });
  return positions;
}

export const OrchestratorFlow: React.FC<OrchestratorFlowProps> = ({ calls, agents, isWorking, title, selectedCallId = null, onSelectCall, build = null, selectedBuildAgentId = null, onSelectBuildAgent }) => {
  const [expanded, setExpanded] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const positionsRef = useRef<NodePosition[]>([]);
  const flashRef = useRef<{ rgb: string; start: number } | null>(null);
  const previousStatusesRef = useRef<Map<string, AgentCall['status']>>(new Map());
  const wasWorkingRef = useRef(false);
  const panelId = useId();
  const turnCalls = useMemo(() => latestChatTurn(calls), [calls]);
  const orchestratorCall = turnCalls.find(isOrchestratorCall);
  const agentCalls = useMemo(() => turnCalls.filter(call => !isOrchestratorCall(call)), [turnCalls]);
  const activeAgentCall = agentCalls.find(call => ['queued', 'running'].includes(call.status));
  const orchestratorLive = Boolean(orchestratorCall && ['queued', 'running'].includes(orchestratorCall.status));
  const working = isWorking || orchestratorLive || Boolean(activeAgentCall) || Boolean(build?.running);
  const buildAgents = useMemo(() => build?.agents ?? [], [build]);
  const hubId = orchestratorCall?.id ?? HUB_ID;
  const agentById = useMemo(() => new Map(agents.map(agent => [agent.id, agent])), [agents]);
  const agentName = (call: AgentCall) => agentById.get(call.agentId)?.name ?? call.agentId;
  const hoveredCall = agentCalls.find(call => call.id === hoveredId);
  const hoveredBuildAgent = hoveredId?.startsWith(BUILD_PREFIX) ? buildAgents.find(agent => BUILD_PREFIX + agent.agentId === hoveredId) : undefined;
  const failedCount = agentCalls.filter(call => call.status === 'failed').length + (orchestratorCall?.status === 'failed' ? 1 : 0);
  // Build agents come first so they keep the places closest to the Orchestrator.
  const waveAgents = useMemo<WaveAgent[]>(() => [
    ...buildAgents.map(agent => ({
      id: BUILD_PREFIX + agent.agentId,
      initial: agent.name.slice(0, 1).toUpperCase(),
      tone: buildTone(agent.state),
      active: agent.state === 'running'
    })),
    ...agentCalls.map(call => ({
      id: call.id,
      initial: (agentById.get(call.agentId)?.name ?? call.agentId).slice(0, 1).toUpperCase(),
      tone: toneFor(call.status),
      active: call.status === 'running' || call.status === 'queued'
    }))
  ].slice(0, AGENT_OFFSETS.length), [agentById, agentCalls, buildAgents]);
  const selectedId = selectedCallId ?? (selectedBuildAgentId ? BUILD_PREFIX + selectedBuildAgentId : null);
  const select = (id: string) => {
    if (id === HUB_ID) return;
    if (id.startsWith(BUILD_PREFIX)) {
      const agentId = id.slice(BUILD_PREFIX.length);
      onSelectBuildAgent?.(selectedBuildAgentId === agentId ? null : agentId);
      return;
    }
    onSelectCall?.(selectedCallId === id ? null : id);
  };
  let statusText: string;
  if (activeAgentCall) statusText = agentName(activeAgentCall) + ' is working';
  else if (build) statusText = build.label;
  else if (working) statusText = 'Working';
  else statusText = orchestratorCall?.status === 'failed' ? 'Needs attention' : 'Ready';

  // Open the flow once when a build starts working, so its agents are visible straight away.
  const autoOpenedRunRef = useRef<string | null>(null);
  useEffect(() => {
    if (!build?.running || autoOpenedRunRef.current === build.runId) return;
    autoOpenedRunRef.current = build.runId;
    setExpanded(true);
  }, [build?.runId, build?.running]);

  // The animation loop reads the latest state from a ref so it never restarts.
  const stateRef = useRef({ expanded, working, agents: waveAgents, hoveredId, selectedId, hubId });
  stateRef.current = { expanded, working, agents: waveAgents, hoveredId, selectedId, hubId };

  // A finished run tints the wave green, a failed one red; both fade back to purple.
  useEffect(() => {
    const previous = previousStatusesRef.current;
    let outcome: 'success' | 'error' | null = null;
    for (const call of turnCalls) {
      const before = previous.get(call.id);
      if (!before || before === call.status || !LIVE_STATUSES.includes(before)) continue;
      if (call.status === 'failed') outcome = 'error';
      else if (call.status === 'completed' && outcome !== 'error') outcome = 'success';
    }
    if (outcome) flashRef.current = { rgb: outcome === 'error' ? ERROR_RGB : SUCCESS_RGB, start: performance.now() };
    previousStatusesRef.current = new Map(turnCalls.map(call => [call.id, call.status]));
  }, [turnCalls]);

  useEffect(() => {
    // Plain answers have no call record; their end still counts as a success.
    const recentFlash = flashRef.current && performance.now() - flashRef.current.start < 1500;
    if (wasWorkingRef.current && !working && !recentFlash) {
      flashRef.current = { rgb: SUCCESS_RGB, start: performance.now() };
    }
    wasWorkingRef.current = working;
  }, [working]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    const paint = (seconds: number, now: number) => {
      const flash = flashRef.current;
      let flashAmount = 0;
      if (flash && !reduceMotion) {
        const elapsed = now - flash.start;
        flashAmount = elapsed < FLASH_HOLD_MS ? 1 : Math.max(0, 1 - (elapsed - FLASH_HOLD_MS) / FLASH_FADE_MS);
        if (flashAmount === 0) flashRef.current = null;
      }
      positionsRef.current = drawWave(canvas, { ...stateRef.current, flashRgb: flash?.rgb ?? null, flashAmount }, seconds);
      // The label follows its node as the wave carries it.
      const hovered = positionsRef.current.find(node => node.id === stateRef.current.hoveredId);
      if (hovered && tooltipRef.current) {
        tooltipRef.current.style.transform = 'translate(' + hovered.x + 'px, ' + (hovered.y - hovered.r - 10) + 'px) translate(-50%, -100%)';
        tooltipRef.current.style.visibility = 'visible';
      }
    };
    const render = (time: number) => {
      if (!document.hidden) paint(reduceMotion ? 0 : time / 1000, time);
      if (!reduceMotion) frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    const observer = new ResizeObserver(() => {
      if (reduceMotion) paint(0, performance.now());
    });
    observer.observe(canvas);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    // Keeps the still frame current when motion is reduced.
    const canvas = canvasRef.current;
    if (canvas && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      positionsRef.current = drawWave(canvas, { ...stateRef.current, flashRgb: null, flashAmount: 0 }, 0);
    }
  }, [expanded, working, waveAgents, hoveredId, selectedId, hubId]);

  useEffect(() => {
    if (!expanded) setHoveredId(null);
  }, [expanded]);

  const nodeAt = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return positionsRef.current.find(node => Math.hypot(node.x - x, node.y - y) <= node.r + 6)?.id ?? null;
  };

  const hubHovered = expanded && hoveredId === hubId;
  const hubClickable = Boolean(orchestratorCall);

  return (
    // The slot keeps the collapsed height, so opening the panel overlays the chat instead of pushing it down.
    <div className="relative h-14 w-full">
    <section className={'absolute inset-x-0 top-0 z-30 overflow-hidden rounded-2xl border border-white/[0.08] bg-shell transition-[height,box-shadow] duration-500 ease-out motion-reduce:transition-none ' + (expanded ? 'h-[184px] shadow-2xl shadow-black/60' : 'h-14')}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        onMouseMove={event => { const id = nodeAt(event); if (id !== hoveredId) setHoveredId(id); }}
        onMouseLeave={() => setHoveredId(null)}
        onClick={event => { const id = nodeAt(event); if (id) select(id); }}
        className={'absolute inset-0 h-full w-full ' + (hoveredCall || hoveredBuildAgent || (hubHovered && hubClickable) ? 'cursor-pointer' : '')}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-72 bg-gradient-to-r from-shell via-shell/70 to-transparent" />
      {expanded && (hoveredCall || hoveredBuildAgent || hubHovered) && <div ref={tooltipRef} role="tooltip" style={{ visibility: 'hidden' }} className="pointer-events-none absolute left-0 top-0 z-20 whitespace-nowrap rounded-xl border border-violet-300/20 bg-surface-raised/95 px-3 py-2 shadow-xl shadow-black/40 backdrop-blur">
        {hoveredBuildAgent ? <>
          <span className="block text-xs font-semibold text-white">{hoveredBuildAgent.name}</span>
          <span className="block max-w-72 truncate text-[10px] text-gray-400">{[BUILD_STATE_LABEL[hoveredBuildAgent.state], hoveredBuildAgent.currentTaskTitle, 'Click to see live activity'].filter(Boolean).join(' · ')}</span>
        </> : hoveredCall ? <>
          <span className="block text-xs font-semibold text-white">{agentName(hoveredCall)}</span>
          <span className="block text-[10px] text-gray-400">{[agentById.get(hoveredCall.agentId)?.role, callStatus(hoveredCall.status), 'Click to see activity'].filter(Boolean).join(' · ')}</span>
        </> : <>
          <span className="block text-xs font-semibold text-white">Orchestrator</span>
          <span className="block text-[10px] text-gray-400">{[title, statusText, hubClickable ? 'Click to see activity' : null].filter(Boolean).join(' · ')}</span>
        </>}
      </div>}

      <div className="relative flex h-14 items-center gap-3 px-4">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded(value => !value)}
          className="flex min-w-0 flex-1 items-center gap-3 self-stretch text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-300/60"
        >
          <span className="relative grid h-3 w-3 shrink-0 place-items-center" aria-hidden="true">
            {working && <span className="absolute inset-0 rounded-full bg-violet-400/60 motion-safe:animate-ping" />}
            <span className={'relative h-2 w-2 rounded-full ' + (working ? 'bg-violet-300 shadow-[0_0_10px_rgba(167,139,250,0.9)]' : 'bg-violet-400/70')} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold tracking-wide text-white">{title}</span>
            <span className={'block truncate text-[11px] ' + (working ? 'text-violet-300' : 'text-gray-500')}>Orchestrator · {statusText}</span>
          </span>
        </button>
        {(buildAgents.length > 0 || (expanded && agentCalls.length > 0)) && <div id={panelId} className="hidden max-w-[55%] items-center gap-1.5 overflow-x-auto md:flex">
          {buildAgents.map(agent => {
            const id = BUILD_PREFIX + agent.agentId;
            const selected = selectedBuildAgentId === agent.agentId;
            return <button
              key={id}
              type="button"
              onClick={() => select(id)}
              onMouseEnter={() => setHoveredId(id)}
              onMouseLeave={() => setHoveredId(null)}
              aria-pressed={selected}
              title={agent.currentTaskTitle ? agent.name + ': ' + agent.currentTaskTitle : agent.name}
              className={'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-left backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60 ' + (selected || hoveredId === id ? 'border-violet-300/40 bg-violet-400/10' : 'border-white/10 bg-black/40 hover:border-violet-300/25')}
            >
              <span className="relative grid h-3 w-3 place-items-center" aria-hidden="true">
                {agent.state === 'running' && <span className="absolute inset-0 rounded-full bg-violet-400/60 motion-safe:animate-ping" />}
                <Bot className="relative h-3 w-3 text-violet-300" />
              </span>
              <span className="max-w-32 truncate text-[11px] font-medium text-gray-100">{agent.name}</span>
              <span className={'rounded-full px-1.5 py-0.5 text-[9px] ' + buildStateTone(agent.state)}>{BUILD_STATE_LABEL[agent.state]}</span>
            </button>;
          })}
          {expanded && agentCalls.map(call => <button
            key={call.id}
            type="button"
            onClick={() => select(call.id)}
            onMouseEnter={() => setHoveredId(call.id)}
            onMouseLeave={() => setHoveredId(null)}
            aria-pressed={selectedCallId === call.id}
            className={'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-left backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60 ' + (selectedCallId === call.id || hoveredId === call.id ? 'border-violet-300/40 bg-violet-400/10' : 'border-white/10 bg-black/40 hover:border-violet-300/25')}
          >
            <Bot className="h-3 w-3 text-violet-300" aria-hidden="true" />
            <span className="max-w-32 truncate text-[11px] font-medium text-gray-100">{agentName(call)}</span>
            <span className={'rounded-full px-1.5 py-0.5 text-[9px] ' + callStatusTone(call.status)}>{callStatus(call.status)}</span>
          </button>)}
        </div>}
        {(failedCount > 0 || (!expanded && agentCalls.length > 0 && buildAgents.length === 0)) && <span className={'shrink-0 rounded-full border bg-black/40 px-2.5 py-1 text-[10px] ' + (failedCount > 0 ? 'border-rose-300/30 text-rose-200' : 'border-violet-300/20 text-violet-200')}>{failedCount > 0 ? 'Needs attention' : agentCalls.length + (agentCalls.length === 1 ? ' agent' : ' agents')}</span>}
        <button type="button" onClick={() => setExpanded(value => !value)} aria-label={expanded ? 'Collapse orchestrator' : 'Expand orchestrator'} className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60">
          <ChevronDown className={'h-4 w-4 transition-transform ' + (expanded ? 'rotate-180' : '')} aria-hidden="true" />
        </button>
      </div>
    </section>
    </div>
  );
};
