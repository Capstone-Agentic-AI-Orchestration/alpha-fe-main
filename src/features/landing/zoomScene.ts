/**
 * Canvas "camera" for the client landing zoom journey. Five nested worlds
 * (cosmos → thread → nebula → planets → spiral); each world sits 40× inside
 * the previous one, and scroll progress drives a single camera through them.
 * The last world is a quiet Cosmo spiral behind the project window, which
 * crossfades back to the cosmos instead of zooming out through every world.
 * Decorative only: every word the canvas shows is also in the DOM.
 */

type Vec = [number, number];
type Transform = (x: number, y: number) => Vec;
type Camera = { i: number; s: number; q: Vec; P: Record<string, Vec> };
type World = {
  stars: [number, number, number, number][];
  neb: { arm: number; r: number; off: number; ph: number; hot: number }[];
  core: [number, number, number][];
  sphere: [number, number, number][];
  dust2: [number, number, number][];
  /** Spiral particles: [arm, radius, angular jitter, brightness]. */
  spiral: [number, number, number, number][];
};
type Frame = { U: number; time: number; still: boolean; mx: number; my: number; wp: number };
type WorldPainter = (ctx: CanvasRenderingContext2D, T: Transform, k: number, C: Frame, w: number, h: number) => void;

/** Scroll progress per sticky section, each 0–1. */
export type JourneyProgress = { hp: number; ip: number; wp: number; pp: number; flat: boolean };

const ZOOM = 40;
const BACKGROUND = '#07070c';
/** Canvas palette as "r,g,b" triplets; rgba() pairs one with an alpha. */
const VIOLET = '178,154,245';
const LILAC = '208,191,255';
const MIST = '224,213,255';
const INK = '245,243,252';
const CYAN = '103,232,249';
const rgba = (rgb: string, alpha: number | string) => `rgba(${rgb},${alpha})`;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (x: number) => { x = clamp(x); return x * x * (3 - 2 * x); };
const lerp = (a: Vec, b: Vec, t: number): Vec => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16_807) % 2_147_483_647;
    return state / 2_147_483_647;
  };
}

function buildWorld(): World {
  const rnd = seeded(5);
  const stars: World['stars'] = [];
  for (let i = 0; i < 700; i++) stars.push([(rnd() - 0.5) * 8, (rnd() - 0.5) * 6, rnd(), rnd() * 6.28]);
  const neb: World['neb'] = [];
  for (let i = 0; i < 1600; i++) {
    const arm = i % 3, r = Math.pow(rnd(), 0.75) * 1.7;
    neb.push({ arm, r, off: (rnd() - 0.5) * (0.25 + r * 0.25), ph: rnd() * 6.28, hot: rnd() });
  }
  const core: World['core'] = [];
  for (let i = 0; i < 160; i++) { const a = rnd() * 6.28, r = Math.pow(rnd(), 2) * 0.06; core.push([Math.cos(a) * r, Math.sin(a) * r, rnd()]); }
  const sphere: World['sphere'] = [];
  const n = 240;
  for (let i = 0; i < n; i++) { const y = 1 - (i / (n - 1)) * 2, rr = Math.sqrt(1 - y * y), th = i * 2.39996; sphere.push([Math.cos(th) * rr, y, Math.sin(th) * rr]); }
  const dust2: World['dust2'] = [];
  for (let i = 0; i < 260; i++) dust2.push([(rnd() - 0.5) * 4, (rnd() - 0.5) * 2.6, rnd()]);
  const spiral: World['spiral'] = [];
  for (let i = 0; i < 1500; i++) spiral.push([i % 2, Math.pow(rnd(), 0.7) * 1.15, (rnd() - 0.5) * (0.35 + rnd() * 0.5), rnd()]);
  return { stars, neb, core, sphere, dust2, spiral };
}

/** Where each world's child portal sits, in that world's own units. */
const PORTALS: Record<string, Vec> = { '-1': [0, 0], '0': [0.42, -0.12], '1': [0, 0], '2': [1, 0.2], '3': [0, 0] };

function pureCamera(level: number): Camera {
  const i = Math.floor(level), s = Math.pow(ZOOM, level - i), p = PORTALS[String(i)] ?? [0, 0];
  const keep = (1 - Math.log(s) / Math.log(ZOOM)) / s;
  return { i, s, q: [p[0] * (1 - keep), p[1] * (1 - keep)], P: PORTALS };
}

function introCamera(g: number): Camera {
  const u = clamp((g - 0.18) / 0.82);
  const eased = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  return pureCamera(Math.min(0.9999, eased * 0.9999));
}

function nebulaCamera(u: number): Camera {
  return pureCamera(u < 0.8 ? 1 + 0.12 * (u / 0.8) : 1.12 + 0.8799 * smooth((u - 0.8) / 0.2));
}

/** Planets: zoom in, pan across the three steps (holding on each), then dive into the third. */
function planetsCamera(u: number): Camera {
  const Z = 2.4, C = PORTALS['2'];
  const A: Vec = [-1 - 0.26 / Z, 0.15], B: Vec = [0.24 / Z, -0.25 - 0.14 / Z], Cf: Vec = [C[0] + 0.26 / Z, C[1] + 0.08 / Z];
  if (u < 0.12) {
    const t = smooth(u / 0.12);
    return { i: 2, s: Math.exp(Math.log(Z) * t), q: lerp([0, 0], A, t), P: PORTALS };
  }
  if (u >= 0.8) {
    const t = smooth((u - 0.8) / 0.2);
    return { i: 2, s: Math.min(ZOOM - 0.01, Math.exp(Math.log(Z) + (Math.log(ZOOM) - Math.log(Z)) * t)), q: lerp(Cf, C, Math.min(1, t * 1.4)), P: PORTALS };
  }
  // Each pan glides for 0.12 and then holds, so a later pan picks up where the previous one stopped.
  const pans: [number, Vec, Vec][] = [[0.3, A, B], [0.6, B, Cf]];
  let q = A;
  pans.forEach(([from, a, b]) => { if (u >= from) q = lerp(a, b, smooth((u - from) / 0.12)); });
  return { i: 2, s: Z, q, P: PORTALS };
}

/** Where the closing section rests: the opening starfield. */
const REST_LEVEL = -0.75;
/** Project progress at which the spiral starts handing over to the starfield. */
const HANDOFF = 0.66;

/** Project: a slow, barely-there push into the spiral while the project window tells its story. */
function projectCamera(u: number): Camera {
  return pureCamera(3 + 0.08 * smooth(u / HANDOFF));
}

/** Maps global progress g (0 hero … 4 end) to a camera. */
function camera(g: number): Camera {
  if (g < 1) return introCamera(g);
  if (g < 2) return nebulaCamera(g - 1);
  if (g < 3) return planetsCamera(g - 2);
  if (g < 4) return projectCamera(g - 3);
  return pureCamera(REST_LEVEL);
}

/** Progress through the planets scene, held at 1 once the camera has moved past it. */
function stepsProgress(g: number): number {
  if (g >= 3) return 1;
  return g >= 2 ? g - 2 : 0;
}

function nebulaColor(r: number, hot: number): string {
  if (r < 0.35) return INK;
  if (hot > 0.8) return CYAN;
  if (hot > 0.5) return LILAC;
  return VIOLET;
}

export class ZoomScene {
  private readonly world = buildWorld();
  private eased: number | null = null;
  private lastTime: number | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  /** Global progress: 0–4 across the four sticky sections; flat pages loop slowly instead. */
  private globalProgress(progress: JourneyProgress, time: number, still: boolean): number {
    if (progress.flat) {
      if (still) return 0.35;
      return Math.min(4, (time % 44) / 44 * 4.4);
    }
    if (progress.hp < 1) return progress.hp;
    if (progress.ip < 1) return 1 + progress.ip;
    if (progress.wp < 1) return 2 + progress.wp;
    if (progress.pp < 1) return 3 + progress.pp;
    return 4;
  }

  /** Matches the backing store to the CSS size and clears it; null while the canvas has no size. */
  private prepare(): { ctx: CanvasRenderingContext2D; w: number; h: number } | null {
    const cv = this.canvas;
    const w = cv.clientWidth, h = cv.clientHeight;
    const ctx = w && h ? cv.getContext('2d') : null;
    if (!ctx) return null;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, w, h);
    return { ctx, w, h };
  }

  /** Eases toward the scroll target so wheel steps glide instead of jump. */
  private ease(target: number, time: number, still: boolean): number {
    const last = this.lastTime;
    this.lastTime = time;
    if (still) return target;
    const dt = last == null ? 0.016 : Math.min(0.1, Math.max(0, time - last));
    if (this.eased == null || Math.abs(target - this.eased) > 1.5) this.eased = target;
    else this.eased += (target - this.eased) * Math.min(1, dt * 5.5);
    return this.eased;
  }

  private drawWorld(ctx: CanvasRenderingContext2D, i: number, T: Transform, k: number, alpha: number, frame: Frame, w: number, h: number) {
    if (alpha <= 0.01) return;
    const worlds: Record<number, WorldPainter> = { [-1]: this.cosmos, 0: this.thread, 1: this.nebula, 2: this.planets, 3: this.spiral };
    ctx.save();
    ctx.globalAlpha = alpha;
    worlds[i]?.call(this, ctx, T, k, frame, w, h);
    ctx.restore();
  }

  /** Draws one camera's world (and the next world in, seen through its portal) at the given opacity. */
  private drawCamera(ctx: CanvasRenderingContext2D, { s, q, i, P }: Camera, centre: Vec, frame: Frame, w: number, h: number, alpha = 1) {
    const k = s * frame.U;
    const T: Transform = (x, y) => [centre[0] + (x - q[0]) * k, centre[1] + (y - q[1]) * k];
    this.drawWorld(ctx, i, T, k, alpha * (1 - clamp((s - 8) / 24)), frame, w, h);
    if (i < 3) {
      const p = P[String(i)] ?? [0, 0];
      const Tc: Transform = (x, y) => T(p[0] + x / ZOOM, p[1] + y / ZOOM);
      this.drawWorld(ctx, i + 1, Tc, k / ZOOM, alpha * clamp((s - 2.5) / 7), frame, w, h);
    }
  }

  draw(time: number, still: boolean, progress: JourneyProgress, pointer: Vec) {
    const surface = this.prepare();
    if (!surface) return;
    const { ctx, w, h } = surface;
    const g = this.ease(this.globalProgress(progress, time, still), time, still);
    const [mx, my] = pointer;
    const frame: Frame = { U: Math.min(w, h) * 0.42, time, still, mx, my, wp: stepsProgress(g) };
    const centre: Vec = [w / 2 + mx * 18, h / 2 + my * 12];
    const handoff = g >= 3 + HANDOFF && g < 4 ? smooth((g - 3 - HANDOFF) / (1 - HANDOFF)) : 0;
    if (handoff > 0) {
      this.drawCamera(ctx, camera(g), centre, frame, w, h, 1 - handoff);
      this.drawCamera(ctx, pureCamera(REST_LEVEL), centre, frame, w, h, handoff);
      return;
    }
    this.drawCamera(ctx, camera(g), centre, frame, w, h);
  }

  private dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a: number, w: number, h: number) {
    if (x < -20 || y < -20 || x > w + 20 || y > h + 20 || a <= 0.01) return;
    ctx.fillStyle = rgba(col, Math.min(1, a).toFixed(3));
    if (r < 1.6) ctx.fillRect(x - r, y - r, r * 2, r * 2);
    else { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); }
  }

  private cosmos(ctx: CanvasRenderingContext2D, T: Transform, k: number, C: Frame, w: number, h: number) {
    this.world.stars.forEach(s => {
      const p = T(s[0], s[1]);
      const tw = C.still ? 0.7 : 0.5 + 0.5 * Math.sin(C.time * (0.6 + s[2]) + s[3]);
      this.dot(ctx, p[0], p[1], 0.6 + s[2] * 0.9, s[2] > 0.85 ? LILAC : INK, 0.15 + 0.5 * tw * s[2], w, h);
    });
    const c = T(0, 0);
    [1.6, 2.6].forEach((r, j) => {
      ctx.strokeStyle = rgba(VIOLET, 0.12 - j * 0.04);
      ctx.beginPath(); ctx.arc(c[0], c[1], r * k * 0.05, 0, 6.2832); ctx.stroke();
    });
  }

  private thread(ctx: CanvasRenderingContext2D, T: Transform, k: number, C: Frame, w: number, h: number) {
    const t = C.time;
    const zs = k / C.U;
    const ribbon = clamp(1 - (zs - 1.3) / 4.5);
    const baseA = ctx.globalAlpha;
    if (ribbon > 0.01) {
      ctx.globalAlpha = baseA * ribbon;
      const N = 90, M = 7;
      const yaw = t * 0.12 + C.mx * 0.4, cyw = Math.cos(yaw), syw = Math.sin(yaw);
      const roll = -0.55, cr = Math.cos(roll), sr = Math.sin(roll);
      let prev: [number, number, number][] | null = null;
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1);
        const a = u * Math.PI * 2.2 + t * 0.2;
        const px = Math.sin(a) * 0.55, py = (u - 0.5) * 3.6, pz = Math.cos(u * 5 + t * 0.15) * 0.45;
        const ring: [number, number, number][] = [];
        for (let j = 0; j < M; j++) {
          const th = j / M * 6.2832 + i * 0.1 + t * 0.3;
          const x = px + Math.cos(th) * 0.12, y = py, z = pz + Math.sin(th) * 0.12;
          const x1 = x * cr - y * sr, y1 = x * sr + y * cr;
          const x2 = x1 * cyw + z * syw, z2 = -x1 * syw + z * cyw;
          const f = 3 / (3 - z2 * 0.6);
          const p = T(x2 * f, -y1 * f * 0.55);
          ring.push([p[0], p[1], z2]);
        }
        ring.forEach((p, j) => {
          const a2 = 0.25 + 0.5 * ((p[2] + 1) / 2);
          this.dot(ctx, p[0], p[1], 1.1, VIOLET, a2, w, h);
          if (prev) {
            ctx.strokeStyle = rgba(VIOLET, (a2 * 0.35).toFixed(3));
            ctx.beginPath(); ctx.moveTo(prev[j][0], prev[j][1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
          }
        });
        prev = ring;
      }
      ctx.globalAlpha = baseA;
    }
    this.portal(ctx, T(0.42, -0.12), 0.055 * k, zs, C, VIOLET, w, h);
  }

  private portal(ctx: CanvasRenderingContext2D, n: Vec, ringR: number, zs: number, C: Frame, col: string, w: number, h: number) {
    const t = C.time;
    const core = clamp(1 - (zs - 1.2) / 2.5);
    const ringA = clamp(1 - (zs - 10) / 20);
    if (core > 0.01) {
      for (let j = 0; j < 3; j++) {
        const ph = C.still ? 0.3 : ((t * 0.5 + j / 3) % 1);
        ctx.strokeStyle = rgba(col, (0.5 * (1 - ph) * core).toFixed(3));
        ctx.beginPath(); ctx.arc(n[0], n[1], 6 + ph * 26, 0, 6.2832); ctx.stroke();
      }
      this.dot(ctx, n[0], n[1], 5, MIST, core, w, h);
      this.dot(ctx, n[0], n[1], 2.5, '255,255,255', core, w, h);
    }
    if (ringR > 7 && ringA > 0.01) {
      const grow = clamp((zs - 1.1) / 1.5);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = rgba(col, (0.75 * grow * ringA).toFixed(3));
      ctx.beginPath(); ctx.arc(n[0], n[1], ringR, 0, 6.2832); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(col, (0.3 * grow * ringA).toFixed(3));
      ctx.beginPath(); ctx.arc(n[0], n[1], ringR * 1.18, 0, 6.2832); ctx.stroke();
      const spin = C.still ? 0 : t * 0.8;
      for (let j = 0; j < 6; j++) {
        const a = spin + j * 1.0472;
        this.dot(ctx, n[0] + Math.cos(a) * ringR, n[1] + Math.sin(a) * ringR, 2, MIST, grow * ringA, w, h);
      }
    }
    ctx.lineWidth = 1;
  }

  private nebula(ctx: CanvasRenderingContext2D, T: Transform, k: number, C: Frame, w: number, h: number) {
    const t = C.time;
    this.world.neb.forEach(p => {
      const ang = p.arm * 2.0944 + p.r * 2.8 + p.off - t * 0.12 / (p.r + 0.35);
      const q = T(Math.cos(ang) * p.r, Math.sin(ang) * p.r * 0.62);
      const col = nebulaColor(p.r, p.hot);
      const tw = C.still ? 1 : 0.7 + 0.3 * Math.sin(t * 1.3 + p.ph);
      this.dot(ctx, q[0], q[1], p.r < 0.3 ? 1.2 : 0.9, col, (0.2 + 0.6 * (1 - p.r / 1.8)) * tw, w, h);
    });
    const zs = k / C.U;
    const coreA = clamp(1 - (zs - 2) / 4);
    this.world.core.forEach(c => {
      const q = T(c[0], c[1]);
      this.dot(ctx, q[0], q[1], 1.2, '255,255,255', (0.5 + 0.5 * c[2]) * coreA, w, h);
    });
    this.portal(ctx, T(0, 0), 0.05 * k, zs, C, MIST, w, h);
  }

  private sphereAt(ctx: CanvasRenderingContext2D, T: Transform, cx: number, cy: number, R: number, rot: number, tilt: number, col: string, w: number, h: number) {
    const cr = Math.cos(rot), sr = Math.sin(rot), ct = Math.cos(tilt), st = Math.sin(tilt);
    this.world.sphere.forEach(p => {
      const x = p[0] * cr + p[2] * sr, z = -p[0] * sr + p[2] * cr, y = p[1];
      const y2 = y * ct - z * st, z2 = y * st + z * ct;
      const q = T(cx + x * R, cy + y2 * R);
      this.dot(ctx, q[0], q[1], z2 > 0.3 ? 1.3 : 0.9, col, 0.12 + 0.75 * ((z2 + 1) / 2), w, h);
    });
  }

  private planets(ctx: CanvasRenderingContext2D, T: Transform, k: number, C: Frame, w: number, h: number) {
    const t = C.time;
    this.world.dust2.forEach(d => { const q = T(d[0], d[1]); this.dot(ctx, q[0], q[1], 0.8, VIOLET, 0.15 + 0.3 * d[2], w, h); });
    const A: Vec = [-1, 0.15], B: Vec = [0, -0.25], Cc: Vec = [1, 0.2];
    ctx.save();
    ctx.setLineDash([2, 10]);
    ctx.lineDashOffset = C.still ? 0 : -t * 20;
    ctx.strokeStyle = rgba(VIOLET, 0.5);
    ctx.lineWidth = 1.2;
    const a = T(A[0], A[1]), m1 = T(-0.5, -0.35), b = T(B[0], B[1]), m2 = T(0.5, -0.2), c = T(Cc[0], Cc[1]);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(m1[0], m1[1], b[0], b[1]); ctx.quadraticCurveTo(m2[0], m2[1], c[0], c[1]); ctx.stroke();
    ctx.restore();
    const R = 0.2;
    const step = journeyStep(C.wp);
    this.sphereAt(ctx, T, A[0], A[1], R, t * 0.3, 0.3, step === 0 ? LILAC : VIOLET, w, h);
    for (let j = 0; j < 3; j++) {
      const ang = t * (0.8 + j * 0.3) + j * 2.1, rr = R * (1.5 + j * 0.25);
      const q = T(A[0] + Math.cos(ang) * rr, A[1] + Math.sin(ang) * rr * 0.4);
      this.dot(ctx, q[0], q[1], Math.max(2, k * 0.012), MIST, 0.9, w, h);
    }
    this.sphereAt(ctx, T, B[0], B[1], R, -t * 0.25, 0.2, step === 1 ? LILAC : VIOLET, w, h);
    ctx.strokeStyle = rgba(CYAN, 0.55);
    ctx.lineWidth = 1.2;
    const bc = T(B[0], B[1]);
    ctx.beginPath(); ctx.ellipse(bc[0], bc[1], R * 1.9 * k, R * 0.45 * k, -0.35, 0, 6.2832); ctx.stroke();
    const sa = C.still ? 0.6 : t * 0.6;
    const sp = T(B[0] + Math.cos(sa) * R * 1.9 * Math.cos(-0.35) - Math.sin(sa) * R * 0.45 * Math.sin(-0.35), B[1] + Math.cos(sa) * R * 1.9 * Math.sin(-0.35) + Math.sin(sa) * R * 0.45 * Math.cos(-0.35));
    this.dot(ctx, sp[0], sp[1], Math.max(2.5, k * 0.015), CYAN, 1, w, h);
    this.sphereAt(ctx, T, Cc[0], Cc[1], R, t * 0.2, -0.2, step === 2 ? LILAC : VIOLET, w, h);
    const cc = T(Cc[0], Cc[1]);
    ctx.strokeStyle = rgba('110,231,183', 0.45);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let j = 0; j < 6; j++) {
      const an = j / 6 * 6.2832 + t * 0.2;
      const p1 = [cc[0] + Math.cos(an) * R * 1.45 * k, cc[1] + Math.sin(an) * R * 1.45 * k];
      const p2 = [cc[0] + Math.cos(an + 1.0472) * R * 1.45 * k, cc[1] + Math.sin(an + 1.0472) * R * 1.45 * k];
      ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(cc[0], cc[1]);
    }
    ctx.stroke();
    ctx.font = '500 11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ([[A, '01  TELL US', 0], [B, '02  YOUR INVITATION', 1], [Cc, '03  YOUR PROJECT', 2]] as const).forEach(([pos, label, index]) => {
      const q = T(pos[0], pos[1] + R * 1.9);
      ctx.fillStyle = index === step ? rgba(INK, 0.95) : rgba('167,165,185', 0.7);
      ctx.fillText(label, q[0], q[1] + 14);
    });
    ctx.textAlign = 'left';
  }

  /** The Cosmo mark: two dotted arms winding into a bright core, turning slowly behind the project window. */
  private spiral(ctx: CanvasRenderingContext2D, T: Transform, k: number, C: Frame, w: number, h: number) {
    const turn = C.still ? 0 : -C.time * 0.05;
    const tilt = 0.82 + C.my * 0.04;
    this.world.spiral.forEach(([arm, r, jitter, glow]) => {
      const a = turn + arm * Math.PI + r * 5.2 + jitter * (0.25 + r * 0.6);
      const q = T(Math.cos(a) * r, Math.sin(a) * r * tilt);
      const fade = 1 - r / 1.25;
      const tw = C.still ? 1 : 0.75 + 0.25 * Math.sin(C.time * 1.1 + glow * 9);
      this.dot(ctx, q[0], q[1], r < 0.2 ? 1.2 : 0.9, glow > 0.9 ? LILAC : INK, (0.12 + 0.5 * fade * fade) * tw, w, h);
    });
    const c = T(0, 0);
    ctx.strokeStyle = rgba(MIST, 0.06);
    [0.35, 0.7, 1.05].forEach(r => { ctx.beginPath(); ctx.ellipse(c[0], c[1], r * k, r * k * tilt, 0, 0, 6.2832); ctx.stroke(); });
    this.dot(ctx, c[0], c[1], Math.max(2, k * 0.012), '255,255,255', 0.85, w, h);
  }
}

/** Which of the three "How it works" steps is in focus for a section progress. */
export function journeyStep(progress: number): 0 | 1 | 2 {
  if (progress < 0.36) return 0;
  return progress < 0.66 ? 1 : 2;
}
