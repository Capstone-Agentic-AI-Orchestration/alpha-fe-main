import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClaudeSignInView, offersInAppSignIn } from './ProviderSignIn';

describe('in-app provider sign-in', () => {
  it('offers a button while signed out', () => {
    const html = renderToStaticMarkup(<ClaudeSignInView state={{ status: 'signed_out' }} />);
    expect(html).toContain('Sign in with your Claude subscription');
  });

  it('shows the fallback link and code box while waiting', () => {
    const html = renderToStaticMarkup(<ClaudeSignInView state={{ status: 'waiting', verificationUrl: 'https://claude.com/cai/oauth/authorize' }} />);
    expect(html).toContain('A browser tab opened');
    expect(html).toContain('https://claude.com/cai/oauth/authorize');
    expect(html).toContain('Paste the code');
    expect(html).not.toContain('Sign in with your Claude subscription');
  });

  it('says so once signed in', () => {
    const html = renderToStaticMarkup(<ClaudeSignInView state={{ status: 'signed_in' }} />);
    expect(html).toContain('signed in on this desktop');
    expect(html).not.toContain('Sign in with your Claude subscription');
  });

  it('covers Claude, Antigravity and OpenCode', () => {
    expect(['claude', 'antigravity', 'opencode', 'codex', 'ollama'].filter(offersInAppSignIn)).toEqual(['claude', 'antigravity', 'opencode']);
  });
});

