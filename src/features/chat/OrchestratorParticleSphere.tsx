import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

import type { ScenePalette } from '@/shared/theme';
import type { LiveBuildOrchestrationStatus } from '@/shared/types';

const PARTICLE_COUNT = 680;
const SPHERE_RADIUS = 0.64;
const SPHERE_SCALE = 2;
const MOTION_GAIN = 1.4;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const STATUS_MOTION: Record<LiveBuildOrchestrationStatus, { color: keyof ScenePalette; speed: number; trails?: boolean }> = {
  planning: { color: 'hub', speed: 0.16 },
  awaiting_plan_approval: { color: 'warning', speed: 0.045 },
  executing: { color: 'hub', speed: 0.52, trails: true },
  paused: { color: 'idle', speed: 0.025 },
  validating: { color: 'info', speed: 0.22, trails: true },
  awaiting_approval: { color: 'warning', speed: 0.04 },
  publishing: { color: 'success', speed: 0.32, trails: true },
  cancelling: { color: 'warning', speed: 0.1 },
  completed: { color: 'success', speed: 0.035 },
  blocked: { color: 'warning', speed: 0.02 },
  recovery_required: { color: 'warning', speed: 0.17, trails: true },
  failed: { color: 'danger', speed: 0.012 },
  cancelled: { color: 'idle', speed: 0.018 }
};

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function OrchestratorParticleSphere({ palette, glow, status, working, selected, clickable, reduceMotion, onOver, onOut, onClick }: {
  palette: ScenePalette;
  glow: THREE.Texture;
  status: LiveBuildOrchestrationStatus | null;
  working: boolean;
  selected: boolean;
  clickable: boolean;
  reduceMotion: boolean;
  onOver: () => void;
  onOut: () => void;
  onClick: () => void;
}) {
  const root = useRef<THREE.Group>(null);
  const pointer = useRef(new THREE.Vector3());
  const pointerActive = useRef(false);
  const clickPulse = useRef(0);
  const visual = status ? STATUS_MOTION[status] : null;
  const color = visual ? palette[visual.color] : palette.hub;
  const speed = (visual?.speed ?? (working ? 0.4 : 0.1)) * MOTION_GAIN;
  const showTrails = Boolean(visual?.trails && !reduceMotion);

  const { geometry, trailGeometry, basePositions, offsets, velocities } = useMemo(() => {
    const sphere = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const trailPositions = new Float32Array(PARTICLE_COUNT * 6);

    for (let index = 0; index < PARTICLE_COUNT; index++) {
      const y = 1 - (2 * (index + 0.5)) / PARTICLE_COUNT;
      const ringRadius = Math.sqrt(1 - y * y);
      const angle = GOLDEN_ANGLE * index;
      const wobble = Math.sin(index * 12.9898) * 0.009;
      const radius = SPHERE_RADIUS + wobble;
      const offset = index * 3;
      positions[offset] = Math.cos(angle) * ringRadius * radius;
      positions[offset + 1] = y * radius;
      positions[offset + 2] = Math.sin(angle) * ringRadius * radius;

      const brightness = 0.66 + ((index * 37) % 31) / 100;
      colors[offset] = brightness;
      colors[offset + 1] = brightness;
      colors[offset + 2] = brightness;
    }

    sphere.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    sphere.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const trails = new THREE.BufferGeometry();
    trails.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3).setUsage(THREE.DynamicDrawUsage));

    return {
      geometry: sphere,
      trailGeometry: trails,
      basePositions: new Float32Array(positions),
      offsets: new Float32Array(PARTICLE_COUNT * 3),
      velocities: new Float32Array(PARTICLE_COUNT * 3)
    };
  }, []);

  useEffect(() => () => {
    geometry.dispose();
    trailGeometry.dispose();
  }, [geometry, trailGeometry]);

  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime();
    const dt = Math.min(delta, 0.05);
    if (!reduceMotion && root.current) {
      root.current.rotation.y += dt * speed;
      root.current.rotation.x = Math.sin(elapsed * 0.24) * 0.035;
      root.current.rotation.z = Math.cos(elapsed * 0.18) * 0.018;
    }

    clickPulse.current *= Math.exp(-4.2 * dt);
    const positionAttribute = geometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = positionAttribute.array as Float32Array;
    const trailAttribute = trailGeometry.getAttribute('position') as THREE.BufferAttribute;
    const trailPositions = trailAttribute.array as Float32Array;
    const pointerDirection = pointer.current;
    for (let index = 0; index < PARTICLE_COUNT; index++) {
      const offset = index * 3;
      const baseX = basePositions[offset];
      const baseY = basePositions[offset + 1];
      const baseZ = basePositions[offset + 2];
      const baseLength = Math.hypot(baseX, baseY, baseZ) || 1;
      const nx = baseX / baseLength;
      const ny = baseY / baseLength;
      const nz = baseZ / baseLength;

      let targetX = nx * clickPulse.current * 0.05;
      let targetY = ny * clickPulse.current * 0.05;
      let targetZ = nz * clickPulse.current * 0.05;

      if (!reduceMotion) {
        const phase = elapsed * (0.55 + speed * 1.2) + index * 0.071;
        const drift = Math.sin(phase) * 0.01;
        targetX += nx * drift;
        targetY += ny * drift;
        targetZ += nz * drift;
      }

      if (pointerActive.current) {
        const dot = nx * pointerDirection.x + ny * pointerDirection.y + nz * pointerDirection.z;
        const influence = smoothstep(0.68, 0.995, dot);
        if (influence > 0) {
          const tangentX = nx - pointerDirection.x * dot;
          const tangentY = ny - pointerDirection.y * dot;
          const tangentZ = nz - pointerDirection.z * dot;
          const tangentLength = Math.hypot(tangentX, tangentY, tangentZ) || 1;
          const spread = influence * 0.24;
          targetX += (tangentX / tangentLength * 0.82 + nx * 0.55) * spread;
          targetY += (tangentY / tangentLength * 0.82 + ny * 0.55) * spread;
          targetZ += (tangentZ / tangentLength * 0.82 + nz * 0.55) * spread;
        }
      }

      if (reduceMotion) {
        offsets[offset] = targetX;
        offsets[offset + 1] = targetY;
        offsets[offset + 2] = targetZ;
        velocities[offset] = velocities[offset + 1] = velocities[offset + 2] = 0;
      } else {
        const spring = 42 * dt;
        const damping = Math.exp(-9 * dt);
        velocities[offset] = (velocities[offset] + (targetX - offsets[offset]) * spring) * damping;
        velocities[offset + 1] = (velocities[offset + 1] + (targetY - offsets[offset + 1]) * spring) * damping;
        velocities[offset + 2] = (velocities[offset + 2] + (targetZ - offsets[offset + 2]) * spring) * damping;
        offsets[offset] += velocities[offset] * dt;
        offsets[offset + 1] += velocities[offset + 1] * dt;
        offsets[offset + 2] += velocities[offset + 2] * dt;
      }

      positions[offset] = baseX + offsets[offset];
      positions[offset + 1] = baseY + offsets[offset + 1];
      positions[offset + 2] = baseZ + offsets[offset + 2];

      if (showTrails) {
        const trailOffset = index * 6;
        const trailDistance = speed * 0.14;
        trailPositions[trailOffset] = positions[offset];
        trailPositions[trailOffset + 1] = positions[offset + 1];
        trailPositions[trailOffset + 2] = positions[offset + 2];
        trailPositions[trailOffset + 3] = positions[offset] - positions[offset + 2] * trailDistance;
        trailPositions[trailOffset + 4] = positions[offset + 1];
        trailPositions[trailOffset + 5] = positions[offset + 2] + positions[offset] * trailDistance;
      }
    }

    positionAttribute.needsUpdate = true;
    if (showTrails) trailAttribute.needsUpdate = true;
  });

  const setPointer = (event: { point: THREE.Vector3 }) => {
    if (!root.current) return;
    pointer.current.copy(root.current.worldToLocal(event.point.clone())).normalize();
    pointerActive.current = true;
  };

  return <group ref={root} scale={SPHERE_SCALE}>
    <sprite scale={[3.8, 3.8, 1]}>
      <spriteMaterial map={glow} color={color} transparent opacity={working ? 0.62 : 0.43} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
    <lineSegments geometry={trailGeometry} visible={showTrails}>
      <lineBasicMaterial color={color} transparent opacity={0.24} depthWrite={false} />
    </lineSegments>
    <points geometry={geometry}>
      <pointsMaterial color={color} size={0.068} sizeAttenuation transparent opacity={0.98} vertexColors depthWrite={false} />
    </points>
    <mesh
      onPointerOver={event => { event.stopPropagation(); setPointer(event); onOver(); }}
      onPointerMove={setPointer}
      onPointerOut={() => { pointerActive.current = false; onOut(); }}
      onClick={event => {
        event.stopPropagation();
        if (!clickable) return;
        clickPulse.current = 1;
        onClick();
      }}
    >
      <sphereGeometry args={[0.82, 24, 24]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
    {selected && <Billboard>
      <mesh>
        <ringGeometry args={[0.9, 0.94, 64]} />
        <meshBasicMaterial color={palette.highlight} transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </Billboard>}
  </group>;
}
