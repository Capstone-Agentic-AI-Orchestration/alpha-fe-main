import { lazy, Suspense, useEffect, useState } from 'react';
import { FlaskConical, Inbox, RefreshCw, Ticket as TicketIcon } from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { Button } from '@/shared/components/ui/button';
import { PmTicketsView } from './PmTicketsView';
import { PmCentralIntakeInbox } from './PmCentralIntakeInbox';
import { pmTicketApi } from './pmApi';

// Use the real cloud-backed queue by default. "0" keeps it disabled.
// The server's rollout switch, workspace gate and fresh PM authorization
// control writes; this flag grants no authority and never enables samples.
const intakeEnabled = import.meta.env.VITE_TICKETING_ENABLED !== '0';

// Development samples are a separate lazy module, never a production fallback.
const SampleTickets = import.meta.env.DEV
  ? lazy(() => import('./ticketingPreviewFixtures').then(({ pmPreviewApi, pmPreviewDocumentsApi }) => ({
    default: () => <PmTicketsView api={pmPreviewApi} documentsApi={pmPreviewDocumentsApi} communicationEnabled />,
  }))) : null;

/** The real PM page: keep Alpha's surrounding sidebar, tabs and auth intact. */
export function PmTicketsPage() {
  const [samples, setSamples] = useState(false);
  const [section, setSection] = useState<'tickets' | 'inquiries'>('tickets');
  const [workflowActions, setWorkflowActions] = useState<'triage' | 'all'>('triage');
  const [refreshToken, setRefreshToken] = useState(0);
  const { activeWorkspace, showToast } = useApp();

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
  return <div className="pm-ticket-page pm-ticket-page--nested">
    {SampleTickets && <div className="pm-ticket-page__sample">
      <p><FlaskConical size={15} aria-hidden="true" />
        {samples ? 'Sample data — not real tickets. Read-only; no messages, uploads, assignments or agent execution.' : 'Local development · inspect the interface with optional fictional tickets.'}</p>
      <button type="button" aria-pressed={samples} onClick={() => { setSamples(value => !value); setSection('tickets'); }}>
        {samples ? 'Hide sample data' : 'Show sample data'}
      </button>
    </div>}
    {!samples && <nav aria-label="Ticket work queues" className="pm-ticket-page__tabs">
      <div role="tablist" className="pm-ticket-page__tab-list">
        <button id="pm-ticket-tab" type="button" role="tab" aria-selected={section === 'tickets'} aria-pressed={section === 'tickets'} aria-controls="pm-ticket-panel"
          onClick={() => setSection('tickets')} className={`pm-ticket-page__tab${section === 'tickets' ? ' is-active' : ''}`}>
          <TicketIcon size={15} aria-hidden="true" /><span className="pm-ticket-page__tab-label">Tickets</span>
        </button>
        <button id="pm-inquiry-tab" type="button" role="tab" aria-selected={section === 'inquiries'} aria-pressed={section === 'inquiries'} aria-controls="pm-inquiry-panel"
          onClick={() => setSection('inquiries')} className={`pm-ticket-page__tab${section === 'inquiries' ? ' is-active' : ''}`}>
          <Inbox size={15} aria-hidden="true" /><span className="pm-ticket-page__tab-label">Inquiries</span>
        </button>
      </div>
      <div className="pm-ticket-page__tab-actions">
        <Button variant="ghost" size="sm" onClick={() => setRefreshToken(value => value + 1)} aria-label={`Refresh ${section}`} title={`Refresh ${section}`}>
          <RefreshCw size={14} aria-hidden="true" /><span>Refresh</span>
        </Button>
      </div>
    </nav>}
    <div id={section === 'inquiries' ? 'pm-inquiry-panel' : 'pm-ticket-panel'} role={samples ? undefined : 'tabpanel'}
      aria-labelledby={samples ? undefined : section === 'inquiries' ? 'pm-inquiry-tab' : 'pm-ticket-tab'} className="pm-ticket-page__content">
      {samples && SampleTickets ? <Suspense fallback={<p role="status" className="p-6 text-xs text-content-secondary">Loading sample tickets…</p>}><SampleTickets /></Suspense>
        : section === 'inquiries' ? <PmCentralIntakeInbox workspaceId={activeWorkspace?.id ?? null} workspaceName={activeWorkspace?.name ?? null}
          workspaceCanReview={activeWorkspace?.role === 'pm'}
          onAccepted={reference => { showToast('Inquiry accepted', `${reference} was created in ${activeWorkspace?.name ?? 'your workspace'}. It is now in Tickets; client invitation and access remain separate.`, 'success'); setSection('tickets'); }} refreshToken={refreshToken} />
          : <PmTicketsView intakeEnabled={intakeEnabled} workflowActions={workflowActions} communicationEnabled refreshToken={refreshToken} />}
    </div>
  </div>;
}
