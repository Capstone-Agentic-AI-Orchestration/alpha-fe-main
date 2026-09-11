import { Agent, AgentAccessLevel, AgentAutonomyLevel, AgentRole, RuntimeEngine, Skill } from '@/shared/types';
import { OfficialAgentTemplate } from '@/features/agents/officialAgentTemplates';
import {
  defaultModelForRuntime,
  modelsForRuntime,
  preferredRuntimeId,
  providerForRuntime,
  runtimeOption
} from '@/shared/lib/providers';
import { agentAvatarDataUri, agentColor } from '@/shared/lib/avatar';

/**
 * The in-progress configuration of an agent being created.
 *
 * Creation used to be fourteen `useState` calls inside the modal, which meant
 * the validation, the defaults and the submit payload all lived in the same
 * component as the markup — nothing could seed a draft, check one, or submit
 * one without rendering the modal. Splitting it out is what lets the AI builder
 * and (later) duplicate-an-agent reuse the same field set, the same cascade
 * rules and the same request shape.
 */
export interface AgentDraft {
  name: string;
  description: string;
  role: AgentRole;
  /** What the daemon dispatches on. `modelProvider` is derived from it. */
  runtimeId: string;
  modelName: string;
  systemPrompt: string;
  autonomyLevel: AgentAutonomyLevel;
  allowedUsers: AgentAccessLevel;
  concurrencyLimit: number;
  skillIds: string[];
}

/**
 * Mirrors the cap the daemon enforces in `dataController`. Duplicated rather
 * than imported because the two apps share no package — keep them in step.
 */
export const AGENT_DESCRIPTION_MAX_LENGTH = 255;

export const AGENT_CONCURRENCY_MIN = 1;
export const AGENT_CONCURRENCY_MAX = 10;

export const DEFAULT_SYSTEM_PROMPT =
  'You are an autonomous engineering specialist. Focus on high precision, defensive programming, clean code, and comprehensive validation.';

/** Attached by default when the daemon reports them — see {@link keepKnownSkills}. */
const PREFERRED_DEFAULT_SKILLS = ['sk-fs', 'sk-code-exec', 'sk-bash'];

export const EMPTY_AGENT_DRAFT: AgentDraft = {
  name: '',
  description: '',
  role: 'Coder',
  runtimeId: '',
  modelName: '',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  autonomyLevel: 'Semi-Autonomous (Requires Approval)',
  allowedUsers: 'team',
  concurrencyLimit: 2,
  skillIds: []
};

/**
 * Drops skill ids the workspace does not actually have.
 *
 * The defaults and the AI generator both name ids literally, and the daemon
 * seeds only five skills — `sk-mcp-postgres`, `sk-docker` and `sk-cloud` are
 * not among them. Without this filter an agent is created holding skills that
 * appear nowhere in the picker, so they cannot be seen or removed.
 */
export function keepKnownSkills(skillIds: string[], skills: Skill[]): string[] {
  const known = new Set(skills.map(s => s.id));
  return skillIds.filter(id => known.has(id));
}

/** A fresh draft, seeded from what the runtime scan actually found. */
export function seedAgentDraft(runtimes: RuntimeEngine[], skills: Skill[]): AgentDraft {
  const runtimeId = preferredRuntimeId(runtimes);
  return {
    ...EMPTY_AGENT_DRAFT,
    runtimeId,
    modelName: defaultModelForRuntime(runtimes, runtimeId),
    skillIds: keepKnownSkills(PREFERRED_DEFAULT_SKILLS, skills)
  };
}

/**
 * Converts an official role into a normal, fully editable creation draft.
 * Runtime and model are intentionally taken from the machine scan rather than
 * hard-coding a provider: a Codex-shaped role remains useful on a machine
 * where only another installed runtime is currently available.
 */
export function draftFromOfficialTemplate(
  template: OfficialAgentTemplate,
  runtimes: RuntimeEngine[],
  skills: Skill[]
): AgentDraft {
  // The official roles are authored for the local Codex workflow. Prefer it
  // when it is actually online, but never bind a template to a missing or
  // signed-out CLI: the normal runtime preference remains the safe fallback.
  const codexRuntime = runtimeOption(runtimes, 'codex');
  const runtimeId = codexRuntime?.available ? 'codex' : preferredRuntimeId(runtimes);
  return {
    ...EMPTY_AGENT_DRAFT,
    name: template.name,
    description: template.description,
    role: template.role,
    runtimeId,
    modelName: defaultModelForRuntime(runtimes, runtimeId),
    systemPrompt: template.systemPrompt,
    autonomyLevel: template.autonomyLevel,
    skillIds: keepKnownSkills(template.preferredSkillIds, skills)
  };
}

/**
 * Runtime change: the model belonged to the old runtime's catalog, so it is
 * re-seeded rather than carried across. Keeping it would let an agent be
 * created with, say, a Claude model id bound to the Ollama runtime — which the
 * daemon resolves at dispatch time by silently falling back to something else.
 */
export function applyDraftRuntimeChange(
  draft: AgentDraft,
  runtimes: RuntimeEngine[],
  runtimeId: string
): AgentDraft {
  if (runtimeId === draft.runtimeId) return draft;
  return { ...draft, runtimeId, modelName: defaultModelForRuntime(runtimes, runtimeId) };
}

export function applyDraftModelChange(draft: AgentDraft, modelName: string): AgentDraft {
  if (modelName === draft.modelName) return draft;
  return { ...draft, modelName };
}

export function toggleDraftSkill(draft: AgentDraft, skillId: string): AgentDraft {
  return {
    ...draft,
    skillIds: draft.skillIds.includes(skillId)
      ? draft.skillIds.filter(id => id !== skillId)
      : [...draft.skillIds, skillId]
  };
}

export function clampConcurrency(value: number): number {
  if (!Number.isFinite(value)) return EMPTY_AGENT_DRAFT.concurrencyLimit;
  return Math.min(AGENT_CONCURRENCY_MAX, Math.max(AGENT_CONCURRENCY_MIN, Math.round(value)));
}

/**
 * The reason this draft cannot be submitted, or null when it can.
 *
 * Counted with the spread so an emoji or accented character costs what the
 * daemon charges it, not what `.length` does.
 */
export function draftValidationError(draft: AgentDraft, runtimes: RuntimeEngine[]): string | null {
  if (!draft.name.trim()) return 'Give the agent a name.';
  if ([...draft.description].length > AGENT_DESCRIPTION_MAX_LENGTH) {
    return `Description is over ${AGENT_DESCRIPTION_MAX_LENGTH} characters.`;
  }
  if (!draft.runtimeId) return 'No runtime detected — scan for runtimes first.';
  if (!draft.modelName.trim()) return 'Pick a model.';

  // A typed id is allowed only where discovery came back empty; if the runtime
  // did report a catalog, an id outside it is a typo the daemon would reject.
  const detected = modelsForRuntime(runtimes, draft.runtimeId);
  if (detected.length > 0 && !detected.includes(draft.modelName)) {
    return `${draft.modelName} is not one of the models detected for this runtime.`;
  }
  return null;
}

/** The `createAgent` payload. Provider, machine and avatar are all derived. */
export function buildCreateAgentRequest(
  draft: AgentDraft,
  runtimes: RuntimeEngine[]
): Omit<Agent, 'id' | 'stats' | 'status'> {
  const runtime = runtimeOption(runtimes, draft.runtimeId);
  const name = draft.name.trim();
  const color = agentColor(name);

  return {
    name,
    description: draft.description.trim() || `${draft.role} specialist configured for autonomous task execution.`,
    role: draft.role,
    owner: 'You',
    isMine: true,
    allowedUsers: draft.allowedUsers,
    machineStatus: runtime?.available ? 'online' : 'offline',
    workStatus: 'idle',
    // The machine label is the runtime's own name, so the roster cannot claim
    // an agent runs somewhere it was never bound to.
    machineName: runtime?.label ?? 'Unbound runtime',
    lastActive: 'Just now',
    isArchived: false,
    concurrencyLimit: clampConcurrency(draft.concurrencyLimit),
    avatar: agentAvatarDataUri(name, color),
    color,
    modelProvider: providerForRuntime(runtimes, draft.runtimeId) ?? 'Anthropic',
    modelName: draft.modelName.trim(),
    runtimeId: draft.runtimeId,
    systemPrompt: draft.systemPrompt.trim(),
    autonomyLevel: draft.autonomyLevel,
    temperature: 0.2,
    skills: draft.skillIds,
    envVars: [],
    mcpServers: ['filesystem', 'bash'],
    customCliArgs: ''
  };
}
