import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Monitor } from 'lucide-react';
import type { ClientProjectPreview } from './clientApi';
import { isEmbeddablePreviewUrl } from './ProjectQaStudio';

/** The preview site is drawn at a desktop size, then scaled down to fit the card. */
const SITE_WIDTH = 1280;
const SITE_HEIGHT = 800;

function hostOf(value: string): string {
  try { return new URL(value).host; } catch { return ''; }
}

/**
 * A small picture of the project's shared preview with a button to open it. The picture is the
 * live site scaled down and cannot be clicked into; sites that cannot be shown inside the portal
 * get a plain placeholder instead. With `onOpen`, the button opens the preview inside the portal
 * (the project's Preview view); without it, the site opens in a new tab.
 */
export function ClientPreviewThumb({ preview, projectName, onOpen }: { preview: ClientProjectPreview | null; projectName: string; onOpen?: () => void }) {
  const screen = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const live = preview !== null && isEmbeddablePreviewUrl(preview.url);
  useEffect(() => {
    const element = screen.current;
    if (!element || !live) return;
    setWidth(element.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => { const next = entries[0]?.contentRect.width; if (next) setWidth(next); });
    observer.observe(element);
    return () => observer.disconnect();
  }, [live]);
  const scale = width / SITE_WIDTH;
  let picture;
  if (live && scale > 0) {
    picture = <iframe src={preview.url} title={'Preview of ' + projectName} tabIndex={-1} loading="lazy" referrerPolicy="no-referrer"
      sandbox="allow-scripts allow-same-origin" style={{ width: SITE_WIDTH, height: SITE_HEIGHT, transform: 'scale(' + scale + ')' }} />;
  } else {
    picture = <div className="cx-thumb-empty"><Monitor size={22} aria-hidden="true" />
      <span>{preview ? 'Open the preview to see the latest version.' : 'Your project manager hasn’t shared a preview yet.'}</span></div>;
  }
  return <div className="cx-thumb">
    <div className="cx-thumb-bar" aria-hidden="true"><i /><i /><i /><span>{preview ? hostOf(preview.url) : 'Preview'}</span></div>
    <div ref={screen} className="cx-thumb-screen" aria-hidden={live ? true : undefined}>{picture}</div>
    {preview && onOpen && <button type="button" className="cx-button cx-thumb-open" onClick={onOpen} aria-label={'Open the preview of ' + projectName}>
      <Monitor size={14} aria-hidden="true" />Open preview</button>}
    {preview && !onOpen && <a className="cx-button cx-thumb-open" href={preview.url} target="_blank" rel="noopener noreferrer">
      <ExternalLink size={14} aria-hidden="true" />Open preview</a>}
  </div>;
}
