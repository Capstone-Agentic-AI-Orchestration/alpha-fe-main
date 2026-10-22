export type Vec3 = [number, number, number];

/**
 * The agents sit on three fixed orbits around the Orchestrator, like electrons
 * drawn around a nucleus. Each orbit is a circle tilted away from the viewer and
 * turned 60 degrees from the next, so from the front they read as the three
 * crossing ellipses of an atom and still have real depth when the camera turns.
 */
export const ORBIT_RADIUS = 3.3;
/** Stretches the atom sideways to fill the wide, short chat panel. */
export const ORBIT_WIDTH = 3.1;
const ORBIT_TILT = Math.acos(0.34);
// One orbit lies flat and the other two cross it at 60 degrees, so the long axes run sideways.
const ORBIT_SPINS = [0, Math.PI / 3, (2 * Math.PI) / 3];
export const ORBIT_COUNT = ORBIT_SPINS.length;

/** The point at angle t on orbit k. */
export function orbitPoint(orbit: number, t: number): Vec3 {
  const x = ORBIT_RADIUS * Math.cos(t);
  const lifted = ORBIT_RADIUS * Math.sin(t);
  const y = lifted * Math.cos(ORBIT_TILT);
  const z = lifted * Math.sin(ORBIT_TILT);
  const spin = ORBIT_SPINS[orbit];
  return [(x * Math.cos(spin) - y * Math.sin(spin)) * ORBIT_WIDTH, x * Math.sin(spin) + y * Math.cos(spin), z];
}

/** Points along orbit k, for drawing its line. */
export function orbitPath(orbit: number, segments = 96): Vec3[] {
  return Array.from({ length: segments + 1 }, (_, index) => orbitPoint(orbit, (index / segments) * Math.PI * 2));
}

function perOrbit(count: number): number[] {
  return Array.from({ length: ORBIT_COUNT }, (_, orbit) => Math.floor(count / ORBIT_COUNT) + (orbit < count % ORBIT_COUNT ? 1 : 0));
}

function placeAll(count: number, phases: number[]): Vec3[] {
  const sizes = perOrbit(count);
  return Array.from({ length: count }, (_, index) => {
    const orbit = index % ORBIT_COUNT;
    const slot = Math.floor(index / ORBIT_COUNT);
    return orbitPoint(orbit, phases[orbit] + (2 * Math.PI * slot) / sizes[orbit]);
  });
}

/** Name labels are wider than tall, so side-by-side agents need more room than stacked ones. */
const LABEL_ASPECT = 1.6;
/** Where the 3D view's camera starts; the layout is spaced for this view. */
export const CAMERA_START: Vec3 = [0, 0.5, 11.5];
/** A narrow lens from further back keeps near and far agents a similar size. */
export const CAMERA_FOV = 34;

/** Where a point lands on screen from the starting camera: nearer points spread outward. */
export function onScreen(point: Vec3): [number, number] {
  const scale = CAMERA_START[2] / (CAMERA_START[2] - point[2]);
  return [point[0] * scale, (point[1] - CAMERA_START[1]) * scale];
}

/** Smallest on-screen gap between two agents, or between an agent and the Orchestrator. */
function crowding(points: Vec3[]): number {
  const projected = points.map(onScreen);
  const hub = onScreen([0, 0, 0]);
  let gap = Infinity;
  for (let i = 0; i < projected.length; i++) {
    gap = Math.min(gap, Math.hypot(projected[i][0] - hub[0], projected[i][1] - hub[1]));
    for (let j = i + 1; j < projected.length; j++) {
      gap = Math.min(gap, Math.hypot((projected[i][0] - projected[j][0]) / LABEL_ASPECT, projected[i][1] - projected[j][1]));
    }
  }
  return gap;
}

const layoutCache = new Map<number, Vec3[]>();

/**
 * Fixed places for the agents, spread evenly over the three orbits. Agents go to
 * the orbits in turn and keep equal spacing on each. Where each orbit's first
 * agent starts is chosen once per count, so no two agents overlap where the
 * orbits cross. The places never animate.
 */
export function atomPositions(count: number): Vec3[] {
  if (count <= 0) return [];
  const cached = layoutCache.get(count);
  if (cached) return cached;
  const sizes = perOrbit(count);
  const steps = 16;
  let best: Vec3[] = placeAll(count, [0, 0, 0]);
  let bestGap = crowding(best);
  for (let a = 0; a < steps; a++) {
    for (let b = 0; b < steps; b++) {
      for (let c = 0; c < steps; c++) {
        const phases = [a, b, c].map((step, orbit) => (step / steps) * ((2 * Math.PI) / Math.max(1, sizes[orbit])));
        const points = placeAll(count, phases);
        const gap = crowding(points);
        if (gap > bestGap + 1e-9) {
          best = points;
          bestGap = gap;
        }
      }
    }
  }
  layoutCache.set(count, best);
  return best;
}

/** Height of the dot floor at a point; u runs left to right, v back to front. Same wave as the 2D bar. */
export function waveAt(u: number, v: number, t: number): number {
  return Math.sin(u * 5.5 + t + v * 1.8) * 0.55
    + Math.sin(u * 11 - t * 1.3 + v * 3.2) * 0.22
    + Math.cos(v * 4 + t * 0.7 + u * 2.4) * 0.3;
}

export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

