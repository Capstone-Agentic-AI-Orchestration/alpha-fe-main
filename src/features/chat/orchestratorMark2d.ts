import { MARK_STROKES, markPoint, sampleMark, seeded } from '@/brand/markParticles';

/**
 * The Orchestrator mark for 2D canvases: a dotted sphere at rest that can
 * unfurl into the Alphaexplora mark, matching the 3D view.
 */

interface Grain {
  /** Mark home in mark units (half-height 1). */
  x: number;
  y: number;
  /** When the grain's stroke draws, 0–1, so the mark forms in the brand's order. */
  delay: number;
  /** Sphere home: polar angle and heading. */
  polar: number;
  heading: number;
  bright: number;
}

const GRAINS: Grain[] = (() => {
  const particles = sampleMark(seeded(31), 460);
  const golden = Math.PI * (3 - Math.sqrt(5));
  return particles.map((particle, i) => {
    const [x, y] = markPoint(particle);
    const [from, to] = MARK_STROKES[particle[0]].draw;
    return {
      x, y,
      delay: from + (to - from) * particle[1],
      // Evenly spaced on the sphere (a golden-angle spiral), so the resting
      // orb reads as a clean dotted ball rather than noise at small sizes.
      polar: Math.acos(1 - (2 * (i + 0.5)) / particles.length),
      heading: i * golden,
      bright: 0.5 + 0.5 * particle[3],
    };
  });
})();

export interface OrchestratorMarkOptions {
  /** Draw every nth grain; small marks read better with fewer, distinct dots. */
  every?: number;
  /** Device pixel ratio to snap dots to, so they render sharp instead of smeared. */
  pixelRatio?: number;
  /** Dot radius in CSS pixels at rest (the mark grows them slightly). */
  dot?: number;
  /** Sphere size relative to the mark's half-height. */
  sphereScale?: number;
  intensity?: number;
}

/**
 * Draw the mark centred on (x, y). `morph` runs 0 (sphere) to 1 (the
 * Alphaexplora mark); `rgb` is an "r, g, b" string for the grains.
 */
export function drawOrchestratorMark(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, morph: number, seconds: number, rgb: string, options: OrchestratorMarkOptions = {}) {
  const { every = 1, pixelRatio = 0, dot = 0.55, sphereScale = 0.55, intensity = 1 } = options;
  const snap = (v: number) => (pixelRatio ? Math.round(v * pixelRatio) / pixelRatio : v);
  const sphereRadius = radius * sphereScale;
  const spin = -seconds * 0.12;
  for (let index = 0; index < GRAINS.length; index += every) {
    const grain = GRAINS[index];
    const local = Math.min(1, Math.max(0, morph * 1.45 - grain.delay * 0.45));
    const e = local * local * (3 - 2 * local);
    // Sphere: the grain on a turning ball, dimmer on the far side.
    const turn = grain.heading + spin;
    const sx = Math.sin(grain.polar) * Math.cos(turn) * sphereRadius;
    const sy = Math.cos(grain.polar) * sphereRadius;
    const depth = Math.sin(grain.polar) * Math.sin(turn);
    // Mark: the grain on its stroke, swirling in while it changes shape. The A itself never spins.
    const twist = Math.sin(e * Math.PI) * 1.7;
    const c = Math.cos(twist), s = Math.sin(twist);
    const gx = (grain.x * c - grain.y * s) * radius;
    const gy = (grain.x * s + grain.y * c) * radius;
    const px = x + sx + (gx - sx) * e;
    const py = y + sy + (gy - sy) * e;
    // At rest the near side is bright and the far side faint, which gives the orb its depth.
    const alpha = ((0.12 + 0.78 * Math.pow((depth + 1) / 2, 1.6)) * (1 - e) + grain.bright * 0.8 * e) * intensity;
    const size = dot + 0.25 * e;
    ctx.fillStyle = 'rgba(' + rgb + ', ' + Math.min(1, alpha).toFixed(2) + ')';
    ctx.fillRect(snap(px - size), snap(py - size), Math.max(snap(size * 2), pixelRatio ? 1 / pixelRatio : 0), Math.max(snap(size * 2), pixelRatio ? 1 / pixelRatio : 0));
  }
}
