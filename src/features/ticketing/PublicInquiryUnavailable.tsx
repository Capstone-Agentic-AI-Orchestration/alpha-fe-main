import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { PublicInquiryForm, type InquiryNavigationState } from './PublicInquiryForm';
import { clientLandingHref, clientPortalHref, publicInquiryContext, publicTicketIntakeApi } from './publicIntakeApi';
import { ClientPublicShell } from './publicClient/ClientPublicShell';

function readPublicInquiryContext() {
  if (typeof window === 'undefined') return { kind: 'central' } as const;
  return publicInquiryContext(window.location);
}

/** Public first-contact intake; workspace links stay scoped and unqualified links use the shared PM inbox. */
export default function PublicInquiryUnavailable() {
  const [retryVersion, setRetryVersion] = useState(0);
  const [context, setContext] = useState(readPublicInquiryContext);
  const [navigation, setNavigation] = useState<InquiryNavigationState>({ dirty: false, locked: false });
  const slug = context.kind === 'workspace' ? context.slug : '';
  const configurationKey = context.kind === 'workspace' ? 'workspace:' + context.slug : context.kind;
  const [configurationResult, setConfigurationResult] = useState<{
    key: string;
    state: 'checking' | 'enabled' | 'unavailable';
  }>(() => ({ key: configurationKey, state: 'checking' }));
  const configuration = configurationResult.key === configurationKey ? configurationResult.state : 'checking';

  useEffect(() => {
    const updateContext = () => setContext(readPublicInquiryContext());
    window.addEventListener('hashchange', updateContext);
    window.addEventListener('popstate', updateContext);
    return () => {
      window.removeEventListener('hashchange', updateContext);
      window.removeEventListener('popstate', updateContext);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setConfigurationResult({ key: configurationKey, state: 'checking' });
    if (context.kind === 'invalid') {
      setConfigurationResult({ key: configurationKey, state: 'unavailable' });
      return () => { active = false; };
    }
    const check = context.kind === 'workspace'
      ? publicTicketIntakeApi.configuration(slug)
      : publicTicketIntakeApi.centralConfiguration();
    void check.then(value => {
      if (active) setConfigurationResult({ key: configurationKey, state: value.enabled ? 'enabled' : 'unavailable' });
    }).catch(() => {
      if (active) setConfigurationResult({ key: configurationKey, state: 'unavailable' });
    });
    return () => { active = false; };
  }, [configurationKey, context.kind, slug, retryVersion]);

  useEffect(() => {
    setNavigation({ dirty: false, locked: false });
  }, [configurationKey]);

  const clientHref = clientPortalHref(slug);
  const message = configuration === 'enabled'
    ? context.kind === 'workspace'
      ? 'Your request will go to the project manager for the team that shared this link.'
      : 'Your request will go to a project manager for review.'
    : configuration === 'checking'
      ? 'Checking whether you can send this inquiry…'
      : context.kind === 'invalid'
        ? 'This inquiry link is incomplete or invalid. Nothing has been sent. Ask your project manager for a new link.'
        : 'This inquiry link is unavailable or could not be checked. Nothing has been submitted. Try again or contact your project manager.';

  return <ClientPublicShell page="inquiry" slug={slug} navigationLocked={navigation.locked} hasDraft={navigation.dirty}>
    <div className="public-container public-inquiry-layout">
      <section className="public-inquiry-body" aria-label="Project inquiry">
        <p role="status" aria-live="polite" className={configuration === 'unavailable' ? 'public-notice public-notice-warning' : 'public-notice'}>
          <ShieldCheck size={17} aria-hidden="true" />
          <span>{message}</span>
        </p>
        {context.kind === 'central' && <p className="public-notice mt-3">
          <ShieldCheck size={17} aria-hidden="true" />
          <span>No account or team selection is needed to send this inquiry. A project manager will review it and let you know what happens next.</span>
        </p>}
        {configuration === 'unavailable' && <button type="button" className="public-button public-button-secondary public-recheck mt-3" onClick={() => setRetryVersion(value => value + 1)}>
          Check inquiry availability again
        </button>}
        <PublicInquiryForm
          key={configurationKey}
          submissionEnabled={configuration === 'enabled'}
          unavailableMessage={configuration === 'checking'
            ? 'Checking inquiry availability. Nothing has been submitted.'
            : 'Inquiry submission is currently unavailable for this link. Nothing has been submitted.'}
          onNavigationStateChange={setNavigation}
          onSubmit={async inquiry => {
            const request = { inquiry };
            if (context.kind === 'invalid') throw new Error('This inquiry link has conflicting or invalid workspace details.');
            if (context.kind === 'workspace') await publicTicketIntakeApi.submit(context.slug, request);
            else return publicTicketIntakeApi.submitCentral(request);
          }}
          onCancel={() => { window.location.href = clientLandingHref(slug); }}
        />
      </section>
      <aside className="public-inquiry-guide" aria-label="What happens next">
        <div className="public-guide-sticky">
          <div className="public-guide-heading">
            <ShieldCheck size={22} aria-hidden="true" />
            <h2>{context.kind === 'workspace' ? 'Your request reaches the right team.' : 'A real person reviews your request.'}</h2>
          </div>
          <p>{context.kind === 'workspace'
            ? 'This link was shared by a specific team. That team’s project manager will review your inquiry.'
            : 'Send your inquiry once. You do not need to choose a workspace or create an account first.'}</p>
          <ul className="public-guide-prompts">
            <li><span>01</span><span>You send your inquiry using this form.</span></li>
            <li><span>02</span><span>A project manager reviews your request.</span></li>
            <li><span>03</span><span>If they accept it and invite you, follow the email to access your account and updates.</span></li>
          </ul>
          <div className="public-guide-next">
            <h3>Already have client access?</h3>
            <p><a href={clientHref}>Sign in to your client portal</a>. This inquiry will be reviewed separately from requests already shared with you.</p>
          </div>
        </div>
      </aside>
    </div>
  </ClientPublicShell>;
}
