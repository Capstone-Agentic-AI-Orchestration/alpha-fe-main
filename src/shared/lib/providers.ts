import { ModelProvider, ReasoningEffort, RuntimeEngine } from '@/shared/types';

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
  /**
   * The runtime this option came from. Provider and runtime are one axis here —
   * `RUNTIME_TO_PROVIDER` is keyed by runtime id, so each detected runtime
   * yields exactly one provider — and carrying the id means a picker can store
   * `runtimeId` instead of re-deriving it from the provider label later.
   */
  runtimeId: string;
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
  lmstudio: 'LM Studio',
  opencode: 'OpenCode'
};

export function providerOptions(runtimes: RuntimeEngine[]): ProviderOption[] {
  const options: ProviderOption[] = [];

  for (const runtime of runtimes) {
    const provider = RUNTIME_TO_PROVIDER[runtime.id];
    if (!provider) continue;

    // The daemon sends `models`; older cached rows used `modelsLoaded`. Prefer
    // a non-empty current list so an empty placeholder from an older row does
    // not hide a freshly discovered catalog.
    const models = runtime.models?.length ? runtime.models : runtime.modelsLoaded ?? [];

    options.push({
      runtimeId: runtime.id,
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

/* ---------------------------------------------------------------------------
 * Runtime-keyed views of the same data.
 *
 * An agent stores `runtimeId` — that is what the daemon dispatches on — while
 * `modelProvider` is a display echo of it. Creation therefore picks a runtime
 * and derives the provider, never the other way round.
 * ------------------------------------------------------------------------ */

export function runtimeOption(
  runtimes: RuntimeEngine[],
  runtimeId: string
): ProviderOption | undefined {
  return providerOptions(runtimes).find(o => o.runtimeId === runtimeId);
}

/** The provider value to store alongside a chosen runtime. */
export function providerForRuntime(
  runtimes: RuntimeEngine[],
  runtimeId: string
): ModelProvider | null {
  return runtimeOption(runtimes, runtimeId)?.provider ?? null;
}

/** Models to offer for a runtime, or [] when nothing was detected. */
export function modelsForRuntime(runtimes: RuntimeEngine[], runtimeId: string): string[] {
  return runtimeOption(runtimes, runtimeId)?.models ?? [];
}

/**
 * Reasoning levels the local CLI can accept for each provider/model family.
 *
 * "Auto" is represented by an empty value in the form and is deliberately
 * not included here. Keeping this mapping next to the runtime catalog means a
 * model change can immediately narrow the effort picker instead of offering a
 * flag that the selected CLI will reject.
 */
export function reasoningEffortsForProviderModel(
  provider: ModelProvider | string | undefined,
  modelName: string | undefined
): ReasoningEffort[] {
  const model = (modelName ?? '').trim().toLowerCase();

  if (provider === 'Anthropic') {
    // Claude Code 2.x advertises these exact values through --effort.
    return ['low', 'medium', 'high', 'xhigh', 'max'];
  }

  if (provider === 'Antigravity' || provider === 'Google Gemini') {
    // agy exposes a smaller --effort surface than Claude Code.
    return ['low', 'medium', 'high'];
  }

  if (provider !== 'OpenAI') return [];

  // OpenAI-compatible local gateways can expose arbitrary ids. Offer the
  // portable core levels for an unknown id; the gateway remains the authority.
  if (!model) return ['low', 'medium', 'high'];

  // GPT-4.x and embedding/moderation models do not expose a reasoning knob.
  if (/^(gpt-?4|gpt-?3|text-|embedding-|omni-moderation)/.test(model)) return [];

  // Current Codex/GPT-5.6 and GPT-6 families expose the extended scale. The
  // Codex CLI applies the selected value through model_reasoning_effort.
  if (model.includes('gpt-6') || model.includes('gpt-5.6') || model.includes('codex')) {
    return ['none', 'low', 'medium', 'high', 'xhigh', 'max'];
  }

  // GPT-5 (the original family) uses minimal instead of none and stops at high.
  if (/^gpt-?5(?:$|[^.])/.test(model) || /^gpt-?5(?:\.0)?(?:$|-)/.test(model)) {
    return ['minimal', 'low', 'medium', 'high'];
  }

  // GPT-5.1–5.5 and the o-series use the standard reasoning scale.
  if (/^gpt-?5\.|^o[134](?:$|[-.])/.test(model)) {
    return ['none', 'low', 'medium', 'high', 'xhigh'];
  }

  return ['low', 'medium', 'high'];
}

/** Reasoning levels offered for the runtime currently selected in a form. */
export function reasoningEffortsForRuntime(
  runtimes: RuntimeEngine[],
  runtimeId: string,
  modelName: string | undefined
): ReasoningEffort[] {
  const runtime = runtimeOption(runtimes, runtimeId);
  return reasoningEffortsForProviderModel(runtime?.provider, modelName);
}

export const REASONING_EFFORT_LABELS: Record<ReasoningEffort, string> = {
  none: 'None',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
  ultra: 'Ultra'
};

export const REASONING_EFFORT_HINTS: Record<ReasoningEffort, string> = {
  none: 'Fastest response with no deliberate reasoning.',
  minimal: 'Light reasoning for quick tasks.',
  low: 'Faster responses with some planning.',
  medium: 'Balanced quality, speed, and cost.',
  high: 'Deeper reasoning for complex tasks.',
  xhigh: 'Extra depth for difficult agentic work.',
  max: 'Maximum supported reasoning depth.',
  ultra: 'Highest available reasoning depth.'
};

/** First detected model for a runtime — used when switching runtime. */
export function defaultModelForRuntime(runtimes: RuntimeEngine[], runtimeId: string): string {
  return modelsForRuntime(runtimes, runtimeId)[0] ?? '';
}

/**
 * The runtime a new agent should start on: the first usable one, falling back
 * to the first detected at all so the form still has a selection to show on a
 * machine where every CLI is signed out.
 */
export function preferredRuntimeId(runtimes: RuntimeEngine[]): string {
  const options = providerOptions(runtimes);
  return options.find(o => o.available)?.runtimeId ?? options[0]?.runtimeId ?? '';
}
