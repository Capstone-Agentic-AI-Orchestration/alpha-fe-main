import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RuntimeIsolationView } from './RuntimeIsolationPanel';

const shared = { isolated: false, detail: 'Agents still read your personal Codex instructions.', action: 'codex_sign_in' as const };

describe('RuntimeIsolationView', () => {
  it('warns when agents share the developer\'s setup and offers the Codex sign-in', () => {
    const html = renderToStaticMarkup(<RuntimeIsolationView isolation={shared} signIn={{ status: 'signed_out' }} />);
    expect(html).toContain('Shares your personal setup');
    expect(html).toContain('Sign in to Codex for Alpha');
  });

  it('shows the one-time code and the OpenAI sign-in link while waiting', () => {
    const html = renderToStaticMarkup(<RuntimeIsolationView isolation={shared}
      signIn={{ status: 'waiting', verificationUrl: 'https://auth.openai.com/codex/device', userCode: 'ABCD-E1234' }} />);
    expect(html).toContain('ABCD-E1234');
    expect(html).toContain('href="https://auth.openai.com/codex/device"');
    expect(html).toContain('rel="noreferrer"');
    expect(html).not.toContain('Sign in to Codex for Alpha');
  });

  it('shows no sign-in controls to people who do not manage runtimes', () => {
    const html = renderToStaticMarkup(<RuntimeIsolationView isolation={shared} signIn={null} />);
    expect(html).not.toContain('<button');
  });

  it('says an isolated runtime is kept separate and offers sign-out once signed in', () => {
    const html = renderToStaticMarkup(<RuntimeIsolationView isolation={{ isolated: true, detail: 'Own home.' }} signIn={{ status: 'signed_in' }} />);
    expect(html).toContain('Kept separate from your personal setup');
    expect(html).toContain('Sign Codex out of Alpha');
  });

  it('explains an expired code', () => {
    const html = renderToStaticMarkup(<RuntimeIsolationView isolation={shared} signIn={{ status: 'expired', error: 'The sign-in code expired. Start again.' }} />);
    expect(html).toContain('The sign-in code expired. Start again.');
  });
});

