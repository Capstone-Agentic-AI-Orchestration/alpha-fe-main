import { useEffect, useState } from 'react';

/** Keep in step with the chat panel open/close animations in index.css. */
export const PANEL_MOTION_MS = 200;

/**
 * Keeps a chat panel mounted for one animation after it is closed, so it can
 * slide shut instead of vanishing. `closing` is true during that last frame run.
 */
export function usePanelPresence(open: boolean) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) { setMounted(true); return; }
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setMounted(false); return; }
    const timer = window.setTimeout(() => setMounted(false), PANEL_MOTION_MS);
    return () => window.clearTimeout(timer);
  }, [open]);
  return { mounted: open || mounted, closing: !open && mounted };
}
