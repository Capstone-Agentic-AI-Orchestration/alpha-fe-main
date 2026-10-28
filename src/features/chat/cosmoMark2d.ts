import { seeded } from '@/features/landing/cosmoSpiral';

/**
 * The Orchestrator mark for 2D canvases: a dotted sphere at rest that unfurls
 * into the two-arm Cosmo galaxy while agents work, matching the 3D view.
 */

interface Grain {
  /** Galaxy home: radius 0–1 and angle on the disc. */
  r: number;
  angle: number;
  /** Sphere home: polar angle and heading. */
  polar: number;
  heading: number;
  bright: number;
}

const GRAINS: Grain[] = (() => {
  const rnd = seeded(31);
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
  const count = 460;
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, i) => {
    const arm = i % 2;
    const base = 0.05 + 0.95 * Math.pow(rnd(), 0.95);
    const across = gauss() * (0.03 + 0.13 * base);
    const angle = arm * Math.PI + 7.6 * Math.pow(base, 0.9);
    return {
      r: Math.max(0, base + across),
      angle,
      // Evenly spaced on the sphere (a golden-angle spiral), so the resting
      // orb reads as a clean dotted ball rather than noise at small sizes.
      polar: Math.acos(1 - (2 * (i + 0.5)) / count),
      heading: i * golden,
      bright: 0.45 + 0.55 * Math.exp(-((across / (0.03 + 0.13 * base)) ** 2)) * (1 - 0.35 * base)
    };
  });
})();

/** The galaxy's tilt on a flat canvas: squashed vertically and turned a little. */
const SQUASH = 0.58;
const ROLL = 0.28;

export interface CosmoMarkOptions {
  /** Draw every nth grain; small marks read better with fewer, distinct dots. */
  every?: number;
  /** Device pixel ratio to snap dots to, so they render sharp instead of smeared. */
  pixelRatio?: number;
  /** Dot radius in CSS pixels at rest (the galaxy grows them slightly). */
  dot?: number;
  /** Sphere size relative to the galaxy's radius. */
  sphereScale?: number;
  intensity?: number;
}

/**
 * Draw the mark centred on (x, y). `morph` runs 0 (sphere) to 1 (galaxy);
 * `rgb` is an "r, g, b" string for the grains.
 */
export function drawCosmoMark(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, morph: number, seconds: number, rgb: string, options: CosmoMarkOptions = {}) {
  const { every = 1, pixelRatio = 0, dot = 0.55, sphereScale = 0.55, intensity = 1 } = options;
  const snap = (v: number) => (pixelRatio ? Math.round(v * pixelRatio) / pixelRatio : v);
  const sphereRadius = radius * sphereScale;
  const spin = -seconds * 0.12;
  const cosRoll = Math.cos(ROLL), sinRoll = Math.sin(ROLL);
  for (let index = 0; index < GRAINS.length; index += every) {
    const grain = GRAINS[index];
    const local = Math.min(1, Math.max(0, morph * 1.45 - Math.min(1, grain.r) * 0.45));
    const e = local * local * (3 - 2 * local);
    // Sphere: the grain on a turning ball, dimmer on the far side.
    const turn = grain.heading + spin;
    const sx = Math.sin(grain.polar) * Math.cos(turn) * sphereRadius;
    const sy = Math.cos(grain.polar) * sphereRadius;
    const depth = Math.sin(grain.polar) * Math.sin(turn);
    // Galaxy: the grain on the tilted disc, swirling while it changes shape.
    const twist = Math.sin(e * Math.PI) * 1.7;
    const a = grain.angle + spin + twist;
    const dx = Math.cos(a) * grain.r * radius;
    const dy = Math.sin(a) * grain.r * radius * SQUASH;
    const gx = dx * cosRoll - dy * sinRoll;
    const gy = dx * sinRoll + dy * cosRoll;
    const px = x + sx + (gx - sx) * e;
    const py = y + sy + (gy - sy) * e;
    // At rest the near side is bright and the far side faint, which gives the orb its depth.
    const alpha = ((0.12 + 0.78 * Math.pow((depth + 1) / 2, 1.6)) * (1 - e) + grain.bright * 0.8 * e) * intensity;
    const size = dot + 0.25 * e * (1 - grain.r * 0.5);
    ctx.fillStyle = 'rgba(' + rgb + ', ' + Math.min(1, alpha).toFixed(2) + ')';
    ctx.fillRect(snap(px - size), snap(py - size), Math.max(snap(size * 2), pixelRatio ? 1 / pixelRatio : 0), Math.max(snap(size * 2), pixelRatio ? 1 / pixelRatio : 0));
  }
}
