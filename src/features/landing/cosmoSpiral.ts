/**
 * The Cosmo mark as particles: two dotted arms winding out from a bright core.
 * Shared by the landing journey (project galaxy and closing lockup) and the
 * client access pages, so every place the spiral appears is the same shape.
 */

/** [arm 0|1, radius 0–SPIRAL_EXTENT, angular jitter, brightness 0–1, disk thickness]. */
export type SpiralParticle = [number, number, number, number, number];

/** Radians an arm winds per unit of radius. */
export const TWIST = 5.2;
/** Outer radius of the particle cloud. */
export const SPIRAL_EXTENT = 1.15;

/** Small deterministic generator, so the spiral looks the same on every load. */
export function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16_807) % 2_147_483_647;
    return state / 2_147_483_647;
  };
}

export function buildSpiral(rnd: () => number, count = 1700): SpiralParticle[] {
  const spiral: SpiralParticle[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.pow(rnd(), 0.7) * SPIRAL_EXTENT;
    spiral.push([i % 2, r, (rnd() - 0.5) * (0.35 + rnd() * 0.5), rnd(), (rnd() - 0.5) * 0.12 * (1.2 - r)]);
  }
  return spiral;
}

/** Angle of a point on an arm at radius r; jitter spreads particles across the arm's width. */
export function spiralAngle(spin: number, arm: number, r: number, jitter = 0): number {
  return spin + arm * Math.PI + r * TWIST + jitter * (0.25 + r * 0.6);
}
