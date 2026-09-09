import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiService } from '@/shared/services/apiService';
import { RuntimeEngine, Skill } from '@/shared/types';
import { providerOptions, modelsForRuntime } from '@/shared/lib/providers';
import { AgentDraft } from '@/features/agents/agentDraft';
import { BuilderMessage, StoredBuilderSession } from '@/features/agents/draftStore';
import {
  encodeBuilderInput,
  mergeBuilderDraft,
  parseBuilderDraft,
  stripBuilderDraft
} from '@/features/agents/builderProtocol';
import { Sparkles, Send, ArrowRight, AlertTriangle } from 'lucide-react';

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
  'A triager that labels and routes incoming issues'
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
  const runtimeLabel = runtimeChoices.find(c => c.runtimeId === draft.runtimeId)?.label;
  const started = messages.length > 0;

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight });
  }, [messages, busy]);

  const appendMessage = (message: BuilderMessage, base: BuilderMessage[]) =>
    onSessionChange({ ...session, messages: [...base, message] });

  const send = async (text: string) => {
    const request = text.trim();
    if (!request || busy) return;

    const withRequest: BuilderMessage[] = [
      ...messages,
      { id: `m-${Date.now()}`, author: 'you', text: request }
    ];

    setComposer('');
    setError(null);
    onSessionChange({ ...session, messages: withRequest });
    setBusy(true);

    try {
      const { content } = await apiService.sendBuilderMessage({
        sessionId: session.sessionId,
        runtimeId: draft.runtimeId,
        // Every turn re-states the whole draft and the catalogs of legal ids,
        // so the builder is never guessing at what it is editing.
        message: encodeBuilderInput(request, draft, skills, models)
      });

      const payload = parseBuilderDraft(content);
      if (payload) {
        onDraftChange(
          mergeBuilderDraft(draft, payload, new Set(skills.map(s => s.id)), new Set(models))
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
        <div>
          <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
            Runtime for the builder
          </label>
          {runtimeChoices.length === 0 ? (
            <p className="px-3 py-2 rounded-lg bg-surface-200 border border-amber-500/30 text-[11px] text-amber-300">
              No runtimes detected. Scan for runtimes in Settings before building with AI.
            </p>
          ) : (
            <>
              <select
                value={draft.runtimeId}
                onChange={(e) => onDraftChange({ ...draft, runtimeId: e.target.value })}
                className="w-full bg-surface-200 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              >
                {runtimeChoices.map(choice => (
                  <option key={choice.runtimeId} value={choice.runtimeId}>{choice.label}</option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-gray-500">
                Runs the conversation. The agent you design can use a different model.
              </p>
            </>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-400" />
            <span>Describe the Agent You Need</span>
          </label>
          <textarea
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
            className="w-full bg-surface-200 border border-white/10 rounded-xl p-3.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 font-sans"
            autoFocus
          />
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-gray-400">
          <span className="text-gray-500">Quick ideas:</span>
          {QUICK_IDEAS.map(idea => (
            <button
              key={idea}
              type="button"
              onClick={() => setComposer(idea)}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
            >
              {idea.split(' ').slice(0, 4).join(' ')}…
            </button>
          ))}
        </div>

        {error && <BuilderError message={error} />}

        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-white"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={() => void send(composer)}
            disabled={busy || !composer.trim() || !draft.runtimeId}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-on-accent shadow-glow-brand transition-all disabled:opacity-50"
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
                  ? 'ml-auto max-w-[85%] rounded-xl rounded-br-sm bg-brand-500/15 border border-brand-500/25 px-3 py-2 text-xs text-white whitespace-pre-wrap'
                  : 'mr-auto max-w-[90%] rounded-xl rounded-bl-sm bg-surface-200 border border-white/5 px-3 py-2 text-xs text-gray-200 whitespace-pre-wrap leading-relaxed'
              }
            >
              {message.text}
            </div>
          ))}

          {busy && (
            <div className="mr-auto flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
              <Sparkles className="w-3.5 h-3.5 animate-spin text-brand-400" />
              <span>Thinking…</span>
            </div>
          )}

          {error && <BuilderError message={error} />}
        </div>

        <div className="pt-3 mt-3 border-t border-white/10 flex items-end gap-2">
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
            className="flex-1 min-w-0 resize-none bg-surface-200 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 disabled:opacity-50"
            autoFocus
          />
          <button
            type="button"
            onClick={() => void send(composer)}
            disabled={busy || !composer.trim()}
            className="p-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-on-accent transition-colors disabled:opacity-40"
            title="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live draft */}
      <div className="flex flex-col min-h-0 lg:w-1/2 rounded-xl border border-white/10 bg-well">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
          <span className="text-[11px] font-medium text-gray-400">Configuration</span>
          {runtimeLabel && <span className="text-[10px] text-gray-500">{runtimeLabel}</span>}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 text-xs">
          <DraftRow label="Name" value={draft.name} />
          <DraftRow label="Role" value={draft.role} />
          <DraftRow label="Model" value={draft.modelName} mono />
          <DraftRow label="Access" value={draft.allowedUsers} />

          <DraftBlock label="Specialization" value={draft.description} />
          <DraftBlock label="Instructions" value={draft.systemPrompt} mono />

          <div className="space-y-1.5">
            <span className="text-gray-500">Skills ({draft.skillIds.length})</span>
            {draft.skillIds.length === 0 ? (
              <p className="text-gray-600 italic">None attached yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {draft.skillIds.map(id => (
                  <span
                    key={id}
                    className="px-2 py-0.5 rounded-md bg-brand-500/15 border border-brand-500/25 text-brand-200"
                  >
                    {skills.find(s => s.id === id)?.name ?? id}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-gray-400 hover:text-white"
          >
            ← Back to options
          </button>
          <button
            type="button"
            onClick={onReview}
            disabled={!draft.name.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-on-accent transition-colors disabled:opacity-40"
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
    <span className="text-gray-500 flex-shrink-0">{label}</span>
    <span className={`text-gray-200 text-right truncate ${mono ? 'font-mono' : 'capitalize'}`}>
      {value || <span className="text-gray-600 italic normal-case">not set</span>}
    </span>
  </div>
);

const DraftBlock: React.FC<{ label: string; value: string; mono?: boolean }> = ({
  label,
  value,
  mono
}) => (
  <div className="space-y-1">
    <span className="text-gray-500 block">{label}</span>
    <p
      className={`text-gray-300 leading-relaxed whitespace-pre-wrap ${mono ? 'font-mono text-[11px]' : ''}`}
    >
      {value || <span className="text-gray-600 italic">not set</span>}
    </p>
  </div>
);

const BuilderError: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
    <span className="break-words">{message}</span>
  </div>
);
