import alphaMarkUrl from '@/assets/alpha-mark.png';
import { PublicInquiryForm } from './PublicInquiryForm';

/** Real inquiry UI, with submission fail-closed until secure intake is enabled. */
export default function PublicInquiryUnavailable() {
  return <main className="min-h-dvh bg-canvas font-sans text-gray-300">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-shell px-5 py-4 md:px-8">
      <a href="/#/client" className="flex items-center gap-3"><img src={alphaMarkUrl} alt="Alpha" className="h-8 w-8 object-contain" /><span className="text-sm font-semibold text-white">Alpha <span className="ml-2 font-normal text-gray-500">Project inquiry</span></span></a>
      <a href="/#/client" className="text-xs text-gray-400 hover:text-white">Already invited? Client access</a>
    </header>
    <p role="status" className="mx-auto mt-6 max-w-2xl px-5 text-xs leading-relaxed text-amber-100/80">The inquiry interface is ready for inspection. Secure submission and email delivery are not enabled yet; no request or account will be created.</p>
    <PublicInquiryForm submissionEnabled={false} onSubmit={() => undefined} onCancel={() => { window.location.href = '/#/client'; }} />
  </main>;
}
