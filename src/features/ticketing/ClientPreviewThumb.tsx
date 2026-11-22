import { useEffect, useRef, useState } from 'react';
import { Monitor } from 'lucide-react';
import type { ClientProjectPreview } from './clientApi';
import { isEmbeddablePreviewUrl } from './ProjectQaStudio';

/** The preview site is drawn at a desktop size, then scaled down to cover the picture area (its top-left stays in view). */
const SITE_WIDTH = 1280;
const SITE_HEIGHT = 800;

function hostOf(value: string): string {
  try { return new URL(value).host; } catch { return ''; }
}

/**
 * A small picture of the project's shared preview, framed so a bright site sits calmly on a dark card.
 * The picture is the live site scaled down and cannot be clicked into; sites that cannot be shown
 * inside the portal get a plain placeholder instead. With `onOpen`, clicking the picture opens the
 * preview inside the portal. It is a mouse shortcut only: the card's "Open preview" link is the
 * labelled way in for keyboards and screen readers.
 */
export function ClientPreviewThumb({ preview, projectName, onOpen }: { preview: ClientProjectPreview | null; projectName: string; onOpen?: () => void }) {
  const screen = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const live = preview !== null && isEmbeddablePreviewUrl(preview.url);
  useEffect(() => {
    const element = screen.current;
    if (!element || !live) return;
    setBox({ width: element.clientWidth, height: element.clientHeight });
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect;
      if (next?.width) setBox({ width: next.width, height: next.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [live]);
  const scale = Math.max(box.width / SITE_WIDTH, box.height / SITE_HEIGHT);
  let picture;
  if (live && scale > 0) {
    picture = <iframe src={preview.url} title={'Preview of ' + projectName} tabIndex={-1} loading="lazy" referrerPolicy="no-referrer"
      sandbox="allow-scripts allow-same-origin" style={{ width: SITE_WIDTH, height: SITE_HEIGHT, transform: 'scale(' + scale + ')' }} />;
  } else {
    picture = <div className="cx-thumb-empty"><Monitor size={22} aria-hidden="true" />
      <span>{preview ? 'Open the preview to see the latest version.' : 'Your project manager hasn’t shared a preview yet.'}</span></div>;
  }
  return <div className={'cx-thumb' + (onOpen ? ' is-openable' : '')} onClick={onOpen} role="presentation">
    <div className="cx-thumb-bar" aria-hidden="true"><i /><i /><i /><span>{preview ? hostOf(preview.url) : 'Preview'}</span></div>
    <div ref={screen} className="cx-thumb-screen" aria-hidden={live ? true : undefined}>{picture}</div>
  </div>;
}
