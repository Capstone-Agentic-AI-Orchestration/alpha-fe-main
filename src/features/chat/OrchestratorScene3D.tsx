import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Html, OrbitControls, QuadraticBezierLine, Sparkles } from '@react-three/drei';

import { agentPositions, waveAt, type Vec3 } from './orchestratorSceneLayout';

export interface SceneAgent {
  id: string;
  name: string;
  /** Orb colour as "r, g, b". */
  tone: string;
  /** Working right now: brighter glow, pulse and a spark along its link. */
  active: boolean;
  /** Shown on hover: state and current task. */
  detail?: string;
}

export interface OrchestratorSceneProps {
  agents: SceneAgent[];
  hubId: string;
  hubLabel: string;
  hubDetail: string;
  hubClickable: boolean;
  working: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  reduceMotion: boolean;
  paused: boolean;
  /** Changing this puts every orb and the camera back where they started. */
  resetToken: number;
}

const SHELL = '#0d0d11';
const MAX_REACH = 7;

/** A soft round glow, drawn once and tinted per sprite. */
function useGlowTexture(): THREE.Texture {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** The dotted wave from the 2D bar, laid out as a floor under the agents. */
function WaveFloor({ working }: { working: boolean }) {
  const cols = 110;
  const rows = 36;
  const geometry = useMemo(() => {
    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cols * rows * 3), 3));
    return next;
  }, []);
  const fill = (t: number) => {
    const array = geometry.attributes.position.array as Float32Array;
    let k = 0;
    for (let j = 0; j < rows; j++) {
      const v = j / (rows - 1);
      for (let i = 0; i < cols; i++) {
        const u = i / (cols - 1);
        array[k++] = (u - 0.5) * 24;
        array[k++] = -2.6 + waveAt(u, v, t) * 0.45;
        array[k++] = (v - 0.5) * 14;
      }
    }
    geometry.attributes.position.needsUpdate = true;
  };
  useMemo(() => fill(0), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => fill(clock.getElapsedTime() * (working ? 1.5 : 0.65)));
  return <points geometry={geometry}>
    <pointsMaterial color={working ? '#a78bfa' : '#8b5cf6'} size={1.8} sizeAttenuation={false} transparent opacity={0.7} depthWrite={false} />
  </points>;
}

function Hub({ glow, working, selected, onOver, onOut, onClick }: {
  glow: THREE.Texture; working: boolean; selected: boolean;
  onOver: () => void; onOut: () => void; onClick: () => void;
}) {
  const core = useRef<THREE.Mesh>(null);
  const rings = useRef<THREE.Group>(null);
  const satellites = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    core.current?.scale.setScalar(1 + Math.sin(t * (working ? 2.4 : 1.2)) * 0.04);
    if (satellites.current) satellites.current.rotation.y = t * (working ? 1.6 : 0.7);
    rings.current?.children.forEach((ring, index) => {
      const phase = (t * (working ? 0.55 : 0.3) + index / 3) % 1;
      ring.scale.setScalar(1 + phase * 2.4);
      ((ring as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.3;
    });
  });
  return <group>
    <sprite scale={[4.4, 4.4, 1]}>
      <spriteMaterial map={glow} color="#8b5cf6" transparent opacity={working ? 0.6 : 0.42} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
    <mesh ref={core} onPointerOver={event => { event.stopPropagation(); onOver(); }} onPointerOut={onOut} onClick={event => { event.stopPropagation(); onClick(); }}>
      <sphereGeometry args={[0.62, 48, 48]} />
      <meshPhysicalMaterial color="#a78bfa" emissive="#6d28d9" emissiveIntensity={working ? 1.1 : 0.7} roughness={0.15} clearcoat={1} clearcoatRoughness={0.1} />
    </mesh>
    <Billboard>
      <group ref={rings}>
        {[0, 1, 2].map(index => <mesh key={index}>
          <ringGeometry args={[0.66, 0.69, 64]} />
          <meshBasicMaterial color="#c4b5fd" transparent opacity={0.2} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>)}
      </group>
      {selected && <mesh><ringGeometry args={[0.86, 0.91, 64]} /><meshBasicMaterial color="#ede9fe" transparent opacity={0.9} depthWrite={false} /></mesh>}
    </Billboard>
    <group ref={satellites}>
      {[0, Math.PI].map(angle => <mesh key={angle} position={[Math.cos(angle) * 1.2, 0, Math.sin(angle) * 1.2]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color="#f5f3ff" />
      </mesh>)}
    </group>
  </group>;
}

function Link({ end, tone, active }: { end: Vec3; tone: string; active: boolean }) {
  const line = useRef<any>(null);
  const spark = useRef<THREE.Mesh>(null);
  const mid = useMemo<Vec3>(() => [end[0] / 2, end[1] / 2 + 0.9, end[2] / 2], [end]);
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(...mid), new THREE.Vector3(...end)), [end, mid]);
  useFrame(({ clock }, delta) => {
    if (!active) return;
    if (line.current?.material) line.current.material.dashOffset -= delta * 1.4;
    if (spark.current) spark.current.position.copy(curve.getPoint((clock.getElapsedTime() * 0.45) % 1));
  });
  return <>
    <QuadraticBezierLine ref={line} start={[0, 0, 0]} end={end} mid={mid} color={'rgb(' + tone + ')'} lineWidth={active ? 1.8 : 1} transparent opacity={active ? 0.9 : 0.35} dashed={active} dashSize={0.3} gapSize={0.18} />
    {active && <mesh ref={spark}><sphereGeometry args={[0.06, 12, 12]} /><meshBasicMaterial color="#f5f3ff" /></mesh>}
  </>;
}

function AgentOrb({ agent, position, glow, selected, hovered, dragging, handlers }: {
  agent: SceneAgent; position: Vec3; glow: THREE.Texture; selected: boolean; hovered: boolean; dragging: boolean;
  handlers: {
    onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
    onPointerMove: (event: ThreeEvent<PointerEvent>) => void;
    onPointerUp: (event: ThreeEvent<PointerEvent>) => void;
    onPointerOver: (event: ThreeEvent<PointerEvent>) => void;
    onPointerOut: () => void;
  };
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const color = useMemo(() => new THREE.Color('rgb(' + agent.tone + ')'), [agent.tone]);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const pulse = agent.active ? 1 + Math.sin(clock.getElapsedTime() * 3 + position[0]) * 0.08 : 1;
    mesh.current.scale.setScalar(pulse * (hovered || dragging ? 1.15 : 1));
  });
  const lifted = hovered || dragging || agent.active;
  return <group position={position}>
    <sprite scale={lifted ? [2.1, 2.1, 1] : [1.4, 1.4, 1]}>
      <spriteMaterial map={glow} color={color} transparent opacity={agent.active ? 0.6 : 0.32} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
    <mesh ref={mesh} {...handlers}>
      <sphereGeometry args={[0.3, 32, 32]} />
      <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={agent.active ? 0.9 : 0.35} roughness={0.2} clearcoat={1} />
    </mesh>
    {selected && <Billboard><mesh><ringGeometry args={[0.42, 0.46, 48]} /><meshBasicMaterial color="#ede9fe" transparent opacity={0.9} depthWrite={false} /></mesh></Billboard>}
    <Html center position={[0, -0.58, 0]} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div className={'whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ' + (selected ? 'bg-violet-400/25 text-white' : 'bg-black/60 text-gray-200')}>{agent.name}</div>
    </Html>
    {(hovered && !dragging && agent.detail) && <Html center position={[0, 0.75, 0]} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
      <div className="max-w-64 rounded-xl border border-violet-300/20 bg-[#16161d]/95 px-3 py-2 text-left shadow-xl shadow-black/40">
        <div className="text-xs font-semibold text-white">{agent.name}</div>
        <div className="mt-0.5 text-[10px] leading-4 text-gray-400">{agent.detail}</div>
        <div className="mt-1 text-[10px] text-violet-200">Click for live activity · drag to move</div>
      </div>
    </Html>}
  </group>;
}

function Scene({ agents, hubId, hubLabel, hubDetail, hubClickable, working, selectedId, onSelect, reduceMotion, resetToken }: OrchestratorSceneProps) {
  const glow = useGlowTexture();
  const { camera, gl } = useThree();
  const controls = useThree(state => state.controls) as unknown as { enabled: boolean; reset?: () => void } | null;
  const defaults = useMemo(() => agentPositions(agents.length), [agents.length]);
  const [moved, setMoved] = useState<Record<string, Vec3>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const drag = useRef<{ id: string; plane: THREE.Plane; offset: THREE.Vector3; x: number; y: number; moved: boolean } | null>(null);

  useEffect(() => {
    if (!resetToken) return;
    setMoved({});
    setTouched(false);
    controls?.reset?.();
  }, [resetToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    gl.domElement.style.cursor = draggingId ? 'grabbing' : hoveredId ? (hoveredId === hubId ? (hubClickable ? 'pointer' : 'default') : 'grab') : 'default';
  }, [draggingId, gl, hoveredId, hubClickable, hubId]);

  const positionOf = (id: string, index: number): Vec3 => moved[id] ?? defaults[index];

  const handlersFor = (agent: SceneAgent, index: number) => ({
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      const position = new THREE.Vector3(...positionOf(agent.id, index));
      // Drag across the plane facing the camera, through the orb, so it follows the pointer at its own depth.
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), position);
      const hit = event.ray.intersectPlane(plane, new THREE.Vector3()) ?? position.clone();
      drag.current = { id: agent.id, plane, offset: hit.sub(position), x: event.clientX, y: event.clientY, moved: false };
      (event.target as unknown as Element).setPointerCapture(event.pointerId);
      if (controls) controls.enabled = false;
      setDraggingId(agent.id);
      setTouched(true);
    },
    onPointerMove: (event: ThreeEvent<PointerEvent>) => {
      const current = drag.current;
      if (!current) return;
      event.stopPropagation();
      if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 4) return;
      current.moved = true;
      const hit = event.ray.intersectPlane(current.plane, new THREE.Vector3());
      if (!hit) return;
      hit.sub(current.offset).clampLength(0, MAX_REACH);
      setMoved(previous => ({ ...previous, [current.id]: [hit.x, hit.y, hit.z] }));
    },
    onPointerUp: (event: ThreeEvent<PointerEvent>) => {
      const current = drag.current;
      if (!current) return;
      event.stopPropagation();
      (event.target as unknown as Element).releasePointerCapture?.(event.pointerId);
      drag.current = null;
      if (controls) controls.enabled = true;
      setDraggingId(null);
      if (!current.moved) onSelect(current.id);
    },
    onPointerOver: (event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); setHoveredId(agent.id); },
    onPointerOut: () => setHoveredId(previous => (previous === agent.id ? null : previous))
  });

  return <>
    <fog attach="fog" args={[SHELL, 10, 24]} />
    <ambientLight intensity={0.45} />
    <pointLight position={[0, 0, 0]} intensity={28} distance={14} color="#a78bfa" />
    <directionalLight position={[5, 8, 6]} intensity={0.9} />
    <WaveFloor working={working} />
    {!reduceMotion && <Sparkles count={70} scale={[14, 6, 9]} size={1.6} speed={0.25} opacity={0.5} color="#c4b5fd" />}
    {agents.map((agent, index) => <Link key={'link-' + agent.id} end={positionOf(agent.id, index)} tone={agent.tone} active={agent.active} />)}
    <Hub glow={glow} working={working} selected={selectedId === hubId}
      onOver={() => setHoveredId(hubId)} onOut={() => setHoveredId(previous => (previous === hubId ? null : previous))}
      onClick={() => { if (hubClickable) onSelect(hubId); }} />
    {hoveredId === hubId && <Html center position={[0, 1.1, 0]} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
      <div className="whitespace-nowrap rounded-xl border border-violet-300/20 bg-[#16161d]/95 px-3 py-2 shadow-xl shadow-black/40">
        <div className="text-xs font-semibold text-white">{hubLabel}</div>
        <div className="text-[10px] text-gray-400">{hubDetail}</div>
      </div>
    </Html>}
    {agents.map((agent, index) => <AgentOrb key={agent.id} agent={agent} position={positionOf(agent.id, index)} glow={glow}
      selected={selectedId === agent.id} hovered={hoveredId === agent.id} dragging={draggingId === agent.id} handlers={handlersFor(agent, index)} />)}
    <OrbitControls makeDefault enableDamping dampingFactor={0.08} enablePan minDistance={4.5} maxDistance={18}
      maxPolarAngle={Math.PI * 0.85} autoRotate={!reduceMotion && !touched && !hoveredId} autoRotateSpeed={0.4}
      onStart={() => setTouched(true)} />
  </>;
}

/**
 * The Orchestrator and its agents in 3D. Orbit, zoom and pan the camera; drag an
 * orb to move it; click one to open its live activity. Loaded only when the
 * flow panel opens, so the chat never pays for three.js until it is used.
 */
export default function OrchestratorScene3D(props: OrchestratorSceneProps) {
  return <Canvas
    dpr={[1, 2]}
    camera={{ position: [0, 2.6, 9.5], fov: 45 }}
    gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    frameloop={props.paused ? 'never' : props.reduceMotion ? 'demand' : 'always'}
    onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    aria-label="Orchestrator and agents in 3D"
  >
    <Scene {...props} />
  </Canvas>;
}

