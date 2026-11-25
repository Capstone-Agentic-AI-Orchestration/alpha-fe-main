import type { ConversationItem } from './projectConversation';
import type { ChangeRequest, Contract, ContractTerms, ProjectStage, RevisionClassification, RevisionRound, StageNextAction, StageResult, StageSummary } from './projectStages';
import type { PmContractDraft } from './pmApi';

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
  if (stage === 'contract') return seeded;
  const terms: ContractTerms = { ...defaultTerms(3), scope: { title: 'Operations dashboard',
    summary: 'A web dashboard where the operations team tracks daily sales and stock.' }, deliverables: ['Daily sales chart', 'Low-stock alerts'] };
  const contract: Contract = { id: 'preview-contract-1', pocVersionId: null, status: 'countersigned', terms,
    contentHash: 'b'.repeat(64), createdAt: at, updatedAt: at, issuedAt: at, clientSignedName: 'Alex Morgan', clientSignedAt: at,
    pmSignedName: 'Pat Reyes', pmSignedAt: at };
  if (stage === 'development') return { ...seeded, contract };
  return { ...seeded, contract, final: { deliveredAt: at, note: '', acceptedAt: at, acceptedName: 'Alex Morgan' } };
}

/** Back to a project that has just started, as on page load. */
export function resetPreviewStage() { state = initial(); }

function fail(message: string): never {
  throw Object.assign(new Error(message), { status: 409 });
}

const POC_ACTION: StageNextAction = { who: 'pm', kind: 'complete_poc', label: 'Move to the contract when the client is ready' };

function contractAction(): StageNextAction {
  if (state.contract?.status === 'issued') return { who: 'client', kind: 'sign_contract', label: 'Sign the contract' };
  if (state.contract?.status === 'client_signed') return { who: 'pm', kind: 'countersign_contract', label: 'Countersign the contract' };
  return { who: 'pm', kind: 'issue_contract', label: 'Issue the contract' };
}

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
    case 'poc': return POC_ACTION;
    case 'contract': return contractAction();
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
  unset: 'Stage not set', poc: 'Proof of concept', contract: 'Contract', development: 'Development', completed: 'Completed',
};

export function previewStageSummary(audience: Actor, clientId?: string): StageSummary {
  return {
    stage: state.stage, stageLabel: LABEL[state.stage], revisionLimit: state.revisionLimit, revisionsUsed: used(),
    version: state.version, stageChangedAt: state.stageChangedAt, nextAction: nextAction(),
    contract: audience === 'client' && state.contract?.status === 'draft' ? null : state.contract, rounds: [...state.rounds].sort((a, b) => b.number - a.number),
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

const hash = () => (id() + id()).replace(/-/g, '').slice(0, 64);

function defaultTerms(limit: number): ContractTerms {
  return {
    projectName: 'Operations Dashboard', clientName: 'Northstar Demo Co.',
    scope: { title: 'Operations Dashboard', summary: '' }, deliverables: [], revisionLimit: limit, notes: '',
    clauses: [
      { title: 'Proof of Concept (POC) Stage', body: 'During the POC stage both parties discussed the proposed design, features and overall concept. This contract sets out the scope agreed at the end of that stage.' },
      { title: 'Contract Signing', body: 'Both parties sign this development contract, confirming the agreed scope, specifications, deliverables and terms.' },
      { title: 'Product Development Stage', body: `The developed product includes a maximum of ${limit} rounds of revisions based on the agreed scope. Fixing defects is not a revision. Further rounds cost additional and are billed separately.` },
      { title: 'Project Completion and Contract Closure', body: 'Upon completion, delivery and final acceptance of the agreed deliverables, this contract is considered closed.' },
      { title: 'Additional Requests After Contract Closure', body: 'New features or changes outside the agreed scope after closure are subject to additional charges, agreed separately before the work starts.' },
    ],
  };
}

function liveContract(contractId: string, status: Contract['status']): Contract {
  if (state.contract?.id !== contractId || state.contract.status !== status) fail('This contract changed. Refresh to see the latest.');
  return state.contract;
}

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
  saveContractDraft(input: PmContractDraft, clientId: string): StageSummary {
    if (state.stage !== 'contract') fail('The contract can only be prepared during the contract stage.');
    if (state.contract && state.contract.status !== 'draft') fail('The contract was already issued. Withdraw it first to change it.');
    const base = state.contract?.terms ?? defaultTerms(state.revisionLimit);
    const terms = { ...base, scope: input.scope ? { ...base.scope, ...input.scope } : base.scope, deliverables: input.deliverables ?? base.deliverables, clauses: input.clauses ?? base.clauses, notes: input.notes ?? base.notes };
    state.contract = { id: state.contract?.id ?? id(), pocVersionId: null, status: 'draft', terms, contentHash: null, createdAt: state.contract?.createdAt ?? now(),
      updatedAt: now(), issuedAt: null, clientSignedName: null, clientSignedAt: null, pmSignedName: null, pmSignedAt: null };
    state.version += 1;
    return previewStageSummary('pm', clientId);
  },
  issueContract(contractId: string) {
    const contract = liveContract(contractId, 'draft');
    state.contract = { ...contract, status: 'issued', issuedAt: now(), contentHash: hash() };
    return record('pm', 'contract_issued', contractId);
  },
  voidContract(contractId: string) {
    liveContract(contractId, 'issued');
    state.contract = null;
    return record('pm', 'contract_voided', contractId);
  },
  signContract(contractId: string, contentHash: string, fullName: string) {
    const contract = liveContract(contractId, 'issued');
    if (contract.contentHash !== contentHash) fail('The contract changed while you were reading it. Review the latest version.');
    state.contract = { ...contract, status: 'client_signed', clientSignedName: fullName, clientSignedAt: now() };
    return record('client', 'contract_signed', contractId, { name: fullName });
  },
  countersignContract(contractId: string, fullName: string) {
    const contract = liveContract(contractId, 'client_signed');
    state.contract = { ...contract, status: 'countersigned', pmSignedName: fullName, pmSignedAt: now() };
    move('development');
    return record('pm', 'contract_countersigned', contractId, { name: fullName });
  },
  setStartingStage(input: { stage: 'poc' | 'development' | 'completed'; revisionsUsed?: number; revisionLimit?: number }) {
    if (state.stage !== 'unset') fail('This project’s stage is already set.');
    state.revisionLimit = input.revisionLimit ?? 3;
    state.revisionsOffset = input.stage === 'development' ? input.revisionsUsed ?? 0 : 0;
    move(input.stage);
    return record('pm', 'stage_set', null, { stage: input.stage });
  },
  completePoc() {
    if (state.stage !== 'poc') fail('This project is not in the proof-of-concept stage.');
    move('contract');
    return record('pm', 'poc_completed', null);
  },
};

// Last, so every constant the seed reads is defined.
state = initial();
