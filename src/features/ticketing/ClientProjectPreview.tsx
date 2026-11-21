import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import type { ClientProject } from './clientApi';
import { QaPreview } from './ProjectQaStudio';

/**
 * The project's shared preview: the latest build the project manager published for the client,
 * with device sizes and reload. Full screen hands the whole display to it where browsers allow that.
 */
export function ProjectPreviewFrame({ project, toolbarExtra }: Readonly<{ project: ClientProject; toolbarExtra?: ReactNode }>) {
  const frame = useRef<HTMLDivElement>(null);
  const [fullScreen, setFullScreen] = useState(false);
  const canFullScreen = typeof document !== 'undefined' && document.fullscreenEnabled === true;
  useEffect(() => {
    const update = () => setFullScreen(document.fullscreenElement === frame.current && frame.current !== null);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  function toggleFullScreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void frame.current?.requestFullscreen().catch(() => undefined);
  }
  if (!project.preview) return null;
  const fullScreenButton = canFullScreen
    ? <Button type="button" variant="outline" size="sm" className="cx-preview-full" onClick={toggleFullScreen}>
      {fullScreen ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}{fullScreen ? 'Exit full screen' : 'Full screen'}</Button>
    : undefined;
  const toolbarEnd = toolbarExtra || fullScreenButton ? <>{toolbarExtra}{fullScreenButton}</> : undefined;
  return <div ref={frame} className="cx-preview-frame"><QaPreview audience="client" toolbarEnd={toolbarEnd}
    preview={{ branch: project.preview.branch, url: project.preview.url, embeddable: true, reason: null }} /></div>;
}
