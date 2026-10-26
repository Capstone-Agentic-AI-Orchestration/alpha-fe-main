import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { PublicInquiryForm, type InquiryNavigationState } from './PublicInquiryForm';
import { clientLandingHref, clientPortalHref, publicInquiryContext, publicTicketIntakeApi } from './publicIntakeApi';
import { ClientPublicShell } from './publicClient/ClientPublicShell';
import './clientAuth.css';

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

  const unavailable = configuration === 'unavailable';
  return <ClientPublicShell page="inquiry" slug={slug} navigationLocked={navigation.locked} hasDraft={navigation.dirty}>
    <section className="public-container iq-section" aria-label="Project inquiry">
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
        status={<div className="iq-status">
          <p role="status" aria-live="polite" className={unavailable ? 'iq-status-line is-warning' : 'iq-status-line'}>{message}</p>
          {context.kind === 'central' && <p className="iq-status-line">No account or team selection is needed to send this inquiry. A project manager will review it and let you know what happens next.</p>}
          {unavailable && <button type="button" className="ca-link" onClick={() => setRetryVersion(value => value + 1)}><RefreshCw size={13} aria-hidden="true" />Check inquiry availability again</button>}
        </div>}
        guide={<aside className="iq-guide" aria-label="What happens next">
          <h2>{context.kind === 'workspace' ? 'Your request reaches the right team.' : 'A real person reviews your request.'}</h2>
          <ol>
            <li><span>01</span>You send your inquiry using this form.</li>
            <li><span>02</span>A project manager reviews your request.</li>
            <li><span>03</span>If they accept it and invite you, follow the email to access your account and updates.</li>
          </ol>
          <p>Already have client access? <a href={clientHref}>Sign in to your client portal</a>. This inquiry will be reviewed separately from requests already shared with you.</p>
        </aside>}
      />
    </section>
  </ClientPublicShell>;
}

