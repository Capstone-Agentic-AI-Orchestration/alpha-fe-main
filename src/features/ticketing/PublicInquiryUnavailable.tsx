import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { PublicInquiryForm, type InquiryNavigationState } from './PublicInquiryForm';
import { clientLandingHref, publicInquiryContext, publicTicketIntakeApi } from './publicIntakeApi';
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

  const message = configuration === 'enabled'
    ? ''
    : configuration === 'checking'
      ? 'Checking this link…'
      : context.kind === 'invalid'
        ? 'This link is invalid. Ask the project manager for a new one.'
        : 'This link isn’t available right now. Nothing was sent.';

  const unavailable = configuration === 'unavailable';
  return <ClientPublicShell page="inquiry" slug={slug} navigationLocked={navigation.locked} hasDraft={navigation.dirty}>
    <section className="public-container iq-section" aria-label="Project inquiry">
      <PublicInquiryForm
        key={configurationKey}
        submissionEnabled={configuration === 'enabled'}
        // The status line beside the heading already says why the form is off.
        unavailableMessage=""
        onNavigationStateChange={setNavigation}
        onSubmit={async inquiry => {
          const request = { inquiry };
          if (context.kind === 'invalid') throw new Error('This inquiry link has conflicting or invalid workspace details.');
          if (context.kind === 'workspace') await publicTicketIntakeApi.submit(context.slug, request);
          else return publicTicketIntakeApi.submitCentral(request);
        }}
        onCancel={() => { window.location.href = clientLandingHref(slug); }}
        status={<div className="iq-status">
          <p role="status" aria-live="polite" className={unavailable ? 'iq-status-line is-warning' : 'iq-status-line'} hidden={!message}>{message}</p>
          {unavailable && <button type="button" className="ca-link" onClick={() => setRetryVersion(value => value + 1)}><RefreshCw size={13} aria-hidden="true" />Check again</button>}
        </div>}
      />
    </section>
  </ClientPublicShell>;
}

