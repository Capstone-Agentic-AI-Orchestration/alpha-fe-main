/**
 * A project's stages in the PM–client conversation: POC → Development →
 * Completed. The development contract is signed in person, outside Alpha. The server decides every rule and whose turn it is;
 * this module reads its answer strictly and names things for both sides.
 */

export type ProjectStage = 'unset' | 'poc' | 'contract' | 'development' | 'completed';
export type ContractStatus = 'draft' | 'issued' | 'client_signed' | 'countersigned' | 'void';
export type RoundStatus = 'open' | 'submitted' | 'classified';
export type RevisionClassification = 'revision' | 'fix' | 'out_of_scope';
/** A change request outside the contract. Alpha takes no payments: the client is reminded it costs extra, and the PM answers. */
export type RequestStatus = 'open' | 'will_do' | 'wont_do';

/** A feature as contracts issued before the POC became a stage marker list it in their scope. */
export interface PocFeature { title: string; detail: string }
export interface ContractClause { title: string; body: string }
export interface ContractTerms {
  projectName: string; clientName: string;
  /**
   * What the contract covers, written by the PM. Contracts issued before the POC
   * became a stage marker also carry the approved POC's number, features,
   * screens and exclusions, shown exactly as signed.
   */
  scope: { title: string; summary: string; pocNumber?: number; features?: PocFeature[]; screens?: string[]; outOfScope?: string };
  deliverables: string[]; revisionLimit: number; clauses: ContractClause[]; notes: string;
}
export interface Contract {
  id: string; pocVersionId: string | null; status: ContractStatus; terms: ContractTerms; contentHash: string | null;
  createdAt: string; updatedAt: string; issuedAt: string | null;
  clientSignedName: string | null; clientSignedAt: string | null; pmSignedName: string | null; pmSignedAt: string | null;
}
export interface RevisionItem { id: string; position: number; body: string; classification: RevisionClassification | null; pmNote: string }
export interface RevisionRound {
  id: string; number: number; status: RoundStatus; buildNote: string; previewUrl: string | null; counts: boolean | null;
  extra: boolean; openedAt: string; submittedAt: string | null; classifiedAt: string | null; items: RevisionItem[];
}
export interface ChangeRequest {
  id: string; roundId: string | null; title: string; description: string; status: RequestStatus;
  requestedBy: 'pm' | 'client'; requestedAt: string; reply: string; answeredAt: string | null;
}
export type NextActionKind =
  | 'set_stage' | 'start_development'
  | 'answer_request' | 'share_build' | 'submit_round' | 'classify_round' | 'accept_final';
export interface StageNextAction { who: 'client' | 'pm'; kind: NextActionKind; label: string }
export interface StageSummary {
  stage: ProjectStage; stageLabel: string; revisionLimit: number; revisionsUsed: number; version: number; stageChangedAt: string;
  nextAction: StageNextAction | null;
  contract: Contract | null; rounds: RevisionRound[]; requests: ChangeRequest[];
  final: { deliveredAt: string; note: string; acceptedAt: string | null; acceptedName: string | null } | null;
  clientId?: string;
}
export interface StageReceipt { operationId: string; action: string; refId: string | null; version: number }
export interface StageResult { receipt: StageReceipt; stage: StageSummary }
/** A project card's chip: the stage, and who is being waited on. */
export interface StageBadge { stage: ProjectStage; label: string; waitingOn: 'client' | 'pm' | null; actionLabel: string | null }

/** The three steps both sides see, in order. The contract is signed in person, between the POC and development. */
export const STAGE_STEPS: ReadonlyArray<{ stage: Exclude<ProjectStage, 'unset' | 'contract'>; label: string; short: string }> = [
  { stage: 'poc', label: 'Proof of concept', short: 'POC' },
  { stage: 'development', label: 'Development', short: 'Development' },
  { stage: 'completed', label: 'Completed', short: 'Completed' },
];

export type StepState = 'done' | 'current' | 'upcoming';
/** Each step's state for the tracker. An unset project shows every step as upcoming. */
export function stageSteps(stage: ProjectStage): Array<(typeof STAGE_STEPS)[number] & { state: StepState }> {
  // The old in-app Contract stage reads as the end of the POC: development starts next.
  const shown = stage === 'contract' ? 'poc' : stage;
  const index = STAGE_STEPS.findIndex(step => step.stage === shown);
  return STAGE_STEPS.map((step, position) => ({
    ...step,
    state: index < 0 ? 'upcoming' : position < index ? 'done' : position === index ? (stage === 'completed' ? 'done' : 'current') : 'upcoming',
  }));
}

/** What the reader sees about the revision allowance, or null outside development. */
export function revisionAllowance(summary: Pick<StageSummary, 'stage' | 'revisionLimit' | 'revisionsUsed'>): string | null {
  if (summary.stage !== 'development') return null;
  const extra = extraRounds(summary);
  return `Revisions: ${Math.min(summary.revisionsUsed, summary.revisionLimit)} of ${summary.revisionLimit} used`
    + (extra ? ` · ${extra} extra` : '');
}

/** Rounds past the included ones. Each one costs additional; nothing is charged in Alpha. */
export function extraRounds(summary: Pick<StageSummary, 'revisionLimit' | 'revisionsUsed'>): number {
  return Math.max(0, summary.revisionsUsed - summary.revisionLimit);
}

/** The reminder shown wherever the client asks for work beyond the contract. */
export const COSTS_EXTRA = 'This costs additional, billed separately from your contract.';

/** A change request's answer, as both sides read it. */
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  open: 'Waiting for an answer', will_do: 'Will do', wont_do: 'Won’t do',
};

/** The next step from the reader's side: their own turn, or who they are waiting for. */
export function nextActionLine(summary: Pick<StageSummary, 'nextAction'>, role: 'client' | 'pm'): { mine: boolean; text: string } | null {
  const action = summary.nextAction;
  if (!action) return null;
  if (action.who === role) return { mine: true, text: action.label };
  return { mine: false, text: role === 'client' ? 'Waiting for the project manager' : 'Waiting for the client' };
}

/** A stage event in the conversation, from the reader's side. */
export interface StageEventInfo {
  action: string; refId: string | null; number: number | null; name: string | null; stage: string | null;
  /** Change-request answers and extra rounds; older servers leave them out. */
  decision?: string | null; title?: string | null; extra?: boolean;
}
function answerLine(event: StageEventInfo, who: string): string {
  const what = event.title ? `“${event.title}”` : 'a change request';
  return event.decision === 'wont_do' ? `${who} won’t do ${what}` : `${who} will do ${what} · ${COSTS_EXTRA}`;
}
export function stageEventLine(event: StageEventInfo, author: 'client' | 'pm', role: 'client' | 'pm'): string {
  const who = author === role ? 'You' : author === 'client' ? 'The client' : role === 'client' ? 'The project manager' : 'A project manager';
  const poc = event.number ? `POC v${event.number}` : 'the proof of concept';
  const named = event.name ? ` (signed as ${event.name})` : '';
  switch (event.action) {
    case 'stage_set': return `${who} set the project’s stage to ${STAGE_STEPS.find(step => step.stage === event.stage)?.label ?? 'a new stage'}`;
    case 'development_started': return `${who} started development · The contract was signed in person`;
    // Events from before the POC became a stage marker and the contract moved offline.
    case 'poc_completed': return `${who} moved the project to the contract stage`;
    case 'poc_published': return `${who} shared ${poc} for review`;
    case 'poc_changes_requested': return `${who} asked for changes to ${poc}`;
    case 'poc_approved': return `${who} approved ${poc}${named} · Next: the contract`;
    case 'contract_issued': return `${who} issued the contract for signing`;
    case 'contract_voided': return `${who} withdrew the contract`;
    case 'contract_signed': return `${who} signed the contract${named}`;
    case 'contract_countersigned': return `${who} countersigned the contract · Development has started`;
    case 'build_shared': return `${who} shared build ${event.number ?? ''} for feedback`.replace('  ', ' ');
    case 'round_submitted': return `${who} sent feedback round ${event.number ?? ''}`.trimEnd() + (event.extra ? ' · An extra round, billed separately' : '');
    case 'round_classified': return `${who} reviewed feedback round ${event.number ?? ''}`.trimEnd();
    case 'request_made': return `${who} asked for new work · ${COSTS_EXTRA}`;
    case 'request_answered': return answerLine(event, who);
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
const CONTRACT_STATUSES = oneOf<ContractStatus>(['draft', 'issued', 'client_signed', 'countersigned', 'void']);
const ROUND_STATUSES = oneOf<RoundStatus>(['open', 'submitted', 'classified']);
const CLASSIFICATIONS = oneOf<RevisionClassification>(['revision', 'fix', 'out_of_scope']);
const REQUEST_STATUSES = oneOf<RequestStatus>(['open', 'will_do', 'wont_do']);
/** Next steps an older server may still name (the written POC and the in-app contract); nothing here acts on them. */
const LEGACY_ACTIONS = new Set(['publish_poc', 'review_poc', 'complete_poc', 'issue_contract', 'sign_contract', 'countersign_contract']);
const ACTIONS = oneOf<NextActionKind>(['set_stage', 'start_development',
  'answer_request', 'share_build', 'submit_round', 'classify_round', 'accept_final']);

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

function parseTerms(value: unknown): ContractTerms {
  if (!record(value) || !str(value.projectName) || !str(value.clientName) || !record(value.scope) || !int(value.revisionLimit)
    || !Array.isArray(value.clauses) || !str(value.notes)) invalid();
  const scope = value.scope;
  if (!str(scope.title) || !str(scope.summary) || !(scope.pocNumber === undefined || int(scope.pocNumber))
    || !(scope.outOfScope === undefined || str(scope.outOfScope))) invalid();
  const clauses = value.clauses.map(clause => {
    if (!record(clause) || !str(clause.title) || !str(clause.body)) invalid();
    return { title: clause.title, body: clause.body };
  });
  return {
    projectName: value.projectName, clientName: value.clientName,
    scope: { title: scope.title, summary: scope.summary,
      ...(int(scope.pocNumber) ? { pocNumber: scope.pocNumber } : {}),
      ...(scope.features === undefined ? {} : { features: features(scope.features) }),
      ...(scope.screens === undefined ? {} : { screens: strings(scope.screens) }),
      ...(str(scope.outOfScope) ? { outOfScope: scope.outOfScope } : {}) },
    deliverables: strings(value.deliverables), revisionLimit: value.revisionLimit, clauses, notes: value.notes,
  };
}

function parseContract(value: unknown): Contract | null {
  if (value === null) return null;
  if (!record(value) || !nonEmpty(value.id) || !(value.pocVersionId === null || nonEmpty(value.pocVersionId)) || !CONTRACT_STATUSES(value.status)
    || !strOrNull(value.contentHash) || !nonEmpty(value.createdAt) || !nonEmpty(value.updatedAt) || !strOrNull(value.issuedAt)
    || !strOrNull(value.clientSignedName) || !strOrNull(value.clientSignedAt) || !strOrNull(value.pmSignedName) || !strOrNull(value.pmSignedAt)) invalid();
  return {
    id: value.id, pocVersionId: value.pocVersionId as string | null, status: value.status, terms: parseTerms(value.terms), contentHash: value.contentHash,
    createdAt: value.createdAt, updatedAt: value.updatedAt, issuedAt: value.issuedAt,
    clientSignedName: value.clientSignedName, clientSignedAt: value.clientSignedAt, pmSignedName: value.pmSignedName, pmSignedAt: value.pmSignedAt,
  };
}

function parseRound(value: unknown): RevisionRound {
  if (!record(value) || !nonEmpty(value.id) || !int(value.number) || !ROUND_STATUSES(value.status) || !str(value.buildNote)
    || !strOrNull(value.previewUrl) || !(value.counts === null || typeof value.counts === 'boolean') || typeof value.extra !== 'boolean'
    || !nonEmpty(value.openedAt) || !strOrNull(value.submittedAt) || !strOrNull(value.classifiedAt)
    || !Array.isArray(value.items)) invalid();
  const items = value.items.map(item => {
    if (!record(item) || !nonEmpty(item.id) || !int(item.position) || !str(item.body)
      || !(item.classification === null || CLASSIFICATIONS(item.classification)) || !str(item.pmNote)) invalid();
    return { id: item.id, position: item.position, body: item.body, classification: item.classification as RevisionClassification | null, pmNote: item.pmNote };
  });
  return {
    id: value.id, number: value.number, status: value.status, buildNote: value.buildNote, previewUrl: value.previewUrl,
    counts: value.counts as boolean | null, extra: value.extra, openedAt: value.openedAt,
    submittedAt: value.submittedAt, classifiedAt: value.classifiedAt, items,
  };
}

function parseRequest(value: unknown): ChangeRequest {
  if (!record(value) || !nonEmpty(value.id) || !strOrNull(value.roundId) || !str(value.title) || !str(value.description)
    || !REQUEST_STATUSES(value.status) || !(value.requestedBy === 'pm' || value.requestedBy === 'client') || !nonEmpty(value.requestedAt)
    || !str(value.reply) || !strOrNull(value.answeredAt)) invalid();
  return {
    id: value.id, roundId: value.roundId, title: value.title, description: value.description, status: value.status,
    requestedBy: value.requestedBy, requestedAt: value.requestedAt, reply: value.reply, answeredAt: value.answeredAt,
  };
}

export function parseStageSummary(value: unknown): StageSummary {
  if (!record(value) || !STAGES(value.stage) || !str(value.stageLabel) || !int(value.revisionLimit) || !int(value.revisionsUsed)
    || !int(value.version) || !nonEmpty(value.stageChangedAt) || !Array.isArray(value.rounds)
    || !Array.isArray(value.requests)) invalid();
  const action = record(value.nextAction) && LEGACY_ACTIONS.has(value.nextAction.kind as string) ? null : value.nextAction;
  if (action !== null && !(record(action) && (action.who === 'client' || action.who === 'pm') && ACTIONS(action.kind) && str(action.label))) invalid();
  const final = value.final;
  if (final !== null && !(record(final) && nonEmpty(final.deliveredAt) && str(final.note) && strOrNull(final.acceptedAt) && strOrNull(final.acceptedName))) invalid();
  return {
    stage: value.stage, stageLabel: value.stageLabel, revisionLimit: value.revisionLimit, revisionsUsed: value.revisionsUsed,
    version: value.version, stageChangedAt: value.stageChangedAt,
    nextAction: action ? { who: action.who as 'client' | 'pm', kind: action.kind as NextActionKind, label: action.label as string } : null,
    contract: parseContract(value.contract ?? null), rounds: value.rounds.map(parseRound), requests: value.requests.map(parseRequest),
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
    name: str(value.name) ? value.name : null, stage: str(value.stage) ? value.stage : null,
    decision: str(value.decision) ? value.decision : null, title: str(value.title) ? value.title : null, extra: value.extra === true };
}
