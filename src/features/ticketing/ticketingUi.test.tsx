import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClientAccessPanel } from './ClientAccessPanel';
import { ClientCreateTicketForm } from './ClientCreateTicketForm';
import { PublicInquiryForm } from './PublicInquiryForm';
import PublicInquiryUnavailable from './PublicInquiryUnavailable';
import { ClientPublicShell } from './publicClient/ClientPublicShell';
import { PmCentralIntakeInbox } from './PmCentralIntakeInbox';
import { invitationButtonLabel, invitationStatusMessage, PmContactVerification, PmTicketsView, safeError } from './PmTicketsView';
import { ApiRequestError } from '@/shared/services/apiService';
import { activationFailureMessage, activationLink, scrubbedActivationUrl } from './ClientActivationUnavailable';
import { ClientTicketApiError } from './clientApi';
import { ClientPasswordSignIn } from './ClientPasswordSignIn';
import { ClientProjectsPage } from './ClientProjectPages';

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
  it('keeps workspace inquiry codes out of the PM ticket inbox', () => {
    const html = renderToStaticMarkup(<PmTicketsView intakeEnabled />);
    expect(html).not.toContain('Share inquiry code');
    expect(html).not.toContain('Share inquiry link');
    expect(html).not.toContain('Workspace inquiry code');
    expect(html).not.toContain('workspace-intake');
  });
  it('lets an enabled inquiry form submit without an external verification widget', () => {
    const html = renderToStaticMarkup(<PublicInquiryForm submissionEnabled onSubmit={() => undefined} onCancel={() => undefined} />);
    expect(html).not.toContain('verification');
    expect(html).not.toContain('UI-only');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>.*Submit inquiry/);
    expect(html).toContain('min-h-[44px]');
    expect(html).toContain('This sends your request for review. It does not start work or create an account.');
  });
  it('marks the inquiry page and provides clear links back home and to client sign-in', () => {
    const html = renderToStaticMarkup(<ClientPublicShell page="inquiry"><h1>Tell us what you need</h1></ClientPublicShell>);
    expect(html).toContain('href="/#/"');
    expect(html).toContain('href="/#/client"');
    expect(html).toContain('aria-current="page">Inquiry form</span>');
  });
  it('shows the landing page as the active home page', () => {
    const html = renderToStaticMarkup(<ClientPublicShell><h1>Start here</h1></ClientPublicShell>);
    expect(html).toContain('aria-current="page">Home</a>');
    expect(html).toContain('Client sign in');
    expect(html).toContain('Start an inquiry');
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
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*class="pm-tickets__refresh"[^>]*>/);
  });
  it('opens the shared inquiry form directly without workspace selection or New Request', () => {
    const html = renderToStaticMarkup(<PublicInquiryUnavailable />);
    expect(html).toContain('Tell us what you need');
    expect(html).toContain('A project manager will review it and let you know what happens next.');
    expect(html).not.toContain('Inquiry code from your project manager');
    expect(html).not.toContain('New request');
    expect(html).toContain('href="/#/client"');
    expect(html).toContain('Submit inquiry');
    expect(html).not.toContain('UI-only');
    expect(html).not.toContain('Create developer');
  });

  it('shows the shared PM intake routing destination and purpose', () => {
    const html = renderToStaticMarkup(<PmCentralIntakeInbox workspaceId="workspace-a" workspaceName="Workspace A" workspaceCanReview onAccepted={() => undefined} />);
    expect(html).toContain('Review new client inquiries and project proposals');
    expect(html).toContain('Accept destination:');
    expect(html).toContain('Workspace A');
  });

  it('keeps client project proposals separate from projects and explains their next step', () => {
    const html = renderToStaticMarkup(<ClientProjectsPage
      projects={[]} loading={false} error="" selectedProjectKey={null}
      onSelectedProjectKeyChange={() => undefined} onOpenRequest={() => undefined} onNewRequest={() => undefined}
      inspectionOnly={false} newRequestEnabled={false} newRequestLoading={false} projectFocusVersion={0} refreshToken={0}
      proposals={[
        { id: 'proposal-pending', title: 'Client portal refresh', description: 'A simpler project space', requestedDeadline: null, submittedAt: '2026-10-29T10:00:00.000Z', status: 'pending' },
        { id: 'proposal-declined', title: 'Archived data export', description: 'An older reporting request', requestedDeadline: '2026-12-01', submittedAt: '2026-10-28T10:00:00.000Z', status: 'declined' },
      ]}
      proposalsLoading={false} proposalsError="" onRefreshProposals={() => undefined} onProposalSubmitted={() => undefined}
    />);
    expect(html).toContain('Propose a project');
    expect(html).toContain('Waiting for PM review');
    expect(html).toContain('Not moving forward');
    expect(html).toContain('Your project manager decided not to move forward. No project was created.');
    expect(html.indexOf('No projects shared yet')).toBeLessThan(html.indexOf('Project proposals'));
    expect(html).not.toContain('decline note');
  });

  it('checks the real inquiry link before enabling its form and preserves context on return', () => {
    vi.stubGlobal('window', { location: { hash: '#/request?intake=workspace-a', search: '' } });
    const html = renderToStaticMarkup(<PublicInquiryUnavailable />);
    expect(html).toContain('Tell us what you need');
    expect(html).toContain('Checking whether you can send this inquiry');
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

  it('explains the password-based client access flow without offering passwordless sign-in', () => {
    const html = renderToStaticMarkup(<ClientAccessPanel unavailable={false} error="" onRetry={() => undefined} />);
    expect(html).toContain('Sign in with your password');
    expect(html).toContain('verify your email and choose a password');
    expect(html).toContain('Go to client sign in');
    expect(html).not.toContain('Send sign-in link');
    expect(html).not.toMatch(/<input[^>]*type="email"/);
    expect(html).toContain('Start a project inquiry');
    expect(html).toContain('href="/#/request"');
  });

  it('does not lose the workspace inquiry code when a client follows the new-inquiry link', () => {
    vi.stubGlobal('window', { location: { hash: '#/client?intake=workspace-a', search: '' } });
    const html = renderToStaticMarkup(<ClientAccessPanel unavailable={false} error="" onRetry={() => undefined} />);
    expect(html).toContain('href="/#/request?intake=workspace-a"');
    expect(html).not.toContain('href="/#/request"');
  });

  it('keeps retry disabled while checking sample access', () => {
    const html = renderToStaticMarkup(<ClientAccessPanel checking unavailable={false} error="" onRetry={() => undefined} />);
    expect(html).toContain('Checking client access…');
    expect(html).toMatch(/<button[^>]*disabled=""/);
    expect(html).toContain('href="/#/request"');
  });

  it('explains how an invited client signs in with their chosen password', () => {
    const html = renderToStaticMarkup(<ClientPasswordSignIn unavailable={false} error="" onRetry={() => undefined} onSignedIn={() => undefined} />);
    expect(html).toContain('Sign in to your requests');
    expect(html).toContain('Use the email your project manager invited');
    expect(html).toContain('Forgot password?');
  });

  it('parses invitation links but rejects standalone passwordless sign-in links', () => {
    const token = 'a'.repeat(43); const proof = 'b'.repeat(32);
    const location = { pathname: '/', search: '', hash: `#/client/activate?token=${token}&providerTokenHash=${proof}&providerTokenType=invite` };
    expect(activationLink(location)).toEqual({ invitationToken: token, providerTokenHash: proof, providerTokenType: 'invite' });
    expect(activationLink({ ...location, hash: `${location.hash}&token=${token}` })).toBeNull();
    expect(activationLink({ ...location, hash: `#/client/activate?token=${token}&providerTokenHash=${proof}&providerTokenType=magiclink` }))
      .toEqual({ invitationToken: token, providerTokenHash: proof, providerTokenType: 'magiclink' });
    expect(activationLink({ ...location, hash: `#/client/activate?providerTokenHash=${proof}&providerTokenType=magiclink` })).toBeNull();
    expect(activationLink({ ...location, hash: '#/client' })).toBeNull();
  });

  it('removes one-time link values from query and fragment before redemption', () => {
    const clean = scrubbedActivationUrl({ pathname: '/', search: '?token=secret&intake=workspace-a',
      hash: '#/client/activate?providerTokenHash=proof&providerTokenType=invite&token=secret' });
    expect(clean).toBe('/?intake=workspace-a#/client/activate');
    for (const secret of ['secret', 'proof', 'providerTokenHash', 'providerTokenType', 'token=']) expect(clean).not.toContain(secret);
  });

  it('distinguishes unavailable activation from an expired link without exposing provider errors', () => {
    expect(activationFailureMessage(new ClientTicketApiError(503, 'private provider error'))).toContain('We could not verify this link');
    expect(activationFailureMessage(new ClientTicketApiError(null, 'private network error'))).toContain('use password recovery');
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
