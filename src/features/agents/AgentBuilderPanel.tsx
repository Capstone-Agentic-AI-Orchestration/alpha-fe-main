import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiService } from '@/shared/services/apiService';
import { RuntimeEngine, Skill } from '@/shared/types';
import {
  providerOptions,
  modelsForRuntime,
  reasoningEffortsForRuntime,
  REASONING_EFFORT_LABELS
} from '@/shared/lib/providers';
import { AgentDraft } from '@/features/agents/agentDraft';
import { BuilderMessage, StoredBuilderSession } from '@/features/agents/draftStore';
import {
  encodeBuilderInput,
  mergeBuilderDraft,
  parseBuilderDraft,
  stripBuilderDraft
} from '@/features/agents/builderProtocol';
import { Sparkles, Send, ArrowRight, AlertTriangle } from 'lucide-react';
import { useApp } from '@/app/AppContext';

interface AgentBuilderPanelProps {
  draft: AgentDraft;
  onDraftChange: (next: AgentDraft) => void;
  /**
   * The conversation, owned by the parent so it can be persisted. Held here it
   * would die with the dialog, and with it the id the daemon keys the CLI's own
   * resumable session off.
   */
  session: StoredBuilderSession;
  onSessionChange: (next: StoredBuilderSession) => void;
  runtimes: RuntimeEngine[];
  skills: Skill[];
  onBack: () => void;
  /** Hands the finished draft to the configuration form for a last look. */
  onReview: () => void;
}

const QUICK_IDEAS = [
  'A senior frontend reviewer for React and Tailwind components',
  'A Playwright QA agent that writes end-to-end tests',
  'An SRE that manages Docker builds and release checks',
  'A triager that labels and routes incoming tasks'
];

/**
 * The conversational half of agent creation.
 *
 * Left: the conversation. Right: the draft it is editing, live. The two are the
 * same object — the builder's reply patches the draft through
 * `mergeBuilderDraft`, and the panel on the right is simply that draft
 * rendered, so there is no "apply" step to forget.
 */
export const AgentBuilderPanel: React.FC<AgentBuilderPanelProps> = ({
  draft,
  onDraftChange,
  session,
  onSessionChange,
  runtimes,
  skills,
  onBack,
  onReview
}) => {
  const { can } = useApp();
  const canManageAgents = can('manage_agents');
  const [composer, setComposer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transcriptRef = useRef<HTMLDivElement>(null);
  const messages = session.messages;

  const runtimeChoices = useMemo(() => providerOptions(runtimes), [runtimes]);
  const models = useMemo(
    () => modelsForRuntime(runtimes, draft.runtimeId),
    [runtimes, draft.runtimeId]
  );
  const reasoningEfforts = useMemo(
    () => reasoningEffortsForRuntime(runtimes, draft.runtimeId, draft.modelName),
    [runtimes, draft.runtimeId, draft.modelName]
  );
  const builderChoices = runtimeChoices.filter(c => ['claude', 'codex', 'antigravity', 'gemini', 'opencode'].includes(c.runtimeId));
  const builderRuntimeId = session.runtimeId ?? runtimes.find(runtime => runtime.isDefault && builderChoices.some(choice => choice.runtimeId === runtime.id && choice.available && choice.models.length))?.id ?? builderChoices.find(c => c.available && c.models.length)?.runtimeId ?? builderChoices[0]?.runtimeId ?? '';
  const builderRuntime = builderChoices.find(c => c.runtimeId === builderRuntimeId);
  const builderModels = builderRuntime?.models ?? [];
  const builderModelName = session.modelName ?? builderModels[0] ?? '';
  const builderReady = !!builderRuntime?.available && builderModels.includes(builderModelName);
  const runtimeLabel = builderRuntime?.label;
  const configuredSession = { ...session, runtimeId: builderRuntimeId, modelName: builderModelName };
  const started = messages.length > 0;

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight });
  }, [messages, busy]);

  const appendMessage = (message: BuilderMessage, base: BuilderMessage[]) =>
    onSessionChange({ ...configuredSession, messages: [...base, message] });

  const send = async (text: string) => {
    if (!canManageAgents) return;
    const request = text.trim();
    if (!request || busy || !builderReady) return;

    const withRequest: BuilderMessage[] = [
      ...messages,
      { id: `m-${Date.now()}`, author: 'you', text: request }
    ];

    setComposer('');
    setError(null);
    onSessionChange({ ...configuredSession, messages: withRequest });
    setBusy(true);

    try {
      const { content } = await apiService.sendBuilderMessage({
        sessionId: session.sessionId,
        runtimeId: builderRuntimeId,
        modelName: builderModelName,
        // Every turn re-states the whole draft and the catalogs of legal ids,
        // so the builder is never guessing at what it is editing.
        message: encodeBuilderInput(request, draft, skills, models, reasoningEfforts)
      });

      const payload = parseBuilderDraft(content);
      if (payload) {
        onDraftChange(
          mergeBuilderDraft(
            draft,
            payload,
            new Set(skills.map(s => s.id)),
            new Set(models),
            new Set(reasoningEfforts)
          )
        );
      }

      const prose = stripBuilderDraft(content);
      appendMessage(
        {
          id: `m-${Date.now()}-b`,
          author: 'builder',
          // A reply that was nothing but the block still needs to say something.
          text: prose || 'Updated the configuration.'
        },
        withRequest
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  /* ---------------------------------------------------------------------
   * Setup: pick where the builder runs, then say what you want.
   * One screen, one job — the conversation replaces it on first send.
   * ------------------------------------------------------------------ */
  if (!started) {
    return (
      <div className="space-y-4 py-2">
        <section className="space-y-3 rounded-xl border border-divider bg-surface/40 p-4">
          <div><h4 className="text-sm font-medium text-content">Choose your builder</h4><p className="mt-1 text-xs leading-relaxed text-content-secondary">This model helps you design the agent. You can choose a different model for the finished agent.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><label htmlFor="builder-runtime" className="text-xs font-medium text-content-secondary">Builder runtime</label>
              <select id="builder-runtime" value={builderRuntimeId} onChange={e => {
                const runtimeId = e.target.value;
                const next = builderChoices.find(c => c.runtimeId === runtimeId);
                onSessionChange({ ...session, runtimeId, modelName: next?.models[0] ?? '' });
              }} className="w-full rounded-lg border border-control bg-surface px-3 py-2.5 text-sm text-content focus:border-control focus:outline-none">
                {!builderChoices.length && <option value="">No supported runtimes detected</option>}
                {builderChoices.map(c => <option key={c.runtimeId} value={c.runtimeId}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><label htmlFor="builder-model" className="text-xs font-medium text-content-secondary">Builder model</label>
              <select id="builder-model" value={builderModelName} disabled={!builderModels.length} onChange={e => onSessionChange({ ...configuredSession, modelName: e.target.value })} className="w-full rounded-lg border border-control bg-surface px-3 py-2.5 text-sm text-content focus:border-control focus:outline-none disabled:opacity-50">
                {!builderModels.includes(builderModelName) && <option value={builderModelName}>{builderModelName || 'No models available'}</option>}
                {builderModels.map(model => <option key={model} value={model}>{model}</option>)}
              </select>
            </div>
          </div>
          {!builderReady && <p role="status" className="text-xs text-status-warning">{!builderRuntime?.available ? 'Connect a supported runtime on the Runtimes page to continue.' : 'Refresh this runtime’s model catalog and choose an available model.'}</p>}
        </section>

        <div>
          <label htmlFor="builder-description" className="block text-xs font-semibold text-content-secondary mb-1.5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-link" />
            <span>Describe the agent you need</span>
          </label>
          <textarea
            id="builder-description"
            rows={4}
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send(composer);
              }
            }}
            placeholder="e.g. A senior frontend reviewer who checks React & Tailwind components for accessibility, state performance, and clean TypeScript props."
            className="w-full bg-surface border border-control rounded-xl p-3.5 text-sm text-content placeholder-content-muted focus:outline-none focus:border-control font-sans"
            autoFocus
          />
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-content-secondary">
          <span className="text-content-muted">Quick ideas:</span>
          {QUICK_IDEAS.map(idea => (
            <button
              key={idea}
              type="button"
              onClick={() => setComposer(idea)}
              className="px-2.5 py-1 rounded-lg bg-surface-raised hover:bg-surface-high text-content-secondary hover:text-content transition-colors"
            >
              {idea.split(' ').slice(0, 4).join(' ')}…
            </button>
          ))}
        </div>

        {error && <BuilderError message={error} />}

        <div className="flex items-center justify-between pt-4 border-t border-divider">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-lg text-xs text-content-secondary hover:text-content"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={() => void send(composer)}
            disabled={busy || !composer.trim() || !builderReady}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold bg-action hover:bg-action-hover text-on-action shadow-glow-brand transition-all disabled:opacity-50"
          >
            {busy ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>Starting…</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Start Building</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------------
   * The conversation and the draft it is editing, side by side.
   * ------------------------------------------------------------------ */
  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[62vh] min-h-0">
      {/* Conversation */}
      <div className="flex flex-col min-h-0 flex-1 lg:w-1/2">
        <div ref={transcriptRef} className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
          {messages.map(message => (
            <div
              key={message.id}
              className={
                message.author === 'you'
                  ? 'ml-auto max-w-[85%] rounded-xl rounded-br-sm bg-selected border border-divider px-3 py-2 text-xs text-selected-content whitespace-pre-wrap'
                  : 'mr-auto max-w-[90%] rounded-xl rounded-bl-sm bg-surface border border-divider px-3 py-2 text-xs text-content whitespace-pre-wrap leading-relaxed'
              }
            >
              {message.text}
            </div>
          ))}

          {busy && (
            <div className="mr-auto flex items-center gap-2 px-3 py-2 text-xs text-content-muted">
              <Sparkles className="w-3.5 h-3.5 animate-spin text-link" />
              <span>Thinking…</span>
            </div>
          )}

          {error && <BuilderError message={error} />}
        </div>

        <div className="pt-3 mt-3 border-t border-divider flex items-end gap-2">
          <textarea
            rows={2}
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line — what a chat composer
              // does everywhere else in the app.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(composer);
              }
            }}
            placeholder="Refine it — “make it stricter about tests”, “drop the browser skill”…"
            disabled={busy}
            className="flex-1 min-w-0 resize-none bg-surface border border-control rounded-xl px-3 py-2 text-xs text-content placeholder-content-muted focus:outline-none focus:border-control disabled:opacity-50"
            autoFocus
          />
          <button
            type="button"
            onClick={() => void send(composer)}
            disabled={busy || !composer.trim() || !builderReady}
            className="p-2.5 rounded-xl bg-action hover:bg-action-hover text-on-action transition-colors disabled:opacity-40"
            title="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live draft */}
      <div className="flex flex-col min-h-0 lg:w-1/2 rounded-xl border border-divider bg-well">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-divider">
          <span className="text-[11px] font-medium text-content-secondary">Configuration</span>
          <span className="truncate text-[10px] text-content-secondary" title={`${runtimeLabel} · ${builderModelName}`}>Builder: {builderModelName}</span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 text-xs">
          <DraftRow label="Name" value={draft.name} />
          <DraftRow label="Role" value={draft.role} />
          <DraftRow label="Model" value={draft.modelName} mono />
          <DraftRow
            label="Reasoning"
            value={draft.reasoningEffort ? REASONING_EFFORT_LABELS[draft.reasoningEffort] : 'Auto'}
          />
          <DraftRow label="Access" value={draft.allowedUsers} />

          <DraftBlock label="Specialization" value={draft.description} />
          <DraftBlock label="Instructions" value={draft.systemPrompt} mono />

          <div className="space-y-1.5">
            <span className="text-content-muted">Skills ({draft.skillIds.length})</span>
            {draft.skillIds.length === 0 ? (
              <p className="text-content-muted italic">None attached yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {draft.skillIds.map(id => (
                  <span
                    key={id}
                    className="px-2 py-0.5 rounded-md bg-selected border border-divider text-selected-content"
                  >
                    {skills.find(s => s.id === id)?.name ?? id}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-divider flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-content-secondary hover:text-content"
          >
            ← Back to options
          </button>
          <button
            type="button"
            onClick={onReview}
            disabled={!draft.name.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-action hover:bg-action-hover text-on-action transition-colors disabled:opacity-40"
          >
            <span>Review &amp; deploy</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

const DraftRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({
  label,
  value,
  mono
}) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className="text-content-muted flex-shrink-0">{label}</span>
    <span className={`text-content text-right truncate ${mono ? 'font-mono' : 'capitalize'}`}>
      {value || <span className="text-content-muted italic normal-case">not set</span>}
    </span>
  </div>
);

const DraftBlock: React.FC<{ label: string; value: string; mono?: boolean }> = ({
  label,
  value,
  mono
}) => (
  <div className="space-y-1">
    <span className="text-content-muted block">{label}</span>
    <p
      className={`text-content-secondary leading-relaxed whitespace-pre-wrap ${mono ? 'font-mono text-[11px]' : ''}`}
    >
      {value || <span className="text-content-muted italic">not set</span>}
    </p>
  </div>
);

const BuilderError: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-start gap-2 rounded-xl border border-status-danger-border bg-status-danger-subtle px-3 py-2 text-[11px] text-status-danger">
    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
    <span className="break-words">{message}</span>
  </div>
);
