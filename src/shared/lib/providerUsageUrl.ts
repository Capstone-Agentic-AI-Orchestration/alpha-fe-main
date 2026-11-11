import type { ProviderLimits } from '@/shared/types';

/** Only open known provider dashboards, even if a local response is malformed. */
export function providerUsageUrl(provider: Pick<ProviderLimits, 'provider' | 'dashboardUrl'>): string {
  if (provider.provider === 'codex') {
    return provider.dashboardUrl === 'https://platform.openai.com/usage'
      ? 'https://platform.openai.com/usage'
      : 'https://chatgpt.com/settings/usage';
  }
  return provider.dashboardUrl === 'https://console.anthropic.com/settings/usage'
    ? 'https://console.anthropic.com/settings/usage'
    : 'https://claude.ai/settings/usage';
}
