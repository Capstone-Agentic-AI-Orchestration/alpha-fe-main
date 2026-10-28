import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Html, Line, OrbitControls, Sparkles } from '@react-three/drei';

import { useTheme, rgbChannels, type ScenePalette } from '@/shared/theme';
import type { LiveBuildOrchestrationStatus } from '@/shared/types';

import { AgentSceneOrb, AgentSceneWave, SceneThemeFrame, useAgentGlowTexture } from './AgentScenePrimitives';
import { OrchestratorParticleSphere } from './OrchestratorParticleSphere';

import { atomPositions, CAMERA_FOV, CAMERA_START, orbitPath, ORBIT_COUNT, type Vec3 } from './orchestratorSceneLayout';

export interface SceneAgent {
  id: string;
  name: string;
  /** Orb colour as "r, g, b". */
  tone: string;
  /** Working right now: brighter glow, pulse and a spark along its link. */
  active: boolean;
  /** Taking part in the open build or chat turn, even if not working this moment. */
  engaged?: boolean;
  /** Shown on hover: state and current task. */
  detail?: string;
}

/** Work passed from one agent to another, drawn as an arc between their orbs. */
export interface SceneLink {
  from: string;
  to: string;
  /** active: the receiver is working on it now (a spark travels along it); done: delivered. */
  state: 'pending' | 'active' | 'done';
}

export interface OrchestratorSceneProps {
  agents: SceneAgent[];
  /** Agent-to-agent handoffs in the open build. */
  links?: SceneLink[];
  hubId: string;
  hubLabel: string;
  hubDetail: string;
  hubClickable: boolean;
  working: boolean;
  /** Used only to color and pace the central sphere. */
  buildStatus?: LiveBuildOrchestrationStatus | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  reduceMotion: boolean;
  paused: boolean;
  /** Changing this puts the camera back where it started. */
  resetToken: number;
}

/** The three orbit lines of the atom. */
function Orbits({ working, palette }: { working: boolean; palette: ScenePalette }) {
  const paths = useMemo(() => Array.from({ length: ORBIT_COUNT }, (_, orbit) => orbitPath(orbit)), []);
  return <>{paths.map((points, orbit) => <Line key={orbit} points={points} color={palette.orbit} lineWidth={1} transparent opacity={working ? 0.32 : 0.2} depthWrite={false} />)}</>;
}

function Hub({ palette, glow, status, reduceMotion, working, cosmo, selected, clickable, onOver, onOut, onClick }: {
  palette: ScenePalette; glow: THREE.Texture; status: LiveBuildOrchestrationStatus | null; reduceMotion: boolean; working: boolean; cosmo: boolean; selected: boolean; clickable: boolean;
  onOver: () => void; onOut: () => void; onClick: () => void;
}) {
  return <OrchestratorParticleSphere palette={palette} glow={glow} status={status} reduceMotion={reduceMotion} working={working} cosmo={cosmo} selected={selected} clickable={clickable}
    onOver={onOver} onOut={onOut} onClick={onClick} />;
}

const COMET_SEGMENTS = [0, 0.03, 0.062, 0.096, 0.132, 0.17];

/** Where an Orchestrator link leaves the Orchestrator, so its core stays clear. */
const LINK_START_RADIUS = 0.72;
/** Links stop at an agent's surface, just outside its ring, instead of running into it. */
const NODE_CLEARANCE = 0.44;

interface TrimmedCurve {
  curve: THREE.QuadraticBezierCurve3;
  /** Curve parameters where the visible line starts and ends. */
  t0: number;
  t1: number;
  points: THREE.Vector3[];
}

/** The parameter at which the curve is `clearance` away from one of its ends. */
function clearAt(curve: THREE.QuadraticBezierCurve3, fromEnd: boolean, clearance: number): number {
  const anchor = curve.getPoint(fromEnd ? 1 : 0);
  let low = 0, high = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    const t = fromEnd ? 1 - mid : mid;
    if (curve.getPoint(t).distanceTo(anchor) < clearance) low = mid; else high = mid;
  }
  return fromEnd ? 1 - high : high;
}

function trimmedCurve(start: Vec3, mid: Vec3, end: Vec3, startClearance: number, endClearance: number): TrimmedCurve {
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(...start), new THREE.Vector3(...mid), new THREE.Vector3(...end));
  const t0 = startClearance > 0 ? clearAt(curve, false, startClearance) : 0;
  const t1 = Math.max(t0 + 0.05, clearAt(curve, true, endClearance));
  const points = Array.from({ length: 49 }, (_, i) => curve.getPoint(t0 + (t1 - t0) * (i / 48)));
  return { curve, t0, t1, points };
}

/**
 * Place a tapered comet along the visible part of a link. `u` runs 0–1 from the
 * start to the agent's surface; grains that have not set off, or that reach the
 * surface, are hidden, so the comet is absorbed by the node rather than passing through it.
 */
function placeComet(group: THREE.Group, path: TrimmedCurve, u: number) {
  group.children.forEach((child, idx) => {
    const along = u - COMET_SEGMENTS[idx];
    child.visible = along >= 0 && along <= 1;
    if (child.visible) child.position.copy(path.curve.getPoint(path.t0 + (path.t1 - path.t0) * along));
  });
}

function Comet({ path, head, tail, cometRef }: { path: TrimmedCurve; head: string; tail: string; cometRef: RefObject<THREE.Group> }) {
  return <group ref={cometRef}>
    {COMET_SEGMENTS.map((seg, idx) => (
      <mesh key={seg} visible={false} position={path.points[0]}>
        <sphereGeometry args={[Math.max(0.02, 0.066 - idx * 0.009), 12, 12]} />
        <meshBasicMaterial color={idx === 0 ? head : tail} transparent opacity={Math.max(0.18, 0.98 - idx * 0.15)} depthWrite={false} />
      </mesh>
    ))}
  </group>;
}

/** A link from the Orchestrator, drawn only while the agent takes part in the work. */
function Link({ palette, end, tone, active, highlighted = false, reduceMotion }: { palette: ScenePalette; end: Vec3; tone: string; active: boolean; highlighted?: boolean; reduceMotion: boolean }) {
  const cometGroup = useRef<THREE.Group>(null);
  const path = useMemo(() => {
    const length = Math.hypot(end[0], end[1], end[2]) || 1;
    const start: Vec3 = [end[0] / length * LINK_START_RADIUS, end[1] / length * LINK_START_RADIUS, end[2] / length * LINK_START_RADIUS];
    const mid: Vec3 = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2 + 0.5, (start[2] + end[2]) / 2];
    return trimmedCurve(start, mid, end, 0, NODE_CLEARANCE);
  }, [end]);
  useFrame(({ clock }) => {
    if (!active || reduceMotion || !cometGroup.current) return;
    placeComet(cometGroup.current, path, (clock.getElapsedTime() * 0.3) % 1.35);
  });
  return <>
    <Line points={path.points} color={'rgb(' + tone + ')'} lineWidth={active ? 1.6 : highlighted ? 1.3 : 1} transparent opacity={active ? 0.8 : highlighted ? 0.6 : 0.3} depthWrite={false} />
    {active && <Comet path={path} head={palette.highlight} tail={'rgb(' + tone + ')'} cometRef={cometGroup} />}
  </>;
}

/**
 * One agent handing work to another: an arc lifted above the orbits so it reads
 * apart from the Orchestrator's links. While the receiver works on what it was
 * given, a comet runs from the sender to the receiver and the receiver ripples
 * as it arrives.
 */
function HandoffLink({ palette, start, end, state, highlighted = false, reduceMotion }: { palette: ScenePalette; start: Vec3; end: Vec3; state: SceneLink['state']; highlighted?: boolean; reduceMotion: boolean }) {
  const cometGroup = useRef<THREE.Group>(null);
  const arrivalRing = useRef<THREE.Mesh>(null);
  const path = useMemo(() => {
    const span = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
    const mid: Vec3 = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2 + 0.55 + span * 0.18, (start[2] + end[2]) / 2];
    return trimmedCurve(start, mid, end, NODE_CLEARANCE, NODE_CLEARANCE);
  }, [start, end]);
  const active = state === 'active';
  const color = active ? palette.ring : state === 'done' ? palette.success : palette.idle;
  useFrame(({ clock }) => {
    if (!active || reduceMotion) return;
    // One cycle: the comet travels to the receiver's surface, then the receiver ripples as the work lands.
    const cycle = (clock.getElapsedTime() * 0.28) % 1.45;
    if (cometGroup.current) placeComet(cometGroup.current, path, cycle);
    if (arrivalRing.current) {
      const landed = THREE.MathUtils.clamp((cycle - 1) / 0.3, 0, 1);
      const eased = 1 - Math.pow(1 - landed, 3);
      arrivalRing.current.scale.setScalar(0.85 + eased * 1.1);
      (arrivalRing.current.material as THREE.MeshBasicMaterial).opacity = landed > 0 ? (1 - eased) * 0.5 : 0;
    }
  });
  return <>
    {(active || highlighted) && <Line points={path.points} color={color} lineWidth={active ? 4 : 2.8} transparent opacity={active ? 0.18 : 0.12} depthWrite={false} />}
    <Line points={path.points} color={color} lineWidth={active ? 1.9 : highlighted ? 1.6 : 1.2}
      transparent opacity={active ? 0.92 : highlighted ? 0.8 : state === 'done' ? 0.6 : 0.32} depthWrite={false} />
    {active && <Comet path={path} head={palette.highlight} tail={color} cometRef={cometGroup} />}
    {/* A small head where the line meets the receiver shows which way the work went. */}
    <mesh position={path.points[path.points.length - 1]}><sphereGeometry args={[active ? 0.05 : 0.04, 12, 12]} /><meshBasicMaterial color={active ? palette.highlight : color} transparent opacity={state === 'pending' ? 0.55 : 0.92} /></mesh>
    {active && <Billboard position={end}><mesh ref={arrivalRing}><ringGeometry args={[0.38, 0.405, 48]} /><meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} /></mesh></Billboard>}
  </>;
}

function AgentOrb({ palette, reduceMotion, agent, position, glow, selected, hovered, onOver, onOut, onClick }: {
  palette: ScenePalette; reduceMotion: boolean; agent: SceneAgent; position: Vec3; glow: THREE.Texture; selected: boolean; hovered: boolean;
  onOver: (event: ThreeEvent<PointerEvent>) => void; onOut: () => void; onClick: (event: ThreeEvent<MouseEvent>) => void;
}) {
  const color = useMemo(() => new THREE.Color('rgb(' + agent.tone + ')'), [agent.tone]);
  const lit = agent.active || agent.engaged;
  return <group position={position}>
    <AgentSceneOrb palette={palette} reduceMotion={reduceMotion} glow={glow} color={color} active={agent.active} engaged={agent.engaged} selected={selected} hovered={hovered}
      onPointerOver={onOver} onPointerOut={onOut} onClick={onClick} />
    <Html center position={[0, -0.46, 0]} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          backgroundColor: `rgba(${rgbChannels(selected ? palette.orbit : palette.labelBackground)}, ${selected ? 0.48 : lit || hovered ? 0.78 : 0.56})`,
          borderColor: `rgba(${agent.active ? agent.tone : rgbChannels(palette.ring)}, ${agent.active || selected || hovered ? 0.45 : 0.16})`,
          color: palette.labelForeground
        }}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[8.5px] font-medium leading-3 shadow-sm"
      >
        <span style={{ backgroundColor: 'rgb(' + agent.tone + ')' }} className={'h-1.5 w-1.5 rounded-full ' + (agent.active ? 'animate-pulse' : 'opacity-85')} />
        <span>{agent.name}</span>
      </div>
    </Html>
    {hovered && agent.detail && <Html center position={[0, 0.72, 0]} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{ backgroundColor: `rgba(${rgbChannels(palette.labelBackground)}, 0.95)`, borderColor: `rgba(${rgbChannels(palette.ring)}, 0.2)`, color: palette.labelForeground }} className="w-max min-w-44 max-w-80 rounded-xl border px-3 py-2 text-left shadow-xl">
        <div className="whitespace-nowrap text-xs font-semibold">{agent.name}</div>
        {agent.detail.split(' · ').map(line => <div key={line} className="whitespace-nowrap text-[10px] leading-4 opacity-70">{line}</div>)}
        <div className="mt-1 whitespace-nowrap text-[10px]">Click to see and change its model</div>
      </div>
    </Html>}
  </group>;
}

function Scene({ agents, links = [], hubId, hubLabel, hubDetail, hubClickable, working, buildStatus, selectedId, onSelect, reduceMotion, resetToken, palette }: OrchestratorSceneProps & { palette: ScenePalette }) {
  const glow = useAgentGlowTexture();
  const { gl } = useThree();
  const controls = useThree(state => state.controls) as unknown as { reset?: () => void } | null;
  const positions = useMemo(() => atomPositions(agents.length), [agents.length]);
  const indexById = useMemo(() => new Map(agents.map((agent, index) => [agent.id, index])), [agents]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    if (resetToken) controls?.reset?.();
  }, [resetToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    gl.domElement.style.cursor = hoveredId && (hoveredId !== hubId || hubClickable) ? 'pointer' : 'default';
  }, [gl, hoveredId, hubClickable, hubId]);

  return <>
    <SceneThemeFrame palette={palette} />
    <fog attach="fog" args={[palette.background, 11, 26]} />
    <ambientLight intensity={0.45} color={palette.highlight} />
    <pointLight position={[0, 0, 0]} intensity={28} distance={14} color={palette.glow} />
    <directionalLight position={[5, 8, 6]} intensity={0.9} color={palette.highlight} />
    <AgentSceneWave palette={palette} working={working} reduceMotion={reduceMotion} />
    {!reduceMotion && <Sparkles count={60} scale={[16, 8, 9]} size={1.4} speed={0.2} opacity={0.4} color={palette.ring} />}
    <Orbits palette={palette} working={working} />
    {agents.map((agent, index) => (agent.active || agent.engaged) &&
      <Link palette={palette} reduceMotion={reduceMotion} key={'link-' + agent.id} end={positions[index]} tone={agent.tone} active={agent.active} highlighted={hoveredId === agent.id || hoveredId === hubId} />)}
    {links.map(link => {
      const from = indexById.get(link.from);
      const to = indexById.get(link.to);
      return from === undefined || to === undefined ? null
        : <HandoffLink palette={palette} key={'handoff-' + link.from + '-' + link.to} start={positions[from]} end={positions[to]} state={link.state} highlighted={hoveredId === link.from || hoveredId === link.to} reduceMotion={reduceMotion} />;
    })}
    {/* At rest the Orchestrator is a sphere; it becomes the Cosmo galaxy while agents work on what it handed them. */}
    <Hub palette={palette} reduceMotion={reduceMotion} glow={glow} status={buildStatus ?? null} working={working} cosmo={agents.some(agent => agent.active)} selected={selectedId === hubId} clickable={hubClickable}
      onOver={() => setHoveredId(hubId)} onOut={() => setHoveredId(previous => (previous === hubId ? null : previous))}
      onClick={() => onSelect(hubId)} />
    {hoveredId === hubId && <Html center position={[0, 1.45, 0]} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{ backgroundColor: `rgba(${rgbChannels(palette.labelBackground)}, 0.95)`, borderColor: `rgba(${rgbChannels(palette.ring)}, 0.2)`, color: palette.labelForeground }} className="w-max min-w-44 max-w-80 rounded-xl border px-3 py-2 shadow-xl">
        <div className="whitespace-nowrap text-xs font-semibold">{hubLabel}</div>
        {hubDetail.split(' · ').map(line => <div key={line} className="whitespace-nowrap text-[10px] leading-4 opacity-70">{line}</div>)}
      </div>
    </Html>}
    {agents.map((agent, index) => <AgentOrb palette={palette} reduceMotion={reduceMotion} key={agent.id} agent={agent} position={positions[index]} glow={glow}
      selected={selectedId === agent.id} hovered={hoveredId === agent.id}
      onOver={event => { event.stopPropagation(); setHoveredId(agent.id); }}
      onOut={() => setHoveredId(previous => (previous === agent.id ? null : previous))}
      onClick={event => { event.stopPropagation(); onSelect(agent.id); }} />)}
    <OrbitControls makeDefault enableDamping dampingFactor={0.08} enablePan minDistance={5} maxDistance={26}
      maxPolarAngle={Math.PI * 0.85} />
  </>;
}

/**
 * The Orchestrator as the nucleus of an atom, with every agent fixed on one of
 * three orbits around it. Turn, zoom and pan the camera to look around; the
 * agents themselves stay put. Click an agent or the Orchestrator to see and
 * change its model. Loaded only when the panel opens, so the chat never pays
 * for three.js until it is used.
 */
export default function OrchestratorScene3D(props: OrchestratorSceneProps) {
  const { theme } = useTheme();
  const palette = theme.scene;
  return <Canvas
    dpr={[1, 2]}
    camera={{ position: CAMERA_START, fov: CAMERA_FOV }}
    gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    frameloop={props.paused ? 'never' : props.reduceMotion ? 'demand' : 'always'}
    aria-label="Orchestrator and agents in 3D"
  >
    <Scene {...props} palette={palette} />
  </Canvas>;
}
