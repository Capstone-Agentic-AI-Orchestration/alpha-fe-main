import React, { Suspense, lazy, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Maximize2, Minimize2, RotateCcw } from 'lucide-react';

import { useTheme, rgbChannels, type ScenePalette } from '@/shared/theme';

import { Agent, AgentCall, ProjectChatAgent, RuntimeEngine } from '@/shared/types';
import type { LiveBuildOrchestrationStatus } from '@/shared/types';
import { AgentModelPanel } from './AgentModelPanel';
import type { BuildAgentNode, BuildAgentState, BuildHandoff } from './useProjectLiveBuild';
import type { SceneAgent, SceneLink } from './OrchestratorScene3D';
import { supportsWebGL } from './orchestratorSceneLayout';
import { runningFlowAgentCount } from './flowExecution';

// three.js loads only when someone opens the flow, never with the chat itself.
const OrchestratorScene3D = lazy(() => import('./OrchestratorScene3D'));

/** Falls back to the 2D flow if the 3D view throws, for example when the GPU context is lost. */
class SceneBoundary extends React.Component<{ onError: () => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** The project's open Orchestrator build, drawn beside the chat's own agents. */
export interface FlowBuild {
  runId: string;
  label: string;
  running: boolean;
  status?: LiveBuildOrchestrationStatus;
  agents: BuildAgentNode[];
  /** Work passed between agents, drawn as links from one agent to the next. */
  handoffs?: BuildHandoff[];
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
  sidePanelOpen?: boolean;
  /** Every agent in the workspace. The 3D view shows them all around the Orchestrator. */
  roster?: Agent[];
  runtimes?: RuntimeEngine[];
  canEditAgents?: boolean;
  onUpdateAgent?: (id: string, updates: Partial<Agent>) => void;
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
  palette: ScenePalette;
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
const ROSTER_PREFIX = 'agent:';

function isOrchestratorAgent(agent: Agent): boolean {
  return agent.templateKey === 'orchestrator' || /orchestrator/i.test(agent.role);
}
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

function toneFor(status: AgentCall['status'], palette: ScenePalette): string {
  switch (status) {
    case 'failed': return rgbChannels(palette.danger);
    case 'completed': return rgbChannels(palette.success);
    case 'awaiting_confirmation': return rgbChannels(palette.warning);
    case 'queued': return rgbChannels(palette.info);
    case 'draft':
    case 'cancelled': return rgbChannels(palette.idle);
    case 'running': return rgbChannels(palette.hub);
  }
}

function buildTone(state: BuildAgentState, palette: ScenePalette): string {
  return rgbChannels(state === 'failed' ? palette.danger : state === 'completed' ? palette.success : state === 'review' ? palette.warning : state === 'waiting' ? palette.info : palette.hub);
}

const BUILD_STATE_LABEL: Record<BuildAgentState, string> = {
  running: 'Working',
  waiting: 'Waiting',
  review: 'Being checked',
  completed: 'Done',
  failed: 'Needs attention'
};


/** A soft glass sphere: light from the upper left, colour toward the rim. */
function drawOrb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, tone: string, palette: ScenePalette) {
  const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  body.addColorStop(0, `rgba(${rgbChannels(palette.highlight)}, 0.95)`);
  body.addColorStop(0.28, 'rgba(' + tone + ', 0.95)');
  body.addColorStop(0.75, 'rgba(' + tone + ', 0.55)');
  body.addColorStop(1, `rgba(${rgbChannels(palette.hubEmissive)}, 0.85)`);
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

function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, palette: ScenePalette) {
  ctx.strokeStyle = `rgba(${rgbChannels(palette.ring)}, 0.85)`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawWave(canvas: HTMLCanvasElement, state: WaveState, seconds: number): NodePosition[] {
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

  const { palette, expanded, working, agents, hoveredId, selectedId, hubId, flashRgb, flashAmount } = state;
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

  // The wave follows the palette and briefly takes the outcome colour.
  ctx.fillStyle = 'rgb(' + mix(rgbChannels(working ? palette.waveActive : palette.wave), flashRgb, flashAmount) + ')';
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
    line.addColorStop(0, 'rgba(' + rgbChannels(palette.orbit) + ', ' + (active ? 0.55 : 0.22) + ')');
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
        ctx.fillStyle = 'rgba(' + rgbChannels(palette.highlight) + ', ' + (0.9 - k * 0.22) + ')';
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
    drawOrb(ctx, node.x, node.y, node.r, tone, palette);
    if (agent.id === selectedId) drawRing(ctx, node.x, node.y, node.r + 5, palette);
    ctx.fillStyle = `rgba(${rgbChannels(palette.labelForeground)}, 0.9)`;
    ctx.font = '700 10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(agent.initial, node.x, node.y + 0.5);
  });

  // The Orchestrator: a breathing glass orb with soft ripples and two satellites.
  const hubGlow = mix(rgbChannels(palette.glow), flashRgb, flashAmount);
  const hubTone = mix(rgbChannels(palette.hub), flashRgb, flashAmount);
  const ringTone = mix(rgbChannels(palette.ring), flashRgb, flashAmount);
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
  drawOrb(ctx, hub.x, hub.y, core, hubTone, palette);
  if (selectedId === hubId) drawRing(ctx, hub.x, hub.y, core + 6, palette);
  for (let k = 0; k < 2; k++) {
    const angle = seconds * (working ? 1.6 : 0.7) + k * Math.PI;
    const sx = hub.x + Math.cos(angle) * core * 1.9;
    const sy = hub.y + Math.sin(angle) * core * 1.9;
    drawGlow(ctx, sx, sy, 7, ringTone, 0.5);
    ctx.fillStyle = `rgba(${rgbChannels(palette.highlight)}, 0.95)`;
    ctx.beginPath();
    ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  positions.push({ id: hubId, x: hub.x, y: hub.y, r: core });
  return positions;
}

export const OrchestratorFlow: React.FC<OrchestratorFlowProps> = ({ calls, agents, title, selectedCallId = null, onSelectCall, build = null, selectedBuildAgentId = null, onSelectBuildAgent, sidePanelOpen = false, roster = [], runtimes = [], canEditAgents = false, onUpdateAgent }) => {
  const { theme } = useTheme();
  const palette = theme.scene;
  const idleRgb = rgbChannels(palette.idle);
  const sceneStyle = Object.fromEntries(Object.entries(palette).map(([role, color]) => [`--scene-${role}`, rgbChannels(color)])) as React.CSSProperties;
  const [expanded, setExpanded] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const positionsRef = useRef<NodePosition[]>([]);
  const paintSecondsRef = useRef(0);
  const flashRef = useRef<{ rgb: string; start: number } | null>(null);
  const panelId = useId();
  const turnCalls = useMemo(() => latestChatTurn(calls), [calls]);
  const orchestratorCall = turnCalls.find(isOrchestratorCall);
  const agentCalls = useMemo(() => turnCalls.filter(call => !isOrchestratorCall(call)), [turnCalls]);
  const activeAgentCall = agentCalls.find(call => call.status === 'running');
  const orchestratorLive = Boolean(orchestratorCall && orchestratorCall.status === 'running');
  // Composer activity and approval clicks are not evidence that an agent is executing.
  const working = orchestratorLive || Boolean(activeAgentCall) || Boolean(build?.running);
  const buildAgents = useMemo(() => build?.agents ?? [], [build]);
  const hubId = orchestratorCall?.id ?? HUB_ID;
  const agentById = useMemo(() => new Map(agents.map(agent => [agent.id, agent])), [agents]);
  const agentName = (call: AgentCall) => agentById.get(call.agentId)?.name ?? call.agentId;
  const hoveredCall = agentCalls.find(call => call.id === hoveredId);
  const hoveredBuildAgent = hoveredId?.startsWith(BUILD_PREFIX) ? buildAgents.find(agent => BUILD_PREFIX + agent.agentId === hoveredId) : undefined;
  // Build agents come first so they keep the places closest to the Orchestrator.
  const waveAgents = useMemo<WaveAgent[]>(() => [
    ...buildAgents.map(agent => ({
      id: BUILD_PREFIX + agent.agentId,
      initial: agent.name.slice(0, 1).toUpperCase(),
      tone: buildTone(agent.state, palette),
      active: Boolean(build?.running && agent.state === 'running')
    })),
    ...agentCalls.map(call => ({
      id: call.id,
      initial: (agentById.get(call.agentId)?.name ?? call.agentId).slice(0, 1).toUpperCase(),
      tone: toneFor(call.status, palette),
      active: call.status === 'running'
    }))
  ].slice(0, AGENT_OFFSETS.length), [agentById, agentCalls, buildAgents, build?.running, palette, idleRgb]);
  const selectedId = selectedCallId ?? (selectedBuildAgentId ? BUILD_PREFIX + selectedBuildAgentId : null);
  const runningCount = runningFlowAgentCount(turnCalls, build);
  const [webgl] = useState(() => supportsWebGL());
  const [sceneFailed, setSceneFailed] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  const reduceMotion = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
  const show3D = expanded && webgl && !sceneFailed;
  const orchestratorAgent = useMemo(() => roster.find(agent => !agent.isArchived && isOrchestratorAgent(agent)), [roster]);
  // Every active agent sits on the atom, official ones first, whether or not it is working.
  const rosterAgents = useMemo(() => {
    const visible = roster.filter(agent => !agent.isArchived && agent.id !== orchestratorAgent?.id);
    const official = visible.filter(agent => agent.isSeeded || agent.templateKey);
    const others = visible.filter(agent => !(agent.isSeeded || agent.templateKey)).sort((a, b) => a.name.localeCompare(b.name));
    return [...official, ...others];
  }, [orchestratorAgent?.id, roster]);
  const [panelAgentId, setPanelAgentId] = useState<string | null>(null);
  const panelAgent = panelAgentId ? roster.find(agent => agent.id === panelAgentId) : undefined;
  const sceneAgents = useMemo<SceneAgent[]>(() => {
    if (!rosterAgents.length) {
      // No roster (for example a client view): show only the agents at work, as before.
      return [
        ...buildAgents.map(agent => ({
          id: BUILD_PREFIX + agent.agentId,
          name: agent.name,
          tone: buildTone(agent.state, palette),
          active: Boolean(build?.running && agent.state === 'running'),
          engaged: false,
          detail: [BUILD_STATE_LABEL[agent.state], agent.currentTaskTitle].filter(Boolean).join(' · ')
        })),
        ...agentCalls.map(call => ({
          id: call.id,
          name: agentById.get(call.agentId)?.name ?? call.agentId,
          tone: toneFor(call.status, palette),
          active: call.status === 'running',
          engaged: false,
          detail: [agentById.get(call.agentId)?.role, callStatus(call.status)].filter(Boolean).join(' · ')
        }))
      ];
    }
    return rosterAgents.map(agent => {
      const inBuild = buildAgents.find(node => node.agentId === agent.id);
      const call = agentCalls.find(item => item.agentId === agent.id);
      const state = inBuild ? [BUILD_STATE_LABEL[inBuild.state], inBuild.currentTaskTitle].filter(Boolean).join(' · ')
        : call ? callStatus(call.status) : 'Available · not assigned';
      return {
        id: ROSTER_PREFIX + agent.id,
        name: agent.name,
        tone: inBuild ? buildTone(inBuild.state, palette) : call ? toneFor(call.status, palette) : idleRgb,
        active: Boolean(build?.running && inBuild?.state === 'running') || call?.status === 'running',
        engaged: false,
        detail: [agent.role, state, inBuild?.changedFiles.length ? inBuild.changedFiles.length + (inBuild.changedFiles.length === 1 ? ' file changed' : ' files changed') : null, agent.modelName].filter(Boolean).join(' · ')
      };
    });
  }, [agentById, agentCalls, buildAgents, rosterAgents, build?.running, palette, idleRgb]);
  // Agent-to-agent links: who handed work to whom in the open build.
  const sceneLinks = useMemo<SceneLink[]>(() => {
    const sceneId = (agentId: string) => (rosterAgents.length ? ROSTER_PREFIX : BUILD_PREFIX) + agentId;
    const present = new Set(sceneAgents.map(agent => agent.id));
    return (build?.running ? build.handoffs ?? [] : []).filter(handoff => handoff.state === 'active')
      .map(handoff => ({ from: sceneId(handoff.fromAgentId), to: sceneId(handoff.toAgentId), state: handoff.state }))
      .filter(link => present.has(link.from) && present.has(link.to));
  }, [build?.handoffs, build?.running, rosterAgents.length, sceneAgents]);
  const agentStatus = (agentId: string): string => {
    if (agentId === orchestratorAgent?.id) return 'Orchestrator · ' + statusText;
    const inBuild = buildAgents.find(node => node.agentId === agentId);
    if (inBuild) return [BUILD_STATE_LABEL[inBuild.state], inBuild.currentTaskTitle].filter(Boolean).join(' · ');
    const call = agentCalls.find(item => item.agentId === agentId);
    return call ? callStatus(call.status) : 'Idle · not part of the current work';
  };
  const activityFor = (agentId: string): (() => void) | undefined => {
    if (agentId === orchestratorAgent?.id && orchestratorCall && onSelectCall) return () => onSelectCall(orchestratorCall.id);
    if (buildAgents.some(node => node.agentId === agentId) && onSelectBuildAgent) return () => onSelectBuildAgent(agentId);
    const call = agentCalls.find(item => item.agentId === agentId);
    if (call && onSelectCall) return () => onSelectCall(call.id);
    return onSelectBuildAgent ? () => onSelectBuildAgent(agentId) : undefined;
  };
  useEffect(() => {
    const onVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  useEffect(() => {
    if (!expanded) setMaximized(false);
  }, [expanded]);
  useEffect(() => {
    if (!maximized) return undefined;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMaximized(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [maximized]);
  useEffect(() => {
    if (!expanded) setPanelAgentId(null);
  }, [expanded]);
  const select = (id: string) => {
    if (id === hubId && orchestratorAgent) {
      setPanelAgentId(previous => (previous === orchestratorAgent.id ? null : orchestratorAgent.id));
      if (sidePanelOpen) activityFor(orchestratorAgent.id)?.();
      return;
    }
    if (id.startsWith(ROSTER_PREFIX)) {
      const agentId = id.slice(ROSTER_PREFIX.length);
      setPanelAgentId(previous => (previous === agentId ? null : agentId));
      if (sidePanelOpen) activityFor(agentId)?.();
      return;
    }
    if (id === HUB_ID) return;
    if (id.startsWith(BUILD_PREFIX)) {
      const agentId = id.slice(BUILD_PREFIX.length);
      onSelectBuildAgent?.(agentId);
      return;
    }
    onSelectCall?.(id);
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
  const stateRef = useRef({ palette, expanded, working, agents: waveAgents, hoveredId, selectedId, hubId, covered: false });
  stateRef.current = { palette, expanded, working, agents: waveAgents, hoveredId, selectedId, hubId, covered: show3D };

  // Historical outcomes remain in review/activity. The live scene returns directly to neutral.
  useEffect(() => { if (!working) flashRef.current = null; }, [working]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    const paint = (seconds: number, now: number) => {
      paintSecondsRef.current = seconds;
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
      if (!document.hidden && !stateRef.current.covered) paint(reduceMotion ? 0 : time / 1000, time);
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
    // Refresh appearance without restarting the loop or advancing a still frame.
    const canvas = canvasRef.current;
    if (canvas) {
      positionsRef.current = drawWave(canvas, { ...stateRef.current, flashRgb: null, flashAmount: 0 }, reduceMotion ? 0 : paintSecondsRef.current);
    }
  }, [expanded, working, waveAgents, hoveredId, selectedId, hubId, palette, reduceMotion]);

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
  const hubClickable = Boolean(orchestratorAgent || orchestratorCall);
  const sceneSelectedId = rosterAgents.length
    ? (panelAgentId ? (panelAgentId === orchestratorAgent?.id ? hubId : ROSTER_PREFIX + panelAgentId) : null)
    : selectedId;

  // One 3D view, shown inline or in the enlarged layer; only one is mounted at a time.
  const sceneView = <>
    <SceneBoundary onError={() => setSceneFailed(true)}>
      <Suspense fallback={<div role="status" className="absolute inset-0 grid place-items-center text-[11px] text-[rgba(var(--scene-labelForeground),0.65)]">Loading the 3D view…</div>}>
        <OrchestratorScene3D
          agents={sceneAgents}
          links={sceneLinks}
          hubId={hubId}
          hubLabel="Orchestrator"
          hubDetail={[title, statusText, orchestratorAgent ? orchestratorAgent.modelName : null, orchestratorAgent ? 'Click to see and change its model' : hubClickable ? 'Click to see activity' : null].filter(Boolean).join(' · ')}
          hubClickable={hubClickable}
          working={working}
          buildStatus={build?.status ?? null}
          selectedId={sceneSelectedId}
          onSelect={select}
          reduceMotion={reduceMotion}
          paused={!pageVisible}
          resetToken={resetToken}
        />
      </Suspense>
    </SceneBoundary>
    <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[10px] text-[rgba(var(--scene-labelForeground),0.65)]">Drag to look around · scroll to zoom · right-drag to pan · {rosterAgents.length ? 'click an agent to see and change its model' : 'click an orb for its live activity'}</p>
    {panelAgent && <div className="absolute bottom-9 left-3 top-16 z-10 flex items-start">
      <AgentModelPanel
        agent={panelAgent}
        status={agentStatus(panelAgent.id)}
        runtimes={runtimes}
        canEdit={canEditAgents && Boolean(onUpdateAgent)}
        onUpdate={(id, updates) => onUpdateAgent?.(id, updates)}
        onViewActivity={sidePanelOpen ? undefined : activityFor(panelAgent.id)}
        changedFiles={buildAgents.find(node => node.agentId === panelAgent.id)?.changedFiles}
        onClose={() => setPanelAgentId(null)}
      />
    </div>}
    {sceneAgents.length > 0 && <div className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:bottom-8 focus-within:right-4 focus-within:flex focus-within:gap-1.5">
      {sceneAgents.map(agent => <button key={agent.id} type="button" data-execution-state={agent.active ? 'running' : 'idle'} onClick={() => select(agent.id)} aria-pressed={sceneSelectedId === agent.id} className="rounded-full border border-[rgba(var(--scene-labelForeground),0.15)] bg-[rgba(var(--scene-background),0.6)] px-2.5 py-1 text-[11px] text-[rgba(var(--scene-labelForeground),0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--scene-hub),0.6)]">{agent.name}</button>)}
    </div>}
  </>;

  return (
    // The slot keeps the collapsed height, so opening the panel overlays the chat instead of pushing it down.
    <div style={sceneStyle} className="relative h-14 w-full">
    {show3D && maximized && createPortal(<div style={sceneStyle} className="fixed inset-0 z-[1000]">
      <div aria-hidden="true" onClick={() => setMaximized(false)} className="absolute inset-0 bg-[rgba(var(--scene-background),0.7)] backdrop-blur-sm" />
      <div role="dialog" aria-label={title + ' agents in 3D'} className="absolute inset-6 select-none overflow-hidden rounded-2xl border border-[rgba(var(--scene-labelForeground),0.08)] bg-[rgba(var(--scene-background),1)] shadow-2xl shadow-[rgba(var(--scene-background),0.7)]">
        {sceneView}
        <div className="absolute inset-x-0 top-0 flex h-14 items-center gap-3 bg-gradient-to-b from-[rgba(var(--scene-background),1)] to-transparent px-5">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-[rgba(var(--scene-labelForeground),1)]">{title}</span>
            <span className={'block truncate text-[11px] ' + (working ? 'text-[rgba(var(--scene-hub),1)]' : 'text-[rgba(var(--scene-labelForeground),0.65)]')}>Orchestrator · {statusText}</span>
          </span>
          <button type="button" onClick={() => setResetToken(value => value + 1)} aria-label="Reset the 3D view" title="Reset view" className="rounded-lg p-1.5 text-[rgba(var(--scene-labelForeground),0.65)] hover:bg-[rgba(var(--scene-labelForeground),0.06)] hover:text-[rgba(var(--scene-labelForeground),1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--scene-hub),0.6)]"><RotateCcw className="h-4 w-4" aria-hidden="true" /></button>
          <button type="button" onClick={() => setMaximized(false)} aria-label="Restore the 3D view" title="Restore (Esc)" className="rounded-lg p-1.5 text-[rgba(var(--scene-labelForeground),0.65)] hover:bg-[rgba(var(--scene-labelForeground),0.06)] hover:text-[rgba(var(--scene-labelForeground),1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--scene-hub),0.6)]"><Minimize2 className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      </div>
    </div>, document.body)}
    <section id={panelId} data-execution-state={working ? 'running' : 'idle'} className={'absolute inset-x-0 top-0 z-30 overflow-hidden rounded-2xl border border-[rgba(var(--scene-labelForeground),0.08)] bg-[rgba(var(--scene-background),1)] transition-[height,box-shadow] duration-500 ease-out motion-reduce:transition-none ' + (show3D ? 'h-[560px] shadow-2xl shadow-[rgba(var(--scene-background),0.6)]' : expanded ? 'h-[184px] shadow-2xl shadow-[rgba(var(--scene-background),0.6)]' : 'h-14')}>
      {show3D && !maximized && <div className="absolute inset-0 select-none">{sceneView}</div>}
      {show3D && maximized && <div role="status" className="absolute inset-0 grid place-items-center text-[11px] text-[rgba(var(--scene-labelForeground),0.65)]">Showing in the enlarged view</div>}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        onMouseMove={event => { const id = nodeAt(event); if (id !== hoveredId) setHoveredId(id); }}
        onMouseLeave={() => setHoveredId(null)}
        onClick={event => { const id = nodeAt(event); if (id) select(id); }}
        className={(show3D ? 'hidden ' : '') + 'absolute inset-0 h-full w-full ' + (hoveredCall || hoveredBuildAgent || (hubHovered && hubClickable) ? 'cursor-pointer' : '')}
      />
      <div aria-hidden="true" className={'pointer-events-none absolute left-0 top-0 w-72 bg-gradient-to-r from-[rgba(var(--scene-background),1)] via-[rgba(var(--scene-background),0.7)] to-transparent ' + (show3D ? 'h-14' : 'bottom-0')} />
      {expanded && !show3D && (hoveredCall || hoveredBuildAgent || hubHovered) && <div ref={tooltipRef} role="tooltip" style={{ visibility: 'hidden' }} className="pointer-events-none absolute left-0 top-0 z-20 whitespace-nowrap rounded-xl border border-[rgba(var(--scene-hub),0.2)] bg-[rgba(var(--scene-labelBackground),0.95)] px-3 py-2 shadow-xl shadow-[rgba(var(--scene-background),0.4)] backdrop-blur">
        {hoveredBuildAgent ? <>
          <span className="block text-xs font-semibold text-[rgba(var(--scene-labelForeground),1)]">{hoveredBuildAgent.name}</span>
          <span className="block max-w-72 truncate text-[10px] text-[rgba(var(--scene-labelForeground),0.65)]">{[BUILD_STATE_LABEL[hoveredBuildAgent.state], hoveredBuildAgent.currentTaskTitle, 'Click to see live activity'].filter(Boolean).join(' · ')}</span>
        </> : hoveredCall ? <>
          <span className="block text-xs font-semibold text-[rgba(var(--scene-labelForeground),1)]">{agentName(hoveredCall)}</span>
          <span className="block text-[10px] text-[rgba(var(--scene-labelForeground),0.65)]">{[agentById.get(hoveredCall.agentId)?.role, callStatus(hoveredCall.status), 'Click to see activity'].filter(Boolean).join(' · ')}</span>
        </> : <>
          <span className="block text-xs font-semibold text-[rgba(var(--scene-labelForeground),1)]">Orchestrator</span>
          <span className="block text-[10px] text-[rgba(var(--scene-labelForeground),0.65)]">{[title, statusText, hubClickable ? 'Click to see activity' : null].filter(Boolean).join(' · ')}</span>
        </>}
      </div>}

      <div className="relative flex h-14 items-center gap-3 px-4">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded(value => !value)}
          className="flex min-w-0 flex-1 items-center gap-3 self-stretch text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(var(--scene-hub),0.6)]"
        >
          <span className="relative grid h-3 w-3 shrink-0 place-items-center" aria-hidden="true">
            {working && <span className="absolute inset-0 rounded-full bg-[rgba(var(--scene-hub),0.6)] motion-safe:animate-ping" />}
            <span className={'relative h-2 w-2 rounded-full ' + (working ? 'bg-[rgba(var(--scene-hub),1)] shadow-[0_0_10px_rgba(var(--scene-glow),0.9)]' : 'bg-[rgba(var(--scene-hub),0.7)]')} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold tracking-wide text-[rgba(var(--scene-labelForeground),1)]">{title}</span>
            <span className={'block truncate text-[11px] ' + (working ? 'text-[rgba(var(--scene-hub),1)]' : 'text-[rgba(var(--scene-labelForeground),0.65)]')}>Orchestrator · {statusText}</span>
          </span>
        </button>
        {!expanded && <span data-agent-execution-count={runningCount} className={'shrink-0 rounded-full border bg-[rgba(var(--scene-background),0.4)] px-2.5 py-1 text-[10px] ' + (runningCount ? 'border-[rgba(var(--scene-hub),0.2)] text-[rgba(var(--scene-hub),1)]' : 'border-[rgba(var(--scene-labelForeground),0.1)] text-[rgba(var(--scene-labelForeground),0.65)]')}>{runningCount ? runningCount + (runningCount === 1 ? ' agent running' : ' agents running') : 'No agents running'}</span>}
        {show3D && <>
          <button type="button" onClick={() => setResetToken(value => value + 1)} aria-label="Reset the 3D view" title="Reset view" className="shrink-0 rounded-lg p-1 text-[rgba(var(--scene-labelForeground),0.65)] hover:bg-[rgba(var(--scene-labelForeground),0.06)] hover:text-[rgba(var(--scene-labelForeground),1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--scene-hub),0.6)]"><RotateCcw className="h-4 w-4" aria-hidden="true" /></button>
          <button type="button" onClick={() => setMaximized(value => !value)} aria-label={maximized ? 'Restore the 3D view' : 'Enlarge the 3D view'} title={maximized ? 'Restore' : 'Enlarge'} className="shrink-0 rounded-lg p-1 text-[rgba(var(--scene-labelForeground),0.65)] hover:bg-[rgba(var(--scene-labelForeground),0.06)] hover:text-[rgba(var(--scene-labelForeground),1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--scene-hub),0.6)]">{maximized ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize2 className="h-4 w-4" aria-hidden="true" />}</button>
        </>}
        <button type="button" onClick={() => setExpanded(value => !value)} aria-label={expanded ? 'Collapse orchestrator' : 'Expand orchestrator'} className="shrink-0 rounded-lg p-1 text-[rgba(var(--scene-labelForeground),0.65)] hover:bg-[rgba(var(--scene-labelForeground),0.06)] hover:text-[rgba(var(--scene-labelForeground),1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--scene-hub),0.6)]">
          <ChevronDown className={'h-4 w-4 transition-transform ' + (expanded ? 'rotate-180' : '')} aria-hidden="true" />
        </button>
      </div>
    </section>
    </div>
  );
};
