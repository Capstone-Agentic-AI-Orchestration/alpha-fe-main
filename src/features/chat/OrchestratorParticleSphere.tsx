import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';

import { seeded } from '@/features/landing/cosmoSpiral';
import type { ScenePalette } from '@/shared/theme';
import type { LiveBuildOrchestrationStatus } from '@/shared/types';

/**
 * The Orchestrator: a quiet sphere of light at rest, the Cosmo galaxy while it
 * hands work to agents.
 *
 * Every grain has two homes, one on the sphere and one in the galaxy. When
 * agents start working the sphere unfurls from the core outwards, swirling as
 * it flattens into two stippled arms; when the work ends it folds back. The
 * galaxy has real thickness and sits tilted in the scene, so orbiting the
 * camera shows its depth. Hovering lifts the grains under the pointer and a
 * click sends one ripple through it. It turns slowly and eases between speeds.
 */

const RADIUS = 1.15;
/** Resting sphere radius: the size of the old Orchestrator orb, without its large glow. */
const SPHERE_RADIUS = 0.62;
const ARM_GRAINS = 8200;
const DUST_GRAINS = 1500;
const CORE_GRAINS = 480;
// Keep the resting shell airy; the remaining grains appear as it unfurls.
const SPHERE_STRIDE = 5;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const HAIRLINES = 18;
const RINGS = 8;
/** Seconds to unfurl into the galaxy, or fold back into the sphere. */
const MORPH_SECONDS = 2.2;

/** Radians an arm winds from the core to the rim: about one and a quarter turns. */
const WIND = 7.6;
const armAngle = (arm: number, r: number) => arm * Math.PI + WIND * Math.pow(r, 0.9);
const armWidth = (r: number) => 0.026 + 0.125 * r;

/** The galaxy's resting tilt: leaned back and turned a little. */
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
attribute vec3 aSphere;
attribute float aSphereVisible;
attribute float aDelay;
attribute float aSize;
attribute float aBright;
attribute float aHue;
attribute float aPhase;
uniform float uTime;
uniform float uPixel;
uniform float uScale;
uniform float uOpacity;
uniform float uMorph;
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
  // The core unfurls first and the rim follows, so the galaxy grows out of the sphere.
  float local = clamp(uMorph * 1.45 - aDelay * 0.45, 0.0, 1.0);
  float e = local * local * (3.0 - 2.0 * local);
  vec3 p = mix(aSphere, position, e);
  // A swirl that is strongest halfway through the change and gone at either end.
  float twist = sin(e * 3.14159) * (1.7 - aDelay * 0.6);
  float c = cos(twist), s = sin(twist);
  p.xy = mat2(c, s, -s, c) * p.xy;

  float r = length(p.xy);
  vec2 away = p.xy - uPointer.xy;
  float near = uPointerAmt * exp(-dot(away, away) / 0.07);
  p += normalize(p + vec3(0.00001)) * near * 0.09 * (1.0 - e);
  p.xy += normalize(away + vec2(0.00001)) * near * 0.05 * e;
  p.z += near * 0.17 * e;
  float wave = uPulseAmt * exp(-pow((r - uPulse) * 7.0, 2.0));
  p.z += wave * 0.09;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float twinkle = 0.82 + 0.18 * sin(uTime * 1.1 + aPhase);
  // A dim far side and a clear near side preserve the shell's depth without
  // stacking thousands of translucent grains into a fuzzy surface.
  vec3 sphereNormal = normalize(normalMatrix * normalize(aSphere));
  float sphereBright = (0.14 + 0.5 * max(0.0, sphereNormal.z)) * aSphereVisible;
  vAlpha = mix(sphereBright, aBright, e) * twinkle * uOpacity * (1.0 + near * 1.3 + wave * 1.5);
  vColor = mix(mix(uWhite, mix(uLilac, uTint, 0.3), 0.55), mix(uWhite, mix(uLilac, uTint, 0.45), aHue), e);
  // Keep dots legible in CSS pixels at either display density and at different
  // zoom levels, then rasterize at the canvas's actual device pixel ratio.
  float diameter = mix(0.018, aSize, e) * uScale / -mv.z * (1.0 + near * 0.6);
  gl_PointSize = clamp(diameter, mix(1.2, 0.85, e), mix(2.2, 3.0, e)) * uPixel;
}
`;

const FRAGMENT = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  // A solid center with only a half-pixel antialiased rim, rather than a glow
  // fading across the entire dot. Derivatives keep that rim stable on zoom.
  float edge = max(fwidth(d) * 0.5, 0.015);
  float coverage = 1.0 - smoothstep(0.5 - edge, 0.5, d);
  gl_FragColor = vec4(vColor, vAlpha * coverage);
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
  const position: number[] = [], sphere: number[] = [], sphereVisible: number[] = [], delay: number[] = [];
  const size: number[] = [], bright: number[] = [], hue: number[] = [], phase: number[] = [];
  const shellCount = Math.ceil((ARM_GRAINS + DUST_GRAINS + CORE_GRAINS) / SPHERE_STRIDE);
  const add = (x: number, y: number, z: number, s: number, b: number, h: number) => {
    position.push(x * RADIUS, y * RADIUS, z * RADIUS);
    // Interleaved golden-angle shells distribute the visible dots evenly,
    // avoiding random clusters. Hidden grains have distinct homes too, ready
    // to fade in along their existing sphere-to-galaxy morph.
    const index = size.length;
    const layer = index % SPHERE_STRIDE;
    const slot = Math.floor(index / SPHERE_STRIDE);
    const heading = slot * GOLDEN_ANGLE + layer * Math.PI * 2 / SPHERE_STRIDE;
    const polar = Math.acos(1 - 2 * (slot + 0.5) / shellCount);
    sphere.push(Math.cos(heading) * Math.sin(polar) * SPHERE_RADIUS, Math.sin(heading) * Math.sin(polar) * SPHERE_RADIUS, Math.cos(polar) * SPHERE_RADIUS);
    sphereVisible.push(layer === 0 ? 1 : 0);
    delay.push(Math.min(1, Math.hypot(x, y)));
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
  grains.setAttribute('aSphere', new THREE.Float32BufferAttribute(sphere, 3));
  grains.setAttribute('aSphereVisible', new THREE.Float32BufferAttribute(sphereVisible, 1));
  grains.setAttribute('aDelay', new THREE.Float32BufferAttribute(delay, 1));
  grains.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  grains.setAttribute('aBright', new THREE.Float32BufferAttribute(bright, 1));
  grains.setAttribute('aHue', new THREE.Float32BufferAttribute(hue, 1));
  grains.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  // The grains move in the shader, beyond the bounds three.js would compute from `position`.
  grains.boundingSphere = new THREE.Sphere(new THREE.Vector3(), RADIUS * 1.6);

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

const smooth = (v: number) => v * v * (3 - 2 * v);

export function OrchestratorParticleSphere({ palette, glow, status, working, cosmo, selected, clickable, reduceMotion, onOver, onOut, onClick }: {
  palette: ScenePalette;
  glow: THREE.Texture;
  status: LiveBuildOrchestrationStatus | null;
  working: boolean;
  /** Agents are working on handed-off tasks: unfurl into the galaxy. */
  cosmo: boolean;
  selected: boolean;
  clickable: boolean;
  reduceMotion: boolean;
  onOver: () => void;
  onOut: () => void;
  onClick: () => void;
}) {
  const disc = useRef<THREE.Group>(null);
  const core = useRef<THREE.SpriteMaterial>(null);
  const halo = useRef<THREE.SpriteMaterial>(null);
  const hairlineMaterial = useRef<THREE.LineBasicMaterial>(null);
  const motion = useRef({ spin: 0, angle: 0, hover: 0, hovering: false, pulse: -1, morph: cosmo ? 1 : 0 });
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
      uTime: { value: 0 }, uPixel: { value: 1 }, uScale: { value: 500 }, uOpacity: { value: 0.8 }, uMorph: { value: 0 },
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

  useEffect(() => { invalidate(); }, [cosmo, invalidate]);
  useEffect(() => () => { grains.dispose(); hairlines.dispose(); material.dispose(); }, [grains, hairlines, material]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const m = motion.current;
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 34;
    material.uniforms.uScale.value = size.height / (2 * Math.tan((fov * Math.PI) / 360));
    material.uniforms.uPixel.value = gl.getPixelRatio();

    const morphTarget = cosmo ? 1 : 0;
    if (reduceMotion) m.morph = morphTarget;
    else m.morph += Math.sign(morphTarget - m.morph) * Math.min(Math.abs(morphTarget - m.morph), dt / MORPH_SECONDS);
    const shape = smooth(m.morph);
    material.uniforms.uMorph.value = m.morph;

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
      material.uniforms.uPulse.value = m.pulse * (SPHERE_RADIUS + (RADIUS * 1.3 - SPHERE_RADIUS) * shape);
      material.uniforms.uPulseAmt.value = Math.max(0, 1 - m.pulse);
      if (m.pulse >= 1) { m.pulse = -1; material.uniforms.uPulseAmt.value = 0; }
      animating = true;
    }
    material.uniforms.uOpacity.value = 0.8 + (selected ? 0.15 : 0) + (working ? 0.05 : 0);
    if (core.current) core.current.opacity = ((working ? 0.7 : 0.5) + (selected ? 0.2 : 0) + m.hover * 0.12 + material.uniforms.uPulseAmt.value * 0.3) * shape;
    if (halo.current) halo.current.opacity = ((working ? 0.12 : 0.07) + (selected ? 0.06 : 0)) * shape;
    if (hairlineMaterial.current) hairlineMaterial.current.opacity = (0.055 + m.hover * 0.05 + (selected ? 0.04 : 0)) * Math.max(0, shape * 1.4 - 0.4);
    if (reduceMotion && animating) invalidate();
  });

  const trackPointer = (event: ThreeEvent<PointerEvent>) => {
    if (!disc.current) return;
    const local = disc.current.worldToLocal(event.point.clone());
    material.uniforms.uPointer.value.set(local.x, local.y, 0);
    if (reduceMotion) invalidate();
  };
  const pointerHandlers = {
    onPointerOver: (event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); motion.current.hovering = true; trackPointer(event); onOver(); },
    onPointerMove: trackPointer,
    onPointerOut: () => { motion.current.hovering = false; onOut(); },
    onClick: (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      motion.current.pulse = 0;
      if (reduceMotion) invalidate();
      if (clickable) onClick();
    }
  };

  return <group rotation={[TILT_X, 0, TILT_Z]}>
    <group ref={disc}>
      <lineSegments geometry={hairlines}>
        <lineBasicMaterial ref={hairlineMaterial} color={palette.highlight} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      <points geometry={grains} material={material} />
      {/* Pointer targets: the sphere at rest, the disc as the galaxy. */}
      {cosmo
        ? <mesh {...pointerHandlers}><circleGeometry args={[RADIUS * 0.95, 48]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} /></mesh>
        : <mesh {...pointerHandlers}><sphereGeometry args={[SPHERE_RADIUS * 1.1, 24, 24]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>}
    </group>
    <sprite scale={[0.5, 0.5, 1]}>
      <spriteMaterial ref={core} map={glow} color={palette.highlight} transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
    <sprite scale={[RADIUS * 2.1, RADIUS * 2.1, 1]}>
      <spriteMaterial ref={halo} map={glow} color={tint} transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  </group>;
}
