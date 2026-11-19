import { TicketQueueSkeleton } from './TicketingSkeletons';
import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowRight, FlaskConical, Inbox } from 'lucide-react';
import { useApp, useTabSessionState } from '@/app/AppContext';
import { PmTicketsView } from './PmTicketsView';
import { pmTicketApi } from './pmApi';
import { OPEN_TICKET_KEY } from './PmInquiriesPage';

// Use the real cloud-backed queue by default. "0" keeps it disabled.
// The server's rollout switch, workspace gate and fresh PM authorization
// control writes; this flag grants no authority and never enables samples.
const intakeEnabled = import.meta.env.VITE_TICKETING_ENABLED !== '0';

// Development samples are a separate lazy module, never a production fallback.
const SampleTickets = import.meta.env.DEV
  ? lazy(() => import('./ticketingPreviewFixtures').then(({ pmPreviewApi, pmPreviewDocumentsApi }) => ({
    default: () => <PmTicketsView api={pmPreviewApi} documentsApi={pmPreviewDocumentsApi} communicationEnabled />,
  }))) : null;

/**
 * Which ticket actions this backend offers. Triage until it confirms the
 * optional Phase 7–9 workflow endpoints. Shared by Tickets and a client's page.
 */
export function usePmWorkflowActions(): 'triage' | 'all' {
  const [workflowActions, setWorkflowActions] = useState<'triage' | 'all'>('triage');
  const { activeWorkspace } = useApp();
  useEffect(() => {
    let current = true;
    setWorkflowActions('triage');
    void pmTicketApi.getWorkflowCapabilities().then(capabilities => {
      if (current && capabilities.phaseWorkflowEnabled) setWorkflowActions('all');
    }).catch(() => {
      // Keep the existing triage path available when this backend has not
      // enabled the optional Phase 7–9 endpoints.
    });
    return () => { current = false; };
  }, [activeWorkspace?.id]);
  return workflowActions;
}

/** The ticket queue and intake switch, shared by Tickets and a client's page. */
export const pmTicketsIntakeEnabled = intakeEnabled;

/** The PM ticket queue; Inquiries has its own sidebar destination. */
export function PmTicketsPage() {
  const [samples, setSamples] = useState(false);
  const workflowActions = usePmWorkflowActions();
  const { activeWorkspace, setActiveTab } = useApp();
  const newInquiries = usePendingInquiryCount(activeWorkspace?.id ?? null);
  const [, setSelectedClient] = useTabSessionState<string | null>('clients.selected', null);
  const openClient = (key: string) => { setSelectedClient(key); setActiveTab('clients'); };
  // A request an inquiry just became: open it once on arrival, then forget it so Tickets opens normally next time.
  const [openTicket, setOpenTicket] = useTabSessionState<string | null>(OPEN_TICKET_KEY, null);
  const [initialTicket] = useState(openTicket);
  useEffect(() => { if (openTicket) setOpenTicket(null); }, [openTicket, setOpenTicket]);

  return <div className="pm-ticket-page pm-ticket-page--nested">
    {SampleTickets && <div className="pm-ticket-page__sample">
      <p><FlaskConical size={15} aria-hidden="true" />
        {samples ? 'Sample data — not real tickets. Read-only; no messages, uploads, assignments or agent execution.' : 'Local development · inspect the interface with optional fictional tickets.'}</p>
      <button type="button" aria-pressed={samples} onClick={() => setSamples(value => !value)}>
        {samples ? 'Hide sample data' : 'Show sample data'}
      </button>
    </div>}
    {newInquiries.count > 0 && !samples && <button type="button" className="pm-inbox-notice" onClick={() => setActiveTab('inquiries')}>
      <Inbox size={15} aria-hidden="true" />
      <span><strong>{newInquiries.count}{newInquiries.more ? '+' : ''} new {newInquiries.count === 1 && !newInquiries.more ? 'inquiry' : 'inquiries'}</strong> waiting for you to accept or decline</span>
      <span className="pm-inbox-notice__action">Review<ArrowRight size={14} aria-hidden="true" /></span>
    </button>}
    <div className="pm-ticket-page__content">
      {samples && SampleTickets
        ? <Suspense fallback={<TicketQueueSkeleton label="Loading sample tickets" className="p-6" />}><SampleTickets /></Suspense>
        : <PmTicketsView key={activeWorkspace?.id ?? 'no-workspace'} intakeEnabled={intakeEnabled} workflowActions={workflowActions} communicationEnabled onOpenClient={openClient} initialSelectedId={initialTicket} initialFilter="needs_pm" />}
    </div>
  </div>;
}

/** New inquiries are part of the PM's inbox: count them so Tickets can point to them. */
function usePendingInquiryCount(workspaceId: string | null): { count: number; more: boolean } {
  const [value, setValue] = useState({ count: 0, more: false });
  useEffect(() => {
    let current = true;
    if (!intakeEnabled || !workspaceId) { setValue({ count: 0, more: false }); return () => { current = false; }; }
    void pmTicketApi.listCentralIntakes(null, 'pending').then(page => {
      if (current) setValue({ count: page.items.length, more: Boolean(page.nextCursor) });
    }).catch(() => { if (current) setValue({ count: 0, more: false }); });
    return () => { current = false; };
  }, [workspaceId]);
  return value;
}
