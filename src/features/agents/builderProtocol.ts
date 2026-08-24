import { AgentAccessLevel, AgentRole, Skill } from '@/shared/types';
import { AgentDraft, AGENT_DESCRIPTION_MAX_LENGTH } from '@/features/agents/agentDraft';

/**
 * Wire format between the agent builder UI and the hidden builder agent.
 *
 * Two asymmetric directions:
 *   - Outbound, the composer's plain text is wrapped in a JSON envelope that
 *     also carries the current draft and the catalogs the builder may pick ids
 *     from, so every turn re-states the full decision context.
 *   - Inbound, the builder appends one `<agent_draft>` JSON block to its natural
 *     language reply; the block updates the form and is stripped before the
 *     message is rendered.
 *
 * Both directions are parsed defensively: a CLI-backed model can emit slightly
 * malformed JSON, and a draft that fails to parse must degrade to "no form
 * update" rather than breaking the conversation.
 */

const BUILDER_INPUT_PREFIX = 'ALPHA_AGENT_BUILDER_INPUT\n';

const AGENT_ROLES: AgentRole[] = [
  'Architect',
  'Coder',
  'Reviewer',
  'QA Tester',
  'DevOps Engineer',
  'Researcher',
  'Triager'
];

const ACCESS_LEVELS: AgentAccessLevel[] = ['everyone', 'team', 'admins', 'private'];

export interface BuilderDraftPayload {
  name?: unknown;
  description?: unknown;
  instructions?: unknown;
  role?: unknown;
  model?: unknown;
  skill_ids?: unknown;
  access?: unknown;
}

export function encodeBuilderInput(
  request: string,
  draft: AgentDraft,
  skills: Skill[],
  models: string[]
): string {
  return (
    BUILDER_INPUT_PREFIX +
    JSON.stringify(
      {
        user_request: request,
        current_draft: {
          name: draft.name,
          description: draft.description,
          instructions: draft.systemPrompt,
          role: draft.role,
          model: draft.modelName,
          skill_ids: [...draft.skillIds],
          access: draft.allowedUsers
        },
        available_models: models,
        available_skills: skills.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description
        })),
        constraints: {
          description_max_length: AGENT_DESCRIPTION_MAX_LENGTH,
          roles: AGENT_ROLES,
          access_levels: ACCESS_LEVELS
        }
      },
      null,
      2
    )
  );
}

/** Recovers what the person actually typed, for redisplay in the transcript. */
export function decodeBuilderInput(content: string): string {
  if (!content.startsWith(BUILDER_INPUT_PREFIX)) return content;
  try {
    const parsed = JSON.parse(content.slice(BUILDER_INPUT_PREFIX.length)) as {
      user_request?: unknown;
    };
    return typeof parsed.user_request === 'string' ? parsed.user_request : content;
  } catch {
    return content;
  }
}

export function parseBuilderDraft(content: string): BuilderDraftPayload | null {
  const match = content.match(/<agent_draft>([\s\S]*?)<\/agent_draft>/);
  if (!match?.[1]) return null;
  try {
    const value = JSON.parse(match[1]);
    return value && typeof value === 'object' ? (value as BuilderDraftPayload) : null;
  } catch {
    // Some CLI-backed models emit literal newlines in the Markdown
    // instructions string even when asked for compact JSON. Repair only JSON
    // control characters that occur inside strings; object structure and all
    // other syntax still have to pass JSON.parse.
    try {
      const value = JSON.parse(escapeJsonStringControlCharacters(match[1]));
      return value && typeof value === 'object' ? (value as BuilderDraftPayload) : null;
    } catch {
      return null;
    }
  }
}

function escapeJsonStringControlCharacters(value: string): string {
  let result = '';
  let inString = false;
  let escaped = false;

  for (const character of value) {
    if (!inString) {
      result += character;
      if (character === '"') inString = true;
      continue;
    }
    if (escaped) {
      result += character;
      escaped = false;
      continue;
    }
    if (character === '\\') {
      result += character;
      escaped = true;
      continue;
    }
    if (character === '"') {
      result += character;
      inString = false;
      continue;
    }
    if (character === '\n') {
      result += '\\n';
    } else if (character === '\r') {
      result += '\\r';
    } else if (character === '\t') {
      result += '\\t';
    } else {
      result += character;
    }
  }

  return result;
}

/**
 * Removes the structured block from a reply before a human reads it. The block
 * is machinery — it drives the configuration form — and the form is where its
 * effect is already visible, so the transcript keeps only the prose.
 *
 * Two patterns, not one. The closed form is what a finished reply holds. The
 * unclosed one is what a partial reply produces: if the CLI is cut off, or the
 * response is truncated mid-block, there is an opening tag and no closing tag,
 * which the closed-form pattern cannot match — and the raw payload would be
 * shown to the reader instead.
 *
 * The leading `\s*` takes the whitespace the model left between its prose and
 * the block, so removing it does not strand a blank line.
 */
export function stripBuilderDraft(content: string): string {
  return content
    .replace(/\s*<agent_draft>[\s\S]*?<\/agent_draft>/g, '')
    .replace(/\s*<agent_draft>[\s\S]*$/, '')
    .trim();
}

/**
 * Folds one builder payload into the draft.
 *
 * Every id is checked against a catalog before it is accepted, so a model that
 * hallucinates `sk-kubernetes` or a model name from its training data changes
 * nothing rather than producing an agent that cannot start. Fields it did not
 * send are left exactly as they were — a reply about the name must not silently
 * reset the skills.
 */
export function mergeBuilderDraft(
  current: AgentDraft,
  payload: BuilderDraftPayload,
  validSkillIds: Set<string>,
  validModelIds: Set<string>
): AgentDraft {
  const role = AGENT_ROLES.includes(payload.role as AgentRole)
    ? (payload.role as AgentRole)
    : current.role;

  const allowedUsers = ACCESS_LEVELS.includes(payload.access as AgentAccessLevel)
    ? (payload.access as AgentAccessLevel)
    : current.allowedUsers;

  const skillIds = Array.isArray(payload.skill_ids)
    ? payload.skill_ids.filter(
        (id): id is string => typeof id === 'string' && validSkillIds.has(id)
      )
    : [...current.skillIds];

  // The current value may be a deliberate entry the user typed for a runtime
  // that reported no catalog, so preserving it is always safe. Only catalog
  // ids may be introduced by the builder; failed discovery therefore cannot
  // turn into fail-open input.
  const modelName =
    typeof payload.model === 'string' &&
    (payload.model === current.modelName ||
      (validModelIds.size > 0 && validModelIds.has(payload.model)))
      ? payload.model
      : current.modelName;

  return {
    ...current,
    name: typeof payload.name === 'string' ? payload.name : current.name,
    // Truncated rather than rejected: the builder writing one character too
    // many should not leave the whole reply unable to touch the form.
    description:
      typeof payload.description === 'string'
        ? [...payload.description].slice(0, AGENT_DESCRIPTION_MAX_LENGTH).join('')
        : current.description,
    systemPrompt:
      typeof payload.instructions === 'string' ? payload.instructions : current.systemPrompt,
    role,
    modelName,
    skillIds,
    allowedUsers
  };
}
