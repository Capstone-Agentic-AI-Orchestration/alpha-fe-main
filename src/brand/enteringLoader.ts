/*
 * Alphaexplora loading screen for the public client pages (landing, client
 * sign-in, inquiry). Bundled on its own and inlined into index.html by
 * vite.config.ts, so it runs before the app bundle; it is not imported by the app.
 *
 * First visit in a session: a white point streaks in and hits where the A's
 * apex will be, the impact blooms, light draws the centered mark stroke by
 * stroke in the brand's loading order (legs, base, inner A, orbit, trails),
 * and once the page is ready the camera dives through the inner A. Repeat
 * visits get the short version (mark, then dive).
 * The exit waits for real readiness (page parsed, loaded, app mounted via
 * window.axLoader.done(), fonts), with a 10s safety reveal.
 */
import { MARK_APEX, MARK_COUNTER, MARK_HALF_WIDTH, MARK_ORBIT_CENTRE, MARK_STROKES, markPoint, particleDrawn, sampleMark, seeded, strokeDrawn, type MarkParticle, type Vec } from './markParticles';

type Loader = { progress: (value: number) => void; done: () => void };
/** The page's window as this script sees it; kept local so the app's Window type is untouched. */
const win = window as Window & { axLoader?: Loader; alphaDesktop?: unknown };
const BACKGROUND = '#07070c';

(function () {
  const root = document.getElementById('ax-loader');
  if (!root) return;
  const noop: Loader = { progress() {}, done() {} };
  const loc = window.location;
  const hash = (loc.hash || '').split('?')[0];
  const path = loc.pathname;
  const publicPage = !win.alphaDesktop
    && !/[?&](code|ticketing-preview)(=|&|$)/.test(loc.search || '')
    && ((path === '/' && (!hash || hash === '#/' || hash === '#/home'))
      || /^#\/(client|request)(\/|$)/.test(hash)
      || /^\/(client|request)(\/|$)/.test(path));
  if (!publicPage) {
    root.remove();
    win.axLoader = noop;
    return;
  }

  const html = document.documentElement;
  html.classList.add('ax-loading');
  const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const canvas = root.querySelector('canvas');
  const ctx = canvas?.getContext ? canvas.getContext('2d') : null;
  const line = root.querySelector<HTMLElement>('.ax-loader-line');

  let seen = false;
  try { seen = window.sessionStorage.getItem('ax.intro') === '1'; window.sessionStorage.setItem('ax.intro', '1'); } catch { /* private mode */ }
  const brief = seen || reduced;

  /* ---------- readiness ---------- */
  let target = 6, shownP = 0, ready = false;
  const reach = (value: number) => { if (value > target) target = Math.min(100, value); if (target >= 100) ready = true; };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => reach(30));
  else reach(30);
  if (document.readyState === 'complete') reach(62);
  else window.addEventListener('load', () => reach(62));
  let finishing = false;
  win.axLoader = {
    progress: reach,
    done() {
      if (finishing) return;
      finishing = true;
      reach(88);
      const fonts = document.fonts?.ready ?? Promise.resolve();
      fonts.then(() => reach(100), () => reach(100));
    },
  };
  window.setTimeout(() => win.axLoader?.done(), 10000);

  /* ---------- maths ---------- */
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const smooth = (v: number) => { v = clamp(v); return v * v * (3 - 2 * v); };
  const outCubic = (v: number) => 1 - Math.pow(1 - clamp(v), 3);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const grains = sampleMark(seeded(11), 7000);
  const grainAlpha = (g: MarkParticle) => (0.18 + 0.5 * g[3]) * (1 - Math.min(1, Math.abs(g[2]) / (MARK_HALF_WIDTH * 3.4)) * 0.7);
  const isOrbit = (g: MarkParticle) => MARK_STROKES[g[0]].layer === 'orbit';

  const sr = seeded(91);
  const stars = Array.from({ length: 240 }, () => [sr(), sr(), sr(), sr() * 6.2832]);

  /* ---------- the finished mark, rendered once: the A and trails, and the orbit apart so it can turn ---------- */
  type Plate = { image: HTMLCanvasElement; size: number };
  let plates: { fixed: Plate; orbit: Plate } | null = null, plateR = 0;
  function plate(R: number, orbit: boolean): Plate {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = Math.ceil(R * 2.6);
    const image = document.createElement('canvas');
    image.width = image.height = Math.ceil(size * dpr);
    const b = image.getContext('2d')!;
    b.scale(dpr, dpr);
    b.translate(size / 2, size / 2);
    if (!orbit) {
      const haze = b.createRadialGradient(0, 0, 0, 0, 0, R * 1.15);
      haze.addColorStop(0, 'rgba(232,226,255,0.1)');
      haze.addColorStop(0.45, 'rgba(178,154,245,0.04)');
      haze.addColorStop(1, 'rgba(178,154,245,0)');
      b.fillStyle = haze;
      b.beginPath(); b.arc(0, 0, R * 1.15, 0, 6.2832); b.fill();
    }
    b.globalCompositeOperation = 'lighter';
    b.lineWidth = 0.6;
    // Fine strands along each stroke give the dots a body, as the brand's drawn lines do.
    MARK_STROKES.forEach(stroke => {
      if ((stroke.layer === 'orbit') !== orbit) return;
      for (let s = 0; s < 7; s++) {
        const off = ((s / 6) * 2 - 1) * MARK_HALF_WIDTH * 0.9;
        b.strokeStyle = `rgba(236,233,250,${(0.05 + 0.06 * (1 - Math.abs(off) / MARK_HALF_WIDTH)).toFixed(3)})`;
        b.beginPath();
        for (let t = 0; t <= 1.0001; t += 0.02) {
          const [x, y] = stroke.at(t), [nx, ny] = stroke.normal(t);
          const px = (x + nx * off) * R, py = (y + ny * off) * R;
          if (t === 0) b.moveTo(px, py); else b.lineTo(px, py);
        }
        b.stroke();
      }
    });
    grains.forEach(g => {
      if (isOrbit(g) !== orbit) return;
      const [x, y] = markPoint(g), size2 = 0.45 + g[3] * 0.75;
      b.fillStyle = (g[3] > 0.9 ? 'rgba(214,200,255,' : 'rgba(245,243,252,') + grainAlpha(g).toFixed(3) + ')';
      b.fillRect(x * R - size2 / 2, y * R - size2 / 2, size2, size2);
    });
    if (!orbit) {
      const [ax, ay] = MARK_APEX;
      const core = b.createRadialGradient(ax * R, ay * R, 0, ax * R, ay * R, R * 0.14);
      core.addColorStop(0, 'rgba(255,255,255,0.5)');
      core.addColorStop(1, 'rgba(255,255,255,0)');
      b.fillStyle = core;
      b.beginPath(); b.arc(ax * R, ay * R, R * 0.14, 0, 6.2832); b.fill();
    }
    return { image, size };
  }

  /* ---------- timeline (seconds) ---------- */
  const T = brief
    ? { comet: -1, impact: -1, birthEnd: -1, formedAt: 0.05, end: 0.6 }
    : { comet: 0.35, impact: 1.3, birthEnd: 2.75, formedAt: 2.6, end: 3.25 };
  let start = 0, exitAt = 0, gone = false, frame = 0, ticker = 0;

  /** R is half the mark's height; the mark stays centered as a standalone lockup. */
  function layout(w: number, h: number) {
    const R = Math.min(w, h) * (w < 700 ? 0.2 : 0.17);
    return { R, x: w / 2, y: h / 2 };
  }

  /** Everything one frame's painters share. */
  type Frame = {
    c: CanvasRenderingContext2D; t: number; w: number; h: number; L: ReturnType<typeof layout>; R: number;
    /** Exit progress 0–1, and the dive it drives. */
    exit: number; zoom: number; cx: number; cy: number; apex: Vec; spin: number; impactK: number;
  };

  /** Starfield, with a small shudder at the impact and a rush outwards on the dive. */
  function drawStars({ c, t, w, h, exit, impactK }: Frame) {
    const nudge = impactK >= 0 && impactK < 0.3 ? 2.2 * Math.sin(impactK * 60) * (1 - impactK / 0.3) : 0;
    const starIn = brief ? 1 : smooth(t / 0.4);
    const spread = 1 + exit * exit * exit * 2.5;
    stars.forEach(st => {
      const tw = reduced ? 0.7 : 0.5 + 0.5 * Math.sin(t * (0.5 + st[2]) + st[3]);
      const px = w / 2 + (st[0] - 0.5) * w * spread + nudge, py = h / 2 + (st[1] - 0.5) * h * spread, sz = 0.5 + st[2] * 0.8;
      c.fillStyle = 'rgba(245,243,252,' + ((0.08 + 0.4 * tw * st[2]) * starIn * (1 - exit)).toFixed(3) + ')';
      c.fillRect(px - sz, py - sz, sz * 2, sz * 2);
    });
  }

  /** The comet: a white point curving in from the lower left and accelerating into the apex. */
  function drawComet({ c, t, w, h, apex: [ax, ay] }: Frame) {
    if (T.comet < 0 || t < T.comet || t >= T.impact) return;
    const u = clamp((t - T.comet) / (T.impact - T.comet));
    const a0 = 2.35, from = Math.hypot(w, h) / 2 * 1.05, tail = 28;
    const point = (v: number): Vec => { const q = Math.pow(v, 1.8); return [ax + Math.cos(a0 + 2.4 * q) * from * (1 - q), ay + Math.sin(a0 + 2.4 * q) * from * (1 - q)]; };
    c.lineCap = 'round';
    for (let j = tail; j > 0; j--) {
      const u1 = u - j * 0.016;
      if (u1 < 0) continue;
      const fade = 1 - j / tail;
      const [x1, y1] = point(u1), [x2, y2] = point(u - (j - 1) * 0.016);
      c.strokeStyle = 'rgba(240,236,255,' + (0.85 * fade * fade).toFixed(3) + ')';
      c.lineWidth = 0.4 + 2.2 * fade;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }
    const [hx, hy] = point(u);
    const glow = c.createRadialGradient(hx, hy, 0, hx, hy, 22);
    glow.addColorStop(0, 'rgba(255,255,255,0.55)');
    glow.addColorStop(1, 'rgba(208,191,255,0)');
    c.fillStyle = glow;
    c.fillRect(hx - 22, hy - 22, 44, 44);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(hx, hy, 2.4, 0, 6.2832); c.fill();
    c.lineWidth = 1;
  }

  /** Birth: light draws each stroke in turn; dots appear as it passes and glow at its leading edge. */
  function drawBirth({ c, R, zoom, cx, cy, spin }: Frame, birth: number) {
    if (birth <= 0 || birth >= 1 || brief) return;
    const particleAlpha = 1 - smooth((birth - 0.88) / 0.12);
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < grains.length; i += 2) {
      const g = grains[i];
      const lit = particleDrawn(g, birth);
      if (lit <= 0) continue;
      const front = Math.exp(-Math.pow((strokeDrawn(g[0], birth) - g[1]) * 14, 2));
      const [px, py] = markPoint(g, spin);
      const size = 1.2 + front * 1.2;
      c.fillStyle = 'rgba(245,243,252,' + ((grainAlpha(g) * 1.4 + front * 0.6) * lit * particleAlpha).toFixed(3) + ')';
      c.fillRect(cx + px * R * zoom - size / 2, cy + py * R * zoom - size / 2, size, size);
    }
    c.globalCompositeOperation = 'source-over';
  }

  /** The finished mark: the fixed plate, then the orbit plate turned about the orbit's centre. */
  function drawPlates({ c, R, zoom, cx, cy, spin }: Frame, alpha: number) {
    if (alpha <= 0.005 || !plates) return;
    const { fixed, orbit } = plates;
    const [ox, oy] = MARK_ORBIT_CENTRE;
    c.save();
    c.globalAlpha = alpha;
    c.translate(cx, cy);
    c.scale(zoom, zoom);
    c.drawImage(fixed.image, -fixed.size / 2, -fixed.size / 2, fixed.size, fixed.size);
    c.translate(ox * R, oy * R);
    c.rotate(spin);
    c.translate(-ox * R, -oy * R);
    c.drawImage(orbit.image, -orbit.size / 2, -orbit.size / 2, orbit.size, orbit.size);
    c.restore();
  }

  /** Impact: a soft bloom and one shockwave ring from the apex. */
  function drawImpact({ c, w, h, R, impactK, apex: [ax, ay] }: Frame) {
    if (impactK < 0 || impactK >= 1) return;
    const bloom = c.createRadialGradient(ax, ay, 0, ax, ay, R * 1.7);
    const strength = Math.pow(1 - impactK, 2);
    bloom.addColorStop(0, 'rgba(255,255,255,' + (0.75 * strength).toFixed(3) + ')');
    bloom.addColorStop(0.3, 'rgba(208,191,255,' + (0.22 * strength).toFixed(3) + ')');
    bloom.addColorStop(1, 'rgba(208,191,255,0)');
    c.fillStyle = bloom;
    c.fillRect(0, 0, w, h);
    c.lineWidth = 1.5;
    c.strokeStyle = 'rgba(224,213,255,' + (0.6 * (1 - impactK)).toFixed(3) + ')';
    c.beginPath(); c.arc(ax, ay, Math.hypot(w, h) / 2 * 1.1 * outCubic(impactK), 0, 6.2832); c.stroke();
    c.lineWidth = 1;
  }

  /** Sizes the canvas to its box and clears it; null while it has no size. */
  function surface(c: CanvasRenderingContext2D, cv: HTMLCanvasElement) {
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return null;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = BACKGROUND;
    c.fillRect(0, 0, w, h);
    return { w, h };
  }

  /** Per-frame bookkeeping: rebuild the plates on a real resize and move the progress line. */
  function keepUp(R: number) {
    if (!plates || Math.abs(R - plateR) / plateR > 0.08) { plates = { fixed: plate(R, false), orbit: plate(R, true) }; plateR = R; }
    shownP = reduced ? target : shownP + (target - shownP) * 0.08;
    if (line) line.style.transform = 'scaleX(' + (shownP / 100).toFixed(3) + ')';
  }

  /** Starts the exit once the page is ready and the intro has played; returns exit progress 0–1. */
  function exitProgress(now: number, t: number) {
    if (ready && t >= T.end && !exitAt) {
      exitAt = now;
      html.classList.remove('ax-loading');
      root!.classList.add('is-leaving');
    }
    return exitAt ? clamp((now - exitAt) / 900) : 0;
  }

  function paint(now: number) {
    if (!canvas || !ctx) return;
    if (!start) start = now;
    const t = reduced ? T.end : (now - start) / 1000;
    const size = surface(ctx, canvas);
    if (!size) return;
    const { w, h } = size;

    const L = layout(w, h), R = L.R;
    keepUp(R);
    const exit = exitProgress(now, t);
    const breathe = 1 + (reduced ? 0 : 0.012 * Math.sin(t * 1.6));
    const zoom = (1 + 11 * exit * exit * exit) * breathe;
    // Keep the standalone mark centered as it forms, then bring its inner counter
    // to the center for the exit dive.
    const cx = lerp(L.x, w / 2 - MARK_COUNTER[0] * R * zoom, smooth(exit));
    const cy = lerp(L.y, h / 2 - MARK_COUNTER[1] * R * zoom, smooth(exit));
    const F: Frame = {
      c: ctx, t, w, h, L, R, exit, zoom, cx, cy,
      apex: [cx + MARK_APEX[0] * R * zoom, cy + MARK_APEX[1] * R * zoom],
      spin: reduced ? 0 : -t * 0.1,
      impactK: T.impact >= 0 && t >= T.impact ? clamp((t - T.impact) / 0.9) : -1,
    };
    const birth = T.impact >= 0 ? clamp((t - T.impact) / (T.birthEnd - T.impact)) : 1;
    const formed = brief ? smooth((t - T.formedAt) / 0.4) : smooth((birth - 0.85) / 0.15);

    drawStars(F);
    drawComet(F);
    drawBirth(F, birth);
    drawPlates(F, formed * (1 - smooth((exit - 0.35) / 0.65)));
    drawImpact(F);
    if (exit >= 1 || (reduced && exitAt && now - exitAt > 300)) finish();
  }

  function finish() {
    if (gone) return;
    gone = true;
    window.cancelAnimationFrame(frame);
    window.clearInterval(ticker);
    html.classList.remove('ax-loading');
    root!.remove();
  }

  if (!ctx) {
    ticker = window.setInterval(() => { if (ready) finish(); }, 100);
    return;
  }
  const loop = (now: number) => {
    paint(now);
    if (!gone) frame = window.requestAnimationFrame(loop);
  };
  if (reduced) {
    paint(performance.now());
    ticker = window.setInterval(() => { if (!gone) paint(performance.now()); }, 150);
  } else frame = window.requestAnimationFrame(loop);
})();
