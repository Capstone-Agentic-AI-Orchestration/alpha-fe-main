import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Html, Line, OrbitControls, QuadraticBezierLine, Sparkles } from '@react-three/drei';

import { atomPositions, CAMERA_FOV, CAMERA_START, orbitPath, ORBIT_COUNT, waveAt, type Vec3 } from './orchestratorSceneLayout';

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
  /** Changing this puts the camera back where it started. */
  resetToken: number;
}

const SHELL = '#0d0d11';

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

/** The dotted wave from the 2D bar, laid out as a floor under the atom. */
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
        array[k++] = (u - 0.5) * 26;
        array[k++] = -4.1 + waveAt(u, v, t) * 0.45;
        array[k++] = (v - 0.5) * 14;
      }
    }
    geometry.attributes.position.needsUpdate = true;
  };
  useMemo(() => fill(0), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => fill(clock.getElapsedTime() * (working ? 1.5 : 0.65)));
  return <points geometry={geometry}>
    <pointsMaterial color={working ? '#a78bfa' : '#8b5cf6'} size={1.8} sizeAttenuation={false} transparent opacity={0.55} depthWrite={false} />
  </points>;
}

/** The three orbit lines of the atom. */
function Orbits({ working }: { working: boolean }) {
  const paths = useMemo(() => Array.from({ length: ORBIT_COUNT }, (_, orbit) => orbitPath(orbit)), []);
  return <>{paths.map((points, orbit) => <Line key={orbit} points={points} color="#a78bfa" lineWidth={1.1} transparent opacity={working ? 0.42 : 0.3} depthWrite={false} />)}</>;
}

function Hub({ glow, working, selected, clickable, onOver, onOut, onClick }: {
  glow: THREE.Texture; working: boolean; selected: boolean; clickable: boolean;
  onOver: () => void; onOut: () => void; onClick: () => void;
}) {
  const core = useRef<THREE.Mesh>(null);
  const rings = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    core.current?.scale.setScalar(1 + Math.sin(t * (working ? 2.4 : 1.2)) * 0.03);
    rings.current?.children.forEach((ring, index) => {
      const phase = (t * 0.45 + index / 2) % 1;
      ring.scale.setScalar(1 + phase * 1.8);
      ((ring as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = working ? (1 - phase) * 0.28 : 0;
    });
  });
  return <group>
    <sprite scale={[4.4, 4.4, 1]}>
      <spriteMaterial map={glow} color="#8b5cf6" transparent opacity={working ? 0.6 : 0.45} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
    <mesh ref={core}
      onPointerOver={event => { event.stopPropagation(); onOver(); }}
      onPointerOut={onOut}
      onClick={event => { event.stopPropagation(); if (clickable) onClick(); }}>
      <sphereGeometry args={[0.66, 48, 48]} />
      <meshPhysicalMaterial color="#a78bfa" emissive="#6d28d9" emissiveIntensity={working ? 1.1 : 0.75} roughness={0.15} clearcoat={1} clearcoatRoughness={0.1} />
    </mesh>
    <Billboard>
      <group ref={rings}>
        {[0, 1].map(index => <mesh key={index}>
          <ringGeometry args={[0.7, 0.73, 64]} />
          <meshBasicMaterial color="#c4b5fd" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>)}
      </group>
      {selected && <mesh><ringGeometry args={[0.9, 0.95, 64]} /><meshBasicMaterial color="#ede9fe" transparent opacity={0.9} depthWrite={false} /></mesh>}
    </Billboard>
    {/* The name sits on the orb itself, so it never collides with an agent placed just below. */}
    <Html center position={[0, 0, 0.7]} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div className={'whitespace-nowrap rounded-full px-1.5 py-px text-[9px] font-semibold leading-3 text-white ' + (selected ? 'bg-violet-500/50' : 'bg-violet-950/50')}>Orchestrator</div>
    </Html>
  </group>;
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

function AgentOrb({ agent, position, glow, selected, hovered, onOver, onOut, onClick }: {
  agent: SceneAgent; position: Vec3; glow: THREE.Texture; selected: boolean; hovered: boolean;
  onOver: (event: ThreeEvent<PointerEvent>) => void; onOut: () => void; onClick: (event: ThreeEvent<MouseEvent>) => void;
}) {
  const halo = useRef<THREE.SpriteMaterial>(null);
  const color = useMemo(() => new THREE.Color('rgb(' + agent.tone + ')'), [agent.tone]);
  // The orb stays where it is; a working agent only breathes its glow.
  useFrame(({ clock }) => {
    if (halo.current && agent.active) halo.current.opacity = 0.45 + Math.sin(clock.getElapsedTime() * 3) * 0.15;
  });
  const lit = agent.active || agent.engaged;
  return <group position={position}>
    <sprite scale={hovered || selected || lit ? [1.9, 1.9, 1] : [1.3, 1.3, 1]}>
      <spriteMaterial ref={halo} map={glow} color={color} transparent opacity={lit ? 0.5 : 0.24} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
    <mesh onPointerOver={onOver} onPointerOut={onOut} onClick={onClick} scale={hovered ? 1.15 : 1}>
      <sphereGeometry args={[0.28, 32, 32]} />
      <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={agent.active ? 0.95 : lit ? 0.6 : 0.3} roughness={0.2} clearcoat={1} />
    </mesh>
    {selected && <Billboard><mesh><ringGeometry args={[0.4, 0.44, 48]} /><meshBasicMaterial color="#ede9fe" transparent opacity={0.9} depthWrite={false} /></mesh></Billboard>}
    <Html center position={[0, -0.46, 0]} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div className={'whitespace-nowrap rounded-full px-1.5 py-px text-[8.5px] font-medium leading-3 ' + (selected ? 'bg-violet-400/30 text-white' : lit ? 'bg-black/60 text-gray-100' : 'bg-black/40 text-gray-400')}>{agent.name}</div>
    </Html>
    {hovered && agent.detail && <Html center position={[0, 0.72, 0]} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
      <div className="max-w-64 rounded-xl border border-violet-300/20 bg-[#16161d]/95 px-3 py-2 text-left shadow-xl shadow-black/40">
        <div className="text-xs font-semibold text-white">{agent.name}</div>
        <div className="mt-0.5 text-[10px] leading-4 text-gray-400">{agent.detail}</div>
        <div className="mt-1 text-[10px] text-violet-200">Click to see and change its model</div>
      </div>
    </Html>}
  </group>;
}

function Scene({ agents, hubId, hubLabel, hubDetail, hubClickable, working, selectedId, onSelect, reduceMotion, resetToken }: OrchestratorSceneProps) {
  const glow = useGlowTexture();
  const { gl } = useThree();
  const controls = useThree(state => state.controls) as unknown as { reset?: () => void } | null;
  const positions = useMemo(() => atomPositions(agents.length), [agents.length]);
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
    <WaveFloor working={working} />
    {!reduceMotion && <Sparkles count={60} scale={[16, 8, 9]} size={1.4} speed={0.2} opacity={0.4} color="#c4b5fd" />}
    <Orbits working={working} />
    {agents.map((agent, index) => (agent.active || agent.engaged) &&
      <Link key={'link-' + agent.id} end={positions[index]} tone={agent.tone} active={agent.active} />)}
    <Hub glow={glow} working={working} selected={selectedId === hubId} clickable={hubClickable}
      onOver={() => setHoveredId(hubId)} onOut={() => setHoveredId(previous => (previous === hubId ? null : previous))}
      onClick={() => onSelect(hubId)} />
    {hoveredId === hubId && <Html center position={[0, 1.15, 0]} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
      <div className="whitespace-nowrap rounded-xl border border-violet-300/20 bg-[#16161d]/95 px-3 py-2 shadow-xl shadow-black/40">
        <div className="text-xs font-semibold text-white">{hubLabel}</div>
        <div className="text-[10px] text-gray-400">{hubDetail}</div>
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

