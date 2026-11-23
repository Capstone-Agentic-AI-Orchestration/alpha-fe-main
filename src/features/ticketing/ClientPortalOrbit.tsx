import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';

gsap.registerPlugin(useGSAP);

/** A quiet orbital motion layer for the client portal; it never intercepts pointer input. */
export function ClientPortalOrbit() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const rings = gsap.utils.toArray<SVGGElement>('[data-orbit-ring]', root.current);
    rings.forEach((ring, index) => {
      gsap.to(ring, {
        rotation: index === 1 ? -360 : 360,
        duration: 118 + index * 28,
        ease: 'none',
        repeat: -1,
        transformOrigin: '50% 50%',
      });
    });

    const nodes = gsap.utils.toArray<SVGCircleElement>('[data-orbit-node]', root.current);
    gsap.to(nodes, {
      scale: 1.16,
      opacity: 0.62,
      duration: 3.2,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
      stagger: 0.55,
      transformOrigin: '50% 50%',
    });
  }, { scope: root });

  return <div ref={root} className="cx-orbit-background" aria-hidden="true">
    <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
      <g transform="translate(800 500)">
        <g data-orbit-ring className="cx-orbit-ring cx-orbit-ring--outer">
          <ellipse rx="760" ry="355" transform="rotate(-18)" />
          <circle data-orbit-node className="cx-orbit-node is-violet" cx="760" cy="0" r="6" />
        </g>
        <g data-orbit-ring className="cx-orbit-ring cx-orbit-ring--middle">
          <ellipse rx="590" ry="285" transform="rotate(24)" />
          <circle data-orbit-node className="cx-orbit-node is-teal" cx="-590" cy="0" r="5" />
        </g>
        <g data-orbit-ring className="cx-orbit-ring cx-orbit-ring--inner">
          <ellipse rx="420" ry="215" transform="rotate(-8)" />
          <circle data-orbit-node className="cx-orbit-node is-amber" cx="0" cy="215" r="5" />
          <circle data-orbit-node className="cx-orbit-node is-violet" cx="420" cy="0" r="4" />
        </g>
      </g>
    </svg>
  </div>;
}
