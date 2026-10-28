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
  return Array.from({ length: 460 }, (_, i) => {
    const arm = i % 2;
    const base = 0.05 + 0.95 * Math.pow(rnd(), 0.95);
    const across = gauss() * (0.03 + 0.13 * base);
    const angle = arm * Math.PI + 7.6 * Math.pow(base, 0.9);
    return {
      r: Math.max(0, base + across),
      angle,
      polar: Math.acos(1 - 2 * rnd()),
      heading: angle + (rnd() - 0.5) * 0.3,
      bright: 0.45 + 0.55 * Math.exp(-((across / (0.03 + 0.13 * base)) ** 2)) * (1 - 0.35 * base)
    };
  });
})();

/** The galaxy's tilt on a flat canvas: squashed vertically and turned a little. */
const SQUASH = 0.58;
const ROLL = 0.28;

/**
 * Draw the mark centred on (x, y). `morph` runs 0 (sphere) to 1 (galaxy);
 * `rgb` is an "r, g, b" string for the grains.
 */
export function drawCosmoMark(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, morph: number, seconds: number, rgb: string, intensity = 1) {
  const sphereRadius = radius * 0.55;
  const spin = -seconds * 0.12;
  const cosRoll = Math.cos(ROLL), sinRoll = Math.sin(ROLL);
  for (const grain of GRAINS) {
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
    const alpha = ((0.32 + 0.38 * (depth + 1) / 2) * (1 - e) + grain.bright * 0.8 * e) * intensity;
    const size = 0.55 + 0.35 * e * (1 - grain.r * 0.5);
    ctx.fillStyle = 'rgba(' + rgb + ', ' + Math.min(1, alpha).toFixed(2) + ')';
    ctx.fillRect(px - size, py - size, size * 2, size * 2);
  }
}
