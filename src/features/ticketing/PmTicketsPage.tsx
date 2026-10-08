import { lazy, Suspense, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { PmTicketsView } from './PmTicketsView';

// UI availability is separate from the server's rollout gate. Neither switch
// grants permissions or enables writes; both must be ready for connected use.
const intakeEnabled = import.meta.env.VITE_TICKETING_ENABLED === '1';

// Development samples are a separate lazy module, never a production fallback.
const SampleTickets = import.meta.env.DEV
  ? lazy(() => import('./ticketingPreviewFixtures').then(({ pmPreviewApi }) => ({
    default: () => <PmTicketsView api={pmPreviewApi} />,
  }))) : null;

/** The real PM page: keep Alpha's surrounding sidebar, tabs and auth intact. */
export function PmTicketsPage() {
  const [samples, setSamples] = useState(false);
  return <div className="flex h-full min-h-0 flex-col">
    {SampleTickets && <div className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/15 bg-amber-500/[0.04] px-3 py-2 text-[11px] md:mx-6">
      <p className="flex items-center gap-2 text-amber-100/80"><FlaskConical size={14} className="shrink-0" />
        {samples ? 'Sample data — not real tickets. Read-only; no messages, uploads, assignments or agent execution.' : 'Local development · inspect the interface with optional fictional tickets.'}</p>
      <button type="button" aria-pressed={samples} onClick={() => setSamples(value => !value)} className="shrink-0 rounded-md border border-white/10 px-2.5 py-1 text-gray-200 hover:bg-white/[0.06]">
        {samples ? 'Hide sample data' : 'Show sample data'}
      </button>
    </div>}
    <div className="min-h-0 flex-1">
      {samples && SampleTickets ? <Suspense fallback={<p role="status" className="p-6 text-xs text-gray-400">Loading sample tickets…</p>}><SampleTickets /></Suspense> : <PmTicketsView intakeEnabled={intakeEnabled} />}
    </div>
  </div>;
}
