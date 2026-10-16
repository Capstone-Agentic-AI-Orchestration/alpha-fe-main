import { useLayoutEffect, useRef, useState } from 'react';

/** Scroll only the transcript; never ask the browser to move its ancestors. */
export function useTranscriptScroll(threadId: string | null, revision: unknown, active: boolean) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const previousThread = useRef<string | null>(null);
  const [showLatest, setShowLatest] = useState(false);

  const jumpToLatest = () => {
    following.current = true;
    setShowLatest(false);
    const el = transcriptRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  useLayoutEffect(() => {
    if (!active) return;
    const el = transcriptRef.current;
    if (!el) return;
    const changedThread = previousThread.current !== threadId;
    previousThread.current = threadId;
    if (changedThread || following.current) {
      el.scrollTop = el.scrollHeight;
      following.current = true;
      setShowLatest(false);
    } else {
      setShowLatest(el.scrollHeight - el.clientHeight - el.scrollTop > 80);
    }
  }, [threadId, revision, active]);

  const onScroll = () => {
    const el = transcriptRef.current;
    if (!el) return;
    following.current = el.scrollHeight - el.clientHeight - el.scrollTop < 80;
    if (following.current) setShowLatest(false);
  };

  return { transcriptRef, onScroll, showLatest, jumpToLatest, followNextMessage: () => { following.current = true; } };
}
