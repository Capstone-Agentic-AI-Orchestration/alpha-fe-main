export interface PmDeliveryCandidate { id: string; scopeVersionId: string; summary: string; fileCount: number }
export interface PmDeliveryCandidatePage { items: PmDeliveryCandidate[]; nextCursor: string | null }
const opaque = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200 && value.trim() === value;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
/** Allowlist unassessed PM candidate metadata; never retain private source fields. */
export function parsePmDeliveryCandidates(value: unknown): PmDeliveryCandidatePage {
  const fail = () => new Error('Protected result candidates could not be verified.');
  if (!record(value) || !Array.isArray(value.items) || value.items.length > 20
    || (value.nextCursor !== null && !opaque(value.nextCursor))) throw fail();
  let previous: string | null = null;
  const items = value.items.map(row => {
    if (!record(row) || !opaque(row.id) || !opaque(row.scopeVersionId)
      || typeof row.summary !== 'string' || !row.summary.trim() || row.summary.length > 4000
      || typeof row.fileCount !== 'number' || !Number.isSafeInteger(row.fileCount) || row.fileCount < 1 || row.fileCount > 100
      || (previous !== null && row.id <= previous)) throw fail();
    previous = row.id;
    return { id: row.id, scopeVersionId: row.scopeVersionId, summary: row.summary, fileCount: row.fileCount };
  });
  if (value.nextCursor !== null && value.nextCursor !== items.at(-1)?.id) throw fail();
  return { items, nextCursor: value.nextCursor };
}
