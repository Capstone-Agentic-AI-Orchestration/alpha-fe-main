import type { ConversationItem } from './projectConversation';
import type { ChangeRequest, Contract, ProjectStage, RevisionClassification, RevisionRound, StageNextAction, StageResult, StageSummary } from './projectStages';

/**
 * Dev-only stand-in for the stage service, shared by the client and PM UI
 * previews so switching sides shows the same project. It follows the server's
 * rules closely enough to click through; the server stays the authority.
 * State lives in memory and resets on reload.
 */

type Actor = 'client' | 'pm';
interface PreviewState {
  stage: ProjectStage; revisionLimit: number; revisionsOffset: number; version: number; stageChangedAt: string;
  events: ConversationItem[]; contract: Contract | null;
  rounds: RevisionRound[]; requests: ChangeRequest[]; final: StageSummary['final'];
}

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
let state: PreviewState;

const SEED_STAGES: readonly ProjectStage[] = ['unset', 'poc', 'contract', 'development', 'completed'];

/**
 * A new project, or one already at a later stage with `?preview-stage=contract|development|completed|unset`
 * in the preview URL, so a stage can be inspected without clicking through the ones before it.
 */
function initial(): PreviewState {
  const base: PreviewState = { stage: 'poc', revisionLimit: 3, revisionsOffset: 0, version: 0, stageChangedAt: '2026-10-01T09:00:00+08:00',
    events: [], contract: null, rounds: [], requests: [], final: null };
  const asked = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('preview-stage');
  const stage = SEED_STAGES.find(item => item === asked);
  if (!stage || stage === 'poc') return base;
  if (stage === 'unset') return { ...base, stage };
  const at = '2026-10-02T09:00:00+08:00';
  const seeded: PreviewState = { ...base, stage };
  if (stage === 'contract' || stage === 'development') return seeded;
  return { ...seeded, final: { deliveredAt: at, note: '', acceptedAt: at, acceptedName: 'Alex Morgan' } };
}

/** Back to a project that has just started, as on page load. */
export function resetPreviewStage() { state = initial(); }

function fail(message: string): never {
  throw Object.assign(new Error(message), { status: 409 });
}

const START_ACTION: StageNextAction = { who: 'pm', kind: 'start_development', label: 'Start development after signing in person' };

function developmentAction(): StageNextAction {
  const round = activeRound();
  if (round?.status === 'open') return { who: 'client', kind: 'submit_round', label: `Send your feedback on build ${round.number}` };
  if (round?.status === 'submitted') return { who: 'pm', kind: 'classify_round', label: `Review feedback round ${round.number}` };
  const request = requestAction();
  if (request) return request;
  if (state.final && !state.final.acceptedAt) return { who: 'client', kind: 'accept_final', label: 'Review the final delivery' };
  return { who: 'pm', kind: 'share_build', label: 'Share the next build' };
}

function nextAction(): StageNextAction | null {
  switch (state.stage) {
    case 'unset': return { who: 'pm', kind: 'set_stage', label: 'Choose this project’s stage' };
    case 'poc': return START_ACTION;
    case 'contract': return START_ACTION;
    case 'development': return developmentAction();
    case 'completed': return requestAction();
  }
}

function requestAction(): StageNextAction | null {
  return state.requests.some(request => request.status === 'open') ? { who: 'pm', kind: 'answer_request', label: 'Answer a change request' } : null;
}
const activeRound = () => state.rounds.find(round => round.status !== 'classified') ?? null;
const used = () => state.revisionsOffset + state.rounds.filter(round => round.counts === true).length;

const LABEL: Record<ProjectStage, string> = {
  unset: 'Stage not set', poc: 'Proof of concept', contract: 'Proof of concept', development: 'Development', completed: 'Completed',
};

export function previewStageSummary(audience: Actor, clientId?: string): StageSummary {
  return {
    stage: state.stage, stageLabel: LABEL[state.stage], revisionLimit: state.revisionLimit, revisionsUsed: used(),
    version: state.version, stageChangedAt: state.stageChangedAt, nextAction: nextAction(),
    contract: state.contract, rounds: [...state.rounds].sort((a, b) => b.number - a.number),
    requests: state.requests, final: state.final,
    ...(audience === 'pm' && clientId ? { clientId } : {}),
  };
}

/** The stage events, as conversation items, for the preview timelines. */
export function previewStageEvents(): ConversationItem[] { return state.events; }

interface EventDetails { number?: number; name?: string; stage?: string; body?: string; decision?: string; title?: string; extra?: boolean }
function record(actor: Actor, action: string, refId: string | null, details: EventDetails = {}): StageResult {
  state.version += 1;
  const createdAt = now();
  state.events = [...state.events, { id: 'se:' + id(), kind: 'stage_event', author: actor, body: details.body ?? '', createdAt, request: null, task: null,
    stage: { action, refId, number: details.number ?? null, name: details.name ?? null, stage: details.stage ?? null,
      decision: details.decision ?? null, title: details.title ?? null, extra: details.extra === true } }];
  return { receipt: { operationId: id(), action, refId, version: state.version }, stage: previewStageSummary(actor, 'preview-northstar') };
}

function move(to: ProjectStage) { state.stage = to; state.stageChangedAt = now(); }

function round(roundId: string, status: RevisionRound['status']): RevisionRound {
  const found = state.rounds.find(item => item.id === roundId);
  if (state.stage !== 'development' || !found || found.status !== status) fail('This round changed. Refresh to see the latest.');
  return found;
}
const replaceRound = (next: RevisionRound) => { state.rounds = state.rounds.map(item => item.id === next.id ? next : item); };
function newRequest(roundId: string | null, title: string, description: string, requestedBy: Actor): ChangeRequest {
  const request: ChangeRequest = { id: id(), roundId, title, description, status: 'open', requestedBy, requestedAt: now(), reply: '', answeredAt: null };
  state.requests = [request, ...state.requests];
  return request;
}

export const previewStage = {
  shareBuild(note: string) {
    if (state.stage !== 'development' || activeRound()) fail('The client is still working on the last feedback round.');
    const number = state.rounds.length + 1;
    const opened: RevisionRound = { id: id(), number, status: 'open', buildNote: note, previewUrl: null, counts: null, extra: false,
      openedAt: now(), submittedAt: null, classifiedAt: null, items: [] };
    state.rounds = [...state.rounds, opened];
    if (state.final && !state.final.acceptedAt) state.final = null;
    return record('pm', 'build_shared', opened.id, { number });
  },
  saveRoundItems(roundId: string, items: string[]): StageSummary {
    const current = round(roundId, 'open');
    replaceRound({ ...current, items: items.map((body, position) => ({ id: id(), position, body, classification: null, pmNote: '' })) });
    state.version += 1;
    return previewStageSummary('client');
  },
  submitRound(roundId: string, acknowledgeExtra: boolean) {
    const current = round(roundId, 'open');
    if (!current.items.length) fail('Add at least one change before sending the round.');
    const extra = used() >= state.revisionLimit;
    if (extra && !acknowledgeExtra) fail(`Your ${state.revisionLimit} included revision rounds are used. This round costs additional; confirm to send it.`);
    replaceRound({ ...current, status: 'submitted', submittedAt: now(), extra });
    return record('client', 'round_submitted', roundId, { number: current.number, extra });
  },
  classifyRound(roundId: string, labels: Array<{ id: string; classification: RevisionClassification; pmNote: string }>) {
    const current = round(roundId, 'submitted');
    const byId = new Map(labels.map(item => [item.id, item]));
    if (current.items.some(item => !byId.has(item.id))) fail('Label every change in the round.');
    const items = current.items.map(item => ({ ...item, classification: byId.get(item.id)!.classification, pmNote: byId.get(item.id)!.pmNote }));
    for (const item of items) if (item.classification === 'out_of_scope') newRequest(roundId, item.body.slice(0, 120), item.body, 'pm');
    replaceRound({ ...current, items, status: 'classified', classifiedAt: now(), counts: items.some(item => item.classification === 'revision') });
    return record('pm', 'round_classified', roundId, { number: current.number });
  },
  requestChange(title: string, description: string) {
    if (state.stage !== 'development' && state.stage !== 'completed') fail('Change requests start once development has begun.');
    const request = newRequest(null, title, description, 'client');
    return record('client', 'request_made', request.id, { body: description ? `${title}\n\n${description}` : title });
  },
  answerRequest(requestId: string, decision: 'will_do' | 'wont_do', reply: string) {
    const request = state.requests.find(item => item.id === requestId && item.status === 'open');
    if (!request) fail('This request was already answered.');
    state.requests = state.requests.map(item => item.id === requestId ? { ...item, status: decision, reply, answeredAt: now() } : item);
    return record('pm', 'request_answered', requestId, { decision, title: request.title, body: reply });
  },
  markFinalDelivery(note: string) {
    if (state.stage !== 'development' || activeRound() || state.final) fail('Finish the open feedback round first.');
    state.final = { deliveredAt: now(), note, acceptedAt: null, acceptedName: null };
    return record('pm', 'final_delivered', null);
  },
  acceptFinal(fullName: string) {
    if (state.stage !== 'development' || !state.final || state.final.acceptedAt) fail('There is no final delivery waiting for you.');
    state.final = { ...state.final, acceptedAt: now(), acceptedName: fullName };
    move('completed');
    return record('client', 'final_accepted', null, { name: fullName });
  },
  setStartingStage(input: { stage: 'poc' | 'development' | 'completed'; revisionsUsed?: number; revisionLimit?: number }) {
    if (state.stage !== 'unset') fail('This project’s stage is already set.');
    state.revisionLimit = input.revisionLimit ?? 3;
    state.revisionsOffset = input.stage === 'development' ? input.revisionsUsed ?? 0 : 0;
    move(input.stage);
    return record('pm', 'stage_set', null, { stage: input.stage });
  },
  startDevelopment(revisionLimit: number) {
    if (state.stage !== 'poc' && state.stage !== 'contract') fail('Development has already started for this project.');
    state.revisionLimit = revisionLimit;
    move('development');
    return record('pm', 'development_started', null);
  },
};

// Last, so every constant the seed reads is defined.
state = initial();
