import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClientAccessPanel } from './ClientAccessPanel';
import { ClientCreateTicketForm } from './ClientCreateTicketForm';
import { PublicInquiryForm } from './PublicInquiryForm';
import PublicInquiryUnavailable from './PublicInquiryUnavailable';
import { invitationButtonLabel, invitationStatusMessage, PmContactVerification, PmTicketsView, safeError } from './PmTicketsView';
import { ApiRequestError } from '@/shared/services/apiService';
import { activationFailureMessage, activationLink, scrubbedActivationUrl } from './ClientActivationUnavailable';
import { ClientTicketApiError } from './clientApi';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('real ticketing interfaces in the Alpha app', () => {
  it.each([
    ['verified', 'Email verified'],
    ['unverified_submission', 'Pending email verification'],
    [undefined, 'Unable to verify status'],
    [null, 'Unable to verify status'],
    ['unexpected-status', 'Unable to verify status'],
    [true, 'Unable to verify status'],
  ])('renders only the backend verification fact %s', (verification, label) => {
    const html = renderToStaticMarkup(<PmContactVerification verification={verification} />);
    expect(html).toContain(label);
    if (verification !== 'verified') expect(html).not.toContain('Email verified');
    if (verification !== 'unverified_submission') expect(html).not.toContain('Pending email verification');
  });

  it('explains an unavailable client invitation without displaying server secrets', () => {
    const message = safeError(new ApiRequestError(503, 'private server details', 'client_invitation_unavailable'), 'write');
    expect(message).toContain('Client invitations are not configured on the hosted backend');
    expect(message).not.toContain('private server details');
    expect(safeError(new ApiRequestError(503, 'private server details', 'unknown'), 'write'))
      .toBe('Ticket service is temporarily unavailable.');
  });

  it('distinguishes the invitation sender restriction from a stale ticket version', () => {
    const message = safeError(new ApiRequestError(409, 'private recipient', 'ticket_invitation_recipient_restricted'), 'write');
    expect(message).toContain('configured test recipient');
    expect(message).not.toContain('private recipient');
    expect(safeError(new ApiRequestError(409, 'version changed', 'ticket_version_conflict'), 'write'))
      .toContain('The ticket changed');
  });
  it('explains provider acceptance without claiming inbox delivery and offers recovery for a failed invitation', () => {
    const accepted = { status: 'pending' as const, delivery: 'accepted_by_provider' as const, expiresAt: '2026-10-14T00:00:00.000Z' };
    const failed = { status: 'pending' as const, delivery: 'failed' as const, expiresAt: '2026-10-14T00:00:00.000Z' };
    expect(invitationStatusMessage(accepted)).toContain('does not confirm inbox delivery');
    expect(invitationButtonLabel(failed)).toBe('Retry invitation email');
    expect(invitationStatusMessage(failed)).toContain('issue a fresh link');
  });
  it('offers the PM a database-backed inquiry code action, without a sample code in the UI', () => {
    const html = renderToStaticMarkup(<PmTicketsView intakeEnabled />);
    expect(html).toContain('Share inquiry code');
    expect(html).not.toContain('workspace-intake');
  });
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
  it('requires explicit workspace context instead of showing a permanently disabled generic form', () => {
    const html = renderToStaticMarkup(<PublicInquiryUnavailable />);
    expect(html).toContain('Send an inquiry to a workspace');
    expect(html).toContain('Inquiry code from your project manager');
    expect(html).toContain('Already have client access? Sign in first');
    expect(html).toContain('New request');
    expect(html).toContain('href="/#/client"');
    expect(html).not.toContain('Submit inquiry');
    expect(html).not.toContain('UI-only');
    expect(html).not.toContain('Create developer');
  });

  it('checks the real inquiry link before enabling its form and preserves context on return', () => {
    vi.stubGlobal('window', { location: { hash: '#/request?intake=workspace-a', search: '' } });
    const html = renderToStaticMarkup(<PublicInquiryUnavailable />);
    expect(html).toContain('Tell us what you need');
    expect(html).toContain('Checking whether this inquiry link');
    expect(html).toContain('href="/#/client?intake=workspace-a"');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
    expect(html).not.toContain('UI-only');
    expect(html).not.toContain('Acknowledgment emails and client account activation are not available yet');
  });

  it('keeps direct inquiry form use fail-closed unless a submit handler is explicitly enabled', () => {
    const html = renderToStaticMarkup(<PublicInquiryForm onSubmit={() => undefined} onCancel={() => undefined} />);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
    expect(html).toContain('Nothing is sent or saved');
  });

  it('requires an email address on the actual public inquiry form', () => {
    const html = renderToStaticMarkup(<PublicInquiryForm onSubmit={() => undefined} onCancel={() => undefined} />);
    const emailInput = html.match(/<input\b[^>]*type="email"[^>]*>/)?.[0];
    expect(emailInput).toBeDefined();
    expect(emailInput).toMatch(/\brequired=""/);
    expect(emailInput).toContain('autoComplete="email"');
    expect(emailInput).toContain('maxLength="254"');
    expect(html).toMatch(/Email <span[^>]*>\(required\)<\/span>/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  });

  it('shows the invitation-only sign-in interface without offering open account creation', () => {
    const html = renderToStaticMarkup(<ClientAccessPanel unavailable={false} error="" signInError=""
      signInSent={false} signingIn={false} onRetry={() => undefined} onRequestSignIn={() => undefined} />);
    expect(html).toContain('Access your tickets');
    expect(html).toContain('Send sign-in link');
    expect(html).toMatch(/<input[^>]*type="email"[^>]*required=""/);
    expect(html).toContain('Your project manager must review it and invite you before you can sign in');
    expect(html).toContain('A sign-in link will not create access');
    expect(html).toContain('New to Alpha? Send an inquiry');
    expect(html).toContain('href="/#/request"');
  });

  it('does not lose the workspace inquiry code when a client follows the new-inquiry link', () => {
    vi.stubGlobal('window', { location: { hash: '#/client?intake=workspace-a', search: '' } });
    const html = renderToStaticMarkup(<ClientAccessPanel unavailable={false} error="" signInError=""
      signInSent={false} signingIn={false} onRetry={() => undefined} onRequestSignIn={() => undefined} />);
    expect(html).toContain('href="/#/request?intake=workspace-a"');
    expect(html).not.toContain('href="/#/request"');
  });

  it('keeps sign-in disabled while checking access, with the inquiry journey available', () => {
    const html = renderToStaticMarkup(<ClientAccessPanel checking unavailable={false} error="" signInError=""
      signInSent={false} signingIn={false} onRetry={() => undefined} onRequestSignIn={() => undefined} />);
    expect(html).toContain('Access your tickets');
    expect(html).toContain('Checking secure client access…');
    expect(html.match(/<input\b[^>]*type="email"[^>]*>/)?.[0]).toContain('disabled=""');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
    expect(html).toContain('href="/#/request"');
  });

  it('parses invitation and returning-sign-in links without accepting duplicate credentials', () => {
    const token = 'a'.repeat(43); const proof = 'b'.repeat(32);
    const location = { pathname: '/', search: '', hash: `#/client/activate?token=${token}&providerTokenHash=${proof}&providerTokenType=invite` };
    expect(activationLink(location)).toEqual({ invitationToken: token, providerTokenHash: proof, providerTokenType: 'invite' });
    expect(activationLink({ ...location, hash: `${location.hash}&token=${token}` })).toBeNull();
    expect(activationLink({ ...location, hash: `#/client/activate?providerTokenHash=${proof}&providerTokenType=magiclink` }))
      .toEqual({ invitationToken: null, providerTokenHash: proof, providerTokenType: 'magiclink' });
    expect(activationLink({ ...location, hash: '#/client' })).toBeNull();
  });

  it('removes one-time link values from query and fragment before redemption', () => {
    const clean = scrubbedActivationUrl({ pathname: '/', search: '?token=secret&intake=workspace-a',
      hash: '#/client/activate?providerTokenHash=proof&providerTokenType=invite&token=secret' });
    expect(clean).toBe('/?intake=workspace-a#/client/activate');
    for (const secret of ['secret', 'proof', 'providerTokenHash', 'providerTokenType', 'token=']) expect(clean).not.toContain(secret);
  });

  it('distinguishes unavailable activation from an expired link without exposing provider errors', () => {
    expect(activationFailureMessage(new ClientTicketApiError(503, 'private provider error'))).toContain('not configured');
    expect(activationFailureMessage(new ClientTicketApiError(null, 'private network error'))).toContain('fresh sign-in link');
    expect(activationFailureMessage(new ClientTicketApiError(404, 'private provider error'))).toContain('expired');
    expect(activationFailureMessage(new ClientTicketApiError(429, 'private provider error'))).toContain('Too many attempts');
    expect(activationFailureMessage(new Error('private secret'))).not.toContain('private secret');
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
