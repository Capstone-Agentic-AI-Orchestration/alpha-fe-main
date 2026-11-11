import { describe, expect, it } from 'vitest';
import { providerUsageUrl } from './providerUsageUrl';

describe('provider usage links', () => {
  it('preserves the supported API billing dashboards', () => {
    expect(providerUsageUrl({ provider: 'codex', dashboardUrl: 'https://platform.openai.com/usage' })).toBe('https://platform.openai.com/usage');
    expect(providerUsageUrl({ provider: 'claude', dashboardUrl: 'https://console.anthropic.com/settings/usage' })).toBe('https://console.anthropic.com/settings/usage');
  });
  it('does not open an untrusted URL from a provider response', () => {
    expect(providerUsageUrl({ provider: 'codex', dashboardUrl: 'javascript:alert(1)' })).toBe('https://chatgpt.com/settings/usage');
    expect(providerUsageUrl({ provider: 'claude', dashboardUrl: 'https://example.com/' })).toBe('https://claude.ai/settings/usage');
  });
});
