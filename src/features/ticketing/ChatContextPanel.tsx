import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { PanelRightClose, PanelRightOpen, X } from 'lucide-react';
import './chatWorkspace.css';

/** Presentation only: each caller supplies its existing role-authorized content. */
export function ChatContextPanel({ label, className = '', children, activeSection = 'conversation', onClose }: {
  label: string; className?: string; children: ReactNode; activeSection?: string; onClose?: () => void;
}) {
  const id = useId();
  const panel = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const [width, setWidth] = useState(320);
  const [open, setOpen] = useState(() => typeof window === 'undefined'
    || (typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1280px)').matches));
  const close = () => { setOpen(false); onClose?.(); window.requestAnimationFrame(() => toggle.current?.focus()); };
  useEffect(() => { if (activeSection !== 'conversation') setOpen(true); }, [activeSection]);
  useEffect(() => {
    if (open && window.matchMedia('(max-width: 1279px)').matches) panel.current?.focus();
  }, [open]);
  function resize(value: number) {
    const available = panel.current?.parentElement?.parentElement?.clientWidth ?? 900;
    setWidth(Math.max(260, Math.min(420, available - 440, value)));
  }
  return <div className={`role-chat-context ${open ? 'is-open' : ''}`} style={{ '--role-chat-context-width': `${width}px` } as React.CSSProperties}>
    <button ref={toggle} type="button" className="role-chat-context__toggle" aria-label={`${open ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
      aria-expanded={open} aria-controls={id} onClick={() => { if (open) close(); else setOpen(true); }}>
      {open ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}<span>{label}</span>
    </button>
    {open && <button type="button" tabIndex={-1} className="role-chat-context__scrim" aria-label={`Close ${label.toLowerCase()}`} onClick={close} />}
    <aside ref={panel} tabIndex={-1} id={id} hidden={!open} aria-label={label} className={`role-chat-context__panel ${className}`}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); close(); }
        if (event.key === 'Tab' && window.matchMedia('(max-width: 1279px)').matches) {
          const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')];
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <div className="role-chat-context__header"><h2>{label}</h2><button type="button" aria-label={`Close ${label.toLowerCase()}`} onClick={close}><X size={17} /></button></div>
      {children}
    </aside>
    {open && <div role="separator" tabIndex={0} aria-label={`Resize ${label.toLowerCase()}`} aria-orientation="vertical" aria-valuemin={260} aria-valuemax={420} aria-valuenow={width}
      className="role-chat-context__resize"
      onPointerDown={event => { drag.current = { x: event.clientX, width }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { if (drag.current) resize(drag.current.width + drag.current.x - event.clientX); }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); resize(width + (event.key === 'ArrowLeft' ? 24 : -24)); } }} />}
  </div>;
}
