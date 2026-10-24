import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, Line, OrbitControls, QuadraticBezierLine, Sparkles } from '@react-three/drei';

import { AgentSceneOrb, AgentSceneWave, useAgentGlowTexture } from './AgentScenePrimitives';

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
  selectedId: string | null;
  onSelect: (id: string) => void;
  reduceMotion: boolean;
  paused: boolean;
  /** Changing this puts the camera back where it started. */
  resetToken: number;
}

const SHELL = '#0d0d11';

/** The three orbit lines of the atom. */
function Orbits({ working }: { working: boolean }) {
  const paths = useMemo(() => Array.from({ length: ORBIT_COUNT }, (_, orbit) => orbitPath(orbit)), []);
  return <>{paths.map((points, orbit) => <Line key={orbit} points={points} color="#a78bfa" lineWidth={1.1} transparent opacity={working ? 0.42 : 0.3} depthWrite={false} />)}</>;
}

function Hub({ glow, working, selected, clickable, onOver, onOut, onClick }: {
  glow: THREE.Texture; working: boolean; selected: boolean; clickable: boolean;
  onOver: () => void; onOut: () => void; onClick: () => void;
}) {
  return <AgentSceneOrb glow={glow} color="#a78bfa" hub active={working} selected={selected}
    onPointerOver={event => { event.stopPropagation(); onOver(); }} onPointerOut={onOut}
    onClick={event => { event.stopPropagation(); if (clickable) onClick(); }} />;
}

/** A link from the Orchestrator, drawn only while the agent takes part in the work. */
function Link({ end, tone, active }: { end: Vec3; tone: string; active: boolean }) {
  const line = useRef<any>(null);
  const spark = useRef<THREE.Mesh>(null);
  const mid = useMemo<Vec3>(() => [end[0] / 2, end[1] / 2 + 0.6, end[2] / 2], [end]);
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(...mid), new THREE.Vector3(...end)), [end, mid]);
  useFrame(({ clock }, delta) => {
    if (!active) return;
    if (line.current?.material) line.current.material.dashOffset -= delta * 1.4;
    if (spark.current) spark.current.position.copy(curve.getPoint((clock.getElapsedTime() * 0.45) % 1));
  });
  return <>
    <QuadraticBezierLine ref={line} start={[0, 0, 0]} end={end} mid={mid} color={'rgb(' + tone + ')'} lineWidth={active ? 1.8 : 1} transparent opacity={active ? 0.9 : 0.45} dashed={active} dashSize={0.3} gapSize={0.18} />
    {active && <mesh ref={spark}><sphereGeometry args={[0.06, 12, 12]} /><meshBasicMaterial color="#f5f3ff" /></mesh>}
  </>;
}

const HANDOFF_COLOR: Record<SceneLink['state'], string> = { active: '#c4b5fd', done: '#6ee7b7', pending: '#9ca3af' };

/**
 * One agent handing work to another: an arc lifted above the orbits so it reads
 * apart from the Orchestrator's links. While the receiver works on what it was
 * given, a spark runs from the sender to the receiver.
 */
function HandoffLink({ start, end, state, reduceMotion }: { start: Vec3; end: Vec3; state: SceneLink['state']; reduceMotion: boolean }) {
  const line = useRef<any>(null);
  const spark = useRef<THREE.Mesh>(null);
  const mid = useMemo<Vec3>(() => {
    const span = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
    return [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2 + 0.5 + span * 0.18, (start[2] + end[2]) / 2];
  }, [start, end]);
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(new THREE.Vector3(...start), new THREE.Vector3(...mid), new THREE.Vector3(...end)), [start, mid, end]);
  const active = state === 'active';
  useFrame(({ clock }, delta) => {
    if (!active || reduceMotion) return;
    if (line.current?.material) line.current.material.dashOffset -= delta * 1.2;
    if (spark.current) spark.current.position.copy(curve.getPoint((clock.getElapsedTime() * 0.35) % 1));
  });
  return <>
    <QuadraticBezierLine ref={line} start={start} end={end} mid={mid} color={HANDOFF_COLOR[state]}
      lineWidth={active ? 2 : 1.2} transparent opacity={active ? 0.95 : state === 'done' ? 0.55 : 0.3}
      dashed={state !== 'done'} dashSize={active ? 0.28 : 0.12} gapSize={active ? 0.16 : 0.14} depthWrite={false} />
    {active && <mesh ref={spark} position={start}><sphereGeometry args={[0.07, 12, 12]} /><meshBasicMaterial color="#ffffff" /></mesh>}
    {/* A small head at the receiving end shows which way the work went. */}
    <mesh position={curve.getPoint(0.92)}><sphereGeometry args={[0.045, 10, 10]} /><meshBasicMaterial color={HANDOFF_COLOR[state]} transparent opacity={state === 'pending' ? 0.5 : 0.9} /></mesh>
  </>;
}

function AgentOrb({ agent, position, glow, selected, hovered, onOver, onOut, onClick }: {
  agent: SceneAgent; position: Vec3; glow: THREE.Texture; selected: boolean; hovered: boolean;
  onOver: (event: ThreeEvent<PointerEvent>) => void; onOut: () => void; onClick: (event: ThreeEvent<MouseEvent>) => void;
}) {
  const color = useMemo(() => new THREE.Color('rgb(' + agent.tone + ')'), [agent.tone]);
  const lit = agent.active || agent.engaged;
  return <group position={position}>
    <AgentSceneOrb glow={glow} color={color} active={agent.active} engaged={agent.engaged} selected={selected} hovered={hovered}
      onPointerOver={onOver} onPointerOut={onOut} onClick={onClick} />
    <Html center position={[0, -0.46, 0]} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div className={'whitespace-nowrap rounded-full px-1.5 py-px text-[8.5px] font-medium leading-3 ' + (selected ? 'bg-violet-400/30 text-white' : lit ? 'bg-black/60 text-gray-100' : 'bg-black/40 text-gray-400')}>{agent.name}</div>
    </Html>
    {hovered && agent.detail && <Html center position={[0, 0.72, 0]} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
      <div className="w-max min-w-44 max-w-80 rounded-xl border border-violet-300/20 bg-[#16161d]/95 px-3 py-2 text-left shadow-xl shadow-black/40">
        <div className="whitespace-nowrap text-xs font-semibold text-white">{agent.name}</div>
        {agent.detail.split(' · ').map(line => <div key={line} className="whitespace-nowrap text-[10px] leading-4 text-gray-400">{line}</div>)}
        <div className="mt-1 whitespace-nowrap text-[10px] text-violet-200">Click to see and change its model</div>
      </div>
    </Html>}
  </group>;
}

function Scene({ agents, links = [], hubId, hubLabel, hubDetail, hubClickable, working, selectedId, onSelect, reduceMotion, resetToken }: OrchestratorSceneProps) {
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
    <fog attach="fog" args={[SHELL, 11, 26]} />
    <ambientLight intensity={0.45} />
    <pointLight position={[0, 0, 0]} intensity={28} distance={14} color="#a78bfa" />
    <directionalLight position={[5, 8, 6]} intensity={0.9} />
    <AgentSceneWave working={working} reduceMotion={reduceMotion} />
    {!reduceMotion && <Sparkles count={60} scale={[16, 8, 9]} size={1.4} speed={0.2} opacity={0.4} color="#c4b5fd" />}
    <Orbits working={working} />
    {agents.map((agent, index) => (agent.active || agent.engaged) &&
      <Link key={'link-' + agent.id} end={positions[index]} tone={agent.tone} active={agent.active} />)}
    {links.map(link => {
      const from = indexById.get(link.from);
      const to = indexById.get(link.to);
      return from === undefined || to === undefined ? null
        : <HandoffLink key={'handoff-' + link.from + '-' + link.to} start={positions[from]} end={positions[to]} state={link.state} reduceMotion={reduceMotion} />;
    })}
    <Hub glow={glow} working={working} selected={selectedId === hubId} clickable={hubClickable}
      onOver={() => setHoveredId(hubId)} onOut={() => setHoveredId(previous => (previous === hubId ? null : previous))}
      onClick={() => onSelect(hubId)} />
    {hoveredId === hubId && <Html center position={[0, 1.15, 0]} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
      <div className="w-max min-w-44 max-w-80 rounded-xl border border-violet-300/20 bg-[#16161d]/95 px-3 py-2 shadow-xl shadow-black/40">
        <div className="whitespace-nowrap text-xs font-semibold text-white">{hubLabel}</div>
        {hubDetail.split(' · ').map(line => <div key={line} className="whitespace-nowrap text-[10px] leading-4 text-gray-400">{line}</div>)}
      </div>
    </Html>}
    {agents.map((agent, index) => <AgentOrb key={agent.id} agent={agent} position={positions[index]} glow={glow}
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
  return <Canvas
    dpr={[1, 2]}
    camera={{ position: CAMERA_START, fov: CAMERA_FOV }}
    gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    frameloop={props.paused ? 'never' : props.reduceMotion ? 'demand' : 'always'}
    onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    aria-label="Orchestrator and agents in 3D"
  >
    <Scene {...props} />
  </Canvas>;
}

