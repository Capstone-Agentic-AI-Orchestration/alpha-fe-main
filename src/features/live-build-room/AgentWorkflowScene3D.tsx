import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';

export interface WorkflowCurveConnection {
  id: string;
  start: [number, number];
  control1: [number, number];
  control2: [number, number];
  end: [number, number];
  color: string;
  active: boolean;
  selected?: boolean;
  muted: boolean;
  feedback?: boolean;
  indicator?: 'PLAN' | 'CTX' | 'TASK';
}

export interface WorkflowSceneNode {
  id: string;
  center: [number, number];
  color: string;
  active: boolean;
  selected: boolean;
  kind?: 'task';
}

function useGlowTexture(): THREE.Texture {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(0.22, 'rgba(255,255,255,0.45)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function toWorld(point: [number, number], width: number, height: number, z = 0): THREE.Vector3 {
  return new THREE.Vector3(point[0] - width / 2, height / 2 - point[1], z);
}

function FlowConnection({ connection, width, height, reduceMotion, onSelect }: {
  connection: WorkflowCurveConnection;
  width: number;
  height: number;
  reduceMotion: boolean;
  onSelect: (id: string) => void;
}) {
  const marker = useRef<THREE.Group>(null);
  const curve = useMemo(() => new THREE.CubicBezierCurve3(
    toWorld(connection.start, width, height, 0.6),
    toWorld(connection.control1, width, height, 0.7),
    toWorld(connection.control2, width, height, 0.7),
    toWorld(connection.end, width, height, 0.6),
  ), [connection.control1, connection.control2, connection.end, connection.start, height, width]);
  const visibleGeometry = useMemo(() => new THREE.TubeGeometry(curve, 48, connection.active || connection.selected ? 1.8 : 1.15, 7, false), [connection.active, connection.selected, curve]);
  const glowGeometry = useMemo(() => new THREE.TubeGeometry(curve, 48, connection.active || connection.selected ? 7.5 : 3.8, 7, false), [connection.active, connection.selected, curve]);
  const hitGeometry = useMemo(() => new THREE.TubeGeometry(curve, 48, 9.5, 7, false), [curve]);
  const arrowPosition = curve.getPointAt(0.94);
  const arrowRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangentAt(0.94).normalize());
  const points = useMemo(() => curve.getPoints(54), [curve]);

  useFrame(({ clock }) => {
    if (!marker.current || reduceMotion || !connection.active) return;
    const progress = (clock.getElapsedTime() * 0.24 + 0.12) % 1;
    marker.current.position.copy(curve.getPointAt(progress));
  });

  return <group>
    <mesh geometry={glowGeometry}>
      <meshBasicMaterial color={connection.color} transparent opacity={connection.selected ? 0.24 : connection.active ? 0.12 : 0.035} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
    <mesh geometry={visibleGeometry}>
      <meshStandardMaterial color={connection.color} emissive={connection.color} emissiveIntensity={connection.selected ? 1.1 : connection.active ? 0.75 : 0.3} metalness={0.34} roughness={0.3} transparent opacity={connection.muted ? 0.42 : connection.active || connection.selected ? 0.96 : 0.7} depthWrite={false} />
    </mesh>
    {(connection.feedback || connection.muted) && <Line points={points} color={connection.color} lineWidth={1.2} transparent opacity={connection.muted ? 0.5 : 0.82} dashed dashSize={10} gapSize={7} />}
    <mesh position={arrowPosition} quaternion={arrowRotation}>
      <coneGeometry args={[4.4, 10, 10]} />
      <meshBasicMaterial color={connection.color} transparent opacity={connection.muted ? 0.48 : 0.95} />
    </mesh>
    <mesh geometry={hitGeometry} onClick={event => { event.stopPropagation(); onSelect(connection.id); }}>
      <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
    {connection.active && <group ref={marker} position={curve.getPointAt(reduceMotion ? 0.5 : 0.12)}>
      <mesh>
        <sphereGeometry args={[4.2, 16, 12]} />
        <meshBasicMaterial color="#f5f3ff" toneMapped={false} />
      </mesh>
      <Html center position={[0, 13, 0]} zIndexRange={[12, 1]} style={{ pointerEvents: 'none' }}>
        <span className="rounded-full border border-violet-200/40 bg-[#12101c]/95 px-1.5 py-0.5 text-[8px] font-bold tracking-[0.12em] text-violet-100 shadow-[0_0_12px_rgba(167,139,250,0.35)]">{connection.indicator || 'CTX'}</span>
      </Html>
    </group>}
  </group>;
}

function DottedField({ width, height, active }: { width: number; height: number; active: boolean }) {
  const columns = 110;
  const rows = 52;
  const { geometry, base } = useMemo(() => {
    const positions = new Float32Array(columns * rows * 3);
    const basePositions = new Float32Array(columns * rows * 3);
    let cursor = 0;
    for (let row = 0; row < rows; row += 1) {
      const depth = row / (rows - 1);
      for (let column = 0; column < columns; column += 1) {
        const across = column / (columns - 1);
        // Overscan keeps the rows continuous as the viewport pans and zooms.
        const x = (across - 0.5) * width * 1.35;
        const y = (depth * 1.25 - 0.125) * height
          + Math.sin(across * Math.PI * 2.2 + depth * 3.1) * 28
          + Math.sin(across * Math.PI * 4.3 - depth * 2.4) * 11;
        const z = -32 - depth * 24;
        positions[cursor] = x;
        positions[cursor + 1] = height / 2 - y;
        positions[cursor + 2] = z;
        basePositions[cursor] = x;
        basePositions[cursor + 1] = height / 2 - y;
        basePositions[cursor + 2] = z;
        cursor += 3;
      }
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { geometry: next, base: basePositions };
  }, [height, width]);

  useFrame(({ clock }) => {
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const time = clock.getElapsedTime() * (active ? 0.6 : 0.22);
    for (let index = 0; index < base.length / 3; index += 1) {
      const offset = index * 3;
      positions.array[offset + 1] = base[offset + 1] + Math.sin(base[offset] * 0.012 + time + Math.floor(index / columns) * 0.2) * (active ? 3.2 : 1.3);
    }
    positions.needsUpdate = true;
  });

  return <points geometry={geometry} frustumCulled={false}>
    <pointsMaterial color={active ? '#a78bfa' : '#7054b5'} size={1.45} sizeAttenuation={false} transparent opacity={0.31} depthWrite={false} blending={THREE.AdditiveBlending} />
  </points>;
}

function NodeOrb({ node, width, height, root = false, reduceMotion, glow, onSelect }: {
  node: WorkflowSceneNode; width: number; height: number; root?: boolean; reduceMotion: boolean;
  glow: THREE.Texture; onSelect: (id: string) => void;
}) {
  const core = useRef<THREE.Mesh>(null);
  const rings = useRef<THREE.Group>(null);
  const radius = root ? 29 : node.kind === 'task' ? 11 : 23;
  const center = toWorld(node.center, width, height, 3);
  useFrame(({ clock }) => {
    if (reduceMotion) return;
    const elapsed = clock.getElapsedTime();
    core.current?.scale.setScalar(1 + Math.sin(elapsed * (node.active ? 2.3 : 1.2)) * (node.active ? 0.055 : 0.023));
    if (rings.current) rings.current.rotation.z = elapsed * (root ? 0.2 : -0.14);
  });
  return <group position={center}>
    <sprite scale={[radius * 5, radius * 5, 1]}>
      <spriteMaterial map={glow} color={node.color} transparent opacity={node.active ? 0.65 : 0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
    <mesh ref={core} onClick={event => { event.stopPropagation(); onSelect(node.id); }} onPointerOver={event => { event.stopPropagation(); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
      <sphereGeometry args={[radius, 40, 32]} />
      <meshPhysicalMaterial color={node.color} emissive={node.color} emissiveIntensity={node.active ? 1.1 : 0.68} roughness={0.16} clearcoat={1} clearcoatRoughness={0.12} metalness={0.22} />
    </mesh>
    <group ref={rings}>
      <mesh rotation={[0.1, 0.28, 0]}>
        <torusGeometry args={[radius + 9, root ? 1.2 : 0.9, 8, 72]} />
        <meshStandardMaterial color={node.color} emissive={node.color} emissiveIntensity={0.95} metalness={0.6} roughness={0.22} transparent opacity={0.7} />
      </mesh>
      <mesh rotation={[0.52, -0.24, 0.28]}>
        <torusGeometry args={[radius + 15, 0.75, 7, 72]} />
        <meshStandardMaterial color={node.color} emissive={node.color} emissiveIntensity={0.62} transparent opacity={0.37} />
      </mesh>
    </group>
    {node.selected && <mesh><ringGeometry args={[radius + 20, radius + 21, 72]} /><meshBasicMaterial color="#f5f3ff" transparent opacity={0.75} side={THREE.DoubleSide} /></mesh>}
  </group>;
}

function Scene({ width, height, connections, nodes, active, reduceMotion, onSelect, onSelectNode }: {
  width: number;
  height: number;
  connections: WorkflowCurveConnection[];
  nodes: WorkflowSceneNode[];
  active: boolean;
  reduceMotion: boolean;
  onSelect: (id: string) => void;
  onSelectNode: (id: string) => void;
}) {
  const glow = useGlowTexture();
  return <>
    <ambientLight intensity={0.62} color="#ddd6fe" />
    <hemisphereLight args={['#e9d5ff', '#080b14', 0.85]} />
    <directionalLight position={[-width * 0.22, height * 0.18, 80]} intensity={1.3} color="#f5f3ff" />
    <pointLight position={[0, height * 0.25, 18]} intensity={active ? 260 : 140} distance={width * 0.72} color="#8b5cf6" />
    <DottedField width={width} height={height} active={active} />
    {connections.map(connection => <FlowConnection key={connection.id} connection={connection} width={width} height={height} reduceMotion={reduceMotion} onSelect={onSelect} />)}
    {nodes.map(node => <NodeOrb key={node.id} node={node} width={width} height={height} root={node.id === 'orchestrator'} reduceMotion={reduceMotion} glow={glow} onSelect={onSelectNode} />)}
  </>;
}

export function AgentWorkflowScene3D({ width, height, connections, nodes, active, reduceMotion, onSelect, onSelectNode }: {
  width: number;
  height: number;
  connections: WorkflowCurveConnection[];
  nodes: WorkflowSceneNode[];
  active: boolean;
  reduceMotion: boolean;
  onSelect: (id: string) => void;
  onSelectNode: (id: string) => void;
}) {
  return <Canvas
    className="absolute inset-0 z-0 h-full w-full"
    orthographic
    dpr={[1, 1.6]}
    camera={{ position: [0, 0, 120], zoom: 1, near: 0.1, far: 400 }}
    gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    frameloop={reduceMotion || !active ? 'demand' : 'always'}
    onCreated={({ gl }) => gl.setClearColor('#080a13', 0)}
    aria-label="Interactive 3D agent workflow connections"
  >
    <Scene width={width} height={height} connections={connections} nodes={nodes} active={active} reduceMotion={reduceMotion} onSelect={onSelect} onSelectNode={onSelectNode} />
  </Canvas>;
}
