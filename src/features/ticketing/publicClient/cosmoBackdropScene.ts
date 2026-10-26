import { buildSpiral, seeded, spiralAngle, SPIRAL_EXTENT } from '@/features/landing/cosmoSpiral';

/** Fired on window after a successful client sign-in; the spiral's core flashes once. */
export const COSMO_IGNITE_EVENT = 'cosmo:ignite';

const BACKGROUND = '#07070c';
/** Canvas palette as "r,g,b" triplets, matching the landing journey. */
const INK = '245,243,252';
const LILAC = '208,191,255';
const MIST = '224,213,255';
const rgba = (rgb: string, alpha: number) => `rgba(${rgb},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;

/**
 * Background for the client access pages: the landing's starfield with a
 * large, faint Cosmo spiral turning behind the headline. It slows while the
 * visitor types and flashes once when sign-in succeeds. Decorative only.
 */
export class CosmoBackdropScene {
  private readonly spiral = buildSpiral(seeded(7), 1100);
  private readonly stars: [number, number, number, number][];
  private spin = 0;
  private speed = 0.035;
  private last: number | null = null;
  private flashAt: number | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const rnd = seeded(91);
    this.stars = Array.from({ length: 240 }, () => [rnd(), rnd(), rnd(), rnd() * 6.2832]);
  }

  ignite(time: number) {
    this.flashAt = time;
  }

  /** `calm` slows the spiral right down, e.g. while a field has focus. */
  draw(time: number, still: boolean, [mx, my]: [number, number], calm: boolean) {
    const cv = this.canvas;
    const w = cv.clientWidth, h = cv.clientHeight;
    const ctx = w && h ? cv.getContext('2d') : null;
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, w, h);

    const dt = this.last == null || still ? 0 : Math.min(0.1, Math.max(0, time - this.last));
    this.last = time;
    this.speed += ((calm ? 0.008 : 0.035) - this.speed) * Math.min(1, dt * 2);
    this.spin -= dt * this.speed;

    this.stars.forEach(([sx, sy, size, phase]) => {
      const tw = still ? 0.7 : 0.5 + 0.5 * Math.sin(time * (0.5 + size) + phase);
      const x = sx * w + mx * 6 * size, y = sy * h + my * 4 * size, r = 0.5 + size * 0.8;
      ctx.fillStyle = rgba(size > 0.85 ? LILAC : INK, 0.08 + 0.4 * tw * size);
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });

    const wide = w >= 900;
    const R = wide ? Math.min(w * 0.3, h * 0.46) : Math.min(w, h) * 0.46;
    const x = (wide ? w * 0.26 : w * 0.82) + mx * 24, y = (wide ? h * 0.64 : h * 0.2) + my * 16;
    const scale = R / SPIRAL_EXTENT;

    ctx.strokeStyle = rgba(MIST, 0.05);
    [0.36, 0.72, 1.08].forEach(f => { ctx.beginPath(); ctx.arc(x, y, f * scale, 0, 6.2832); ctx.stroke(); });

    this.spiral.forEach(([arm, r, jitter, glow]) => {
      const a = spiralAngle(this.spin, arm, r, jitter);
      const fade = 1 - r / 1.3;
      const tw = still ? 1 : 0.75 + 0.25 * Math.sin(time * 1.1 + glow * 9);
      const size = r < 0.2 ? 1.2 : 0.9;
      ctx.fillStyle = rgba(glow > 0.88 ? LILAC : INK, (0.06 + 0.34 * fade * fade) * tw);
      ctx.fillRect(x + Math.cos(a) * r * scale - size, y + Math.sin(a) * r * scale - size, size * 2, size * 2);
    });

    const flash = this.flashAt == null ? 1 : (time - this.flashAt) / 0.8;
    if (flash >= 1) this.flashAt = null;
    const core = Math.max(2.5, R * 0.018);
    ctx.fillStyle = rgba('255,255,255', 0.4);
    ctx.beginPath(); ctx.arc(x, y, core, 0, 6.2832); ctx.fill();
    if (flash < 1) {
      ctx.fillStyle = rgba('255,255,255', 0.35 * (1 - flash));
      ctx.beginPath(); ctx.arc(x, y, core * (1 + 4 * (1 - flash)), 0, 6.2832); ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = rgba(MIST, 0.6 * (1 - flash));
      ctx.beginPath(); ctx.arc(x, y, R * (0.08 + 1.1 * flash), 0, 6.2832); ctx.stroke();
      ctx.lineWidth = 1;
    }
  }
}
