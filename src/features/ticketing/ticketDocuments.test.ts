import { describe, expect, it } from 'vitest';

import { parseTicketDocument, parseTicketDocumentList } from './ticketDocuments';

const validDocument = {
  id: 'document-1', groupId: 'document-group-1', version: 1, replacesDocumentId: null,
  author: 'pm', filename: 'brief.pdf', contentType: 'application/pdf', byteLength: 25,
  changeProposed: false, status: 'available', createdAt: '2026-10-12T08:00:00.000Z', availableAt: '2026-10-12T08:00:01.000Z',
};

describe('ticket document response validation', () => {
  it('projects only the safe ticket-facing metadata', () => {
    const result = parseTicketDocument({ ...validDocument, storagePath: 'private/path', sha256: 'secret-digest' });
    expect(result).toEqual(validDocument);
    expect(result).not.toHaveProperty('storagePath');
    expect(result).not.toHaveProperty('sha256');
  });

  it('rejects unsafe names, unsupported content, invalid versions, and duplicated document IDs', () => {
    expect(() => parseTicketDocument({ ...validDocument, filename: '../brief.pdf' })).toThrow();
    expect(() => parseTicketDocument({ ...validDocument, contentType: 'text/html' })).toThrow();
    expect(() => parseTicketDocument({ ...validDocument, version: 0 })).toThrow();
    expect(() => parseTicketDocumentList({ items: [validDocument, validDocument] })).toThrow(/duplicate/i);
  });
});
