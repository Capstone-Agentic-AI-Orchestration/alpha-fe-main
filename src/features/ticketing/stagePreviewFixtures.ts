import type { ConversationItem } from './projectConversation';
import type { PocVersion, ProjectStage, StageNextAction, StageResult, StageSummary } from './projectStages';
import type { PmPocDraft } from './pmApi';

/**
 * Dev-only stand-in for the stage service, shared by the client and PM UI
 * previews so switching sides shows the same project. It follows the server's
 * rules closely enough to click through; the server stays the authority.
 * State lives in memory and resets on reload.
 */

type Actor = 'client' | 'pm';
interface PreviewState {
  stage: ProjectStage; revisionLimit: number; revisionsOffset: number; version: number; stageChangedAt: string;
  pocs: PocVersion[]; events: ConversationItem[];
}

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
let state: PreviewState = initial();

function initial(): PreviewState {
  return { stage: 'poc', revisionLimit: 3, revisionsOffset: 0, version: 0, stageChangedAt: '2026-10-01T09:00:00+08:00', pocs: [], events: [] };
}

/** Back to a project that has just started, as on page load. */
export function resetPreviewStage() { state = initial(); }

function fail(message: string): never {
  throw Object.assign(new Error(message), { status: 409 });
}

const latestPublished = () => state.pocs.filter(poc => poc.status !== 'draft').sort((a, b) => b.number - a.number)[0] ?? null;

function nextAction(): StageNextAction | null {
  const poc = latestPublished();
  switch (state.stage) {
    case 'unset': return { who: 'pm', kind: 'set_stage', label: 'Choose this project’s stage' };
    case 'poc':
      if (poc?.status === 'published') return { who: 'client', kind: 'review_poc', label: `Review POC v${poc.number}` };
      if (poc?.status === 'changes_requested') return { who: 'pm', kind: 'publish_poc', label: `Update the POC after the change request on v${poc.number}` };
      return { who: 'pm', kind: 'publish_poc', label: 'Share the proof of concept' };
    case 'contract': return { who: 'pm', kind: 'issue_contract', label: 'Issue the contract' };
    case 'development': return { who: 'pm', kind: 'share_build', label: 'Share the next build' };
    case 'completed': return null;
  }
}

const LABEL: Record<ProjectStage, string> = {
  unset: 'Stage not set', poc: 'Proof of concept', contract: 'Contract', development: 'Development', completed: 'Completed',
};

export function previewStageSummary(audience: Actor, clientId?: string): StageSummary {
  const published = state.pocs.filter(poc => poc.status !== 'draft').sort((a, b) => b.number - a.number);
  return {
    stage: state.stage, stageLabel: LABEL[state.stage], revisionLimit: state.revisionLimit, revisionsUsed: state.revisionsOffset,
    version: state.version, stageChangedAt: state.stageChangedAt, nextAction: nextAction(),
    poc: published[0] ?? null, pocDraft: audience === 'pm' ? state.pocs.find(poc => poc.status === 'draft') ?? null : null,
    pocHistory: published.map(poc => ({ id: poc.id, number: poc.number, status: poc.status, publishedAt: poc.publishedAt })),
    contract: null, rounds: [], quotes: [], final: null,
    ...(audience === 'pm' && clientId ? { clientId } : {}),
  };
}

/** The stage events, as conversation items, for the preview timelines. */
export function previewStageEvents(): ConversationItem[] { return state.events; }

function record(actor: Actor, action: string, refId: string | null, extra: { number?: number; name?: string; stage?: string; body?: string } = {}): StageResult {
  state.version += 1;
  const createdAt = now();
  state.events = [...state.events, { id: 'se:' + id(), kind: 'stage_event', author: actor, body: extra.body ?? '', createdAt, request: null, task: null,
    stage: { action, refId, number: extra.number ?? null, name: extra.name ?? null, stage: extra.stage ?? null } }];
  return { receipt: { operationId: id(), action, refId, version: state.version }, stage: previewStageSummary(actor, 'preview-northstar') };
}

function move(to: ProjectStage) { state.stage = to; state.stageChangedAt = now(); }

export const previewStage = {
  setStartingStage(input: { stage: 'poc' | 'development' | 'completed'; revisionsUsed?: number; revisionLimit?: number }) {
    if (state.stage !== 'unset') fail('This project’s stage is already set.');
    state.revisionLimit = input.revisionLimit ?? 3;
    state.revisionsOffset = input.stage === 'development' ? input.revisionsUsed ?? 0 : 0;
    move(input.stage);
    return record('pm', 'stage_set', null, { stage: input.stage });
  },
  savePocDraft(draft: PmPocDraft, clientId: string): StageSummary {
    if (state.stage !== 'poc') fail('The proof of concept can only change during the POC stage.');
    const existing = state.pocs.find(poc => poc.status === 'draft');
    const number = existing?.number ?? Math.max(0, ...state.pocs.map(poc => poc.number)) + 1;
    const saved: PocVersion = { id: existing?.id ?? id(), number, status: 'draft', ...draft, contentHash: null,
      createdAt: existing?.createdAt ?? now(), updatedAt: now(), publishedAt: null, approvedAt: null, approvedName: null, changeRequest: null };
    state.pocs = [...state.pocs.filter(poc => poc.id !== saved.id), saved];
    state.version += 1;
    return previewStageSummary('pm', clientId);
  },
  publishPoc(pocId: string) {
    const draft = state.pocs.find(poc => poc.id === pocId && poc.status === 'draft');
    if (state.stage !== 'poc' || !draft) fail('This draft was already shared. Refresh to see the latest version.');
    state.pocs = state.pocs.map(poc => {
      if (poc.id === pocId) return { ...poc, status: 'published' as const, publishedAt: now(), contentHash: id().replace(/-/g, '').padEnd(64, '0').slice(0, 64) };
      return poc.status === 'published' || poc.status === 'changes_requested' ? { ...poc, status: 'superseded' as const } : poc;
    });
    return record('pm', 'poc_published', pocId, { number: draft.number });
  },
  requestPocChanges(pocId: string, body: string) {
    const poc = state.pocs.find(item => item.id === pocId && item.status === 'published');
    if (state.stage !== 'poc' || !poc) fail('This version is no longer the one waiting for review. Refresh to see the latest.');
    const createdAt = now();
    state.pocs = state.pocs.map(item => item.id === pocId ? { ...item, status: 'changes_requested' as const, changeRequest: { body, createdAt } } : item);
    return record('client', 'poc_changes_requested', pocId, { number: poc.number, body });
  },
  approvePoc(pocId: string, contentHash: string, fullName: string) {
    const poc = state.pocs.find(item => item.id === pocId && item.status === 'published');
    if (state.stage !== 'poc' || !poc) fail('This version is no longer the one waiting for review. Refresh to see the latest.');
    if (poc.contentHash !== contentHash) fail('The proof of concept changed while you were reading it. Review the latest version.');
    state.pocs = state.pocs.filter(item => item.status !== 'draft')
      .map(item => item.id === pocId ? { ...item, status: 'approved' as const, approvedAt: now(), approvedName: fullName } : item);
    move('contract');
    return record('client', 'poc_approved', pocId, { number: poc.number, name: fullName });
  },
};
