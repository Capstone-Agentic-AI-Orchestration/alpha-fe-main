import type { PmCentralIntakeItem, PmClientSummary } from '@/features/ticketing/pmApi';
import type { NextActionKind, StageSummary } from '@/features/ticketing/projectStages';

/**
 * The project manager's Inbox: everything clients and prospects asked for, in one list.
 *
 * Rows come from what the PM screens already read: inquiries and project proposals that are not
 * a project yet, each client project's stage (whose turn it is, and to do what), and client
 * requests waiting on the PM. Nothing is stored for the Inbox; each row opens the screen where
 * the PM answers it.
 */
export type InboxKind = 'inquiry' | 'proposal' | 'request' | 'revision' | 'final' | 'stage';
export type InboxTone = 'info' | 'accent' | 'warn' | 'ok';
export type InboxFilter = 'all' | 'inquiries' | 'requests' | 'waiting';

export type InboxTarget =
  | { view: 'inquiries'; inquiryId: string }
  | { view: 'clients'; clientKey: string; projectId?: string };

export interface InboxItem {
  id: string;
  kind: InboxKind;
  /** The chip: what sort of thing this is. */
  label: string;
  tone: InboxTone;
  title: string;
  /** Who asked, and for which project. */
  who: string;
  /** Whose move it is. */
  turn: 'pm' | 'client';
  /** The one next step, from the PM's side. */
  nextStep: string;
  /** What they wrote, when the source has it. */
  detail?: string;
  since?: string;
  target: InboxTarget;
}

export const INBOX_FILTERS: ReadonlyArray<{ id: InboxFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'inquiries', label: 'New inquiries' },
  { id: 'requests', label: 'Client requests' },
  { id: 'waiting', label: 'Waiting on client' },
];

const isIntake = (item: InboxItem) => item.kind === 'inquiry' || item.kind === 'proposal';

/** All, inquiries and requests are the PM's turn; Waiting on client is the rest. */
export function inInboxFilter(item: InboxItem, filter: InboxFilter): boolean {
  if (filter === 'waiting') return item.turn === 'client';
  if (item.turn !== 'pm') return false;
  if (filter === 'inquiries') return isIntake(item);
  if (filter === 'requests') return !isIntake(item);
  return true;
}

/** Newest first: the Inbox reads like mail. */
export function sortInbox(items: readonly InboxItem[]): InboxItem[] {
  return [...items].sort((a, b) => (b.since ?? '').localeCompare(a.since ?? ''));
}

/** An inquiry or a client's project proposal that is not a project yet. */
export function intakeInboxItem(item: PmCentralIntakeItem): InboxItem {
  const proposal = item.kind === 'project_proposal';
  const waiting = item.status === 'awaiting_client';
  return {
    id: 'intake:' + item.id,
    kind: proposal ? 'proposal' : 'inquiry',
    label: proposal ? 'Project proposal' : 'Inquiry',
    tone: 'info',
    title: item.title,
    who: [item.fullName, item.company].filter(Boolean).join(' · ') + ' · No project yet',
    turn: waiting ? 'client' : 'pm',
    nextStep: waiting ? 'Waiting for their answer to your question' : 'Start a project or reply',
    detail: item.description,
    since: item.submittedAt,
    target: { view: 'inquiries', inquiryId: item.id },
  };
}

const STAGE_KIND: Record<NextActionKind, { kind: InboxKind; label: string; tone: InboxTone }> = {
  answer_request: { kind: 'request', label: 'Change request', tone: 'warn' },
  share_build: { kind: 'revision', label: 'Revision round', tone: 'accent' },
  submit_round: { kind: 'revision', label: 'Revision round', tone: 'accent' },
  classify_round: { kind: 'revision', label: 'Revision round', tone: 'accent' },
  accept_final: { kind: 'final', label: 'Final delivery', tone: 'ok' },
  set_stage: { kind: 'stage', label: 'Project stage', tone: 'info' },
  start_development: { kind: 'stage', label: 'Project stage', tone: 'info' },
};

/** A client project whose stage is waiting on someone: the PM to act, or the client. */
export function stageInboxItem(client: PmClientSummary, project: { projectId: string; name: string }, stage: StageSummary): InboxItem | null {
  const action = stage.nextAction;
  if (!action) return null;
  const kind = STAGE_KIND[action.kind] ?? STAGE_KIND.set_stage;
  return {
    id: 'stage:' + client.key + ':' + project.projectId,
    ...kind,
    title: project.name,
    who: client.displayName + ' · ' + stage.stageLabel,
    turn: action.who,
    nextStep: action.who === 'pm' ? action.label : 'Waiting for ' + client.displayName + ': ' + action.label,
    since: stage.stageChangedAt,
    target: { view: 'clients', clientKey: client.key, projectId: project.projectId },
  };
}

const counted = (count: number, one: string, many: string) => count + ' ' + (count === 1 ? one : many);

/** A client's requests waiting on the PM, or unread replies. */
export function requestsInboxItem(client: PmClientSummary): InboxItem | null {
  const needs = client.tickets.needsPm;
  const unread = client.tickets.unreadReplies ?? 0;
  if (!needs && !unread) return null;
  const parts: string[] = [];
  if (needs) parts.push(counted(needs, 'request needs', 'requests need') + ' you');
  if (unread) parts.push(counted(unread, 'unread reply', 'unread replies'));
  return {
    id: 'requests:' + client.key,
    kind: 'request',
    label: 'Client requests',
    tone: 'warn',
    title: parts.join(' · '),
    who: client.displayName,
    turn: 'pm',
    nextStep: 'Answer in the client conversation',
    since: client.lastActivityAt,
    target: { view: 'clients', clientKey: client.key },
  };
}

/** The account id a client's key carries, which the stage endpoint takes. */
export function clientAccountId(client: PmClientSummary): string | null {
  return client.key.startsWith('client:') ? client.key.slice('client:'.length) : null;
}

