import { MARK_APEX, MARK_STROKES, MARK_TRAIL_DIRECTION, markPoint, sampleMark, seeded } from '@/brand/markParticles';

/** Fired on window after a successful client sign-in; the mark's apex flashes once. */
export const BRAND_IGNITE_EVENT = 'alphaexplora:ignite';

const BACKGROUND = '#07070c';
/** Canvas palette as "r,g,b" triplets, matching the landing journey. */
const INK = '245,243,252';
const LILAC = '208,191,255';
const MIST = '224,213,255';
const rgba = (rgb: string, alpha: number) => `rgba(${rgb},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;

/**
 * Background for sign-in pages: the landing's starfield with a
 * large, faint Alphaexplora mark behind the headline. The A holds still while
 * its orbit turns and its dots shimmer along the strokes; it all slows while
 * the visitor types, and the apex flashes and the trails streak once when
 * sign-in succeeds. Decorative only.
 */
export class BrandBackdropScene {
  private readonly particles = sampleMark(seeded(7), 1300);
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

  /** `calm` slows the orbit right down, e.g. while a field has focus. */
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
    this.spin -= dt * this.speed * 2.4;

    this.stars.forEach(([sx, sy, size, phase]) => {
      const tw = still ? 0.7 : 0.5 + 0.5 * Math.sin(time * (0.5 + size) + phase);
      const x = sx * w + mx * 6 * size, y = sy * h + my * 4 * size, r = 0.5 + size * 0.8;
      ctx.fillStyle = rgba(size > 0.85 ? LILAC : INK, 0.08 + 0.4 * tw * size);
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });

    const wide = w >= 900;
    /** Half the mark's height in pixels. */
    const R = wide ? Math.min(w * 0.26, h * 0.4) : Math.min(w, h) * 0.4;
    const x = (wide ? w * 0.26 : w * 0.8) + mx * 24, y = (wide ? h * 0.6 : h * 0.22) + my * 16;
    const flash = this.flashAt == null ? 1 : (time - this.flashAt) / 0.8;
    if (flash >= 1) this.flashAt = null;
    const burst = 1 - flash;

    this.particles.forEach(particle => {
      const [stroke, along, , glow] = particle;
      // Dots drift a little along their stroke, so the mark shimmers without moving.
      const drift = still ? 0 : 0.006 * Math.sin(time * 0.5 * (this.speed / 0.035) + glow * 9);
      let [px, py] = markPoint([stroke, Math.min(1, Math.max(0, along + drift)), particle[2], glow, particle[4]], this.spin);
      const trail = MARK_STROKES[stroke].layer === 'trail';
      if (trail && burst > 0) { px += MARK_TRAIL_DIRECTION[0] * 0.25 * (1 - burst) * burst; py += MARK_TRAIL_DIRECTION[1] * 0.25 * (1 - burst) * burst; }
      const tw = still ? 1 : 0.75 + 0.25 * Math.sin(time * 1.1 + glow * 9);
      const size = glow > 0.9 ? 1.2 : 0.9;
      ctx.fillStyle = rgba(glow > 0.88 ? LILAC : INK, (0.1 + 0.26 * glow) * tw + (trail ? 0.5 * burst : 0));
      ctx.fillRect(x + px * R - size, y + py * R - size, size * 2, size * 2);
    });

    const apexX = x + MARK_APEX[0] * R, apexY = y + MARK_APEX[1] * R;
    const core = Math.max(2.5, R * 0.018);
    ctx.fillStyle = rgba('255,255,255', 0.4);
    ctx.beginPath(); ctx.arc(apexX, apexY, core, 0, 6.2832); ctx.fill();
    if (burst > 0) {
      ctx.fillStyle = rgba('255,255,255', 0.35 * burst);
      ctx.beginPath(); ctx.arc(apexX, apexY, core * (1 + 4 * burst), 0, 6.2832); ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = rgba(MIST, 0.6 * burst);
      ctx.beginPath(); ctx.arc(apexX, apexY, R * (0.08 + 1.1 * flash), 0, 6.2832); ctx.stroke();
      ctx.lineWidth = 1;
    }
  }
}
