export type TicketDocumentAuthor = 'pm' | 'client';
export type TicketDocumentStatus = 'pending' | 'available';

export interface TicketDocument {
  id: string;
  groupId: string;
  version: number;
  replacesDocumentId: string | null;
  author: TicketDocumentAuthor;
  filename: string;
  contentType: 'application/pdf' | 'image/png' | 'image/jpeg' | 'text/plain' | 'text/csv';
  byteLength: number;
  changeProposed: boolean;
  status: TicketDocumentStatus;
  createdAt: string;
  availableAt: string | null;
}
export interface TicketDocumentsApi {
  list(scope: string | undefined, ticketId: string): Promise<TicketDocument[]>;
  upload(scope: string | undefined, ticketId: string, file: File, replacesDocumentId: string | null, operationId: string): Promise<TicketDocument>;
  download(scope: string | undefined, ticketId: string, documentId: string): Promise<Blob>;
}

const OPAQUE = /^[A-Za-z0-9_-]{1,200}$/;
const CONTENT_TYPES = new Set<TicketDocument['contentType']>([
  'application/pdf', 'image/png', 'image/jpeg', 'text/plain', 'text/csv',
]);
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseTicketDocument(value: unknown): TicketDocument {
  if (!isRecord(value) || typeof value.id !== 'string' || !OPAQUE.test(value.id)
    || typeof value.groupId !== 'string' || !OPAQUE.test(value.groupId)
    || !Number.isSafeInteger(value.version) || Number(value.version) < 1
    || (value.replacesDocumentId !== null && (typeof value.replacesDocumentId !== 'string' || !OPAQUE.test(value.replacesDocumentId)))
    || (value.author !== 'pm' && value.author !== 'client')
    || typeof value.filename !== 'string' || !value.filename.trim() || value.filename.length > 200
    || /[\\/\u0000-\u001f\u007f]/.test(value.filename)
    || typeof value.contentType !== 'string' || !CONTENT_TYPES.has(value.contentType as TicketDocument['contentType'])
    || !Number.isSafeInteger(value.byteLength) || Number(value.byteLength) < 1 || Number(value.byteLength) > MAX_DOCUMENT_BYTES
    || typeof value.changeProposed !== 'boolean' || (value.status !== 'pending' && value.status !== 'available')
    || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))
    || (value.availableAt !== null && (typeof value.availableAt !== 'string' || !Number.isFinite(Date.parse(value.availableAt))))) {
    throw new Error('The ticket service returned invalid document details.');
  }
  return {
    id: value.id, groupId: value.groupId, version: Number(value.version),
    replacesDocumentId: value.replacesDocumentId as string | null, author: value.author,
    filename: value.filename, contentType: value.contentType as TicketDocument['contentType'],
    byteLength: Number(value.byteLength), changeProposed: value.changeProposed,
    status: value.status, createdAt: value.createdAt, availableAt: value.availableAt as string | null,
  };
}

export function parseTicketDocumentList(value: unknown): TicketDocument[] {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length > 500) {
    throw new Error('The ticket service returned invalid document history.');
  }
  const ids = new Set<string>();
  return value.items.map(item => {
    const document = parseTicketDocument(item);
    if (ids.has(document.id)) throw new Error('The ticket service returned duplicate documents.');
    ids.add(document.id);
    return document;
  });
}

/** Stable and content-derived so retries survive a refresh without local persistence. */
export async function ticketDocumentOperationId(ticketId: string, file: File, replacesDocumentId: string | null): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  const contentHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const metadata = JSON.stringify(['alpha-ticket-document-operation-v1', ticketId, file.name, file.type, file.size, replacesDocumentId, contentHash]);
  const operationDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(metadata));
  const operationHash = Array.from(new Uint8Array(operationDigest), byte => byte.toString(16).padStart(2, '0')).join('');
  return `upload-${operationHash}`;
}

export function downloadTicketDocument(file: Blob, document: TicketDocument): void {
  const url = URL.createObjectURL(file);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = document.filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  window.document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
