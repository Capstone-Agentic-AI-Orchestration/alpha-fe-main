import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useApp, useTabSessionState } from '@/app/AppContext';
import { Button } from '@/shared/components/ui/button';
import { CreateProjectModal, type NewProjectInput } from '@/features/projects/CreateProjectModal';
import type { Project } from '@/shared/types';
import { PmCentralIntakeInbox } from './PmCentralIntakeInbox';
import { PmTicketsView, safeError } from './PmTicketsView';
import { InviteClientOption } from './InviteClientOption';
import { inviteClientToPortal, inviteOutcomeText, type ClientInviteOutcome } from './clientInvite';
import { pmTicketsIntakeEnabled, usePmWorkflowActions } from './pmTicketAvailability';
import { pmTicketApi, type PmCentralIntakeItem, type PmIntakeProjectStart } from './pmApi';

/** Tab state another page sets to open one inquiry here (a client's Proposals tab). */
export const OPEN_INQUIRY_KEY = 'inquiries.open';
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

/** Where a project manager answers an inquiry; the Inbox, Needs your attention and Clients open it. */
export function PmInquiriesPage() {
  const [refreshToken, setRefreshToken] = useState(0);
  const { activeWorkspace, setActiveTab, showToast, projects, refreshBoardState, visibleTabs } = useApp();
  const [openInquiry, setOpenInquiry] = useTabSessionState<OpenInquiry | null>(OPEN_INQUIRY_KEY, null);
  const [openRequest, setOpenRequest] = useState<{ ticketId: string; reference?: string } | null>(null);
  const workflowActions = usePmWorkflowActions();
  const [, setSelectedProject] = useTabSessionState<string | null>('projects.selectedProject', null);
  // Read once on arrival: the inbox keeps it as its starting selection, and coming back later starts fresh.
  const [initialSelection] = useState(openInquiry);
  useEffect(() => { if (openInquiry) setOpenInquiry(null); }, [openInquiry, setOpenInquiry]);

  // Starting a project: the inquiry being turned into one, and one operation per inquiry so a retry finishes the job.
  const [startFor, setStartFor] = useState<PmCentralIntakeItem | null>(null);
  const startOperations = useRef(new Map<string, string>());
  const started = useRef<PmIntakeProjectStart | null>(null);

  // Whether starting a project from a public inquiry also invites its sender to the client portal.
  const [inviteClient, setInviteClient] = useState(true);
  const invited = useRef<ClientInviteOutcome | null>(null);

  const openTicket = (ticketId: string, reference?: string) => setOpenRequest({ ticketId, reference });
  const openProject = (projectId: string) => { setSelectedProject(projectId); setActiveTab('projects'); };
  const announce = (result: PmIntakeProjectStart, item?: Pick<PmCentralIntakeItem, 'kind' | 'email'> | null, invitation: ClientInviteOutcome | null = null) => {
    const client = item?.kind === 'project_proposal' && result.clientVisible ? ' The client can see it in their projects.' : '';
    const invite = item ? inviteOutcomeText(item.email, invitation) : '';
    showToast(result.created ? 'Project started' : 'Added to project',
      [`${result.projectName} (${result.projectKey}) now has the request ${result.reference}.${client}`, invite].filter(Boolean).join(' '),
      invitation && 'failed' in invitation ? 'error' : 'success');
  };
  /** Invite the inquiry's sender, after the project exists: a failure leaves the project in place. */
  const sendInvite = async (ticketId: string): Promise<ClientInviteOutcome> => {
    try { return { sent: await inviteClientToPortal(pmTicketApi, ticketId) }; }
    catch (error) { return { failed: safeError(error, 'write') }; }
  };

  const createFromInquiry = async (input: NewProjectInput): Promise<Project> => {
    const item = startFor;
    if (!item) throw new Error('This inquiry is no longer selected.');
    const invite = item.kind !== 'project_proposal' && inviteClient;
    let operationId = startOperations.current.get(item.id);
    if (!operationId) { operationId = crypto.randomUUID(); startOperations.current.set(item.id, operationId); }
    const result = await pmTicketApi.startProjectFromIntake(item.id, operationId,
      { name: input.name, key: input.key, description: input.description, ...(input.targetDate ? { targetDate: input.targetDate.slice(0, 10) } : {}) },
      item.kind === 'project_proposal' || invite);
    startOperations.current.delete(item.id);
    started.current = result;
    invited.current = invite ? await sendInvite(result.ticketId) : null;
    // The project was made on the server: load it, so the repository step can save to it.
    await refreshBoardState();
    return { id: result.projectId, name: result.projectName, key: result.projectKey, resources: [] } as unknown as Project;
  };

  if (openRequest) return <div className="pm-ticket-page pm-ticket-page--nested">
    <nav aria-label="Request navigation" className="pm-ticket-page__tabs">
      <Button variant="ghost" size="sm" onClick={() => setOpenRequest(null)}><ArrowLeft size={14} aria-hidden="true" />Back to inquiries</Button>
    </nav>
    <div className="pm-ticket-page__content">
      <PmTicketsView key={openRequest.ticketId} initialSelectedId={openRequest.ticketId} ticketReference={openRequest.reference}
        intakeEnabled={pmTicketsIntakeEnabled} workflowActions={workflowActions} communicationEnabled />
    </div>
  </div>;

  return <div className="pm-ticket-page pm-ticket-page--nested">
    <nav aria-label="Inquiries actions" className="pm-ticket-page__tabs">
      {/* Not in the sidebar any more: the way back is to the Inbox that lists every inquiry. */}
      {visibleTabs.includes('inbox') && <Button variant="ghost" size="sm" onClick={() => setActiveTab('inbox')}><ArrowLeft size={14} aria-hidden="true" />Back to Inbox</Button>}
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
        onStartNewProject={item => { started.current = null; invited.current = null; setInviteClient(true); setStartFor(item); }}
        onProjectStarted={(result, item, invite) => {
          if (!invite) { announce(result, item); return; }
          void sendInvite(result.ticketId).then(invitation => { announce(result, item, invitation); setRefreshToken(value => value + 1); });
        }}
        onOpenTicket={openTicket}
        onOpenProject={openProject}
        onAccepted={(reference, ticketId) => {
          showToast('Inquiry accepted', `Opened request ${reference}.`, 'success');
          openTicket(ticketId, reference);
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
      extraFields={startFor && startFor.kind !== 'project_proposal'
        ? <InviteClientOption email={startFor.email} checked={inviteClient} onChange={setInviteClient} />
        : undefined}
      create={createFromInquiry}
      onClose={() => {
        // Closing after the project was made still counts: say so, and show the inquiry as handled.
        if (started.current) {
          announce(started.current, startFor, invited.current);
          setRefreshToken(value => value + 1); started.current = null; invited.current = null;
        }
        setStartFor(null);
      }}
    />
  </div>;
}
