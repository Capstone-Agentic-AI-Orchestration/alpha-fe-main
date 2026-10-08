import { describe, expect, it } from 'vitest';
import { parsePmDeliveryCandidates } from './pmDeliveryCandidates';

const candidate = { id: 'delivery-a', scopeVersionId: 'scope-a', summary: 'Reviewed result', fileCount: 2 };
describe('PM delivery candidate metadata', () => {
  it('owns and allowlists metadata without retaining private provenance', () => {
    const value = { items: [{ ...candidate, object: 'private', readyManifest: 'private' }], nextCursor: null, notes: 'private' };
    const parsed = parsePmDeliveryCandidates(value);
    expect(parsed).toEqual({ items: [candidate], nextCursor: null });
    value.items[0].summary = 'Changed'; expect(parsed.items[0].summary).toBe('Reviewed result');
  });
  it('supports an empty real list and bounded continuation', () => {
    expect(parsePmDeliveryCandidates({ items: [], nextCursor: null })).toEqual({ items: [], nextCursor: null });
    expect(parsePmDeliveryCandidates({ items: [candidate], nextCursor: candidate.id }).nextCursor).toBe(candidate.id);
  });
  it.each(['duplicate', 'unsorted', 'wrong-cursor', 'too-many', 'invalid-count', 'empty-summary', 'missing-scope'])('rejects %s pages', invalid => {
    const value: any = { items: [{ ...candidate }], nextCursor: null };
    if (invalid === 'duplicate') value.items.push({ ...candidate });
    if (invalid === 'unsorted') value.items.push({ ...candidate, id: 'delivery-0' });
    if (invalid === 'wrong-cursor') value.nextCursor = 'foreign';
    if (invalid === 'too-many') value.items = Array.from({ length: 21 }, (_, i) => ({ ...candidate, id: `delivery-${String(i).padStart(2, '0')}` }));
    if (invalid === 'invalid-count') value.items[0].fileCount = 101;
    if (invalid === 'empty-summary') value.items[0].summary = ' ';
    if (invalid === 'missing-scope') value.items[0].scopeVersionId = '';
    expect(() => parsePmDeliveryCandidates(value)).toThrow('could not be verified');
  });
});
