import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

/** Decorative only. The public shell owns pointer events; the artwork never captures them. */
export function InteractiveBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const artwork = ref.current;
    const shell = artwork?.parentElement;
    if (!artwork || !shell) return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)', () => {
      const layer = artwork.querySelector('.public-network');
      const light = artwork.querySelector('.public-pointer-light');
      const moveX = gsap.quickTo(layer, 'x', { duration: 0.8, ease: 'power2.out' });
      const moveY = gsap.quickTo(layer, 'y', { duration: 0.8, ease: 'power2.out' });
      const lightX = gsap.quickTo(light, 'x', { duration: 0.8, ease: 'power2.out' });
      const lightY = gsap.quickTo(light, 'y', { duration: 0.8, ease: 'power2.out' });
      const reset = () => { moveX(0); moveY(0); lightX(0); lightY(0); };
      const move = (event: PointerEvent) => {
        if (document.hidden || document.activeElement?.matches('input, textarea, select')) return;
        const x = event.clientX / window.innerWidth - 0.5;
        const y = event.clientY / window.innerHeight - 0.5;
        moveX(x * 22); moveY(y * 16);
        lightX(x * 160); lightY(y * 90);
      };
      shell.addEventListener('pointermove', move);
      shell.addEventListener('pointerleave', reset);
      shell.addEventListener('focusin', reset);
      window.addEventListener('blur', reset);
      return () => {
        shell.removeEventListener('pointermove', move);
        shell.removeEventListener('pointerleave', reset);
        shell.removeEventListener('focusin', reset);
        window.removeEventListener('blur', reset);
      };
    });
    return () => media.revert();
  }, { scope: ref });

  return <div ref={ref} className="public-backdrop" aria-hidden="true" data-testid="interactive-backdrop">
    <div className="public-pointer-light" />
    <svg className="public-network" viewBox="0 0 1600 980" fill="none" preserveAspectRatio="xMidYMin slice">
      <g className="public-network-lines">
        <path d="M-100 310H104Q144 310 144 270V140Q144 100 184 100H430Q470 100 470 60V-40" />
        <path d="M-80 730H128Q176 730 176 682V585Q176 545 216 545H440" />
        <path d="M1640 155H1380Q1340 155 1340 195V300Q1340 340 1300 340H1160" />
        <path d="M1660 650H1420Q1380 650 1380 690V792Q1380 832 1340 832H1080Q1040 832 1040 872V1020" />
        <path d="M80 1000V855Q80 815 120 815H500Q540 815 540 855V1000" />
        <path d="M720-40V35Q720 75 760 75H1030Q1070 75 1070 115V170" />
      </g>
      <g className="public-network-nodes">
        <rect x="133" y="210" width="22" height="22" rx="6" />
        <rect x="264" y="89" width="22" height="22" rx="6" />
        <rect x="165" y="615" width="22" height="22" rx="6" />
        <rect x="1329" y="235" width="22" height="22" rx="6" />
        <rect x="1369" y="732" width="22" height="22" rx="6" />
        <rect x="1179" y="821" width="22" height="22" rx="6" />
        <rect x="874" y="64" width="22" height="22" rx="6" />
      </g>
      <g fill="currentColor"><circle cx="144" cy="221" r="3" /><circle cx="1340" cy="246" r="3" /><circle cx="1380" cy="743" r="3" /><circle cx="275" cy="100" r="3" /></g>
    </svg>
    <div className="public-background-dots" />
  </div>;
}
