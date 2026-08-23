import { ModelProvider, RuntimeEngine } from '@/shared/types';

/**
 * Provider and model choices, derived from what the daemon actually detected
 * on this machine.
 *
 * Previously both agent editors hardcoded four providers and default model ids
 * like `claude-3-7-sonnet` and `o3-mini`. Neither is a current model, and the
 * list omitted Antigravity entirely even on a machine where it is installed and
 * signed in. Deriving from the runtime scan means the picker cannot drift from
 * reality — a newly installed CLI appears after the next scan, with no code
 * change.
 */

export interface ProviderOption {
  provider: ModelProvider;
  label: string;
  /** Detected models, empty when the runtime has not reported any. */
  models: string[];
  status: RuntimeEngine['status'];
  available: boolean;
}

/** Runtime id → the ModelProvider value an agent stores. */
const RUNTIME_TO_PROVIDER: Record<string, ModelProvider> = {
  claude: 'Anthropic',
  codex: 'OpenAI',
  antigravity: 'Antigravity',
  gemini: 'Google Gemini',
  ollama: 'Ollama',
  lmstudio: 'LM Studio'
};

export function providerOptions(runtimes: RuntimeEngine[]): ProviderOption[] {
  const options: ProviderOption[] = [];

  for (const runtime of runtimes) {
    const provider = RUNTIME_TO_PROVIDER[runtime.id];
    if (!provider) continue;

    // The daemon sends `models`; older cached rows used `modelsLoaded`.
    const models = runtime.models ?? runtime.modelsLoaded ?? [];

    options.push({
      provider,
      // Surface why a choice is unusable rather than hiding it — an installed
      // but signed-out CLI is a fixable state, not an absent one.
      label:
        runtime.status === 'online'
          ? runtime.name
          : `${runtime.name} — ${runtime.status === 'degraded' ? 'not signed in' : 'not installed'}`,
      models,
      status: runtime.status,
      available: runtime.status === 'online'
    });
  }

  // Online first, then alphabetical, so the usable choices lead.
  return options.sort((a, b) =>
    a.available === b.available ? a.label.localeCompare(b.label) : Number(b.available) - Number(a.available)
  );
}

/** Models to offer for a provider, or [] when nothing was detected. */
export function modelsForProvider(runtimes: RuntimeEngine[], provider: ModelProvider): string[] {
  return providerOptions(runtimes).find(o => o.provider === provider)?.models ?? [];
}

/** First detected model for a provider — used when switching provider. */
export function defaultModelFor(runtimes: RuntimeEngine[], provider: ModelProvider): string {
  return modelsForProvider(runtimes, provider)[0] ?? '';
}
