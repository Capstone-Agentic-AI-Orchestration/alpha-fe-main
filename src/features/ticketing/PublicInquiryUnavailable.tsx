import alphaMarkUrl from '@/assets/alpha-mark.png';
import { PublicInquiryForm } from './PublicInquiryForm';
import { useEffect, useState } from 'react';
import { publicTicketIntakeApi } from './publicIntakeApi';

/** Fails closed until the durable inquiry API is enabled by the server. */
export default function PublicInquiryUnavailable() {
  const [configuration, setConfiguration] = useState<{ enabled: boolean }>({ enabled: false });
  const [slug] = useState(() => {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    return new URLSearchParams(url.hash.split('?')[1] ?? url.search).get('intake') ?? '';
  });
  useEffect(() => {
    let active = true;
    void publicTicketIntakeApi.configuration(slug).then(value => { if (active) setConfiguration(value); })
      .catch(() => { if (active) setConfiguration({ enabled: false }); });
    return () => { active = false; };
  }, [slug]);
  return <main className="min-h-dvh bg-canvas font-sans text-gray-300">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-shell px-5 py-4 md:px-8">
      <a href="/#/client" className="flex items-center gap-3"><img src={alphaMarkUrl} alt="Alpha" className="h-8 w-8 object-contain" /><span className="text-sm font-semibold text-white">Alpha <span className="ml-2 font-normal text-gray-500">Project inquiry</span></span></a>
      <a href="/#/client" className="text-xs text-gray-400 hover:text-white">Already invited? Client access</a>
    </header>
    <p role="status" className="mx-auto mt-6 max-w-2xl px-5 text-xs leading-relaxed text-amber-100/80">{configuration.enabled
      ? 'Submit your inquiry for PM review. Acknowledgment emails and client account activation are not available yet.'
      : 'Submission is not enabled for this inquiry link yet. Nothing is sent or saved.'}</p>
    <PublicInquiryForm submissionEnabled={configuration.enabled} onSubmit={async inquiry => { await publicTicketIntakeApi.submit(slug, { inquiry }); }}
      onCancel={() => { window.location.href = '/#/client'; }} />
  </main>;
}
