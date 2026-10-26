import { useEffect, useRef } from 'react';
import { COSMO_IGNITE_EVENT, CosmoBackdropScene } from './cosmoBackdropScene';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Decorative Cosmo spiral behind the client access pages. Pointer input is read, never captured. */
export function CosmoBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const scene = new CosmoBackdropScene(canvas);
    const motion = globalThis.matchMedia(REDUCED_MOTION);
    const start = performance.now();
    const now = () => (performance.now() - start) / 1000;
    const target: [number, number] = [0, 0];
    const pointer: [number, number] = [0, 0];
    let frame = 0;
    const typing = () => Boolean(document.activeElement?.matches('input, textarea, select'));
    const drawStill = () => scene.draw(now(), true, [0, 0], false);
    const loop = () => {
      pointer[0] += (target[0] - pointer[0]) * 0.06;
      pointer[1] += (target[1] - pointer[1]) * 0.06;
      scene.draw(now(), false, pointer, typing());
      frame = requestAnimationFrame(loop);
    };
    const restart = () => {
      cancelAnimationFrame(frame);
      if (motion.matches) drawStill();
      else frame = requestAnimationFrame(loop);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      target[0] = event.clientX / globalThis.innerWidth - 0.5;
      target[1] = event.clientY / globalThis.innerHeight - 0.5;
    };
    const ignite = () => { if (!motion.matches) scene.ignite(now()); };
    const resize = () => { if (motion.matches) drawStill(); };
    restart();
    globalThis.addEventListener('pointermove', move, { passive: true });
    globalThis.addEventListener('resize', resize);
    globalThis.addEventListener(COSMO_IGNITE_EVENT, ignite);
    motion.addEventListener('change', restart);
    return () => {
      cancelAnimationFrame(frame);
      globalThis.removeEventListener('pointermove', move);
      globalThis.removeEventListener('resize', resize);
      globalThis.removeEventListener(COSMO_IGNITE_EVENT, ignite);
      motion.removeEventListener('change', restart);
    };
  }, []);
  return <canvas ref={ref} className="public-cosmo-canvas" aria-hidden="true" />;
}
