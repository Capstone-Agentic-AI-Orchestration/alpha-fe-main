import { lazy, Suspense, useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { PmTicketsView } from './PmTicketsView';
import { PmCentralIntakeInbox } from './PmCentralIntakeInbox';
import { pmTicketApi } from './pmApi';

// Use the real cloud-backed queue by default. "0" keeps it disabled.
// The server's rollout switch, workspace gate and fresh PM authorization
// control writes; this flag grants no authority and never enables samples.
const intakeEnabled = import.meta.env.VITE_TICKETING_ENABLED !== '0';

// Development samples are a separate lazy module, never a production fallback.
const SampleTickets = import.meta.env.DEV
  ? lazy(() => import('./ticketingPreviewFixtures').then(({ pmPreviewApi }) => ({
    default: () => <PmTicketsView api={pmPreviewApi} />,
  }))) : null;

/** The real PM page: keep Alpha's surrounding sidebar, tabs and auth intact. */
export function PmTicketsPage() {
  const [samples, setSamples] = useState(false);
  const [section, setSection] = useState<'tickets' | 'inquiries'>('tickets');
  const [workflowActions, setWorkflowActions] = useState<'triage' | 'all'>('triage');
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
  return <div className="flex h-full min-h-0 flex-col">
    {SampleTickets && <div className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/15 bg-amber-500/[0.04] px-3 py-2 text-[11px] md:mx-6">
      <p className="flex items-center gap-2 text-amber-100/80"><FlaskConical size={14} className="shrink-0" />
        {samples ? 'Sample data — not real tickets. Read-only; no messages, uploads, assignments or agent execution.' : 'Local development · inspect the interface with optional fictional tickets.'}</p>
      <button type="button" aria-pressed={samples} onClick={() => { setSamples(value => !value); setSection('tickets'); }} className="shrink-0 rounded-md border border-white/10 px-2.5 py-1 text-gray-200 hover:bg-white/[0.06]">
        {samples ? 'Hide sample data' : 'Show sample data'}
      </button>
    </div>}
    {!samples && <nav aria-label="Ticket work queues" className="mx-4 mt-3 flex gap-2 border-b border-white/[0.08] px-2 md:mx-6">
      <button type="button" aria-pressed={section === 'tickets'} onClick={() => setSection('tickets')}
        className={`border-b-2 px-3 py-2 text-xs ${section === 'tickets' ? 'border-brand-400 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>Tickets</button>
      <button type="button" aria-pressed={section === 'inquiries'} onClick={() => setSection('inquiries')}
        className={`border-b-2 px-3 py-2 text-xs ${section === 'inquiries' ? 'border-brand-400 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>New inquiries</button>
    </nav>}
    <div className="min-h-0 flex-1">
      {samples && SampleTickets ? <Suspense fallback={<p role="status" className="p-6 text-xs text-gray-400">Loading sample tickets…</p>}><SampleTickets /></Suspense>
        : section === 'inquiries' ? <PmCentralIntakeInbox workspaceId={activeWorkspace?.id ?? null} workspaceName={activeWorkspace?.name ?? null}
          workspaceCanReview={activeWorkspace?.role === 'pm'}
          onAccepted={reference => { showToast('Inquiry accepted', `${reference} was created in ${activeWorkspace?.name ?? 'your workspace'}. It is now in Tickets; client invitation and access remain separate.`, 'success'); setSection('tickets'); }} />
          : <PmTicketsView intakeEnabled={intakeEnabled} workflowActions={workflowActions} communicationEnabled />}
    </div>
  </div>;
}
