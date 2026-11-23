/**
 * A project's stages in the PM–client conversation: POC → Contract →
 * Development → Completed. The server decides every rule and whose turn it is;
 * this module reads its answer strictly and names things for both sides.
 */

export type ProjectStage = 'unset' | 'poc' | 'contract' | 'development' | 'completed';
export type PocStatus = 'draft' | 'published' | 'changes_requested' | 'superseded' | 'approved';
export type ContractStatus = 'draft' | 'issued' | 'client_signed' | 'countersigned' | 'void';
export type RoundStatus = 'open' | 'awaiting_quote' | 'submitted' | 'classified';
export type RevisionClassification = 'revision' | 'fix' | 'out_of_scope';
export type QuoteStatus = 'requested' | 'sent' | 'accepted' | 'declined' | 'withdrawn';

export interface PocFeature { title: string; detail: string }
export interface PocVersion {
  id: string; number: number; status: PocStatus; title: string; summary: string; features: PocFeature[]; screens: string[];
  outOfScope: string; note: string; contentHash: string | null; createdAt: string; updatedAt: string; publishedAt: string | null;
  approvedAt: string | null; approvedName: string | null; changeRequest: { body: string; createdAt: string } | null;
}
export interface ContractClause { title: string; body: string }
export interface ContractTerms {
  projectName: string; clientName: string;
  scope: { pocNumber: number; title: string; summary: string; features: PocFeature[]; screens: string[]; outOfScope: string };
  deliverables: string[]; revisionLimit: number; clauses: ContractClause[]; notes: string;
}
export interface Contract {
  id: string; pocVersionId: string; status: ContractStatus; terms: ContractTerms; contentHash: string | null;
  createdAt: string; updatedAt: string; issuedAt: string | null;
  clientSignedName: string | null; clientSignedAt: string | null; pmSignedName: string | null; pmSignedAt: string | null;
}
export interface RevisionItem { id: string; position: number; body: string; classification: RevisionClassification | null; pmNote: string }
export interface RevisionRound {
  id: string; number: number; status: RoundStatus; buildNote: string; previewUrl: string | null; counts: boolean | null;
  paid: boolean; quoteId: string | null; openedAt: string; submittedAt: string | null; classifiedAt: string | null; items: RevisionItem[];
}
export interface Quote {
  id: string; kind: 'paid_revision' | 'change_request'; roundId: string | null; title: string; description: string;
  amount: string | null; currency: string; status: QuoteStatus; requestedBy: 'pm' | 'client'; requestedAt: string;
  sentAt: string | null; decidedName: string | null; decidedAt: string | null;
}
export type NextActionKind =
  | 'set_stage' | 'publish_poc' | 'review_poc' | 'issue_contract' | 'sign_contract' | 'countersign_contract'
  | 'send_quote' | 'decide_quote' | 'share_build' | 'submit_round' | 'classify_round' | 'accept_final';
export interface StageNextAction { who: 'client' | 'pm'; kind: NextActionKind; label: string }
export interface StageSummary {
  stage: ProjectStage; stageLabel: string; revisionLimit: number; revisionsUsed: number; version: number; stageChangedAt: string;
  nextAction: StageNextAction | null;
  poc: PocVersion | null; pocDraft: PocVersion | null;
  pocHistory: Array<{ id: string; number: number; status: PocStatus; publishedAt: string | null }>;
  contract: Contract | null; rounds: RevisionRound[]; quotes: Quote[];
  final: { deliveredAt: string; note: string; acceptedAt: string | null; acceptedName: string | null } | null;
  clientId?: string;
}
export interface StageReceipt { operationId: string; action: string; refId: string | null; version: number }
export interface StageResult { receipt: StageReceipt; stage: StageSummary }
/** A project card's chip: the stage, and who is being waited on. */
export interface StageBadge { stage: ProjectStage; label: string; waitingOn: 'client' | 'pm' | null; actionLabel: string | null }

/** The four steps both sides see, in order. */
export const STAGE_STEPS: ReadonlyArray<{ stage: Exclude<ProjectStage, 'unset'>; label: string; short: string }> = [
  { stage: 'poc', label: 'Proof of concept', short: 'POC' },
  { stage: 'contract', label: 'Contract', short: 'Contract' },
  { stage: 'development', label: 'Development', short: 'Development' },
  { stage: 'completed', label: 'Completed', short: 'Completed' },
];

export type StepState = 'done' | 'current' | 'upcoming';
/** Each step's state for the tracker. An unset project shows every step as upcoming. */
export function stageSteps(stage: ProjectStage): Array<(typeof STAGE_STEPS)[number] & { state: StepState }> {
  const index = STAGE_STEPS.findIndex(step => step.stage === stage);
  return STAGE_STEPS.map((step, position) => ({
    ...step,
    state: index < 0 ? 'upcoming' : position < index ? 'done' : position === index ? (stage === 'completed' ? 'done' : 'current') : 'upcoming',
  }));
}

/** What the reader sees about the revision allowance, or null outside development. */
export function revisionAllowance(summary: Pick<StageSummary, 'stage' | 'revisionLimit' | 'revisionsUsed'>): string | null {
  if (summary.stage === 'poc') return 'Unlimited changes';
  if (summary.stage !== 'development') return null;
  return `Revisions: ${Math.min(summary.revisionsUsed, summary.revisionLimit)} of ${summary.revisionLimit} used`;
}

/** The next step from the reader's side: their own turn, or who they are waiting for. */
export function nextActionLine(summary: Pick<StageSummary, 'nextAction'>, role: 'client' | 'pm'): { mine: boolean; text: string } | null {
  const action = summary.nextAction;
  if (!action) return null;
  if (action.who === role) return { mine: true, text: action.label };
  return { mine: false, text: role === 'client' ? 'Waiting for your project manager' : 'Waiting for the client' };
}

/** A stage event in the conversation, from the reader's side. */
export interface StageEventInfo { action: string; refId: string | null; number: number | null; name: string | null; stage: string | null }
export function stageEventLine(event: StageEventInfo, author: 'client' | 'pm', role: 'client' | 'pm'): string {
  const who = author === role ? 'You' : author === 'client' ? 'The client' : role === 'client' ? 'Your project manager' : 'A project manager';
  const poc = event.number ? `POC v${event.number}` : 'the proof of concept';
  const named = event.name ? ` (signed as ${event.name})` : '';
  switch (event.action) {
    case 'stage_set': return `${who} set the project’s stage to ${STAGE_STEPS.find(step => step.stage === event.stage)?.label ?? 'a new stage'}`;
    case 'poc_published': return `${who} shared ${poc} for review`;
    case 'poc_changes_requested': return `${who} asked for changes to ${poc}`;
    case 'poc_approved': return `${who} approved ${poc}${named} · Next: the contract`;
    case 'contract_issued': return `${who} issued the contract for signing`;
    case 'contract_voided': return `${who} withdrew the contract`;
    case 'contract_signed': return `${who} signed the contract${named}`;
    case 'contract_countersigned': return `${who} countersigned the contract · Development has started`;
    case 'build_shared': return `${who} shared build ${event.number ?? ''} for feedback`.replace('  ', ' ');
    case 'round_submitted': return `${who} sent feedback round ${event.number ?? ''}`.trimEnd();
    case 'round_classified': return `${who} reviewed feedback round ${event.number ?? ''}`.trimEnd();
    case 'quote_requested': return `${who} asked for a quote`;
    case 'quote_sent': return `${who} sent a quote`;
    case 'quote_accepted': return `${who} accepted a quote${named}`;
    case 'quote_declined': return `${who} declined a quote`;
    case 'final_delivered': return `${who} marked the final delivery ready for acceptance`;
    case 'final_accepted': return `${who} accepted the final delivery${named} · The contract is closed`;
    default: return `${who} updated the project’s stage`;
  }
}

// ---- strict reading -------------------------------------------------------

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const str = (value: unknown): value is string => typeof value === 'string';
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const strOrNull = (value: unknown): value is string | null => value === null || typeof value === 'string';
const int = (value: unknown): value is number => Number.isSafeInteger(value);
function invalid(): never { throw new Error('The project stage could not be read. Refresh to try again.'); }
const oneOf = <T extends string>(values: readonly T[]) => (value: unknown): value is T => values.includes(value as T);

const STAGES = oneOf<ProjectStage>(['unset', 'poc', 'contract', 'development', 'completed']);
const POC_STATUSES = oneOf<PocStatus>(['draft', 'published', 'changes_requested', 'superseded', 'approved']);
const CONTRACT_STATUSES = oneOf<ContractStatus>(['draft', 'issued', 'client_signed', 'countersigned', 'void']);
const ROUND_STATUSES = oneOf<RoundStatus>(['open', 'awaiting_quote', 'submitted', 'classified']);
const CLASSIFICATIONS = oneOf<RevisionClassification>(['revision', 'fix', 'out_of_scope']);
const QUOTE_STATUSES = oneOf<QuoteStatus>(['requested', 'sent', 'accepted', 'declined', 'withdrawn']);
const ACTIONS = oneOf<NextActionKind>(['set_stage', 'publish_poc', 'review_poc', 'issue_contract', 'sign_contract', 'countersign_contract',
  'send_quote', 'decide_quote', 'share_build', 'submit_round', 'classify_round', 'accept_final']);

function features(value: unknown): PocFeature[] {
  if (!Array.isArray(value)) invalid();
  return value.map(item => {
    if (!record(item) || !str(item.title) || !str(item.detail)) invalid();
    return { title: item.title, detail: item.detail };
  });
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every(str)) invalid();
  return value as string[];
}

function parsePoc(value: unknown): PocVersion | null {
  if (value === null) return null;
  if (!record(value) || !nonEmpty(value.id) || !int(value.number) || !POC_STATUSES(value.status) || !str(value.title) || !str(value.summary)
    || !str(value.outOfScope) || !str(value.note) || !strOrNull(value.contentHash) || !nonEmpty(value.createdAt) || !nonEmpty(value.updatedAt)
    || !strOrNull(value.publishedAt) || !strOrNull(value.approvedAt) || !strOrNull(value.approvedName)) invalid();
  const change = value.changeRequest;
  if (change !== null && !(record(change) && str(change.body) && nonEmpty(change.createdAt))) invalid();
  return {
    id: value.id, number: value.number, status: value.status, title: value.title, summary: value.summary,
    features: features(value.features), screens: strings(value.screens), outOfScope: value.outOfScope, note: value.note,
    contentHash: value.contentHash, createdAt: value.createdAt, updatedAt: value.updatedAt, publishedAt: value.publishedAt,
    approvedAt: value.approvedAt, approvedName: value.approvedName,
    changeRequest: change ? { body: change.body as string, createdAt: change.createdAt as string } : null,
  };
}

function parseTerms(value: unknown): ContractTerms {
  if (!record(value) || !str(value.projectName) || !str(value.clientName) || !record(value.scope) || !int(value.revisionLimit)
    || !Array.isArray(value.clauses) || !str(value.notes)) invalid();
  const scope = value.scope;
  if (!int(scope.pocNumber) || !str(scope.title) || !str(scope.summary) || !str(scope.outOfScope)) invalid();
  const clauses = value.clauses.map(clause => {
    if (!record(clause) || !str(clause.title) || !str(clause.body)) invalid();
    return { title: clause.title, body: clause.body };
  });
  return {
    projectName: value.projectName, clientName: value.clientName,
    scope: { pocNumber: scope.pocNumber, title: scope.title, summary: scope.summary, features: features(scope.features),
      screens: strings(scope.screens), outOfScope: scope.outOfScope },
    deliverables: strings(value.deliverables), revisionLimit: value.revisionLimit, clauses, notes: value.notes,
  };
}

function parseContract(value: unknown): Contract | null {
  if (value === null) return null;
  if (!record(value) || !nonEmpty(value.id) || !nonEmpty(value.pocVersionId) || !CONTRACT_STATUSES(value.status)
    || !strOrNull(value.contentHash) || !nonEmpty(value.createdAt) || !nonEmpty(value.updatedAt) || !strOrNull(value.issuedAt)
    || !strOrNull(value.clientSignedName) || !strOrNull(value.clientSignedAt) || !strOrNull(value.pmSignedName) || !strOrNull(value.pmSignedAt)) invalid();
  return {
    id: value.id, pocVersionId: value.pocVersionId, status: value.status, terms: parseTerms(value.terms), contentHash: value.contentHash,
    createdAt: value.createdAt, updatedAt: value.updatedAt, issuedAt: value.issuedAt,
    clientSignedName: value.clientSignedName, clientSignedAt: value.clientSignedAt, pmSignedName: value.pmSignedName, pmSignedAt: value.pmSignedAt,
  };
}

function parseRound(value: unknown): RevisionRound {
  if (!record(value) || !nonEmpty(value.id) || !int(value.number) || !ROUND_STATUSES(value.status) || !str(value.buildNote)
    || !strOrNull(value.previewUrl) || !(value.counts === null || typeof value.counts === 'boolean') || typeof value.paid !== 'boolean'
    || !strOrNull(value.quoteId) || !nonEmpty(value.openedAt) || !strOrNull(value.submittedAt) || !strOrNull(value.classifiedAt)
    || !Array.isArray(value.items)) invalid();
  const items = value.items.map(item => {
    if (!record(item) || !nonEmpty(item.id) || !int(item.position) || !str(item.body)
      || !(item.classification === null || CLASSIFICATIONS(item.classification)) || !str(item.pmNote)) invalid();
    return { id: item.id, position: item.position, body: item.body, classification: item.classification as RevisionClassification | null, pmNote: item.pmNote };
  });
  return {
    id: value.id, number: value.number, status: value.status, buildNote: value.buildNote, previewUrl: value.previewUrl,
    counts: value.counts as boolean | null, paid: value.paid, quoteId: value.quoteId, openedAt: value.openedAt,
    submittedAt: value.submittedAt, classifiedAt: value.classifiedAt, items,
  };
}

function parseQuote(value: unknown): Quote {
  if (!record(value) || !nonEmpty(value.id) || !(value.kind === 'paid_revision' || value.kind === 'change_request') || !strOrNull(value.roundId)
    || !str(value.title) || !str(value.description) || !strOrNull(value.amount) || !str(value.currency) || !QUOTE_STATUSES(value.status)
    || !(value.requestedBy === 'pm' || value.requestedBy === 'client') || !nonEmpty(value.requestedAt) || !strOrNull(value.sentAt)
    || !strOrNull(value.decidedName) || !strOrNull(value.decidedAt)) invalid();
  return {
    id: value.id, kind: value.kind, roundId: value.roundId, title: value.title, description: value.description, amount: value.amount,
    currency: value.currency, status: value.status, requestedBy: value.requestedBy, requestedAt: value.requestedAt,
    sentAt: value.sentAt, decidedName: value.decidedName, decidedAt: value.decidedAt,
  };
}

export function parseStageSummary(value: unknown): StageSummary {
  if (!record(value) || !STAGES(value.stage) || !str(value.stageLabel) || !int(value.revisionLimit) || !int(value.revisionsUsed)
    || !int(value.version) || !nonEmpty(value.stageChangedAt) || !Array.isArray(value.pocHistory) || !Array.isArray(value.rounds)
    || !Array.isArray(value.quotes)) invalid();
  const action = value.nextAction;
  if (action !== null && !(record(action) && (action.who === 'client' || action.who === 'pm') && ACTIONS(action.kind) && str(action.label))) invalid();
  const final = value.final;
  if (final !== null && !(record(final) && nonEmpty(final.deliveredAt) && str(final.note) && strOrNull(final.acceptedAt) && strOrNull(final.acceptedName))) invalid();
  const pocHistory = value.pocHistory.map(item => {
    if (!record(item) || !nonEmpty(item.id) || !int(item.number) || !POC_STATUSES(item.status) || !strOrNull(item.publishedAt)) invalid();
    return { id: item.id, number: item.number, status: item.status, publishedAt: item.publishedAt };
  });
  return {
    stage: value.stage, stageLabel: value.stageLabel, revisionLimit: value.revisionLimit, revisionsUsed: value.revisionsUsed,
    version: value.version, stageChangedAt: value.stageChangedAt,
    nextAction: action ? { who: action.who as 'client' | 'pm', kind: action.kind as NextActionKind, label: action.label as string } : null,
    poc: parsePoc(value.poc ?? null), pocDraft: parsePoc(value.pocDraft ?? null), pocHistory,
    contract: parseContract(value.contract ?? null), rounds: value.rounds.map(parseRound), quotes: value.quotes.map(parseQuote),
    final: final ? { deliveredAt: final.deliveredAt as string, note: final.note as string,
      acceptedAt: final.acceptedAt as string | null, acceptedName: final.acceptedName as string | null } : null,
    ...(nonEmpty(value.clientId) ? { clientId: value.clientId } : {}),
  };
}

export function parseStageResult(value: unknown): StageResult {
  if (!record(value) || !record(value.receipt)) invalid();
  const receipt = value.receipt;
  if (!nonEmpty(receipt.operationId) || !str(receipt.action) || !strOrNull(receipt.refId) || !int(receipt.version)) invalid();
  return { receipt: { operationId: receipt.operationId, action: receipt.action, refId: receipt.refId, version: receipt.version },
    stage: parseStageSummary(value.stage) };
}

/** A project card's chip; a missing or malformed chip is left off, never guessed. */
export function parseStageBadge(value: unknown): StageBadge | null {
  if (!record(value) || !STAGES(value.stage) || !str(value.label)
    || !(value.waitingOn === null || value.waitingOn === 'client' || value.waitingOn === 'pm') || !strOrNull(value.actionLabel)) return null;
  return { stage: value.stage, label: value.label, waitingOn: value.waitingOn, actionLabel: value.actionLabel };
}

/** A stage event's details in the conversation; anything malformed is dropped. */
export function parseStageEvent(value: unknown): StageEventInfo | null {
  if (!record(value) || !str(value.action) || !strOrNull(value.refId)) return null;
  return { action: value.action, refId: value.refId, number: int(value.number) ? value.number : null,
    name: str(value.name) ? value.name : null, stage: str(value.stage) ? value.stage : null };
}
