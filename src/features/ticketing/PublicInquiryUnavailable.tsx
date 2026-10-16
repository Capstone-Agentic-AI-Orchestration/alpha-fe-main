import { PublicInquiryForm, type InquiryNavigationState } from './PublicInquiryForm';
import { useEffect, useState } from 'react';
import { clientPortalHref, publicInquiryHref, publicInquirySlug, publicTicketIntakeApi } from './publicIntakeApi';
import { ArrowRight, FileText, MessageSquare, ShieldCheck, RefreshCw } from 'lucide-react';
import { ClientPublicShell } from './publicClient/ClientPublicShell';

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
  return <ClientPublicShell page="inquiry" slug={slug} navigationLocked={navigation.locked} hasDraft={navigation.dirty}>
    {!slug ? <section className="public-destination public-container">
      <span className="public-icon-tile"><FileText size={25} /></span>
      <h1>Choose your inquiry destination</h1>
      <p>Open the workspace-specific inquiry link your project manager shared, or enter its inquiry code below. Alpha will not guess which workspace should receive your request.</p>
      <form onSubmit={event => {
        event.preventDefault();
        const code = inquiryCode.trim();
        const href = publicInquiryHref(code);
        if (href === '/#/request') { setLinkError('Enter the inquiry code from your project manager’s link.'); return; }
        window.location.assign(href);
      }}>
        <label className="public-field"><span>Workspace inquiry code</span><input required maxLength={100} value={inquiryCode} onChange={event => { setInquiryCode(event.target.value); setLinkError(''); }} className="public-input" autoComplete="off" placeholder="The code from your PM’s link" /></label>
        {linkError && <p role="alert" className="public-error">{linkError}</p>}
        <button type="submit" className="public-button public-button-primary">Open inquiry form <ArrowRight size={17} /></button>
      </form>
    </section> : <div className="public-inquiry-layout public-container">
      <PublicInquiryForm key={slug} onNavigationStateChange={setNavigation} submissionEnabled={configuration === 'enabled'} unavailableMessage={configuration === 'checking' ? 'Checking inquiry availability. Nothing has been submitted.' : 'Inquiry submission is currently unavailable for this link. Nothing has been submitted.'} onSubmit={async inquiry => { await publicTicketIntakeApi.submit(slug, { inquiry }); }}
        onCancel={() => { window.location.href = clientHref; }} />
      <aside className="public-inquiry-guide" aria-label="Inquiry guidance">
        <div className="public-guide-sticky">
          <div className="public-guide-heading"><MessageSquare size={23} /><h2>A little context.<br />A better conversation.</h2></div>
          <p>You don’t need a finished brief. Start with what you know.</p>
          <ul className="public-guide-prompts"><li><span>01</span>What should change for your users?</li><li><span>02</span>What would a good result look like?</li><li><span>03</span>Are there any timing or technical constraints?</li></ul>
          <div className="public-guide-next"><h3>What happens next</h3><p>A project manager reviews your inquiry and follows up. Work and client access are arranged separately after review.</p></div>
          <div role="status" className={`public-notice ${configuration === 'unavailable' ? 'public-notice-warning' : ''}`}><ShieldCheck size={17} /><p>{configuration === 'enabled'
            ? 'This link accepts inquiries for PM review. Submission does not approve work or grant client access.'
            : configuration === 'checking' ? 'Checking whether this inquiry link can accept submissions…'
              : 'This inquiry link is unavailable or could not be checked. Nothing has been submitted. Try again or contact your project manager.'}</p></div>
          {configuration === 'unavailable' && <button type="button" className="public-recheck" onClick={() => setRetryVersion(value => value + 1)}><RefreshCw size={14} />Check inquiry availability again</button>}
        </div>
      </aside>
    </div>}
  </ClientPublicShell>;
}
