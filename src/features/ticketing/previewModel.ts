/** Development-only UI rehearsal. No accounts, network, persistence or execution. */
export const PREVIEW_STAGES = {
  received: { label: 'New inquiry', status: 'Received', owner: 'pm', action: 'PM reviews the request' },
  reviewing: { label: 'PM reviewing', status: 'Under review', owner: 'pm', action: 'PM clarifies the scope' },
  awaiting_client: { label: 'Waiting on client', status: 'Awaiting you', owner: 'client', action: 'Reply to the PM on this ticket' },
  implementing: { label: 'Developer working', status: 'In progress', owner: 'developer', action: 'Developer works on the assigned Issues' },
  pm_review: { label: 'PM reviews developer result', status: 'In progress', owner: 'pm', action: 'PM assesses the developer result' },
  client_review: { label: 'Client reviews shared result', status: 'Ready for review', owner: 'client', action: 'Review the result shared by the PM' },
  held: { label: 'On hold', status: 'On hold', owner: 'none', action: 'PM explains the hold before work resumes' },
  closed: { label: 'Closed', status: 'Closed', owner: 'none', action: 'Read-only history' },
  declined: { label: 'Declined', status: 'Declined', owner: 'none', action: 'Read-only history' },
  cancelled: { label: 'Cancelled', status: 'Cancelled', owner: 'none', action: 'Read-only history' },
} as const;
export type PreviewStage = keyof typeof PREVIEW_STAGES;
export type TicketStatus = (typeof PREVIEW_STAGES)[PreviewStage]['status'];
export type PreviewRole = 'client' | 'pm';
export interface TicketMessage { id: string; author: PreviewRole; body: string; createdAt: string }
export interface ClientTicketView {
  id: string; reference: string; title: string; description: string;
  status: TicketStatus; nextAction: string; actionOwner: 'pm' | 'client' | 'developer' | 'none';
  createdAt: string; updatedAt: string; closedAt: string | null; relatedTicketId: string | null;
  messages: TicketMessage[];
}
export interface PmPublicInquiryView {
  source: 'public_inquiry';
  contact: { fullName: string; email: string; company: string | null; verified: false };
  requestedDeadline: string | null;
}
export interface PmTicketView extends ClientTicketView { notes: TicketMessage[]; internalUpdatedAt: string; inquiry?: PmPublicInquiryView }
interface PreviewRecord {
  id: string; reference: string; title: string; description: string; stage: PreviewStage;
  createdAt: string; clientUpdatedAt: string; internalUpdatedAt: string; closedAt: string | null;
  relatedTicketId: string | null; messages: TicketMessage[]; notes: TicketMessage[];
  source: 'authenticated_request' | 'public_inquiry';
  contact: PmPublicInquiryView['contact'] | null;
  requestedDeadline: string | null;
}
export interface PreviewSeedTicket {
  id: string;
  reference: string;
  title: string;
  description: string;
  stage: PreviewStage;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  relatedTicketId: string | null;
  messages: readonly TicketMessage[];
  notes: readonly TicketMessage[];
  source: 'authenticated_request' | 'public_inquiry';
  contact: PmPublicInquiryView['contact'] | null;
  requestedDeadline: string | null;
}
export interface NewTicketInput { title: string; description: string; relatedTicketId?: string }
export interface NewPublicInquiryInput {
  fullName: string; email: string; company?: string; title: string; description: string; requestedDeadline?: string;
}
export const isTerminal = (status: TicketStatus) => ['Closed', 'Declined', 'Cancelled'].includes(status);
const validDate = (date: string) => Number.isFinite(Date.parse(date));
const text = (value: string, max: number, name: string) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`${name} must contain 1–${max} characters.`);
  return value.trim();
};
const validCalendarDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

/** Explicit allowlist: internal notes/timestamps never reach a client view. */
function clientView(record: PreviewRecord): ClientTicketView {
  const stage = PREVIEW_STAGES[record.stage];
  return {
    id: record.id, reference: record.reference, title: record.title, description: record.description,
    status: stage.status, nextAction: stage.action, actionOwner: stage.owner,
    createdAt: record.createdAt, updatedAt: record.clientUpdatedAt, closedAt: record.closedAt,
    relatedTicketId: record.relatedTicketId, messages: record.messages.map(message => ({ ...message })),
  };
}

export function createTicketPreview(
  clock: () => string = () => new Date().toISOString(),
  id: () => string = () => crypto.randomUUID(),
  initialRecords: readonly PreviewSeedTicket[] = [],
) {
  let records: PreviewRecord[] = initialRecords.map(record => ({
    ...record,
    clientUpdatedAt: record.updatedAt,
    internalUpdatedAt: record.updatedAt,
    messages: record.messages.map(message => ({ ...message })),
    notes: record.notes.map(note => ({ ...note })),
  }));
  let counter = records.length;
  const now = () => {
    const value = clock();
    if (!validDate(value)) throw new Error('Preview clock is invalid.');
    return value;
  };
  const find = (ticketId: string) => {
    const record = records.find(item => item.id === ticketId);
    if (!record) throw new Error('This preview ticket is not available.');
    return record;
  };
  return {
    // An unactivated public inquiry is never a client ticket or a way to read
    // its own status/reference. It enters My Tickets only after real activation.
    listClient: () => records.filter(record => record.source === 'authenticated_request').map(clientView),
    listPm: (): PmTicketView[] => records.map(record => {
      const base: PmTicketView = {
        ...clientView(record), notes: record.notes.map(note => ({ ...note })), internalUpdatedAt: record.internalUpdatedAt,
      };
      return record.source === 'public_inquiry' && record.contact
        ? { ...base, inquiry: { source: 'public_inquiry', contact: { ...record.contact }, requestedDeadline: record.requestedDeadline } }
        : base;
    }),
    create(input: NewTicketInput): ClientTicketView {
      const title = text(input.title, 160, 'Title');
      const description = text(input.description, 6000, 'Description');
      if (input.relatedTicketId) find(input.relatedTicketId);
      const timestamp = now();
      const record: PreviewRecord = {
        id: id(), reference: `LOCAL-${++counter}`, title, description, stage: 'received',
        createdAt: timestamp, clientUpdatedAt: timestamp, internalUpdatedAt: timestamp, closedAt: null,
        relatedTicketId: input.relatedTicketId ?? null, messages: [], notes: [],
        source: 'authenticated_request', contact: null, requestedDeadline: null,
      };
      records = [record, ...records];
      return clientView(record);
    },
    /** Local rehearsal only. The caller receives no ticket id/reference/status. */
    submitPublicInquiry(input: NewPublicInquiryInput): { received: true } {
      const fullName = text(input.fullName, 160, 'Name');
      const email = text(input.email, 254, 'Email');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
      const company = typeof input.company === 'string' && input.company.trim()
        ? text(input.company, 160, 'Company') : null;
      const title = text(input.title, 160, 'Title');
      const description = text(input.description, 6000, 'Description');
      const requestedDeadline = input.requestedDeadline ? text(input.requestedDeadline, 10, 'Requested date') : null;
      if (requestedDeadline && !validCalendarDate(requestedDeadline)) throw new Error('Enter a valid requested date.');
      const timestamp = now();
      records = [{
        id: id(), reference: `LOCAL-${++counter}`, title, description, stage: 'received',
        createdAt: timestamp, clientUpdatedAt: timestamp, internalUpdatedAt: timestamp, closedAt: null,
        relatedTicketId: null, messages: [], notes: [], source: 'public_inquiry',
        contact: { fullName, email, company, verified: false }, requestedDeadline,
      }, ...records];
      return { received: true };
    },
    message(ticketId: string, author: PreviewRole, value: string, privateNote = false): void {
      const record = find(ticketId);
      if (isTerminal(PREVIEW_STAGES[record.stage].status)) throw new Error('This ticket is read-only.');
      if (record.source === 'public_inquiry' && !privateNote) throw new Error('A public inquiry has no client thread before account activation.');
      if (privateNote && author !== 'pm') throw new Error('Only the PM preview can write internal notes.');
      const body = text(value, 4000, privateNote ? 'Note' : 'Message');
      const timestamp = now();
      const message = { id: id(), author, body, createdAt: timestamp };
      if (privateNote) record.notes.push(message);
      else { record.messages.push(message); record.clientUpdatedAt = timestamp; }
      record.internalUpdatedAt = timestamp;
      // Conversation alone never resets scope, execution or status.
    },
    setScene(ticketId: string, stage: PreviewStage): void {
      // A fixture control, deliberately NOT a real business transition command.
      if (!Object.prototype.hasOwnProperty.call(PREVIEW_STAGES, stage)) throw new Error('Unknown preview scene.');
      const record = find(ticketId);
      if (record.source === 'public_inquiry') throw new Error('A public inquiry cannot enter ticket workflow before verified account activation.');
      const timestamp = now();
      record.stage = stage;
      record.clientUpdatedAt = timestamp;
      record.internalUpdatedAt = timestamp;
      record.closedAt = stage === 'closed' || stage === 'cancelled' ? timestamp : null;
    },
    clear(): void { records = []; counter = 0; },
  };
}
export type TicketPreview = ReturnType<typeof createTicketPreview>;

function monthKey(timestamp: string, timeZone: string) {
  if (!validDate(timestamp)) throw new Error('Invalid ticket timestamp.');
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(new Date(timestamp));
  return parts.filter(part => part.type === 'year' || part.type === 'month').map(part => part.value).join('-');
}
export function matchesTicketFilter(ticket: ClientTicketView, filter: string, now: string, timeZone: string) {
  const open = !isTerminal(ticket.status);
  switch (filter) {
    case 'open': return open;
    case 'needs_client': return open && ticket.actionOwner === 'client';
    case 'needs_pm': return open && ticket.actionOwner === 'pm';
    case 'in_progress': return ticket.status === 'In progress';
    case 'waiting_client': return open && ticket.actionOwner === 'client';
    case 'closed_month': return ticket.closedAt !== null && monthKey(ticket.closedAt, timeZone) === monthKey(now, timeZone);
    case 'history': return !open;
    default: return true;
  }
}
export function ticketCounters(tickets: ClientTicketView[], now: string, timeZone: string) {
  return Object.fromEntries(['open', 'needs_client', 'needs_pm', 'in_progress', 'waiting_client', 'closed_month']
    .map(filter => [filter, tickets.filter(ticket => matchesTicketFilter(ticket, filter, now, timeZone)).length]));
}
