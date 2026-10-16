import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

/** Entrances are independent of form state. Content starts visible and stays usable. */
export function useClientPageMotion() {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const elements = ref.current?.querySelectorAll('[data-public-arrival]');
      if (!elements?.length) return;
      gsap.from(elements, { y: 12, opacity: 0.65, duration: 0.45, stagger: 0.06, ease: 'power2.out', clearProps: 'opacity,transform' });
    });
    return () => media.revert();
  }, { scope: ref });
  return ref;
}
