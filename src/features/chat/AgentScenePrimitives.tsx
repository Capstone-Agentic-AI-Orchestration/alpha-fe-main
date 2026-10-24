import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { waveAt } from './orchestratorSceneLayout';

/** Shared by the chat atom and the live hierarchy so their light and materials stay consistent. */
export function useAgentGlowTexture(): THREE.Texture {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

export function AgentSceneOrb({ glow, color, active, engaged = false, selected = false, hovered = false, hub = false, emissiveScale = 1, showRings = true, reduceMotion = false, onPointerOver, onPointerOut, onClick }: {
  glow: THREE.Texture;
  color: THREE.ColorRepresentation;
  active: boolean;
  engaged?: boolean;
  selected?: boolean;
  hovered?: boolean;
  hub?: boolean;
  emissiveScale?: number;
  showRings?: boolean;
  reduceMotion?: boolean;
  onPointerOver?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: () => void;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}) {
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.SpriteMaterial>(null);
  const rings = useRef<THREE.Group>(null);
  const lit = active || engaged;
  const radius = hub ? 0.66 : 0.28;
  useFrame(({ clock }) => {
    if (reduceMotion) return;
    const t = clock.getElapsedTime();
    if (core.current && active) core.current.scale.setScalar(1 + Math.sin(t * 2.4) * 0.03);
    if (halo.current && active) halo.current.opacity = (hub ? 0.6 : 0.45) + Math.sin(t * 3) * 0.1;
    rings.current?.children.forEach((ring, index) => {
      const phase = (t * 0.45 + index / 2) % 1;
      ring.scale.setScalar(1 + phase * 1.8);
      ((ring as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = active ? (1 - phase) * 0.28 : 0;
    });
  });
  return <group>
    <sprite scale={hub ? [4.4, 4.4, 1] : hovered || selected || lit ? [1.9, 1.9, 1] : [1.3, 1.3, 1]}>
      <spriteMaterial ref={halo} map={glow} color={color} transparent opacity={hub ? active ? 0.6 : 0.45 : lit ? 0.5 : 0.24} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
    <group scale={hovered ? 1.1 : 1}>
      <mesh ref={core} onPointerOver={onPointerOver} onPointerOut={onPointerOut} onClick={onClick}>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshPhysicalMaterial color={color} emissive={hub ? '#6d28d9' : color} emissiveIntensity={(active ? hub ? 1.1 : 0.95 : lit ? 0.6 : hub ? 0.75 : 0.3) * emissiveScale} roughness={hub ? 0.15 : 0.2} clearcoat={1} clearcoatRoughness={0.1} />
      </mesh>
    </group>
    {showRings && <Billboard>
      {hub && <group ref={rings}>{[0, 1].map(i => <mesh key={i}>
        <ringGeometry args={[0.7, 0.73, 64]} />
        <meshBasicMaterial color="#c4b5fd" transparent opacity={reduceMotion && active ? 0.15 : 0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>)}</group>}
      {selected && <mesh><ringGeometry args={hub ? [0.9, 0.94, 64] : [0.4, 0.43, 48]} /><meshBasicMaterial color="#ede9fe" transparent opacity={0.9} depthWrite={false} /></mesh>}
    </Billboard>}
  </group>;
}

/** The original chat wave remains independent of the static live-graph background. */
export function AgentSceneWave({ working, reduceMotion = false }: { working: boolean; reduceMotion?: boolean }) {
  const columns = 110, rows = 36;
  const geometry = useMemo(() => {
    const next = new THREE.BufferGeometry();
    const positions = new Float32Array(columns * rows * 3);
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      const u = i / (columns - 1), v = j / (rows - 1), offset = (j * columns + i) * 3;
      positions[offset] = (u - 0.5) * 26;
      positions[offset + 1] = -4.1 + waveAt(u, v, 0) * 0.45;
      positions[offset + 2] = (v - 0.5) * 14;
    }
    next.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return next;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    if (reduceMotion) return;
    const positions = geometry.attributes.position.array as Float32Array;
    const t = clock.getElapsedTime() * (working ? 1.5 : 0.65);
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      positions[(j * columns + i) * 3 + 1] = -4.1 + waveAt(i / (columns - 1), j / (rows - 1), t) * 0.45;
    }
    geometry.attributes.position.needsUpdate = true;
  });
  return <points geometry={geometry}><pointsMaterial color={working ? '#a78bfa' : '#8b5cf6'} size={1.8} sizeAttenuation={false} transparent opacity={0.55} depthWrite={false} /></points>;
}
