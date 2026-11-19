import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useApp, useTabSessionState } from '@/app/AppContext';
import { Button } from '@/shared/components/ui/button';
import { CreateProjectModal, type NewProjectInput } from '@/features/projects/CreateProjectModal';
import type { Project } from '@/shared/types';
import { PmCentralIntakeInbox } from './PmCentralIntakeInbox';
import { pmTicketApi, type PmCentralIntakeItem, type PmIntakeProjectStart } from './pmApi';

/** Tab state another page sets to open one inquiry here (a client's Proposals tab). */
export const OPEN_INQUIRY_KEY = 'inquiries.open';
/** Tab state this page sets so Tickets opens the request an inquiry just became. */
export const OPEN_TICKET_KEY = 'tickets.open';

export type OpenInquiry = { id: string; view: 'pending' | 'handled' };

/** The new-project form, filled in from what the client asked for. */
export function projectPrefill(item: Pick<PmCentralIntakeItem, 'title' | 'description' | 'requestedDeadline' | 'clarificationMessages'>) {
  const answers = (item.clarificationMessages ?? []).map(message => `${message.author === 'pm' ? 'Q' : 'A'}: ${message.body}`);
  return {
    name: item.title.slice(0, 120),
    description: [item.description, answers.length ? `From the conversation with the client:\n${answers.join('\n')}` : '']
      .filter(Boolean).join('\n\n').slice(0, 8000),
    targetDate: item.requestedDeadline ?? '',
  };
}

/** Shared inquiry intake as a distinct PM sidebar destination. */
export function PmInquiriesPage() {
  const [refreshToken, setRefreshToken] = useState(0);
  const { activeWorkspace, setActiveTab, showToast, projects, refreshBoardState } = useApp();
  const [openInquiry, setOpenInquiry] = useTabSessionState<OpenInquiry | null>(OPEN_INQUIRY_KEY, null);
  const [, setOpenTicket] = useTabSessionState<string | null>(OPEN_TICKET_KEY, null);
  const [, setSelectedProject] = useTabSessionState<string | null>('projects.selectedProject', null);
  // Read once on arrival: the inbox keeps it as its starting selection, and coming back later starts fresh.
  const [initialSelection] = useState(openInquiry);
  useEffect(() => { if (openInquiry) setOpenInquiry(null); }, [openInquiry, setOpenInquiry]);

  // Starting a project: the inquiry being turned into one, and one operation per inquiry so a retry finishes the job.
  const [startFor, setStartFor] = useState<PmCentralIntakeItem | null>(null);
  const startOperations = useRef(new Map<string, string>());
  const started = useRef<PmIntakeProjectStart | null>(null);

  const openTicket = (ticketId: string) => { setOpenTicket(ticketId); setActiveTab('tickets'); };
  const openProject = (projectId: string) => { setSelectedProject(projectId); setActiveTab('projects'); };
  const announce = (result: PmIntakeProjectStart, item?: PmCentralIntakeItem | null) => {
    const client = item?.kind === 'project_proposal' && result.clientVisible ? ' The client can see it in their projects.' : '';
    showToast(result.created ? 'Project started' : 'Added to project', `${result.projectName} (${result.projectKey}) now has the request ${result.reference}.${client}`, 'success');
  };

  const createFromInquiry = async (input: NewProjectInput): Promise<Project> => {
    const item = startFor;
    if (!item) throw new Error('This inquiry is no longer selected.');
    let operationId = startOperations.current.get(item.id);
    if (!operationId) { operationId = crypto.randomUUID(); startOperations.current.set(item.id, operationId); }
    const result = await pmTicketApi.startProjectFromIntake(item.id, operationId,
      { name: input.name, key: input.key, description: input.description, ...(input.targetDate ? { targetDate: input.targetDate.slice(0, 10) } : {}) },
      item.kind === 'project_proposal');
    startOperations.current.delete(item.id);
    started.current = result;
    // The project was made on the server: load it, so the repository step can save to it.
    await refreshBoardState();
    return { id: result.projectId, name: result.projectName, key: result.projectKey, resources: [] } as unknown as Project;
  };

  return <div className="pm-ticket-page pm-ticket-page--nested">
    <nav aria-label="Inquiries actions" className="pm-ticket-page__tabs">
      <div className="pm-ticket-page__tab-actions">
        <Button variant="ghost" size="sm" onClick={() => setRefreshToken(value => value + 1)}
          aria-label="Refresh inquiries" title="Refresh inquiries">
          <RefreshCw size={14} aria-hidden="true" /><span>Refresh</span>
        </Button>
      </div>
    </nav>
    <div className="pm-ticket-page__content">
      <PmCentralIntakeInbox
        workspaceId={activeWorkspace?.id ?? null}
        workspaceName={activeWorkspace?.name ?? null}
        workspaceCanReview={activeWorkspace?.role === 'pm'}
        initialSelection={initialSelection}
        projects={projects}
        onStartNewProject={item => { started.current = null; setStartFor(item); }}
        onProjectStarted={result => announce(result)}
        onOpenTicket={openTicket}
        onOpenProject={openProject}
        onAccepted={(reference, ticketId) => {
          showToast('Inquiry accepted', `${reference} is open in Tickets. Link its project from there.`, 'success');
          // Open the request itself, not just the Tickets list.
          openTicket(ticketId);
        }}
        refreshToken={refreshToken}
      />
    </div>
    <CreateProjectModal
      isOpen={Boolean(startFor)}
      initial={startFor ? projectPrefill(startFor) : undefined}
      title="Start a project from this inquiry"
      subtitle={startFor?.kind === 'project_proposal'
        ? 'Alpha creates the project, opens the request and lets this client see it. Set up repositories next.'
        : 'Alpha creates the project and opens the request. Set up repositories next.'}
      submitLabel="Start project"
      create={createFromInquiry}
      onClose={() => {
        // Closing after the project was made still counts: say so, and show the inquiry as handled.
        if (started.current) { announce(started.current, startFor); setRefreshToken(value => value + 1); started.current = null; }
        setStartFor(null);
      }}
    />
  </div>;
}
