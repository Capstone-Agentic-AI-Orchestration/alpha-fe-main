import { lazy, Suspense, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { PmTicketsView } from './PmTicketsView';

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
        {samples ? 'Sample tickets · fictional, read-only records. No email, uploads or agent execution.' : 'Local development · inspect the interface with optional fictional tickets.'}</p>
      <button type="button" aria-pressed={samples} onClick={() => setSamples(value => !value)} className="shrink-0 rounded-md border border-white/10 px-2.5 py-1 text-gray-200 hover:bg-white/[0.06]">
        {samples ? 'Use connected service' : 'Show sample tickets'}
      </button>
    </div>}
    <div className="min-h-0 flex-1">
      {samples && SampleTickets ? <Suspense fallback={<p role="status" className="p-6 text-xs text-gray-400">Loading sample tickets…</p>}><SampleTickets /></Suspense> : <PmTicketsView />}
    </div>
  </div>;
}
