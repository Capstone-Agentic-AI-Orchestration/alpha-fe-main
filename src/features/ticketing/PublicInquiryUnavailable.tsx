import alphaMarkUrl from '@/assets/alpha-mark.png';
import { PublicInquiryForm } from './PublicInquiryForm';
import { useEffect, useState } from 'react';
import { clientLandingHref, clientPortalHref, publicInquiryContext, publicTicketIntakeApi } from './publicIntakeApi';
import { secondary } from './ticketUi';

/** Fails closed until the durable inquiry API is enabled by the server. */
export default function PublicInquiryUnavailable() {
  const [retryVersion, setRetryVersion] = useState(0);
  const readContext = () => {
    if (typeof window === 'undefined') return { kind: 'central' } as const;
    return publicInquiryContext(window.location);
  };
  const [context, setContext] = useState(readContext);
  const slug = context.kind === 'workspace' ? context.slug : '';
  const configurationKey = context.kind === 'workspace' ? `workspace:${context.slug}` : context.kind;
  const [configurationResult, setConfigurationResult] = useState<{
    key: string;
    state: 'checking' | 'enabled' | 'unavailable';
  }>(() => ({ key: configurationKey, state: 'checking' }));
  const configuration = configurationResult.key === configurationKey ? configurationResult.state : 'checking';

  useEffect(() => {
    const updateSlug = () => setContext(readContext());
    window.addEventListener('hashchange', updateSlug);
    window.addEventListener('popstate', updateSlug);
    return () => {
      window.removeEventListener('hashchange', updateSlug);
      window.removeEventListener('popstate', updateSlug);
    };
  }, []);
  useEffect(() => {
    let active = true;
    setConfigurationResult({ key: configurationKey, state: 'checking' });
    if (context.kind === 'invalid') {
      setConfigurationResult({ key: configurationKey, state: 'unavailable' });
      return () => { active = false; };
    }
    const check = context.kind === 'workspace' ? publicTicketIntakeApi.configuration(context.slug) : publicTicketIntakeApi.centralConfiguration();
    void check.then(value => {
      if (active) setConfigurationResult({ key: configurationKey, state: value.enabled ? 'enabled' : 'unavailable' });
    }).catch(() => { if (active) setConfigurationResult({ key: configurationKey, state: 'unavailable' }); });
    return () => { active = false; };
  }, [context, configurationKey, retryVersion]);
  const clientHref = clientPortalHref(slug);
  return <main className="min-h-dvh bg-canvas font-sans text-gray-300">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-shell px-5 py-4 md:px-8">
      <a href={clientLandingHref(slug)} className="flex items-center gap-3"><img src={alphaMarkUrl} alt="Alpha" className="h-8 w-8 object-contain" /><span className="text-sm font-semibold text-white">Alpha <span className="ml-2 font-normal text-gray-500">Project inquiry</span></span></a>
      <a href={clientHref} className="text-xs text-gray-400 hover:text-white">Already have client access? Sign in</a>
    </header>
    <>
      <p role="status" className="mx-auto mt-6 max-w-2xl px-5 text-xs leading-relaxed text-amber-100/80">{configuration === 'enabled'
        ? slug ? 'Submit your inquiry for review by the workspace that shared this link. Submission does not approve work or grant client access.'
          : 'Your inquiry goes to Alpha’s shared PM inbox. A PM will accept it into their workspace before it becomes a ticket.'
        : configuration === 'checking' ? 'Checking whether this inquiry link can accept submissions…'
          : context.kind === 'invalid' ? 'This inquiry link has conflicting or invalid workspace details. Nothing has been submitted. Open the link your project manager shared.'
            : 'This inquiry link is unavailable or could not be checked. Nothing has been submitted. Try again or contact your project manager.'}</p>
      {context.kind === 'central' && <p className="mx-auto mt-2 max-w-2xl px-5 text-xs leading-relaxed text-gray-400">No workspace choice is needed. A PM will review your inquiry in the shared inbox and accept it into their workspace before it becomes a ticket.</p>}
      {configuration === 'unavailable' && <div className="mx-auto mt-3 max-w-2xl px-5"><button type="button" className={secondary} onClick={() => setRetryVersion(value => value + 1)}>Check inquiry availability again</button></div>}
      <PublicInquiryForm key={configurationKey} submissionEnabled={configuration === 'enabled'} unavailableMessage={configuration === 'checking' ? 'Checking inquiry availability. Nothing has been submitted.' : 'Inquiry submission is currently unavailable for this link. Nothing has been submitted.'} onSubmit={async inquiry => {
        const request = { inquiry };
        if (context.kind === 'invalid') throw new Error('This inquiry link has conflicting or invalid workspace details.');
        if (context.kind === 'workspace') await publicTicketIntakeApi.submit(context.slug, request);
        else await publicTicketIntakeApi.submitCentral(request);
      }}
        onCancel={() => { window.location.href = clientLandingHref(slug); }} />
    </>
  </main>;
}
