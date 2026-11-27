import { useEffect, useRef } from 'react';
import { MARK_ORBIT_CENTRE, MARK_STROKES, markPoint, sampleMark, seeded } from '@/brand/markParticles';

export function ClientPortalStars({ showAlphaMark = false }: { showAlphaMark?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Match the archived Cosmo backdrop's density, palette and twinkle.
    const random = seeded(91);
    const stars = Array.from({ length: 240 }, () => ({
      x: random(), y: random(), size: random(), phase: random() * Math.PI * 2,
    }));
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mark = showAlphaMark ? sampleMark(seeded(11), 2800).map(particle => ({
      point: markPoint(particle),
      orbit: MARK_STROKES[particle[0]].layer === 'orbit',
      size: 0.45 + particle[3] * 0.85,
    })) : [];
    let frame = 0;
    let nextMeteor = 0;
    let meteor: { x: number; y: number; dx: number; dy: number; start: number } | undefined;

    function draw(now: number) {
      if (!canvas || !ctx) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.round(w * dpr);
      const height = Math.round(h * dpr);
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      for (const star of stars) {
        const twinkle = motion.matches ? 0.7 : 0.5 + 0.5 * Math.sin(now / 1000 * (0.5 + star.size) + star.phase);
        const radius = 0.5 + star.size * 0.8;
        const color = star.size > 0.85 ? '208,191,255' : '245,243,252';
        ctx.fillStyle = `rgba(${color},${0.09 + 0.59 * twinkle * star.size})`;
        ctx.fillRect(star.x * w - radius, star.y * h - radius, radius * 2, radius * 2);
      }

      if (showAlphaMark) {
        const radius = Math.min(w * 0.24, h * 0.22, 165);
        const [orbitX, orbitY] = MARK_ORBIT_CENTRE;
        const angle = motion.matches ? 0 : -now / 26000;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        ctx.fillStyle = 'rgba(234,226,255,0.27)';
        for (const grain of mark) {
          let [x, y] = grain.point;
          if (grain.orbit) {
            const dx = x - orbitX;
            const dy = y - orbitY;
            x = orbitX + dx * cos - dy * sin;
            y = orbitY + dx * sin + dy * cos;
          }
          ctx.fillRect(w / 2 + x * radius, h / 2 + y * radius, grain.size, grain.size);
        }
      }

      if (motion.matches) return;
      if (!nextMeteor) nextMeteor = now + 3000 + Math.random() * 4000;
      if (now >= nextMeteor) {
        const direction = Math.random() < 0.5 ? -1 : 1;
        meteor = {
          x: 0.08 + Math.random() * 0.84, y: 0.05 + Math.random() * 0.7,
          dx: direction * w * (0.18 + Math.random() * 0.25),
          dy: h * (0.1 + Math.random() * 0.17), start: now,
        };
        nextMeteor = now + 7000 + Math.random() * 10000;
      }
      if (meteor) {
        const progress = (now - meteor.start) / 850;
        if (progress >= 1) meteor = undefined;
        else {
          const x = meteor.x * w + meteor.dx * progress;
          const y = meteor.y * h + meteor.dy * progress;
          const length = Math.min(145, Math.hypot(meteor.dx, meteor.dy) * 0.48);
          const angle = Math.atan2(meteor.dy, meteor.dx);
          const tailX = x - Math.cos(angle) * length;
          const tailY = y - Math.sin(angle) * length;
          if (length > 0) {
            const trail = ctx.createLinearGradient(tailX, tailY, x, y);
            trail.addColorStop(0, 'rgba(208,191,255,0)');
            trail.addColorStop(1, `rgba(245,243,252,${Math.sin(Math.PI * progress) * 0.8})`);
            ctx.strokeStyle = trail;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(x, y);
            ctx.stroke();
          }
        }
      }
      if (!document.hidden) frame = requestAnimationFrame(draw);
    }

    function refresh() {
      cancelAnimationFrame(frame);
      meteor = undefined;
      nextMeteor = 0;
      if (!document.hidden) draw(performance.now());
    }

    const resize = new ResizeObserver(() => {
      if (motion.matches) refresh();
    });
    resize.observe(canvas);
    motion.addEventListener('change', refresh);
    document.addEventListener('visibilitychange', refresh);
    refresh();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      motion.removeEventListener('change', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [showAlphaMark]);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 top-[52px] h-[calc(100%-52px)] w-full" />;
}
