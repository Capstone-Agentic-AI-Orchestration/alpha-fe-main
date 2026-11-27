import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ArrowLeft, ArrowRight, FolderKanban, MessageSquareText, Monitor } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { LoadingRows } from '@/shared/components/ui/skeleton';
import type { ClientProject, ClientProjectFeedbackMessage, ClientProjectRequestItem } from './clientApi';
import { ClientPreviewThumb, previewHost } from './ClientPreviewThumb';
import { CxEmpty } from './clientKit';
import { relativeTime } from './clientFriendly';
import { clientTicketProgress } from './clientTicketProgress';
import { time } from './ticketUi';
import { clientProjectKey } from './ClientProjectSections';

gsap.registerPlugin(useGSAP);

interface ShowcaseUpdate {
  id: string;
  kind: 'conversation' | 'request';
  title: string;
  body: string;
  createdAt: string;
  onOpen: () => void;
}

/** A project carousel paired with an activity feed scoped to the selected project. */
export function ClientProjectShowcase({ project, projects, requests, latestMessage, projectsLoading, requestsLoading, onSelectProject,
  onOpenRequest, onOpenProject, onOpenPreview, onGoToRequests }: {
  project: ClientProject | null;
  projects: ClientProject[];
  requests: ClientProjectRequestItem[];
  latestMessage: ClientProjectFeedbackMessage | null;
  projectsLoading: boolean;
  requestsLoading: boolean;
  onSelectProject: (project: ClientProject) => void;
  onOpenRequest: (request: ClientProjectRequestItem) => void;
  onOpenProject: (project: ClientProject) => void;
  onOpenPreview: (project: ClientProject) => void;
  onGoToRequests: () => void;
}) {
  const featureRef = useRef<HTMLDivElement>(null);
  const projectKey = project ? clientProjectKey(project) : '';
  const selectedIndex = project ? projects.findIndex(candidate => clientProjectKey(candidate) === projectKey) : -1;
  const projectRequests = project ? requests
    .filter(item => item.workspaceId === project.workspaceId && item.projectId === project.projectId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)) : [];
  useGSAP(() => {
    if (!featureRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(featureRef.current, { opacity: 0.72, y: 8, scale: 0.994 }, {
      opacity: 1, y: 0, scale: 1, duration: 0.38, ease: 'power2.out', clearProps: 'all',
    });
  }, { scope: featureRef, dependencies: [projectKey], revertOnUpdate: true });

  if (projectsLoading && !project) {
    return <Card className="cx-showcase-empty"><LoadingRows label="Loading your projects" rows={2} className="p-4" /></Card>;
  }
  if (!projects.length && !project) {
    return <Card className="cx-showcase-empty"><CxEmpty icon={<FolderKanban size={22} />} title="No projects yet"
      body="When the project manager shares a project, it will appear here." /></Card>;
  }
  if (!project) return null;
  const hostname = project.preview ? previewHost(project.preview.url) : '';

  const updates: ShowcaseUpdate[] = [];
  if (latestMessage) updates.push({
    id: 'conversation-' + latestMessage.id,
    kind: 'conversation',
    title: 'Project conversation',
    body: latestMessage.body,
    createdAt: latestMessage.createdAt,
    onOpen: () => onOpenProject(project),
  });
  projectRequests.slice(0, 4).forEach(item => {
    const body = item.projectLinkStatus === 'pending_review'
      ? 'The project manager is confirming the project' + (item.requestedProjectName ? ' for ' + item.requestedProjectName : '')
      : clientTicketProgress(item.status, item.requestedAction).label;
    updates.push({ id: 'request-' + item.workspaceId + '-' + item.id, kind: 'request', title: item.title,
      body, createdAt: item.updatedAt, onOpen: () => onOpenRequest(item) });
  });
  updates.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const go = (direction: -1 | 1) => {
    if (projects.length < 2) return;
    const nextIndex = (selectedIndex + direction + projects.length) % projects.length;
    onSelectProject(projects[nextIndex]);
  };

  return <section className="cx-showcase-layout" aria-label="Project showcase">
    <Card className={'cx-showcase-feature' + (project.preview ? '' : ' is-preview-unshared')} ref={featureRef}>
      <div className="cx-showcase-stage" aria-label={project.name + ' project preview'}>
        <div className="cx-showcase-picture">
          {project.preview
            ? <ClientPreviewThumb preview={project.preview} projectName={project.name} showBrowserBar={false} onOpen={() => onOpenPreview(project)} />
            : <div className="cx-showcase-no-preview cx-preview-glass" role="status">
                <Monitor size={24} strokeWidth={1.5} aria-hidden="true" />
                <span>Preview not shared yet</span>
              </div>}
          <header className="cx-showcase-overlay">
            <p className="cx-showcase-eyebrow">Featured project · {selectedIndex + 1} of {projects.length}</p>
            <div className="cx-showcase-overlay-actions">
              <h3><button type="button" className="cx-showcase-project-link" title={project.name} onClick={() => onOpenProject(project)}>
                <span>{project.name}</span><ArrowRight size={16} aria-hidden="true" />
              </button></h3>
              {project.preview && <Button type="button" variant="ghost" size="icon" className="cx-link cx-showcase-open-preview"
                aria-label="Open preview" title="Open preview" onClick={() => onOpenPreview(project)}>
                <Monitor size={16} aria-hidden="true" />
              </Button>}
            </div>
            {hostname && <p className="cx-showcase-host">{hostname}</p>}
          </header>
          {projects.length > 1 && <>
            <Button type="button" variant="outline" size="icon" className="cx-showcase-arrow is-previous"
              aria-label="Show previous project" onClick={() => go(-1)}><ArrowLeft size={16} aria-hidden="true" /></Button>
            <Button type="button" variant="outline" size="icon" className="cx-showcase-arrow is-next"
              aria-label="Show next project" onClick={() => go(1)}><ArrowRight size={16} aria-hidden="true" /></Button>
          </>}
        </div>
      </div>
    </Card>

    <Card className="cx-showcase-updates" aria-labelledby="cx-showcase-updates-title">
      <header className="cx-showcase-updates-head">
        <div><p className="cx-showcase-eyebrow">Selected project</p><h3 id="cx-showcase-updates-title">Latest updates</h3></div>
        <span className="cx-showcase-project-label">{project.name}</span>
      </header>
      <div className="cx-showcase-update-list">{requestsLoading && !requests.length
        ? <LoadingRows label={'Loading updates for ' + project.name} layout="table" rows={2} className="px-4 py-3" />
        : updates.length > 0
          ? updates.slice(0, 5).map(update => <button key={update.id} type="button"
            className="cx-showcase-update" onClick={update.onOpen}>
            <span className={'cx-showcase-update-icon is-' + update.kind} aria-hidden="true">
              {update.kind === 'conversation' ? <MessageSquareText size={15} /> : <FolderKanban size={15} />}
            </span>
            <span className="cx-showcase-update-copy"><strong>{update.title}</strong><span>{update.body}</span>
              <time dateTime={update.createdAt} title={time(update.createdAt)}>{relativeTime(update.createdAt)}</time></span>
            <ArrowRight size={14} className="cx-showcase-update-arrow" aria-hidden="true" />
          </button>)
          : <CxEmpty title="No updates for this project yet" body="Conversation and request updates will appear here." />}</div>
      <footer className="cx-showcase-updates-footer">
        <Button type="button" variant="ghost" size="sm" className="cx-link" onClick={() => onOpenProject(project)}>
          <MessageSquareText size={14} aria-hidden="true" />Open conversation</Button>
        <Button type="button" variant="ghost" size="sm" className="cx-link" onClick={onGoToRequests}>
          All requests <ArrowRight size={14} aria-hidden="true" /></Button>
      </footer>
    </Card>
  </section>;
}
