import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClientFreshLinkRequest } from './ClientFreshLinkRequest';
import { InquiryWorkflow } from './publicClient/InquiryWorkflow';

describe('client link recovery and onboarding copy', () => {
  it('lets a client ask for a fresh link and tells first-time invitees what to do', () => {
    const html = renderToStaticMarkup(<ClientFreshLinkRequest />);
    expect(html).toContain('Email me a fresh link');
    expect(html).toContain('type="email"');
    expect(html).toContain('Ask your project manager to send a new invitation');
    expect(html).not.toContain('exists');
  });
  it('describes the real sign-in flow, a password, instead of an email sign-in link', () => {
    const html = renderToStaticMarkup(<InquiryWorkflow />);
    expect(html).toContain('A clear next step.');
    expect(html).not.toContain('email sign-in link');
  });
});
