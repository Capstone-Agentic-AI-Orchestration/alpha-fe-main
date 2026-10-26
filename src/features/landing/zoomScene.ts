import { buildSpiral, seeded, spiralAngle, TWIST } from './cosmoSpiral';

/**
 * Canvas "camera" for the client landing zoom journey. Five nested worlds
 * (cosmos → thread → nebula → planets → galaxy); each world sits 40× inside
 * the previous one, and scroll progress drives a single camera through them.
 * The last world is the client's project as a 3D Cosmo galaxy: light runs out
 * along its arms, work items ignite, a message comets out to the item waiting
 * on the client, the disk turns face-on into the Cosmo mark, and the camera
 * pulls all the way back out through every world.
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
  /** Galaxy particles: [arm, radius, angular jitter, brightness, disk thickness]. */
  spiral: [number, number, number, number, number][];
  /** Finale start for each galaxy particle: [distance from the lockup, as a share of the half‑diagonal; delay 0–0.55; extra swirl]. */
  gather: [number, number, number][];
};
type Frame = { U: number; time: number; still: boolean; mx: number; my: number; wp: number; pu: number; finale: number };
type WorldPainter = (ctx: CanvasRenderingContext2D, T: Transform, k: number, C: Frame, w: number, h: number) => void;
type WarpStreak = { a: number; r0: number; sp: number; len: number; hot: number };
type Kind = 'done' | 'waiting' | 'progress';
type Label = { x: number; y: number; text: string; col: string; a: number; r: number; up?: boolean };
/** Finale amounts, each 0–1: particles gathered, wordmark written, core flash, warp curl, recede behind the close, wordmark left. */
type Finale = { gather: number; word: number; flash: number; curl: number; recede: number; wordLeft: number };
/** Where the Cosmo lockup sits at rest: spiral centre and radius, and the wordmark box. */
type Lockup = { R: number; x: number; y: number; wordX: number; wordY: number; wordW: number; wordH: number; stacked: boolean };

/** Scroll progress per sticky section, each 0–1, plus `cp`: how far the closing section has risen into view. */
export type JourneyProgress = { hp: number; ip: number; wp: number; pp: number; cp: number; flat: boolean };

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
  const spiral = buildSpiral(rnd);
  // Separate stream so the finale's start positions don't reshuffle the other worlds.
  const gatherRnd = seeded(77);
  const gather: World['gather'] = spiral.map(() => [0.9 + gatherRnd() * 0.9, gatherRnd() * 0.55, (gatherRnd() - 0.5) * 0.8]);
  return { stars, neb, core, sphere, dust2, spiral, gather };
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
/**
 * Project-world beats in project progress (0–1): the light reaches the rim by
 * `lit`, the message beat runs `ask`–`reveal`, the disk turns face-on by
 * `revealEnd`, and the camera pulls back out from `pull`.
 */
export const GALAXY_BEATS = { lit: 0.13, ask: 0.15, reveal: 0.3, revealEnd: 0.41, pull: 0.45 } as const;
/**
 * Finale beats in project progress: the warp curls from `curl`, the camera
 * rests at `rest`, particles gather `gather`–`gatherEnd`, the core flashes at
 * `ignite`, and the wordmark writes in from `word` to the end of the section.
 */
export const FINALE_BEATS = { curl: 0.8, rest: 0.88, gather: 0.86, gatherEnd: 0.95, ignite: 0.935, word: 0.95 } as const;

/** Project: a slow push into the galaxy while the captions play, then pull all the way back out. */
function projectCamera(u: number): Camera {
  const { pull } = GALAXY_BEATS;
  return pureCamera(u < pull ? 3 + 0.06 * smooth(u / pull) : 3.06 - (3.06 - REST_LEVEL) * smooth((u - pull) / (FINALE_BEATS.rest - pull)));
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

/** Progress through the project world, held at 1 once the camera has moved past it. */
function projectProgress(g: number): number {
  if (g >= 4) return 1;
  return g >= 3 ? g - 3 : 0;
}

/** 0–1 share of the side shift that keeps the galaxy clear of the captions on the left. */
function galaxyShift(g: number): number {
  if (g < 3) return 0;
  return smooth((g - 3) / 0.05) * (1 - smooth((g - 3 - GALAXY_BEATS.pull) / 0.1));
}

/** Finale amounts for global progress g. Reduced motion shows the finished lockup once the close is in view. */
function finaleState(g: number, cp: number, still: boolean): Finale {
  const F = FINALE_BEATS;
  const u = g >= 4 ? 1 : g - 3;
  const recede = smooth(cp / 0.5), wordLeft = 1 - smooth(cp / 0.3);
  if (still) { const on = cp > 0 ? 1 : 0; return { gather: on, word: on, flash: 0, curl: 0, recede, wordLeft }; }
  if (g < 3) return { gather: 0, word: 0, flash: 0, curl: 0, recede, wordLeft };
  return {
    gather: smooth((u - F.gather) / (F.gatherEnd - F.gather)),
    word: clamp((u - F.word) / (1 - F.word)),
    flash: u >= F.ignite ? clamp((u - F.ignite) / 0.04) : 0,
    curl: smooth((u - F.curl) / (F.rest - F.curl)),
    recede,
    wordLeft,
  };
}

/** The lockup as in the logo: spiral, gap 0.3R, wordmark 3.07R × 0.52R set 0.1R low; stacked when it can't fit across. */
function lockupLayout(w: number, h: number): Lockup {
  const R = Math.min(Math.min(w, h) * 0.23, 210);
  const wordW = R * 3.07, wordH = R * 0.52, gap = R * 0.3;
  if (2 * R + gap + wordW > w * 0.9) {
    const y = h / 2 - (wordH + gap) / 2;
    return { R, x: w / 2, y, wordX: w / 2 - wordW / 2, wordY: y + R + gap, wordW, wordH, stacked: true };
  }
  const x = w / 2 - (2 * R + gap + wordW) / 2 + R;
  return { R, x, y: h / 2, wordX: x + R + gap, wordY: h / 2 + 0.1 * R - wordH / 2, wordW, wordH, stacked: false };
}

function buildWarp(): WarpStreak[] {
  const rnd = seeded(41);
  return Array.from({ length: 180 }, () => ({ a: rnd() * 6.2832, r0: rnd(), sp: 0.5 + rnd() * 0.9, len: 0.04 + rnd() * 0.1, hot: rnd() }));
}

/** Work items on the galaxy arms: arm index and radius along the spiral. */
const WORKS: { name: string; kind: Kind; arm: number; r: number }[] = [
  { name: 'Brand assets', kind: 'done', arm: 1, r: 0.26 },
  { name: 'Homepage', kind: 'done', arm: 0, r: 0.42 },
  { name: 'Contact page', kind: 'waiting', arm: 1, r: 0.62 },
  { name: 'Booking flow', kind: 'progress', arm: 0, r: 0.84 },
];
const KIND_RGB: Record<Kind, string> = { done: '52,211,153', waiting: '251,191,36', progress: '167,139,250' };
const KIND_LABEL: Record<Kind, string> = { done: 'Done', waiting: 'Awaiting you', progress: 'In progress' };
/** Galaxy disk radius in world units. */
const DISK = 0.82;

function nebulaColor(r: number, hot: number): string {
  if (r < 0.35) return INK;
  if (hot > 0.8) return CYAN;
  if (hot > 0.5) return LILAC;
  return VIOLET;
}

export class ZoomScene {
  private readonly world = buildWorld();
  private readonly warpStreaks = buildWarp();
  private eased: number | null = null;
  private lastTime: number | null = null;

  private readonly wordmark: HTMLImageElement | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, wordmarkUrl?: string) {
    if (wordmarkUrl && typeof Image !== 'undefined') {
      this.wordmark = new Image();
      this.wordmark.src = wordmarkUrl;
    }
  }

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
    const worlds: Record<number, WorldPainter> = { [-1]: this.cosmos, 0: this.thread, 1: this.nebula, 2: this.planets, 3: this.galaxy };
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
    const finale = finaleState(g, progress.cp, still);
    const frame: Frame = { U: Math.min(w, h) * 0.42, time, still, mx, my, wp: stepsProgress(g), pu: projectProgress(g), finale: finale.gather };
    const side = w >= 900 ? Math.min(w * 0.18, 260) : 0;
    const centre: Vec = [w / 2 + mx * 18 + side * galaxyShift(g), h / 2 + my * 12];
    this.drawCamera(ctx, camera(g), centre, frame, w, h);
    const lockup = lockupLayout(w, h);
    const warpFrom = 3 + GALAXY_BEATS.pull + 0.05, warpTo = 3 + FINALE_BEATS.gatherEnd - 0.03;
    if (!still && g > warpFrom && g < warpTo) {
      // As the streaks curl, their vanishing point slides over to the forming spiral.
      const at: Vec = [w / 2 + (lockup.x - w / 2) * finale.curl, h / 2 + (lockup.y - h / 2) * finale.curl];
      this.warp(ctx, w, h, Math.sin(Math.PI * clamp((g - warpFrom) / (warpTo - warpFrom))), time, finale.curl, at);
    }
    if (finale.gather > 0) this.lockup(ctx, lockup, finale, w, h, time, still);
  }

  /** Speed lines rushing to the centre; `curl` (0–1) bends them into the spiral's arms. */
  private warp(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number, time: number, curl: number, [cx, cy]: Vec) {
    if (intensity <= 0.01) return;
    const R = Math.hypot(w, h) / 2;
    const bend = curl * 1.6;
    ctx.lineWidth = 1.2;
    this.warpStreaks.forEach(s => {
      let r = (s.r0 - time * s.sp) % 1;
      if (r < 0) r += 1;
      const r1 = (0.06 + r * 0.98) * R, r2 = r1 + s.len * (0.3 + r * 1.4) * R;
      const a = intensity * Math.min(1, r * 1.6) * (s.hot > 0.85 ? 0.9 : 0.45);
      const a1 = s.a + bend * (1 - r1 / R), a2 = s.a + bend * (1 - r2 / R), am = (a1 + a2) / 2, rm = (r1 + r2) / 2;
      ctx.strokeStyle = rgba(s.hot > 0.85 ? INK : VIOLET, a.toFixed(3));
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1);
      ctx.quadraticCurveTo(cx + Math.cos(am) * rm, cy + Math.sin(am) * rm, cx + Math.cos(a2) * r2, cy + Math.sin(a2) * r2);
      ctx.stroke();
    });
    ctx.lineWidth = 1;
  }

  /**
   * The finale: galaxy particles spiral in from across the screen to form the
   * Cosmo mark, the core flashes, and the wordmark writes in beside it. As the
   * closing section rises, the wordmark leaves and the mark recedes behind it.
   */
  private lockup(ctx: CanvasRenderingContext2D, L: Lockup, F: Finale, w: number, h: number, time: number, still: boolean) {
    const x = L.x + (w / 2 - L.x) * F.recede, y = L.y + (h * 0.4 - L.y) * F.recede;
    const R = L.R * (1 - 0.3 * F.recede);
    const reach = Math.hypot(w, h) / 2;
    const spin = still ? 0 : -time * 0.03;
    const appear = clamp(F.gather * 4);
    ctx.save();
    ctx.globalAlpha = 1 - 0.86 * F.recede;

    ctx.strokeStyle = rgba(MIST, (0.08 * F.gather).toFixed(3));
    [0.36, 0.72, 1.08].forEach(f => { ctx.beginPath(); ctx.arc(x, y, f * R, 0, 6.2832); ctx.stroke(); });

    const { spiral, gather } = this.world;
    spiral.forEach(([arm, r, jitter, glow], i) => {
      const [dist, delay, swirl] = gather[i];
      const local = clamp((F.gather - delay) / 0.45);
      const e = 1 - Math.pow(1 - local, 3);
      const target = spiralAngle(spin, arm, r, jitter);
      const angle = target + (1 - e) * (2.4 + swirl);
      const radius = (r / 1.15) * R + (dist * reach - (r / 1.15) * R) * (1 - e);
      const fade = 1 - r / 1.3;
      this.dot(ctx, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, r < 0.2 ? 1.25 : 0.95, glow > 0.88 ? LILAC : INK, (0.14 + 0.66 * fade) * (0.3 + 0.7 * e) * appear, w, h);
    });

    const coreR = Math.max(2.5, R * 0.025);
    this.dot(ctx, x, y, coreR, '255,255,255', F.gather, w, h);
    if (F.flash > 0 && F.flash < 1) {
      this.dot(ctx, x, y, coreR * (1 + 3 * (1 - F.flash)), '255,255,255', 0.35 * (1 - F.flash), w, h);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = rgba(MIST, (0.6 * (1 - F.flash)).toFixed(3));
      ctx.beginPath(); ctx.arc(x, y, R * (0.08 + 1.1 * F.flash), 0, 6.2832); ctx.stroke();
      ctx.lineWidth = 1;
    }
    ctx.restore();

    const img = this.wordmark;
    const show = F.word * F.wordLeft;
    if (!img?.complete || !img.naturalWidth || show <= 0.01) return;
    // The letters arrive a little wide and soft, then tighten to the logo's spacing.
    const width = L.wordW * (1 + 0.22 * (1 - F.word));
    const left = L.stacked ? w / 2 - width / 2 : L.wordX;
    ctx.save();
    ctx.globalAlpha = clamp(show * 1.5);
    ctx.beginPath(); ctx.rect(left - 6, L.wordY - 10, (width + 12) * clamp(F.word * 1.3), L.wordH + 20); ctx.clip();
    if ('filter' in ctx) ctx.filter = `blur(${((1 - F.word) * 5).toFixed(1)}px)`;
    ctx.drawImage(img, left, L.wordY, width, L.wordH);
    ctx.restore();
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
      ctx.strokeStyle = rgba(VIOLET, ((0.12 - j * 0.04) * (1 - C.finale)).toFixed(3));
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

  /**
   * The project as a 3D Cosmo galaxy. A tilted two-arm disk turns in depth;
   * light runs from the core out along the arms and each work item ignites as
   * it passes; a message comets out to the item waiting on the client; then
   * the disk swings face-on into the Cosmo mark before the camera pulls away.
   */
  private galaxy(ctx: CanvasRenderingContext2D, T: Transform, k: number, C: Frame, w: number, h: number) {
    const t = C.time, u = C.pu, B = GALAXY_BEATS;
    const spin = C.still ? 0.4 : -t * 0.07;
    const pitch = 0.55 + 0.97 * smooth((u - B.reveal) / (B.revealEnd - B.reveal)) + C.my * 0.12;
    const roll = -0.18 + C.mx * 0.25;
    const cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    /** Disk point (angle, radius, height) → screen [x, y, depth]; depth > 0 is toward the viewer. */
    const place = (a: number, r: number, y = 0): [number, number, number] => {
      const x = Math.cos(a) * r * DISK, z = Math.sin(a) * r * DISK;
      const y1 = y * cp - z * sp, z1 = y * sp + z * cp;
      const f = 3 / (3 - z1 * 0.9);
      const sx = x * f, sy = y1 * f;
      const q = T(sx * cr - sy * sr, sx * sr + sy * cr);
      return [q[0], q[1], z1];
    };
    const armAngle = (arm: number, r: number) => spin + arm * Math.PI + r * TWIST;
    const reach = clamp(u / B.lit) * 1.2;

    ctx.strokeStyle = rgba(MIST, 0.07);
    [0.36, 0.72, 1.08].forEach(r => {
      ctx.beginPath();
      for (let j = 0; j <= 72; j++) { const p = place(j / 72 * 6.2832, r); if (j) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
      ctx.stroke();
    });

    this.world.spiral.forEach(([arm, r, jitter, glow, height]) => {
      const p = place(armAngle(arm, r) + jitter * (0.25 + r * 0.6), r, height);
      const lit = r < reach;
      const near = 0.7 + 0.3 * clamp((p[2] + 0.8) / 1.6);
      const tw = C.still ? 1 : 0.75 + 0.25 * Math.sin(t * 1.1 + glow * 9);
      const alpha = lit ? 0.22 + 0.62 * (1 - r / 1.3) : 0.1;
      const col = lit ? (glow > 0.88 ? LILAC : INK) : VIOLET;
      this.dot(ctx, p[0], p[1], r < 0.2 ? 1.3 : 0.95, col, alpha * tw * near, w, h);
    });

    const core = place(0, 0);
    this.dot(ctx, core[0], core[1], Math.max(3, k * 0.016), '255,255,255', 0.95, w, h);
    for (let j = 0; j < 3; j++) {
      const ph = C.still ? 0.3 : ((t * 0.35 + j / 3) % 1);
      ctx.strokeStyle = rgba(MIST, (0.35 * (1 - ph)).toFixed(3));
      ctx.beginPath(); ctx.arc(core[0], core[1], Math.max(3, k * 0.016) * (1.5 + ph * 5), 0, 6.2832); ctx.stroke();
    }

    const asking = u >= B.ask && u < B.reveal;
    const labelFade = 1 - clamp((u - (B.pull - 0.05)) / 0.04);
    const labels: Label[] = [];
    WORKS.forEach(work => {
      const p = place(armAngle(work.arm, work.r), work.r);
      const on = clamp((reach - work.r) / 0.15);
      const col = KIND_RGB[work.kind];
      const focus = asking && work.kind === 'waiting';
      const dim = asking && !focus ? 0.45 : 1;
      const size = Math.max(3.5, k * 0.02) * (0.8 + 0.2 * (p[2] + 1)) * (focus ? 1.35 : 1);
      const pulse = focus && !C.still ? 0.6 + 0.4 * Math.sin(t * 3) : 1;
      for (let j = 0; j < 2; j++) {
        ctx.strokeStyle = rgba(col, (0.4 * on * pulse * dim / (j + 1)).toFixed(3));
        ctx.beginPath(); ctx.arc(p[0], p[1], size * (2 + j * 1.3), 0, 6.2832); ctx.stroke();
      }
      this.dot(ctx, p[0], p[1], size, on > 0 ? col : VIOLET, (0.3 + 0.7 * on) * dim, w, h);
      const shown = !asking || focus;
      if (on > 0.5 && shown) labels.push({ x: p[0], y: p[1], text: work.name + '  ·  ' + KIND_LABEL[work.kind], col, a: (on - 0.5) * 2 * labelFade, r: size });
      if (focus) labels.push({ x: p[0], y: p[1], text: 'New message from your project manager', col: VIOLET, a: clamp((u - B.ask) / 0.03) * labelFade, r: size, up: true });
    });

    if (asking) {
      // The message: a comet that leaves the core and runs out along the arm to the waiting item.
      const target = WORKS.find(work => work.kind === 'waiting') ?? WORKS[0];
      const env = clamp((u - B.ask) / 0.02) * (1 - clamp((u - (B.reveal - 0.02)) / 0.02));
      const head = C.still ? 0.8 : (t * 0.4) % 1;
      for (let j = 0; j < 10; j++) {
        const along = head - j * 0.022;
        if (along < 0) break;
        const p = place(armAngle(target.arm, along * target.r), along * target.r);
        this.dot(ctx, p[0], p[1], 2.6 - j * 0.2, j ? LILAC : '255,255,255', env * (1 - j / 10), w, h);
      }
    }
    if (k >= 120) this.labels(ctx, labels, w);
  }

  /** Status pills beside the galaxy's work items; flipped to the left when they would leave the screen. */
  private labels(ctx: CanvasRenderingContext2D, labels: Label[], w: number) {
    ctx.font = '500 12px "DM Sans", sans-serif';
    ctx.textBaseline = 'middle';
    const baseA = ctx.globalAlpha;
    labels.forEach(l => {
      if (l.a <= 0.01) return;
      const width = ctx.measureText(l.text).width + 24;
      let bx = l.x + l.r + 12;
      if (bx + width > w - 16) bx = l.x - l.r - 12 - width;
      const by = l.up ? l.y - l.r - 40 : l.y - 13;
      ctx.globalAlpha = clamp(l.a) * baseA;
      ctx.fillStyle = rgba('20,18,32', 0.92);
      ctx.strokeStyle = rgba(l.col, 0.6);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, width, 26, 6); else ctx.rect(bx, by, width, 26);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgb(' + l.col + ')';
      ctx.fillRect(bx + 9, by + 10, 6, 6);
      ctx.fillStyle = '#f5f3fc';
      ctx.fillText(l.text, bx + 20, by + 13.5);
    });
    ctx.globalAlpha = baseA;
    ctx.textBaseline = 'alphabetic';
  }
}

/** Which of the three "How it works" steps is in focus for a section progress. */
export function journeyStep(progress: number): 0 | 1 | 2 {
  if (progress < 0.36) return 0;
  return progress < 0.66 ? 1 : 2;
}
