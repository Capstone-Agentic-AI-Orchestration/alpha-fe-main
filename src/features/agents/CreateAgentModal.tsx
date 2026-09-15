import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/app/AppContext';
import { Modal } from '@/shared/components/Modal';
import { AgentRole, AgentAccessLevel, ReasoningEffort } from '@/shared/types';
import {
  providerOptions,
  modelsForRuntime,
  reasoningEffortsForRuntime,
  REASONING_EFFORT_HINTS,
  REASONING_EFFORT_LABELS
} from '@/shared/lib/providers';
import {
  AGENT_CONCURRENCY_MAX,
  AGENT_CONCURRENCY_MIN,
  AGENT_DESCRIPTION_MAX_LENGTH,
  AgentDraft,
  applyDraftModelChange,
  applyDraftRuntimeChange,
  buildCreateAgentRequest,
  clampConcurrency,
  draftFromOfficialTemplate,
  draftValidationError,
  seedAgentDraft,
  toggleDraftSkill
} from '@/features/agents/agentDraft';
import { OFFICIAL_AGENT_TEMPLATES, OfficialAgentTemplate } from '@/features/agents/officialAgentTemplates';
import { AgentBuilderPanel } from '@/features/agents/AgentBuilderPanel';
import {
  clearDraftEntry,
  draftOwnerKey,
  loadDraftStore,
  mostRecentDraft,
  saveDraftEntry,
  StoredBuilderSession
} from '@/features/agents/draftStore';
import { Sparkles, Bot, Wand2, ArrowRight, History, X, Layers } from 'lucide-react';

interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateAgentModal: React.FC<CreateAgentModalProps> = ({ isOpen, onClose }) => {
  const { createAgent, skills, runtimes } = useApp();

  // Mode: 'choice' (initial screen) | 'template' | 'blank' | 'ai'
  const [creationMode, setCreationMode] = useState<'choice' | 'template' | 'blank' | 'ai'>('choice');

  // The whole form is one draft, so seeding, validating and submitting it are
  // things the modal calls rather than things it implements.
  const [draft, setDraft] = useState<AgentDraft>(() => seedAgentDraft(runtimes, skills));

  // The builder conversation lives here rather than in the panel so that
  // closing the dialog does not take the session id with it.
  const [builderSession, setBuilderSession] = useState<StoredBuilderSession | null>(null);

  // Only `blank` is reachable until duplicate-as-creation exists, but the store
  // is keyed from the start — see draftOwnerKey.
  const owner = draftOwnerKey(null);
  const [saved, setSaved] = useState(() => mostRecentDraft(loadDraftStore()));

  // This modal is mounted for the life of the agents view, not built when it
  // opens, so its initial seed runs before the daemon has answered the runtime
  // and skill queries. Re-seed once those land — but only while the draft is
  // still unbound, so a scan finishing mid-edit cannot overwrite a choice.
  useEffect(() => {
    if (!draft.runtimeId) setDraft(seedAgentDraft(runtimes, skills));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimes, skills]);

  const runtimeChoices = useMemo(() => providerOptions(runtimes), [runtimes]);
  const detectedModels = useMemo(
    () => modelsForRuntime(runtimes, draft.runtimeId),
    [runtimes, draft.runtimeId]
  );
  const reasoningEfforts = useMemo(
    () => reasoningEffortsForRuntime(runtimes, draft.runtimeId, draft.modelName),
    [runtimes, draft.runtimeId, draft.modelName]
  );
  const validationError = draftValidationError(draft, runtimes);
  const descriptionLength = [...draft.description].length;

  /**
   * Autosave.
   *
   * The baseline is a freshly seeded draft, not an empty one: creation seeds a
   * runtime, its model and the default skills on every visit, so comparing
   * against a blank object would file a draft for a form nobody touched.
   *
   * Skipped while the chooser is up. Resuming sets the draft *and* the mode in
   * the same commit, but React renders them together — and on the very first
   * render after mount the mode is 'choice' with a seeded draft, which is
   * exactly the state that means "nothing to save".
   */
  useEffect(() => {
    if (creationMode === 'choice') return;
    saveDraftEntry(
      owner,
      { draft, builder: builderSession, updatedAt: new Date().toISOString() },
      seedAgentDraft(runtimes, skills)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, builderSession, creationMode]);

  const handleReset = () => {
    setCreationMode('choice');
    setDraft(seedAgentDraft(runtimes, skills));
    setBuilderSession(null);
    setSaved(mostRecentDraft(loadDraftStore()));
  };

  // Closing keeps the stored copy — that is the whole point. Only the in-memory
  // form is cleared, so reopening lands on the chooser with the draft offered.
  const handleClose = () => {
    handleReset();
    onClose();
  };

  const goToChoice = () => {
    setCreationMode('choice');
    setSaved(mostRecentDraft(loadDraftStore()));
  };

  const startBuilder = () => {
    setBuilderSession({
      sessionId: `builder-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      messages: []
    });
    setCreationMode('ai');
  };

  const startTemplate = (template: OfficialAgentTemplate) => {
    setDraft(draftFromOfficialTemplate(template, runtimes, skills));
    setBuilderSession(null);
    setCreationMode('blank');
  };

  const resumeDraft = () => {
    if (!saved) return;
    setDraft(saved.entry.draft);
    setBuilderSession(saved.entry.builder);
    setCreationMode(saved.entry.builder ? 'ai' : 'blank');
  };

  const discardDraft = () => {
    clearDraftEntry(owner);
    setSaved(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError) return;

    createAgent(buildCreateAgentRequest(draft, runtimes));
    // The draft became an agent, so the slot has nothing left to hold.
    clearDraftEntry(owner);
    handleClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Hire New Autonomous Agent"
      subtitle="Deploy a new persona into your orchestration cluster with specialized skills and runtime bindings."
      maxWidth={creationMode === 'ai' ? 'max-w-5xl' : 'max-w-2xl'}
    >
      {creationMode === 'choice' ? (
        /* Choice Screen: official role, blank form, or AI builder */
        <div className="space-y-4 py-2">
          {/* Offer the work left behind, on the one screen that would otherwise
              silently start over on top of it. */}
          {saved && (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-surface-200 px-4 py-3">
              <span className="flex w-8 h-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-gray-400">
                <History className="w-4 h-4" />
              </span>

              <button
                type="button"
                onClick={resumeDraft}
                className="min-w-0 flex-1 text-left group"
              >
                <div className="text-xs font-medium text-white truncate">
                  Continue {saved.entry.draft.name.trim() || 'your unfinished agent'}
                </div>
                <div className="text-[11px] text-gray-500 truncate">
                  {saved.entry.builder?.messages.length
                    ? `Conversation with ${saved.entry.builder.messages.length} messages`
                    : 'Saved configuration'}
                </div>
              </button>

              <button
                type="button"
                onClick={resumeDraft}
                className="flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors"
              >
                <span>Resume</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={discardDraft}
                className="p-1 rounded text-gray-500 hover:text-rose-400 transition-colors"
                title="Discard this draft"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="text-xs text-gray-300 font-medium">
            How would you like to configure your new agent?
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Option 1: Official role template */}
            <button
              type="button"
              onClick={() => setCreationMode('template')}
              className="p-5 rounded-2xl bg-surface-200 border border-brand-500/30 hover:border-brand-500/70 hover:bg-brand-500/10 transition-all text-left space-y-3 group"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-on-accent transition-colors">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white group-hover:text-brand-300">Use a Role Template</h4>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Start from one of the ten delivery roles, then tailor its runtime and instructions.
                </p>
              </div>
              <div className="text-xs text-brand-400 font-semibold flex items-center gap-1">
                <span>Choose a role</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>

            {/* Option 2: Start Blank */}
            <button
              type="button"
              onClick={() => setCreationMode('blank')}
              className="p-5 rounded-2xl bg-surface-200 border border-white/10 hover:border-brand-500/50 hover:bg-brand-500/5 transition-all text-left space-y-3 group"
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-on-accent group-hover:bg-brand-500 transition-colors">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white group-hover:text-brand-300">Start Blank</h4>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Fill in the configuration yourself with sensible default settings.
                </p>
              </div>
              <div className="text-xs text-brand-400 font-semibold flex items-center gap-1">
                <span>Configure Form</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>

            {/* Option 3: Build with AI */}
            <button
              type="button"
              onClick={startBuilder}
              className="p-5 rounded-2xl bg-surface-200 border border-brand-500/30 hover:border-brand-500/70 hover:bg-brand-500/10 transition-all text-left space-y-3 group shadow-glow-brand"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-on-accent transition-colors">
                <Wand2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-white group-hover:text-brand-300">Build with AI</h4>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300">Chat</span>
                </div>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Talk it through with a real agent. It writes the instructions, model and skills,
                  and you refine them turn by turn.
                </p>
              </div>
              <div className="text-xs text-brand-400 font-semibold flex items-center gap-1">
                <span>Open Builder</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>
          </div>
        </div>
      ) : creationMode === 'template' ? (
        <div className="space-y-4 py-2">
          <div>
            <h3 className="text-sm font-semibold text-white">Choose a delivery role</h3>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              Templates are editable starting points. Alpha uses the runtime installed on this machine rather than assuming a provider is available.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[56vh] overflow-y-auto pr-1">
            {OFFICIAL_AGENT_TEMPLATES.map((template) => (
              <button
                key={template.key}
                type="button"
                onClick={() => startTemplate(template)}
                className="rounded-xl border border-white/10 bg-surface-200 p-4 text-left transition-colors hover:border-brand-500/60 hover:bg-brand-500/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">{template.name}</div>
                    <div className="mt-1 text-xs leading-relaxed text-gray-400">{template.description}</div>
                  </div>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11px]">
                  <span className="rounded bg-white/5 px-2 py-1 font-medium text-gray-300">{template.phase}</span>
                  <span className="truncate text-gray-500">{template.expectedOutput}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="border-t border-white/10 pt-4">
            <button type="button" onClick={goToChoice} className="text-xs text-gray-400 hover:text-white">
              Back to options
            </button>
          </div>
        </div>
      ) : creationMode === 'ai' && builderSession ? (
        /* Conversational builder: chat left, the draft it edits right. */
        <AgentBuilderPanel
          draft={draft}
          onDraftChange={setDraft}
          session={builderSession}
          onSessionChange={setBuilderSession}
          runtimes={runtimes}
          skills={skills}
          onBack={goToChoice}
          onReview={() => setCreationMode('blank')}
        />
      ) : (
        /* Blank / Generated Form */
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Required: Name & Runtime */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Agent Name <span className="text-rose-400">* (Required)</span>
              </label>
              <input
                type="text"
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Sentinel Prime"
                className="w-full bg-surface-200 border border-white/10 rounded-lg px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                autoFocus
              />
            </div>

            {/* One picker, not two. A runtime IS its provider here, so offering
                a separate "machine" list only invited the two to disagree —
                the old one held four invented names and set nothing at all. */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Machine / Runtime <span className="text-rose-400">* (Required)</span>
              </label>
              {runtimeChoices.length === 0 ? (
                <p className="px-3 py-2 rounded-lg bg-surface-200 border border-amber-500/30 text-[11px] text-amber-300">
                  No runtimes detected. Scan for runtimes in Settings first.
                </p>
              ) : (
                <select
                  value={draft.runtimeId}
                  onChange={(e) => setDraft(applyDraftRuntimeChange(draft, runtimes, e.target.value))}
                  className="w-full bg-surface-200 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                >
                  {runtimeChoices.map(choice => (
                    <option key={choice.runtimeId} value={choice.runtimeId}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Description / Specialization */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>One-Line Specialization</span>
              <span
                className={`tabular-nums font-normal normal-case tracking-normal ${
                  descriptionLength > AGENT_DESCRIPTION_MAX_LENGTH ? 'text-rose-400' : 'text-gray-500'
                }`}
              >
                {descriptionLength}/{AGENT_DESCRIPTION_MAX_LENGTH}
              </span>
            </label>
            <input
              type="text"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="e.g. Fullstack TypeScript/Rust developer & reactive WebSockets engineer"
              className="w-full bg-surface-200 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Role, model and effort. Provider is not asked for — it follows the runtime. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Role
              </label>
              <select
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value as AgentRole })}
                className="w-full bg-surface-200 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="Architect">Architect</option>
                <option value="Coder">Coder</option>
                <option value="Reviewer">Reviewer</option>
                <option value="QA Tester">QA Tester</option>
                <option value="DevOps Engineer">DevOps Engineer</option>
                <option value="Researcher">Researcher</option>
                <option value="Triager">Triager</option>
                <option value="Research Agent">Research Agent</option>
                <option value="Architecture Agent">Architecture Agent</option>
                <option value="Manager Agent">Manager Agent</option>
                <option value="Database Agent">Database Agent</option>
                <option value="Backend Agent">Backend Agent</option>
                <option value="Frontend Agent">Frontend Agent</option>
                <option value="Mobile Agent">Mobile Agent</option>
                <option value="Security / Code Quality Agent">Security / Code Quality Agent</option>
                <option value="Validation / Checking Agent">Validation / Checking Agent</option>
                <option value="GitHub Finalization Agent">GitHub Finalization Agent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Model
              </label>
              {detectedModels.length === 0 ? (
                <input
                  type="text"
                  required
                  value={draft.modelName}
                  onChange={(e) => setDraft(applyDraftModelChange(draft, e.target.value))}
                  placeholder="no models detected — type an id"
                  className="w-full bg-surface-200 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                />
              ) : (
                <select
                  required
                  value={draft.modelName}
                  onChange={(e) => {
                    const modelName = e.target.value;
                    setDraft(
                      applyDraftModelChange(
                        draft,
                        modelName,
                        reasoningEffortsForRuntime(runtimes, draft.runtimeId, modelName)
                      )
                    );
                  }}
                  className="w-full bg-surface-200 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                >
                  {draft.modelName && !detectedModels.includes(draft.modelName) && (
                    <option value={draft.modelName}>{draft.modelName} (not detected)</option>
                  )}
                  {detectedModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Reasoning Effort
              </label>
              <select
                value={draft.reasoningEffort}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    reasoningEffort: e.target.value as ReasoningEffort | ''
                  })
                }
                className="w-full bg-surface-200 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="">Auto (runtime default)</option>
                {reasoningEfforts.map(effort => (
                  <option key={effort} value={effort}>
                    {REASONING_EFFORT_LABELS[effort]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] leading-snug text-gray-500">
                {reasoningEfforts.length
                  ? 'Higher effort can improve difficult tasks, with more latency or usage.'
                  : 'This runtime does not expose a separate effort flag; Auto keeps its native default.'}
              </p>
              {draft.reasoningEffort && (
                <p className="mt-1 text-[10px] text-gray-600">
                  {REASONING_EFFORT_HINTS[draft.reasoningEffort]}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Autonomy
              </label>
              <select
                value={draft.autonomyLevel}
                onChange={(e) => setDraft({ ...draft, autonomyLevel: e.target.value as AgentDraft['autonomyLevel'] })}
                className="w-full bg-surface-200 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="Supervised">Supervised</option>
                <option value="Semi-Autonomous (Requires Approval)">Semi-Autonomous</option>
                <option value="Full Autonomy">Full Autonomy</option>
              </select>
            </div>
          </div>

          {/* Access / Who can use them & Concurrency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Who Can Use This Agent?
              </label>
              <select
                value={draft.allowedUsers}
                onChange={(e) => setDraft({ ...draft, allowedUsers: e.target.value as AgentAccessLevel })}
                className="w-full bg-surface-200 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="everyone">Everyone in Workspace</option>
                <option value="team">Team Members Only</option>
                <option value="admins">Admins Only</option>
                <option value="private">Private (Only Me)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Concurrency Limit (Tasks)
              </label>
              <input
                type="number"
                min={AGENT_CONCURRENCY_MIN}
                max={AGENT_CONCURRENCY_MAX}
                value={draft.concurrencyLimit}
                // Clamped on blur rather than on every keystroke, so clearing
                // the field to retype it does not snap back to 1 mid-edit.
                onChange={(e) => setDraft({ ...draft, concurrencyLimit: parseInt(e.target.value, 10) })}
                onBlur={() => setDraft({ ...draft, concurrencyLimit: clampConcurrency(draft.concurrencyLimit) })}
                className="w-full bg-surface-200 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              System Instructions
            </label>
            <textarea
              rows={3}
              value={draft.systemPrompt}
              onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })}
              className="w-full bg-surface-200 border border-white/10 rounded-lg p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          {/* Skills Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Attached Skills & MCP Tools ({draft.skillIds.length} selected)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto p-1 bg-surface-300/60 rounded-lg border border-white/5">
              {skills.length === 0 ? (
                <p className="p-2 text-[11px] text-gray-500 italic">
                  No skills reported by the daemon yet.
                </p>
              ) : (
                skills.map((skill) => {
                  const isChecked = draft.skillIds.includes(skill.id);
                  return (
                    <button
                      type="button"
                      key={skill.id}
                      onClick={() => setDraft(toggleDraftSkill(draft, skill.id))}
                      className={`flex items-start gap-2.5 p-2 rounded-lg text-left text-xs transition-all border ${
                        isChecked
                          ? 'bg-brand-500/20 text-white border-brand-500/40'
                          : 'bg-surface-200 text-gray-400 border-transparent hover:border-white/10'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        className="mt-0.5 accent-brand-500 rounded"
                      />
                      <div className="truncate">
                        <div className="font-medium text-white truncate">{skill.name}</div>
                        <div className="text-[10px] text-gray-400 capitalize">{skill.category}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={goToChoice}
              className="text-xs text-gray-400 hover:text-white"
            >
              ← Back to options
            </button>
            <div className="flex items-center gap-3">
              {/* Say why the button is dead instead of leaving the user to
                  guess which of eight fields is the problem. */}
              {validationError && draft.name.trim() && (
                <span className="text-[11px] text-amber-300">{validationError}</span>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!!validationError}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-on-accent shadow-glow-brand transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-4 h-4" />
                <span>Deploy Agent</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};
