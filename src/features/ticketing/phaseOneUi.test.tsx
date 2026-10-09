import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClientAccessPanel } from './ClientAccessPanel';
import { ClientCreateTicketForm } from './ClientCreateTicketForm';
import { PublicInquiryForm } from './PublicInquiryForm';
import PublicInquiryUnavailable from './PublicInquiryUnavailable';
import { PmTicketsView } from './PmTicketsView';

describe('phase-one real app interfaces', () => {
  it('lets an enabled inquiry form submit without an external verification widget', () => {
    const html = renderToStaticMarkup(<PublicInquiryForm submissionEnabled onSubmit={() => undefined} onCancel={() => undefined} />);
    expect(html).not.toContain('verification');
    expect(html).not.toContain('UI-only');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>.*Submit inquiry/);
  });
  it('shows a neutral planned-unavailable Tickets interface with controls disabled', () => {
    const html = renderToStaticMarkup(<PmTicketsView intakeEnabled={false} />);
    expect(html).toContain('Ticketing is coming soon.');
    expect(html).toContain('Live tickets are not connected yet');
    expect(html).toContain('role="status"');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('No tickets in this view');
    expect(html).not.toContain('Ticket counters');
    expect(html).not.toContain('Client-provided documents');
    expect(html).toMatch(/<input[^>]*disabled=""[^>]*placeholder="Search tickets…"/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Refresh<\/button>/);
  });
  it('renders the inquiry form at the real public entry without enabling submission', () => {
    const html = renderToStaticMarkup(<PublicInquiryUnavailable />);
    expect(html).toContain('Tell us what you need');
    expect(html).toContain('Your name');
    expect(html).toContain('Requested target date');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
    expect(html).toContain('nothing is sent or saved');
    expect(html).not.toContain('Create developer');
  });

  it('keeps direct inquiry form use fail-closed unless a submit handler is explicitly enabled', () => {
    const html = renderToStaticMarkup(<PublicInquiryForm onSubmit={() => undefined} onCancel={() => undefined} />);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
    expect(html).toContain('nothing is sent or saved');
  });

  it('requires an email address on the actual public inquiry form', () => {
    const html = renderToStaticMarkup(<PublicInquiryUnavailable />);
    const emailInput = html.match(/<input\b[^>]*type="email"[^>]*>/)?.[0];
    expect(emailInput).toBeDefined();
    expect(emailInput).toMatch(/\brequired=""/);
    expect(emailInput).toContain('autoComplete="email"');
    expect(emailInput).toContain('maxLength="254"');
    expect(html).toMatch(/Email <span[^>]*>\(required\)<\/span>/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
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
