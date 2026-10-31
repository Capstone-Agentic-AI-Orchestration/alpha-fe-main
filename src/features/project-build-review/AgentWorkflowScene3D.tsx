import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { useTheme, rgbChannels, type ScenePalette } from '@/shared/theme';
import { AgentSceneOrb, SceneThemeFrame, useAgentGlowTexture } from '@/features/chat/AgentScenePrimitives';
import { workflowPathSegments, type WorkflowCurveConnection, type WorkflowSceneNode } from './workflowPaths';

function toWorld(point: [number, number], width: number, height: number, z = 0): THREE.Vector3 {
  return new THREE.Vector3(point[0] - width / 2, height / 2 - point[1], z);
}

function FlowConnection({ palette, connection, width, height, reduceMotion, glow, onSelect }: {
  palette: ScenePalette;
  connection: WorkflowCurveConnection;
  width: number;
  height: number;
  reduceMotion: boolean;
  glow: THREE.Texture;
  onSelect: (id: string) => void;
}) {
  const markers = useRef<THREE.Group>(null);
  const flowLine = useRef<any>(null);
  const particleCount = connection.active ? 3 : 1;
  const curve = useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (const segment of workflowPathSegments(connection)) path.add(new THREE.CubicBezierCurve3(
      toWorld(segment.start, width, height, 0.6), toWorld(segment.control1, width, height, 0.6),
      toWorld(segment.control2, width, height, 0.6), toWorld(segment.end, width, height, 0.6)));
    return path;
  }, [connection.start, connection.end, connection.control1, connection.control2, connection.viaX, height, width]);
  const visibleGeometry = useMemo(() => new THREE.TubeGeometry(curve, 48, connection.active || connection.selected ? 1.25 : 0.7, 7, false), [connection.active, connection.selected, curve]);
  const glowGeometry = useMemo(() => new THREE.TubeGeometry(curve, 48, connection.active || connection.selected ? 4.5 : 2.5, 7, false), [connection.active, connection.selected, curve]);
  const hitGeometry = useMemo(() => new THREE.TubeGeometry(curve, 48, 9.5, 7, false), [curve]);
  const arrowPosition = curve.getPointAt(0.94);
  const arrowRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangentAt(0.94).normalize());
  const points = useMemo(() => curve.getPoints(54), [curve]);

  useEffect(() => () => { visibleGeometry.dispose(); glowGeometry.dispose(); hitGeometry.dispose(); }, [visibleGeometry, glowGeometry, hitGeometry]);

  useFrame(({ clock }, delta) => {
    if (reduceMotion) return;
    const speed = connection.active ? 0.24 : 0.07;
    markers.current?.children.forEach((marker, index) => {
      marker.position.copy(curve.getPointAt((clock.getElapsedTime() * speed + index / particleCount) % 1));
    });
    if (flowLine.current?.material) flowLine.current.material.dashOffset -= delta * (connection.active ? 28 : 8);
  });

  return <group>
    <mesh geometry={glowGeometry}>
      <meshBasicMaterial color={connection.color} transparent opacity={connection.selected ? 0.24 : connection.active ? 0.12 : 0.035} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
    <mesh geometry={visibleGeometry}>
      <meshStandardMaterial color={connection.color} emissive={connection.color} emissiveIntensity={connection.selected ? 1.1 : connection.active ? 0.75 : 0.3} metalness={0.34} roughness={0.3} transparent opacity={connection.muted ? 0.42 : connection.active || connection.selected ? 0.96 : 0.7} depthWrite={false} />
    </mesh>
    {(connection.feedback || connection.muted) && <Line points={points} color={connection.color} lineWidth={1.2} transparent opacity={connection.muted ? 0.5 : 0.82} dashed dashSize={10} gapSize={7} />}
    {!reduceMotion && <Line ref={flowLine} points={points} color={connection.active ? palette.highlight : connection.color} lineWidth={connection.active ? 1.3 : 0.85} transparent opacity={connection.active ? 0.75 : 0.28} dashed dashSize={connection.active ? 12 : 5} gapSize={connection.active ? 48 : 65} depthWrite={false} />}
    <mesh position={arrowPosition} quaternion={arrowRotation}>
      <coneGeometry args={[4.4, 10, 10]} />
      <meshBasicMaterial color={connection.color} transparent opacity={connection.muted ? 0.48 : 0.95} />
    </mesh>
    <mesh geometry={hitGeometry} onClick={event => { event.stopPropagation(); onSelect(connection.id); }}>
      <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
    {(!reduceMotion || connection.active) && <group ref={markers}>{Array.from({ length: reduceMotion ? 1 : particleCount }, (_, index) => <group key={index} position={curve.getPointAt(reduceMotion ? 0.5 : index / particleCount)}>
      <sprite scale={connection.active ? [19, 19, 1] : [10, 10, 1]}><spriteMaterial map={glow} color={connection.color} transparent opacity={connection.active ? 0.85 : 0.35} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      <mesh><sphereGeometry args={[connection.active ? 2.6 : 1.3, 12, 10]} /><meshBasicMaterial color={connection.active ? palette.highlight : connection.color} transparent opacity={connection.active ? 1 : 0.55} toneMapped={false} /></mesh>
      {index === 0 && connection.indicator && <Html center position={[0, 13, 0]} zIndexRange={[12, 1]} style={{ pointerEvents: 'none' }}>
        <span style={{ color: palette.labelForeground, backgroundColor: `rgba(${rgbChannels(palette.labelBackground)}, 0.95)`, borderColor: `rgba(${rgbChannels(palette.ring)}, 0.4)`, boxShadow: `0 0 12px rgba(${rgbChannels(palette.glow)}, 0.35)` }} className="rounded-full border px-1.5 py-0.5 text-[8px] font-bold tracking-[0.12em]">{connection.indicator || 'CTX'}</span>
      </Html>}
    </group>)}</group>}
  </group>;
}

function NodeOrb({ palette, node, width, height, root, reduceMotion, glow, onSelect }: {
  palette: ScenePalette; node: WorkflowSceneNode; width: number; height: number; root: boolean; reduceMotion: boolean;
  glow: THREE.Texture; onSelect: (id: string) => void;
}) {
  const center = toWorld(node.center, width, height, 4);
  const scale = root ? 48 : node.kind === 'task' ? 53 : 88;
  return <group position={center} scale={scale}>
    <AgentSceneOrb palette={palette} glow={glow} color={node.color} hub={root} showRings={false} emissiveScale={0.35}
      active={node.active} engaged selected={node.selected} reduceMotion={reduceMotion}
      onClick={event => { event.stopPropagation(); onSelect(node.id); }}
      onPointerOver={event => { event.stopPropagation(); }} />
  </group>;
}

function Scene({ palette, width, height, connections, nodes, active, reduceMotion, onSelect, onSelectNode }: {
  palette: ScenePalette;
  width: number;
  height: number;
  connections: WorkflowCurveConnection[];
  nodes: WorkflowSceneNode[];
  active: boolean;
  reduceMotion: boolean;
  onSelect: (id: string) => void;
  onSelectNode: (id: string) => void;
}) {
  const glow = useAgentGlowTexture();
  return <>
    <SceneThemeFrame palette={palette} />
    <ambientLight intensity={0.32} color={palette.ring} />
    <hemisphereLight args={[palette.highlight, palette.background, 0.35]} />
    <directionalLight position={[-width * 0.22, height * 0.18, 80]} intensity={2.3} color={palette.highlight} />
    <pointLight position={[0, height * 0.25, 18]} intensity={active ? 260 : 140} distance={width * 0.72} color={palette.glow} />

    {connections.map(connection => <FlowConnection palette={palette} key={connection.id} connection={connection} width={width} height={height} reduceMotion={reduceMotion} glow={glow} onSelect={onSelect} />)}
    {nodes.map(node => <NodeOrb palette={palette} key={node.id} node={node} width={width} height={height} root={node.id === 'orchestrator'} reduceMotion={reduceMotion} glow={glow} onSelect={onSelectNode} />)}
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
  const { theme } = useTheme();
  const palette = theme.scene;
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return <Canvas
    className="absolute inset-0 z-0 h-full w-full"
    resize={{ offsetSize: true }}
    orthographic
    dpr={[1, 1.6]}
    camera={{ position: [0, 0, 120], zoom: 1, near: 0.1, far: 400 }}
    gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    frameloop={!pageVisible ? 'never' : reduceMotion ? 'demand' : 'always'}
    aria-label="Interactive 3D agent workflow connections"
  >
    <Scene palette={palette} width={width} height={height} connections={connections} nodes={nodes} active={active} reduceMotion={reduceMotion} onSelect={onSelect} onSelectNode={onSelectNode} />
  </Canvas>;
}
