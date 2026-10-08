import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClientAccessPanel } from './ClientAccessPanel';
import { ClientCreateTicketForm } from './ClientCreateTicketForm';
import PublicInquiryUnavailable from './PublicInquiryUnavailable';

describe('phase-one real app interfaces', () => {
  it('renders the inquiry form at the real public entry without enabling submission', () => {
    const html = renderToStaticMarkup(<PublicInquiryUnavailable />);
    expect(html).toContain('Tell us what you need');
    expect(html).toContain('Your name');
    expect(html).toContain('Requested target date');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
    expect(html).toContain('nothing is sent or saved');
    expect(html).not.toContain('Create developer');
  });

  it('shows the planned email-access interface without pretending to authenticate', () => {
    const html = renderToStaticMarkup(<ClientAccessPanel unavailable error="" onRetry={() => undefined} />);
    expect(html).toContain('Access your tickets');
    expect(html).toContain('Continue with email');
    expect(html).toMatch(/<input[^>]*type="email"[^>]*disabled=""/);
    expect(html).toContain('no code is sent');
    expect(html).toContain('href="/#/request"');
  });

  it('lets clients inspect the same request form with submission disabled', () => {
    const html = renderToStaticMarkup(<ClientCreateTicketForm
      context={{ intakeContextId: 'sample', canCreate: true, sharedProjects: [] }}
      relatedTicket={null} busy={false} error="" submissionEnabled={false}
      onCreate={() => undefined} onCancel={() => undefined}
    />);
    expect(html).toContain('New request');
    expect(html).toContain('UI inspection only');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  });
});
