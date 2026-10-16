import { PublicInquiryForm, type InquiryNavigationState } from './PublicInquiryForm';
import { useEffect, useState } from 'react';
import { clientLandingHref, clientPortalHref, publicInquiryHref, publicInquirySlug, publicTicketIntakeApi } from './publicIntakeApi';
import { input, primary, secondary } from './ticketUi';

/** Fails closed until the durable inquiry API is enabled by the server. */
export default function PublicInquiryUnavailable() {
  const [retryVersion, setRetryVersion] = useState(0);
  const [inquiryCode, setInquiryCode] = useState('');
  const [linkError, setLinkError] = useState('');
  const [navigation, setNavigation] = useState<InquiryNavigationState>({ dirty: false, locked: false });
  const readSlug = () => {
    if (typeof window === 'undefined') return '';
    return publicInquirySlug(window.location);
  };
  const [slug, setSlug] = useState(readSlug);
  const [configurationResult, setConfigurationResult] = useState<{
    slug: string;
    state: 'checking' | 'enabled' | 'unavailable';
  }>(() => ({ slug: readSlug(), state: 'checking' }));
  const configuration = configurationResult.slug === slug ? configurationResult.state : 'checking';

  useEffect(() => {
    if (!slug) setNavigation({ dirty: false, locked: false });
  }, [slug]);

  useEffect(() => {
    const updateSlug = () => setSlug(readSlug());
    window.addEventListener('hashchange', updateSlug);
    window.addEventListener('popstate', updateSlug);
    return () => {
      window.removeEventListener('hashchange', updateSlug);
      window.removeEventListener('popstate', updateSlug);
    };
  }, []);
  useEffect(() => {
    if (!slug) return;
    let active = true;
    setConfigurationResult({ slug, state: 'checking' });
    void publicTicketIntakeApi.configuration(slug).then(value => {
      if (active) setConfigurationResult({ slug, state: value.enabled ? 'enabled' : 'unavailable' });
    }).catch(() => { if (active) setConfigurationResult({ slug, state: 'unavailable' }); });
    return () => { active = false; };
  }, [slug, retryVersion]);
  const clientHref = clientPortalHref(slug);
  return <main className="min-h-dvh bg-canvas font-sans text-gray-300">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-shell px-5 py-4 md:px-8">
      <a href={clientLandingHref(slug)} className="flex items-center gap-3"><img src={alphaMarkUrl} alt="Alpha" className="h-8 w-8 object-contain" /><span className="text-sm font-semibold text-white">Alpha <span className="ml-2 font-normal text-gray-500">Project inquiry</span></span></a>
      <a href={clientHref} className="text-xs text-gray-400 hover:text-white">Already have client access? Sign in</a>
    </header>
    {!slug ? <section className="mx-auto max-w-2xl space-y-4 p-5 md:p-10">
      <h1 className="text-2xl font-semibold text-white">Send an inquiry to a workspace</h1>
      <p className="text-sm leading-relaxed text-gray-400">Use the workspace link or inquiry code your project manager shared so your request reaches the right team. Alpha will not choose a workspace for you.</p>
      <form className="space-y-3" onSubmit={event => {
        event.preventDefault();
        const code = inquiryCode.trim();
        const href = publicInquiryHref(code);
        if (href === '/#/request') { setLinkError('Enter the inquiry code from your project manager’s link.'); return; }
        window.location.assign(href);
      }}>
        <label className="block space-y-2"><span className="text-xs text-gray-300">Inquiry code from your project manager</span><input required maxLength={100} value={inquiryCode} onChange={event => { setInquiryCode(event.target.value); setLinkError(''); }} className={input} autoComplete="off" /></label>
        {linkError && <p role="alert" className="text-xs text-rose-200">{linkError}</p>}
        <button type="submit" className={primary}>Continue to inquiry form</button>
      </form>
      <p className="rounded-lg border border-white/[0.08] bg-surface p-3 text-xs leading-relaxed text-gray-400">Already have client access? Sign in first, then choose <span className="text-gray-200">New request</span> in your portal to send another request—no inquiry code needed.</p>
    </section> : <>
      <p role="status" className="mx-auto mt-6 max-w-2xl px-5 text-xs leading-relaxed text-amber-100/80">{configuration === 'enabled'
        ? 'Submit your inquiry for PM review. Submission does not approve work or grant client access.'
        : configuration === 'checking' ? 'Checking whether this inquiry link can accept submissions…'
          : 'This inquiry link is unavailable or could not be checked. Nothing has been submitted. Try again or contact your project manager.'}</p>
      {configuration === 'unavailable' && <div className="mx-auto mt-3 max-w-2xl px-5"><button type="button" className={secondary} onClick={() => setRetryVersion(value => value + 1)}>Check inquiry availability again</button></div>}
      <PublicInquiryForm key={slug} submissionEnabled={configuration === 'enabled'} unavailableMessage={configuration === 'checking' ? 'Checking inquiry availability. Nothing has been submitted.' : 'Inquiry submission is currently unavailable for this link. Nothing has been submitted.'} onSubmit={async inquiry => { await publicTicketIntakeApi.submit(slug, { inquiry }); }}
        onCancel={() => { window.location.href = clientLandingHref(slug); }} />
    </>}
  </main>;
}
