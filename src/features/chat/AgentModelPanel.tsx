import { Activity, X } from 'lucide-react';

import type { Agent, ModelProvider, ReasoningEffort, RuntimeEngine } from '@/shared/types';
import { defaultModelFor, modelsForProvider, providerOptions, reasoningEffortsForProviderModel } from '@/shared/lib/providers';

const EFFORT_LABEL: Record<string, string> = {
  minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Extra high', max: 'Max', ultra: 'Ultra', none: 'None'
};

export interface AgentModelPanelProps {
  agent: Agent;
  /** What the agent is doing now, for example "Working · Redesign the dashboard" or "Idle". */
  status: string;
  runtimes: RuntimeEngine[];
  canEdit: boolean;
  onUpdate: (id: string, updates: Partial<Agent>) => void;
  /** Opens the agent's live activity, when it has some in this chat or build. */
  onViewActivity?: () => void;
  onClose: () => void;
}

const fieldClass = 'w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 text-xs text-white focus:border-violet-300/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50';

/**
 * The model an agent runs on, shown beside the 3D view when its orb is clicked.
 * Changes save straight to the agent, exactly as in the Agent Directory, and
 * apply from the agent's next task.
 */
export function AgentModelPanel({ agent, status, runtimes, canEdit, onUpdate, onViewActivity, onClose }: AgentModelPanelProps) {
  const managed = new Set(agent.managedByFile ?? []);
  const providers = providerOptions(runtimes);
  const models = modelsForProvider(runtimes, agent.modelProvider);
  const efforts = reasoningEffortsForProviderModel(agent.modelProvider, agent.modelName);
  const keepEffort = (provider: ModelProvider | string, modelName: string) => {
    const allowed = reasoningEffortsForProviderModel(provider, modelName);
    return agent.reasoningEffort && allowed.includes(agent.reasoningEffort) ? agent.reasoningEffort : null;
  };
  const providerKnown = providers.some(option => option.provider === agent.modelProvider);

  return <aside aria-label={agent.name + ' model'} className="flex max-h-full w-72 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121218]/95 shadow-2xl shadow-black/50 backdrop-blur">
    <div className="flex items-start gap-2.5 border-b border-white/[0.06] px-3.5 py-2.5">
      <span aria-hidden="true" className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: agent.color || '#a78bfa' }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{agent.name}</div>
        <div className="truncate text-[11px] text-gray-400">{agent.role}</div>
      </div>
      <button type="button" onClick={onClose} aria-label="Close agent details" className="rounded-lg p-1 text-gray-400 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60"><X className="h-4 w-4" aria-hidden="true" /></button>
    </div>
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3.5 py-2.5">
      <p className="line-clamp-2 text-[11px] leading-4 text-violet-200">{status}</p>

      <label className="block space-y-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Provider</span>
        <select value={agent.modelProvider} disabled={!canEdit || managed.has('modelProvider')} className={fieldClass}
          onChange={event => {
            const provider = event.target.value as ModelProvider;
            const modelName = defaultModelFor(runtimes, provider) || agent.modelName;
            onUpdate(agent.id, { modelProvider: provider, modelName, reasoningEffort: keepEffort(provider, modelName) });
          }}>
          {!providerKnown && <option value={agent.modelProvider}>{agent.modelProvider} (not detected)</option>}
          {providers.map(option => <option key={option.provider} value={option.provider}>{option.label}</option>)}
        </select>
      </label>

      <label className="block space-y-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Model</span>
        {models.length
          ? <select value={agent.modelName} disabled={!canEdit || managed.has('modelName')} className={fieldClass + ' font-mono'}
              onChange={event => onUpdate(agent.id, { modelName: event.target.value, reasoningEffort: keepEffort(agent.modelProvider, event.target.value) })}>
              {agent.modelName && !models.includes(agent.modelName) && <option value={agent.modelName}>{agent.modelName} (not detected)</option>}
              {models.map(model => <option key={model} value={model}>{model}</option>)}
            </select>
          : <input value={agent.modelName} disabled={!canEdit || managed.has('modelName')} placeholder="No models detected; type a model id" className={fieldClass + ' font-mono'}
              onChange={event => onUpdate(agent.id, { modelName: event.target.value })} />}
      </label>

      <label className="block space-y-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Reasoning effort</span>
        <select value={agent.reasoningEffort ?? ''} disabled={!canEdit || managed.has('reasoningEffort') || !efforts.length} className={fieldClass}
          onChange={event => onUpdate(agent.id, { reasoningEffort: (event.target.value || null) as ReasoningEffort | null })}>
          <option value="">Auto</option>
          {efforts.map(effort => <option key={effort} value={effort}>{EFFORT_LABEL[effort] ?? effort}</option>)}
        </select>
      </label>

      <p className="text-[10px] leading-4 text-gray-500">
        {!canEdit ? 'Your project role can see this agent’s model but cannot change it.'
          : managed.size ? 'Fields set in the agent’s persona file can only be changed there.'
          : 'Saved right away. A task that is already running keeps its model; the change applies from the agent’s next task.'}
      </p>
    </div>
    {onViewActivity && <div className="border-t border-white/[0.06] px-3.5 py-2">
      <button type="button" onClick={onViewActivity} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-300/25 bg-violet-300/[0.08] px-3 py-1.5 text-xs font-semibold text-violet-100 hover:bg-violet-300/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60">
        <Activity className="h-3.5 w-3.5" aria-hidden="true" /> View live activity
      </button>
    </div>}
  </aside>;
}

