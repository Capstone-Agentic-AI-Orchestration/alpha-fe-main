import { loadFromStorage, saveToStorage } from '@/shared/lib/storage';
import { AgentDraft } from '@/features/agents/agentDraft';

/**
 * Agent creation that survives closing the dialog.
 *
 * The modal used to reset unconditionally on close, and `Modal` binds Escape to
 * close — so one keypress discarded the form, and after the builder landed, an
 * entire conversation with it. The daemon already keeps its half: the CLI's
 * resumable session is stored against the builder session id. What was missing
 * was the client remembering which session id it had been using.
 */

const STORAGE_KEY = 'agent_drafts';

export interface BuilderMessage {
  id: string;
  author: 'you' | 'builder';
  /** Prose only — the `<agent_draft>` block is stripped before it lands here. */
  text: string;
}

export interface StoredBuilderSession {
  /** What the daemon keys the CLI's own resumable session off. */
  sessionId: string;
  messages: BuilderMessage[];
}

export interface StoredDraftEntry {
  draft: AgentDraft;
  /** Present only when this draft came out of a builder conversation. */
  builder: StoredBuilderSession | null;
  updatedAt: string;
}

export interface AgentDraftStore {
  /** Keyed by {@link draftOwnerKey}. */
  byOwner: Record<string, StoredDraftEntry>;
}

const EMPTY_STORE: AgentDraftStore = { byOwner: {} };

export const BLANK_DRAFT_OWNER = 'blank';

/**
 * Drafts are keyed by what is being created, not stored one at a time.
 *
 * A blank agent and a copy of agent X are different pieces of work, and a copy
 * of X is not a copy of Y. A single slot would destroy one the moment the user
 * opened another, before they had typed anything. Only `blank` is reachable
 * today — duplicate-as-creation is the case this is shaped for.
 */
export function draftOwnerKey(duplicateId: string | null): string {
  return duplicateId ? `duplicate:${duplicateId}` : BLANK_DRAFT_OWNER;
}

export function loadDraftStore(): AgentDraftStore {
  const stored = loadFromStorage<AgentDraftStore>(STORAGE_KEY, EMPTY_STORE);
  // A store written by an older build may not have the map at all.
  return stored && typeof stored.byOwner === 'object' && stored.byOwner !== null
    ? stored
    : EMPTY_STORE;
}

/**
 * Whether two drafts would serialize identically — the autosave's "has anything
 * actually changed" test.
 *
 * Compared whole rather than field by field on purpose. An enumerated predicate
 * silently stops covering each field added to the draft after it was written,
 * and the failure is invisible, because the field saves fine as long as some
 * *other* field also differs.
 */
export function draftsEqual(a: AgentDraft, b: AgentDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Whether an entry is worth keeping.
 *
 * `baseline` is the freshly seeded draft, not an empty one: creation seeds the
 * runtime, its default model and the default skills on every visit, so
 * comparing against a blank object would store a draft for a form nobody
 * touched and leave a slot behind for every dialog ever opened.
 *
 * A conversation counts even when the draft is untouched — the transcript is
 * itself work the user would not want to lose.
 */
export function draftEntryHasContent(entry: StoredDraftEntry, baseline: AgentDraft): boolean {
  if ((entry.builder?.messages.length ?? 0) > 0) return true;
  return !draftsEqual(entry.draft, baseline);
}

/**
 * Writes one owner's entry without touching the others, and drops it entirely
 * when it holds nothing. Emptying the form therefore removes its slot rather
 * than parking a blank one.
 */
export function saveDraftEntry(
  owner: string,
  entry: StoredDraftEntry | null,
  baseline: AgentDraft
): AgentDraftStore {
  const store = loadDraftStore();
  const byOwner = { ...store.byOwner };

  if (entry && draftEntryHasContent(entry, baseline)) {
    byOwner[owner] = entry;
  } else {
    delete byOwner[owner];
  }

  const next = { byOwner };
  saveToStorage(STORAGE_KEY, next);
  return next;
}

export function clearDraftEntry(owner: string): AgentDraftStore {
  const store = loadDraftStore();
  if (!(owner in store.byOwner)) return store;

  const byOwner = { ...store.byOwner };
  delete byOwner[owner];
  const next = { byOwner };
  saveToStorage(STORAGE_KEY, next);
  return next;
}

/**
 * The draft to offer on re-entry, newest first.
 *
 * Returns one rather than a list: only `blank` can be written today, so a
 * chooser would be a question with one answer. When duplicate slots arrive this
 * is where the picker goes.
 */
export function mostRecentDraft(
  store: AgentDraftStore
): { owner: string; entry: StoredDraftEntry } | null {
  const entries = Object.entries(store.byOwner);
  if (entries.length === 0) return null;

  const [owner, entry] = entries.sort(
    ([, a], [, b]) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
  )[0];
  return { owner, entry };
}
