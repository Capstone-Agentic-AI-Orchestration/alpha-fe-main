import { lazy, Suspense } from 'react';
import type { AppEntry as Entry } from '@/features/ticketing/entry';
import PublicInquiryUnavailable from '@/features/ticketing/PublicInquiryUnavailable';
import ClientActivationUnavailable from '@/features/ticketing/ClientActivationUnavailable';
import alphaMarkUrl from '@/assets/alpha-mark.png';

const InternalApp = lazy(() => import('./InternalApp'));
const ClientPortal = lazy(() => import('@/features/ticketing/ClientPortal'));
const TicketingPreview = import.meta.env.DEV ? lazy(() => import('@/features/ticketing/TicketingPreview')) : null;

export default function AppEntry({ entry }: { entry: Entry }) {
  if (entry === 'public-inquiry-unavailable') return <PublicInquiryUnavailable />;
  if (entry === 'client-activation') return <ClientActivationUnavailable />;
  if ((entry === 'preview-client' || entry === 'preview-pm') && !TicketingPreview) return (
    <main className="min-h-dvh flex items-center justify-center bg-canvas p-6">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-7 space-y-4">
        <img src={alphaMarkUrl} alt="Alpha" className="h-10 w-10 object-contain" />
        <h1 className="text-xl font-semibold text-white">Client access is not available yet</h1>
        <p className="text-sm text-gray-400">Ticketing is being prepared. Your project manager will send an invitation when secure client access is ready.</p>
        <p className="text-xs text-gray-500">No GitHub account or desktop download will be needed. No client sign-in or submission is enabled on this page.</p>
      </section>
    </main>
  );
  return <Suspense fallback={<div className="min-h-dvh flex items-center justify-center text-gray-400" role="status">Loading Alpha…</div>}>
    {entry === 'internal' ? <InternalApp /> : entry === 'client-portal' ? <ClientPortal phaseFourReadOnly /> : TicketingPreview && <TicketingPreview initialRole={entry === 'preview-pm' ? 'pm' : 'client'} />}
  </Suspense>;
}
