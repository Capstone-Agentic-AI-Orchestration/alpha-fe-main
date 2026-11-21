import mark from './alphaexploraMark.json';

/**
 * The Alphaexplora mark as particles: dots spread along the strokes of the
 * A, its orbit and its three speed trails. Shared by the loading screen, the
 * landing journey, the client access backdrop and the chat orchestrator, so
 * every place the mark forms is the same shape.
 *
 * Mark units: origin at the centre of the mark's box, y down, and the box's
 * half-height is 1. The A never rotates; only the orbit turns.
 */

export type Vec = [number, number];
export type MarkLayer = 'letter' | 'orbit' | 'trail';

/** [stroke index, position along it 0–1, offset across it in mark units, brightness 0–1, depth −1…1]. */
export type MarkParticle = [number, number, number, number, number];

export interface MarkStroke {
  id: string;
  layer: MarkLayer;
  /** Window of the formation (0–1) in which this stroke draws, in the order of the brand's loading animation. */
  draw: readonly [number, number];
  /** Length in mark units. */
  length: number;
  /** Point at a share t (0–1) of the stroke's length. */
  at(t: number): Vec;
  /** Unit normal at t, for spreading dots across the stroke. */
  normal(t: number): Vec;
}

type StrokeSpec = { id: string; layer: string; draw: number[]; line?: number[][]; cubic?: number[][] };

const [VIEW_W, VIEW_H] = mark.viewBox;
const UNIT = VIEW_H / 2;
const toMark = ([x, y]: number[]): Vec => [(x - VIEW_W / 2) / UNIT, (y - VIEW_H / 2) / UNIT];

/** Half the drawn stroke width in mark units. */
export const MARK_HALF_WIDTH = mark.strokeWidth / 2 / UNIT;
/** Where the two legs meet: the point the mark ignites from. */
export const MARK_APEX = toMark([151, 34]);
/** Centre of the inner A's counter: the opening the loading screen dives through. */
export const MARK_COUNTER = toMark([151, 158]);
/** Centre of the orbit's circle, which the orbit turns about. */
export const MARK_ORBIT_CENTRE = toMark([151, 145]);
/** Width over height of the mark's box. */
export const MARK_ASPECT = VIEW_W / VIEW_H;
/** Direction the speed trails stream in (unit vector, pointing away from the A). */
export const MARK_TRAIL_DIRECTION: Vec = (() => {
  const [x, y] = [93 - 117, 279 - 229];
  const length = Math.hypot(x, y);
  return [x / length, y / length];
})();

function cubicPoint([p0, p1, p2, p3]: Vec[], t: number): Vec {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

/** A stroke as a polyline walked by arc length, so dots spread evenly whatever its shape. */
function buildStroke(spec: StrokeSpec): MarkStroke {
  const points: Vec[] = spec.cubic
    ? Array.from({ length: 33 }, (_, i) => cubicPoint(spec.cubic!.map(toMark), i / 32))
    : spec.line!.map(toMark);
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const total = lengths[lengths.length - 1];
  const segment = (t: number) => {
    const target = Math.max(0, Math.min(1, t)) * total;
    let i = 1;
    while (i < lengths.length - 1 && lengths[i] < target) i++;
    const span = lengths[i] - lengths[i - 1] || 1;
    return { i, f: (target - lengths[i - 1]) / span };
  };
  return {
    id: spec.id,
    layer: spec.layer as MarkLayer,
    draw: [spec.draw[0], spec.draw[1]],
    length: total,
    at(t) {
      const { i, f } = segment(t);
      const a = points[i - 1], b = points[i];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    },
    normal(t) {
      const { i } = segment(t);
      const dx = points[i][0] - points[i - 1][0], dy = points[i][1] - points[i - 1][1];
      const length = Math.hypot(dx, dy) || 1;
      return [-dy / length, dx / length];
    },
  };
}

export const MARK_STROKES: readonly MarkStroke[] = (mark.strokes as StrokeSpec[]).map(buildStroke);

/** Small deterministic generator, so the mark looks the same on every load. */
export function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16_807) % 2_147_483_647;
    return state / 2_147_483_647;
  };
}

const gauss = (rnd: () => number) => (rnd() + rnd() + rnd() - 1.5) / 1.5;

/**
 * Dots spread along the strokes by length, so a long leg is no thinner than a
 * short trail. Most sit inside the stroke's width; a few drift wider as a halo.
 */
export function sampleMark(rnd: () => number, count = 1700): MarkParticle[] {
  const total = MARK_STROKES.reduce((sum, stroke) => sum + stroke.length, 0);
  const particles: MarkParticle[] = [];
  MARK_STROKES.forEach((stroke, index) => {
    const share = Math.round(count * stroke.length / total);
    for (let i = 0; i < share; i++) {
      const halo = rnd() < 0.1;
      particles.push([index, rnd(), gauss(rnd) * MARK_HALF_WIDTH * (halo ? 3.2 : 1.1), rnd(), (rnd() - 0.5) * 2]);
    }
  });
  return particles;
}

/** Rotates p about c by angle a. */
export function turn([x, y]: Vec, [cx, cy]: Vec, a: number): Vec {
  const c = Math.cos(a), s = Math.sin(a);
  return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
}

/** A particle's resting point in mark units; only orbit particles take `orbitSpin`. */
export function markPoint([stroke, t, across]: MarkParticle, orbitSpin = 0): Vec {
  const s = MARK_STROKES[stroke];
  const [x, y] = s.at(t), [nx, ny] = s.normal(t);
  const p: Vec = [x + nx * across, y + ny * across];
  return s.layer === 'orbit' && orbitSpin ? turn(p, MARK_ORBIT_CENTRE, orbitSpin) : p;
}

/** How much of a stroke is drawn (0–1) at formation progress f (0–1). */
export function strokeDrawn(stroke: number, f: number): number {
  const [from, to] = MARK_STROKES[stroke].draw;
  return Math.max(0, Math.min(1, (f - from) / (to - from)));
}

/** How lit a particle is (0–1) at formation progress f: 1 once its stroke's light has passed it, so every dot is lit when f = 1. */
export function particleDrawn([stroke, t]: MarkParticle, f: number): number {
  return Math.max(0, Math.min(1, (strokeDrawn(stroke, f) * 1.125 - t) * 8));
}
