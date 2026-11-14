import { lazy, Suspense, useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { PmTicketsView } from './PmTicketsView';
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

/** The PM ticket queue; Inquiries has its own sidebar destination. */
export function PmTicketsPage() {
  const [samples, setSamples] = useState(false);
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

  return <div className="pm-ticket-page pm-ticket-page--nested">
    {SampleTickets && <div className="pm-ticket-page__sample">
      <p><FlaskConical size={15} aria-hidden="true" />
        {samples ? 'Sample data — not real tickets. Read-only; no messages, uploads, assignments or agent execution.' : 'Local development · inspect the interface with optional fictional tickets.'}</p>
      <button type="button" aria-pressed={samples} onClick={() => setSamples(value => !value)}>
        {samples ? 'Hide sample data' : 'Show sample data'}
      </button>
    </div>}
    <div className="pm-ticket-page__content">
      {samples && SampleTickets
        ? <Suspense fallback={<p role="status" className="p-6 text-xs text-content-secondary">Loading sample tickets…</p>}><SampleTickets /></Suspense>
        : <PmTicketsView key={activeWorkspace?.id ?? 'no-workspace'} intakeEnabled={intakeEnabled} workflowActions={workflowActions} communicationEnabled />}
    </div>
  </div>;
}
