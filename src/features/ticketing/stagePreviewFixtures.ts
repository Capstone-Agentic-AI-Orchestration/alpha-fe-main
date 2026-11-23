import type { ConversationItem } from './projectConversation';
import type { Contract, ContractTerms, PocVersion, ProjectStage, Quote, RevisionClassification, RevisionRound, StageNextAction, StageResult, StageSummary } from './projectStages';
import type { PmContractDraft, PmPocDraft } from './pmApi';

/**
 * Dev-only stand-in for the stage service, shared by the client and PM UI
 * previews so switching sides shows the same project. It follows the server's
 * rules closely enough to click through; the server stays the authority.
 * State lives in memory and resets on reload.
 */

type Actor = 'client' | 'pm';
interface PreviewState {
  stage: ProjectStage; revisionLimit: number; revisionsOffset: number; version: number; stageChangedAt: string;
  pocs: PocVersion[]; events: ConversationItem[]; contract: Contract | null;
  rounds: RevisionRound[]; quotes: Quote[]; final: StageSummary['final'];
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
    pocs: [], events: [], contract: null, rounds: [], quotes: [], final: null };
  const asked = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('preview-stage');
  const stage = SEED_STAGES.find(item => item === asked);
  if (!stage || stage === 'poc') return base;
  if (stage === 'unset') return { ...base, stage };
  const at = '2026-10-02T09:00:00+08:00';
  const poc: PocVersion = { id: 'preview-poc-1', number: 1, status: 'approved', title: 'Operations dashboard',
    summary: 'A web dashboard where the operations team tracks daily sales and stock.',
    features: [{ title: 'Daily sales chart', detail: 'By store and by day' }, { title: 'Low-stock alerts', detail: '' }],
    screens: ['Overview', 'Stock'], outOfScope: 'Payments', note: '', contentHash: 'a'.repeat(64), createdAt: at, updatedAt: at, publishedAt: at,
    approvedAt: at, approvedName: 'Alex Morgan', changeRequest: null };
  const seeded: PreviewState = { ...base, stage, pocs: [poc] };
  if (stage === 'contract') return seeded;
  const contract: Contract = { id: 'preview-contract-1', pocVersionId: poc.id, status: 'countersigned', terms: defaultTerms(poc, 3),
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

const latestPublished = () => state.pocs.filter(poc => poc.status !== 'draft').sort((a, b) => b.number - a.number)[0] ?? null;

function nextAction(): StageNextAction | null {
  const poc = latestPublished();
  switch (state.stage) {
    case 'unset': return { who: 'pm', kind: 'set_stage', label: 'Choose this project’s stage' };
    case 'poc':
      if (poc?.status === 'published') return { who: 'client', kind: 'review_poc', label: `Review POC v${poc.number}` };
      if (poc?.status === 'changes_requested') return { who: 'pm', kind: 'publish_poc', label: `Update the POC after the change request on v${poc.number}` };
      return { who: 'pm', kind: 'publish_poc', label: 'Share the proof of concept' };
    case 'contract':
      if (state.contract?.status === 'issued') return { who: 'client', kind: 'sign_contract', label: 'Sign the contract' };
      if (state.contract?.status === 'client_signed') return { who: 'pm', kind: 'countersign_contract', label: 'Countersign the contract' };
      return { who: 'pm', kind: 'issue_contract', label: 'Issue the contract' };
    case 'development': {
      const quote = quoteAction();
      if (quote) return quote;
      const round = activeRound();
      if (round?.status === 'open') return { who: 'client', kind: 'submit_round', label: `Send your feedback on build ${round.number}` };
      if (round?.status === 'submitted') return { who: 'pm', kind: 'classify_round', label: `Review feedback round ${round.number}` };
      if (state.final && !state.final.acceptedAt) return { who: 'client', kind: 'accept_final', label: 'Review the final delivery' };
      return { who: 'pm', kind: 'share_build', label: 'Share the next build' };
    }
    case 'completed': return quoteAction();
  }
}

function quoteAction(): StageNextAction | null {
  if (state.quotes.some(quote => quote.status === 'requested')) return { who: 'pm', kind: 'send_quote', label: 'Send a quote' };
  if (state.quotes.some(quote => quote.status === 'sent')) return { who: 'client', kind: 'decide_quote', label: 'Review the quote' };
  return null;
}
const activeRound = () => state.rounds.find(round => round.status !== 'classified') ?? null;
const used = () => state.revisionsOffset + state.rounds.filter(round => round.counts === true && !round.paid).length;

const LABEL: Record<ProjectStage, string> = {
  unset: 'Stage not set', poc: 'Proof of concept', contract: 'Contract', development: 'Development', completed: 'Completed',
};

export function previewStageSummary(audience: Actor, clientId?: string): StageSummary {
  const published = state.pocs.filter(poc => poc.status !== 'draft').sort((a, b) => b.number - a.number);
  return {
    stage: state.stage, stageLabel: LABEL[state.stage], revisionLimit: state.revisionLimit, revisionsUsed: used(),
    version: state.version, stageChangedAt: state.stageChangedAt, nextAction: nextAction(),
    poc: published[0] ?? null, pocDraft: audience === 'pm' ? state.pocs.find(poc => poc.status === 'draft') ?? null : null,
    pocHistory: published.map(poc => ({ id: poc.id, number: poc.number, status: poc.status, publishedAt: poc.publishedAt })),
    contract: audience === 'client' && state.contract?.status === 'draft' ? null : state.contract, rounds: [...state.rounds].sort((a, b) => b.number - a.number),
    quotes: state.quotes.map(quote => audience === 'client' && quote.status === 'requested' ? { ...quote, amount: null } : quote), final: state.final,
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

const hash = () => (id() + id()).replace(/-/g, '').slice(0, 64);

function defaultTerms(poc: PocVersion, limit: number): ContractTerms {
  return {
    projectName: 'Operations Dashboard', clientName: 'Northstar Demo Co.',
    scope: { pocNumber: poc.number, title: poc.title, summary: poc.summary, features: poc.features, screens: poc.screens, outOfScope: poc.outOfScope },
    deliverables: poc.features.map(feature => feature.title), revisionLimit: limit, notes: '',
    clauses: [
      { title: 'Proof of Concept (POC) Stage', body: `Unlimited revisions were allowed during the POC stage. This contract is based on POC version ${poc.number}, which the client approved.` },
      { title: 'POC Approval and Contract Signing', body: 'With the POC formally approved, both parties sign this development contract, confirming the agreed scope, specifications, deliverables and terms.' },
      { title: 'Product Development Stage', body: `The developed product includes a maximum of ${limit} rounds of revisions based on the approved POC. Fixing defects is not a revision. Further rounds are quoted.` },
      { title: 'Project Completion and Contract Closure', body: 'Upon completion, delivery and final acceptance of the agreed deliverables, this contract is considered closed.' },
      { title: 'Additional Requests After Contract Closure', body: 'New features or changes outside the agreed scope after closure are charged separately and need a quotation and the client’s approval first.' },
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
function newQuote(kind: Quote['kind'], roundId: string | null, title: string, description: string, requestedBy: Actor): Quote {
  const quote: Quote = { id: id(), kind, roundId, title, description, amount: null, currency: 'PHP', status: 'requested', requestedBy,
    requestedAt: now(), sentAt: null, decidedName: null, decidedAt: null };
  state.quotes = [quote, ...state.quotes];
  return quote;
}

export const previewStage = {
  shareBuild(note: string) {
    if (state.stage !== 'development' || activeRound()) fail('The client is still working on the last feedback round.');
    const number = state.rounds.length + 1;
    const opened: RevisionRound = { id: id(), number, status: 'open', buildNote: note, previewUrl: null, counts: null, paid: false, quoteId: null,
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
  submitRound(roundId: string, acceptPaid: boolean) {
    const current = round(roundId, 'open');
    if (!current.items.length) fail('Add at least one change before sending the round.');
    if (used() < state.revisionLimit) {
      replaceRound({ ...current, status: 'submitted', submittedAt: now() });
      return record('client', 'round_submitted', roundId, { number: current.number });
    }
    if (!acceptPaid) fail(`Your ${state.revisionLimit} included revision rounds are used. This round needs a quote first.`);
    const quote = newQuote('paid_revision', roundId, `Revision round ${current.number}`, current.items.map(item => '• ' + item.body).join('\n'), 'client');
    replaceRound({ ...current, status: 'awaiting_quote', submittedAt: now(), paid: true, quoteId: quote.id });
    return record('client', 'round_submitted', roundId, { number: current.number });
  },
  classifyRound(roundId: string, labels: Array<{ id: string; classification: RevisionClassification; pmNote: string }>) {
    const current = round(roundId, 'submitted');
    const byId = new Map(labels.map(item => [item.id, item]));
    if (current.items.some(item => !byId.has(item.id))) fail('Label every change in the round.');
    const items = current.items.map(item => ({ ...item, classification: byId.get(item.id)!.classification, pmNote: byId.get(item.id)!.pmNote }));
    for (const item of items) if (item.classification === 'out_of_scope') newQuote('change_request', roundId, item.body.slice(0, 120), item.body, 'pm');
    replaceRound({ ...current, items, status: 'classified', classifiedAt: now(), counts: items.some(item => item.classification === 'revision') });
    return record('pm', 'round_classified', roundId, { number: current.number });
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
    const poc = state.pocs.find(item => item.status === 'approved');
    if (!poc) fail('Approve a proof of concept first.');
    const base = state.contract?.terms ?? defaultTerms(poc, state.revisionLimit);
    const terms = { ...base, deliverables: input.deliverables ?? base.deliverables, clauses: input.clauses ?? base.clauses, notes: input.notes ?? base.notes };
    state.contract = { id: state.contract?.id ?? id(), pocVersionId: poc.id, status: 'draft', terms, contentHash: null, createdAt: state.contract?.createdAt ?? now(),
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

// Last, so every constant the seed reads is defined.
state = initial();
