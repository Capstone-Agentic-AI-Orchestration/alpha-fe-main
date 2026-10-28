import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

type Props = Readonly<{ home: string; inquiry: string; clientSignIn: string; onHowItWorks: () => void }>;

/**
 * Landing header actions. The inquiry stays one click away as a pill; the rest
 * lives in a menu that drops down as a stack of panels. Disclosure pattern:
 * Escape or a click outside closes it and returns focus to the toggle.
 */
export function LandingMenu({ home, inquiry, clientSignIn, onHowItWorks }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const close = () => setOpen(false);
  return <div ref={rootRef} className={`cl-menu${open ? ' is-open' : ''}`}>
    <div className="cl-menu-bar">
      <a className="cl-pill cl-pill-cta" href={inquiry}>Start an inquiry <i aria-hidden="true" /></a>
      <button ref={toggleRef} type="button" className="cl-pill" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
        {open ? 'Close' : 'Menu'}<span className="cl-pill-dots" aria-hidden="true"><i /><i /></span>
      </button>
    </div>
    <div id={panelId} className="cl-menu-panels">
      <nav className="cl-menu-links" aria-label="Client navigation">
        <a href={home} aria-current="page" onClick={close}>Home</a>
        <button type="button" onClick={() => { close(); onHowItWorks(); }}>How it works</button>
        <a href={clientSignIn} onClick={close}>Client sign in</a>
      </nav>
      <a className="cl-menu-card" href={inquiry} onClick={close}>
        <span className="cl-mono">Have a project in mind?</span>
        <span className="cl-menu-card-title">Tell us what<br />you need</span>
        <span className="cl-menu-card-arrow" aria-hidden="true"><ArrowRight size={18} /></span>
      </a>
      <a className="cl-menu-team" href="/#/team" onClick={close}><span>Team sign in</span><ArrowUpRight size={20} aria-hidden="true" /></a>
    </div>
  </div>;
}

