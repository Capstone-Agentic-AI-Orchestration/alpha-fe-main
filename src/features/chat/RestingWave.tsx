import React, { useEffect, useRef } from 'react';

/** Colours as "r, g, b" channels, matching the scene palette CSS variables. */
export interface RestingWaveColors { dot: string; crest: string; star: string }

const ROWS = 3;
const DOT_SPACING = 6;
const FRAME_MS = 1000 / 30;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
/** Smooth ramp from 0 at edge0 to 1 at edge1; edge0 > edge1 ramps the other way. */
const ramp = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
/** Stable 0..1 noise per index, so stars keep their place between frames. */
const hash = (index: number, salt: number) => {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

/**
 * The bar at rest: a few far stars and a slow ribbon of dots rolling through
 * the empty middle. It fades out under the title on the left and before the
 * controls on the right, so it never sits behind text.
 */
export function drawRestingWave(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seconds: number,
  colors: RestingWaveColors,
  options: { fadeStart: number; fadeEnd: number; lively?: boolean }
): void {
  ctx.clearRect(0, 0, width, height);
  const { fadeStart, fadeEnd, lively = false } = options;
  const visible = (x: number) => ramp(fadeStart, fadeStart + 140, x) * ramp(width - fadeEnd, width - fadeEnd - 140, x);
  const t = seconds * (lively ? 1.1 : 0.45);
  const mid = height / 2;

  const starCount = Math.floor(width / 16);
  for (let index = 0; index < starCount; index += 1) {
    const x = hash(index, 1) * width;
    const fade = visible(x);
    if (fade <= 0) continue;
    const y = 4 + hash(index, 2) * (height - 8);
    const twinkle = 0.5 + 0.5 * Math.sin(seconds * (0.6 + hash(index, 3)) + index);
    ctx.globalAlpha = (0.08 + 0.32 * twinkle) * fade;
    ctx.fillStyle = 'rgb(' + colors.star + ')';
    ctx.beginPath();
    ctx.arc(x, y, 0.5 + hash(index, 4) * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let row = 0; row < ROWS; row += 1) {
    for (let x = fadeStart; x <= width - fadeEnd; x += DOT_SPACING) {
      const fade = visible(x);
      if (fade <= 0) continue;
      const y = mid
        + Math.sin(x * 0.012 + t + row * 0.9) * height * 0.17
        + Math.sin(x * 0.031 - t * 0.6 + row) * height * 0.06
        + (row - 1) * height * 0.11;
      // Depth rolls along the ribbon: near dots are larger and brighter.
      const depth = 0.5 + 0.5 * Math.sin(x * 0.02 + t * 0.8 + row * 1.3);
      ctx.globalAlpha = (0.12 + depth * (lively ? 0.6 : 0.42)) * fade;
      ctx.fillStyle = 'rgb(' + (depth > 0.86 ? colors.crest : colors.dot) + ')';
      ctx.beginPath();
      ctx.arc(x, y, 0.55 + depth * 0.95, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

interface RestingWaveProps {
  colors: RestingWaveColors;
  /** Px kept clear on the left (title) and right (controls). */
  fadeStart?: number;
  fadeEnd?: number;
  /** Alpha is replying: the same wave, a little faster and brighter. */
  lively?: boolean;
}

export const RestingWave: React.FC<RestingWaveProps> = ({ colors, fadeStart = 230, fadeEnd = 56, lively = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef({ colors, fadeStart, fadeEnd, lively });
  settingsRef.current = { colors, fadeStart, fadeEnd, lively };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let frame = 0;
    let last = -Infinity;
    const paint = (seconds: number) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(rect.width * dpr);
      const pixelHeight = Math.round(rect.height * dpr);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { colors: current, ...options } = settingsRef.current;
      drawRestingWave(ctx, rect.width, rect.height, seconds, current, options);
    };
    const render = (time: number) => {
      // Thirty frames a second is plenty for a slow wave and halves the work.
      if (!document.hidden && time - last >= FRAME_MS) {
        last = time;
        paint(time / 1000);
      }
      frame = requestAnimationFrame(render);
    };
    if (reduceMotion) paint(0);
    else frame = requestAnimationFrame(render);
    const observer = new ResizeObserver(() => { if (reduceMotion) paint(0); });
    observer.observe(canvas);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-full">
    <canvas ref={canvasRef} data-resting-wave="" className="h-full w-full" />
  </span>;
};
