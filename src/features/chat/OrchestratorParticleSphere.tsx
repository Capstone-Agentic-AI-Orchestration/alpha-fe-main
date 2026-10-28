import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';

import { seeded } from '@/features/landing/cosmoSpiral';
import type { ScenePalette } from '@/shared/theme';
import type { LiveBuildOrchestrationStatus } from '@/shared/types';

/**
 * The Orchestrator as the Cosmo mark, built as a small 3D galaxy.
 *
 * Two stippled arms wind out of a tight, bright hook at the core, with faint
 * hairlines running along them like the logo's brushed strokes. The disc has
 * real thickness and sits tilted in the scene, so orbiting the camera shows it
 * from every side. Hovering lifts and brightens the grains under the pointer;
 * a click sends one ripple out through the disc. It turns as one piece, slowly,
 * easing between speeds so it never jerks.
 */

const RADIUS = 1.15;
const ARM_GRAINS = 8200;
const DUST_GRAINS = 1500;
const CORE_GRAINS = 480;
const HAIRLINES = 18;
const RINGS = 8;

/** Radians an arm winds from the core to the rim: about one and a quarter turns. */
const WIND = 7.6;
const armAngle = (arm: number, r: number) => arm * Math.PI + WIND * Math.pow(r, 0.9);
const armWidth = (r: number) => 0.026 + 0.125 * r;

/** The disc's resting tilt: leaned back and turned a little, like a galaxy seen at an angle. */
const TILT_X = -0.62;
const TILT_Z = 0.28;

const IDLE_SPIN = 0.06;
const WORKING_SPIN = 0.15;

const STATUS_MOTION: Record<LiveBuildOrchestrationStatus, { color: keyof ScenePalette; spin: number }> = {
  planning: { color: 'hub', spin: 0.11 },
  awaiting_plan_approval: { color: 'warning', spin: 0.045 },
  executing: { color: 'hub', spin: WORKING_SPIN },
  paused: { color: 'idle', spin: 0.025 },
  validating: { color: 'info', spin: 0.11 },
  awaiting_approval: { color: 'warning', spin: 0.045 },
  publishing: { color: 'success', spin: 0.11 },
  cancelling: { color: 'warning', spin: 0.06 },
  completed: { color: 'success', spin: 0.04 },
  blocked: { color: 'warning', spin: 0.025 },
  recovery_required: { color: 'warning', spin: 0.06 },
  failed: { color: 'danger', spin: 0.02 },
  cancelled: { color: 'idle', spin: 0.025 }
};

const VERTEX = `
attribute float aSize;
attribute float aBright;
attribute float aHue;
attribute float aPhase;
uniform float uTime;
uniform float uPixel;
uniform float uScale;
uniform float uOpacity;
uniform vec3 uPointer;
uniform float uPointerAmt;
uniform float uPulse;
uniform float uPulseAmt;
uniform vec3 uWhite;
uniform vec3 uLilac;
uniform vec3 uTint;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec3 p = position;
  float r = length(p.xy);
  vec2 away = p.xy - uPointer.xy;
  float near = uPointerAmt * exp(-dot(away, away) / 0.07);
  p.xy += normalize(away + vec2(0.00001)) * near * 0.05;
  p.z += near * 0.17;
  float wave = uPulseAmt * exp(-pow((r - uPulse) * 7.0, 2.0));
  p.z += wave * 0.09;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float twinkle = 0.82 + 0.18 * sin(uTime * 1.1 + aPhase);
  vAlpha = aBright * twinkle * uOpacity * (1.0 + near * 1.3 + wave * 1.5);
  vColor = mix(uWhite, mix(uLilac, uTint, 0.45), aHue);
  gl_PointSize = aSize * uPixel * uScale / -mv.z * (1.0 + near * 0.6);
}
`;

const FRAGMENT = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(vColor, vAlpha * smoothstep(0.5, 0.06, d));
  #include <colorspace_fragment>
}
`;

function gauss(rnd: () => number): number {
  return (rnd() + rnd() + rnd() - 1.5) / 1.5;
}

/** Wider than `gauss`, so an arm has a dense spine and a soft, stippled skirt. */
function soft(rnd: () => number): number {
  return (rnd() + rnd() + rnd() + rnd() - 2) / 1.1;
}

function buildGalaxy() {
  const rnd = seeded(23);
  const position: number[] = [], size: number[] = [], bright: number[] = [], hue: number[] = [], phase: number[] = [];
  const add = (x: number, y: number, z: number, s: number, b: number, h: number) => {
    position.push(x * RADIUS, y * RADIUS, z * RADIUS);
    size.push(s); bright.push(b); hue.push(h); phase.push(rnd() * 6.2832);
  };

  for (let i = 0; i < ARM_GRAINS; i++) {
    const arm = i % 2;
    const r = 0.04 + 0.96 * Math.pow(rnd(), 0.95);
    const skirt = rnd() < 0.08;
    const across = soft(rnd) * (skirt ? 1.7 : 1);
    const a = armAngle(arm, r) + (rnd() - 0.5) * 0.06;
    const rr = r + across * armWidth(r);
    const z = gauss(rnd) * (0.012 + 0.045 * Math.pow(1 - r, 2));
    const spine = Math.exp(-across * across * 0.9);
    const sparkle = rnd() > 0.93;
    add(Math.cos(a) * rr, Math.sin(a) * rr, z, sparkle ? 0.032 : 0.018, (0.12 + 0.72 * spine) * (1 - 0.38 * r), sparkle ? 0.5 : 0.05);
  }

  // Sparse dust drifting off the arms' outer edges.
  for (let i = 0; i < DUST_GRAINS; i++) {
    const arm = i % 2;
    const r = 0.4 + 0.92 * Math.sqrt(rnd());
    const a = armAngle(arm, Math.min(1, r) * 0.96) + gauss(rnd) * 0.5;
    const z = gauss(rnd) * 0.03;
    add(Math.cos(a) * r, Math.sin(a) * r, z, rnd() > 0.8 ? 0.022 : 0.014, (0.08 + 0.22 * rnd()) * Math.max(0.15, 1.35 - r), rnd() > 0.85 ? 0.6 : 0.12);
  }

  // A small bright bulge, so the core has depth from the side.
  for (let i = 0; i < CORE_GRAINS; i++) {
    const r = Math.abs(gauss(rnd)) * 0.07;
    const a = rnd() * 6.2832;
    add(Math.cos(a) * r, Math.sin(a) * r, gauss(rnd) * 0.035, 0.03, 0.75, 0);
  }

  const grains = new THREE.BufferGeometry();
  grains.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  grains.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  grains.setAttribute('aBright', new THREE.Float32BufferAttribute(bright, 1));
  grains.setAttribute('aHue', new THREE.Float32BufferAttribute(hue, 1));
  grains.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));

  // Fine hairlines wound along the arms, the logo's brushed strokes.
  const lines: number[] = [];
  for (let h = 0; h < HAIRLINES; h++) {
    const arm = h % 2;
    const offset = ((Math.floor(h / 2) / (HAIRLINES / 2 - 1)) * 2 - 1) * 2.4;
    let previous: [number, number] | null = null;
    for (let step = 0; step <= 120; step++) {
      const r = 0.06 + (step / 120) * 0.92;
      const a = armAngle(arm, r);
      const rr = (r + offset * armWidth(r)) * RADIUS;
      const point: [number, number] = [Math.cos(a) * rr, Math.sin(a) * rr];
      if (previous) lines.push(previous[0], previous[1], 0, point[0], point[1], 0);
      previous = point;
    }
  }
  // Faint rings between the arms, like the fine circular lines behind the logo's swirl.
  for (let ring = 0; ring < RINGS; ring++) {
    const rr = (0.18 + (ring / (RINGS - 1)) * 0.78) * RADIUS;
    for (let step = 0; step < 96; step++) {
      const a0 = (step / 96) * Math.PI * 2, a1 = ((step + 1) / 96) * Math.PI * 2;
      lines.push(Math.cos(a0) * rr, Math.sin(a0) * rr, 0, Math.cos(a1) * rr, Math.sin(a1) * rr, 0);
    }
  }
  const hairlines = new THREE.BufferGeometry();
  hairlines.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  return { grains, hairlines };
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
  const disc = useRef<THREE.Group>(null);
  const core = useRef<THREE.SpriteMaterial>(null);
  const hairlineMaterial = useRef<THREE.LineBasicMaterial>(null);
  const motion = useRef({ spin: 0, angle: 0, hover: 0, hovering: false, pulse: -1 });
  const { gl, size, camera, invalidate } = useThree();
  const visual = status ? STATUS_MOTION[status] : null;
  const tint = visual ? palette[visual.color] : palette.hub;
  const targetSpin = visual?.spin ?? (working ? WORKING_SPIN : IDLE_SPIN);

  const { grains, hairlines } = useMemo(buildGalaxy, []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uPixel: { value: 1 }, uScale: { value: 500 }, uOpacity: { value: 0.8 },
      uPointer: { value: new THREE.Vector3(9, 9, 0) }, uPointerAmt: { value: 0 },
      uPulse: { value: 0 }, uPulseAmt: { value: 0 },
      uWhite: { value: new THREE.Color() }, uLilac: { value: new THREE.Color() }, uTint: { value: new THREE.Color() }
    }
  }), []);

  useEffect(() => {
    material.uniforms.uWhite.value.set(palette.highlight);
    material.uniforms.uLilac.value.set(palette.ring);
    material.uniforms.uTint.value.set(tint);
    invalidate();
  }, [material, palette.highlight, palette.ring, tint, invalidate]);

  useEffect(() => () => { grains.dispose(); hairlines.dispose(); material.dispose(); }, [grains, hairlines, material]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const m = motion.current;
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 34;
    material.uniforms.uScale.value = size.height / (2 * Math.tan((fov * Math.PI) / 360));
    material.uniforms.uPixel.value = gl.getPixelRatio();
    if (!reduceMotion) {
      material.uniforms.uTime.value = clock.getElapsedTime();
      // Ease towards the target speed; hovering adds a gentle push.
      const wanted = targetSpin * (m.hovering ? 1.6 : 1);
      m.spin += (wanted - m.spin) * (1 - Math.exp(-1.1 * dt));
      m.angle -= m.spin * dt;
    }
    if (disc.current) disc.current.rotation.z = m.angle;
    m.hover += ((m.hovering ? 1 : 0) - m.hover) * (1 - Math.exp(-5 * dt));
    material.uniforms.uPointerAmt.value = m.hover;
    let animating = Math.abs((m.hovering ? 1 : 0) - m.hover) > 0.01;
    if (m.pulse >= 0) {
      m.pulse += dt / 1.4;
      material.uniforms.uPulse.value = m.pulse * 1.3;
      material.uniforms.uPulseAmt.value = Math.max(0, 1 - m.pulse);
      if (m.pulse >= 1) { m.pulse = -1; material.uniforms.uPulseAmt.value = 0; }
      animating = true;
    }
    material.uniforms.uOpacity.value = 0.8 + (selected ? 0.15 : 0) + (working ? 0.05 : 0);
    if (core.current) core.current.opacity = (working ? 0.7 : 0.52) + (selected ? 0.2 : 0) + m.hover * 0.12 + material.uniforms.uPulseAmt.value * 0.3;
    if (hairlineMaterial.current) hairlineMaterial.current.opacity = 0.055 + m.hover * 0.05 + (selected ? 0.04 : 0);
    if (reduceMotion && animating) invalidate();
  });

  const trackPointer = (event: ThreeEvent<PointerEvent>) => {
    if (!disc.current) return;
    const local = disc.current.worldToLocal(event.point.clone());
    material.uniforms.uPointer.value.set(local.x, local.y, 0);
    if (reduceMotion) invalidate();
  };

  return <group rotation={[TILT_X, 0, TILT_Z]}>
    <group ref={disc}>
      <lineSegments geometry={hairlines}>
        <lineBasicMaterial ref={hairlineMaterial} color={palette.highlight} transparent opacity={0.06} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      <points geometry={grains} material={material} />
      <mesh
        onPointerOver={event => { event.stopPropagation(); motion.current.hovering = true; trackPointer(event); onOver(); }}
        onPointerMove={trackPointer}
        onPointerOut={() => { motion.current.hovering = false; onOut(); }}
        onClick={event => {
          event.stopPropagation();
          motion.current.pulse = 0;
          if (reduceMotion) invalidate();
          if (clickable) onClick();
        }}
      >
        <circleGeometry args={[RADIUS * 0.95, 48]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
    {/* The brightest, tightest part of the arms: a soft point of light, no disc. */}
    <sprite scale={[0.5, 0.5, 1]}>
      <spriteMaterial ref={core} map={glow} color={palette.highlight} transparent opacity={0.52} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
    <sprite scale={[RADIUS * 2.2, RADIUS * 2.2, 1]}>
      <spriteMaterial map={glow} color={tint} transparent opacity={working ? 0.12 : 0.07} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  </group>;
}
