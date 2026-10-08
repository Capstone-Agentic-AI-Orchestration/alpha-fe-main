import { describe, expect, it } from 'vitest';

import { parseClientDeliveryManifest, readClientDeliveryFile, readPmDeliveryFile, type ClientDeliveryFile } from './clientDelivery';

const bytes = new TextEncoder().encode('Reviewed result');
async function file(): Promise<ClientDeliveryFile> {
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map(value => value.toString(16).padStart(2, '0')).join('');
  return { id: 'file-a', filename: 'result.txt', mediaType: 'text/plain', byteLength: bytes.length, sha256 };
}
function response(body: BodyInit, length: number, overrides: Record<string, string> = {}) {
  return new Response(body, { headers: { 'Content-Type': 'application/octet-stream',
    'Content-Length': String(length), 'Content-Disposition': 'attachment; filename="delivery-file"', ...overrides } });
}

describe('client pinned result verification', () => {
  it('verifies exact PM JSON-envelope bytes without trusting extra storage fields', async () => {
    const f = await file();
    const result = await readPmDeliveryFile({ file: { ...f, object: 'private' }, bytesBase64: btoa('Reviewed result') }, f);
    expect(await result.text()).toBe('Reviewed result'); expect(result.type).toBe('application/octet-stream');
  });
  it.each(['metadata', 'digest', 'size', 'invalid-base64', 'noncanonical', 'missing'])('rejects %s PM inspection data', async invalid => {
    const f = await file(); const value: any = { file: { ...f }, bytesBase64: btoa('Reviewed result') };
    if (invalid === 'metadata') value.file.id = 'other';
    if (invalid === 'digest') value.bytesBase64 = btoa('X'.repeat(bytes.length));
    if (invalid === 'size') value.bytesBase64 += 'AAAA';
    if (invalid === 'invalid-base64') value.bytesBase64 = '$'.repeat(value.bytesBase64.length);
    if (invalid === 'noncanonical') value.bytesBase64 = '===='.repeat(value.bytesBase64.length / 4);
    if (invalid === 'missing') delete value.file;
    await expect(readPmDeliveryFile(value, f)).rejects.toMatchObject({ name: 'ClientTicketApiError' });
  });
  it('projects only safe manifest metadata, not extra URLs, storage keys or notes', async () => {
    const f = await file();
    expect(parseClientDeliveryManifest({ deliveryId: 'delivery-a', scopeVersionId: 'scope-a',
      files: [{ ...f, object: { key: 'secret' } }], url: 'https://untrusted.example' }, 'delivery-a'))
      .toEqual({ deliveryId: 'delivery-a', scopeVersionId: 'scope-a', files: [f] });
  });

  it.each(['wrong-delivery', 'empty-files', 'duplicate', 'path', 'header', 'bidi', 'html', 'svg', 'size', 'digest', 'malformed'])('rejects %s manifest data', async invalid => {
    const f: any = await file();
    const value: any = { deliveryId: 'delivery-a', scopeVersionId: 'scope-a', files: [f] };
    if (invalid === 'wrong-delivery') value.deliveryId = 'other';
    if (invalid === 'empty-files') value.files = [];
    if (invalid === 'duplicate') value.files.push(f);
    if (invalid === 'path') f.filename = '../secret';
    if (invalid === 'header') f.filename = 'file\r\nHeader';
    if (invalid === 'bidi') f.filename = 'file\u202etxt.exe';
    if (invalid === 'html') f.mediaType = 'text/html';
    if (invalid === 'svg') f.mediaType = 'image/svg+xml';
    if (invalid === 'size') f.byteLength = 33 * 1024 * 1024;
    if (invalid === 'digest') f.sha256 = 'invalid';
    expect(() => parseClientDeliveryManifest(invalid === 'malformed' ? null : value, 'delivery-a')).toThrow();
  });

  it('returns only a download blob when all bytes match the pinned digest', async () => {
    const f = await file(); const blob = await readClientDeliveryFile(response(bytes, bytes.length), f);
    expect(blob.type).toBe('application/octet-stream'); expect(await blob.text()).toBe('Reviewed result');
  });

  it.each(['digest', 'short', 'oversize', 'active-content-type', 'bad-length-header', 'inline'])('returns no blob for %s', async invalid => {
    const f = await file(); let data = bytes; const headers: Record<string, string> = {};
    if (invalid === 'digest') data = new Uint8Array(bytes.length);
    if (invalid === 'short') data = bytes.slice(1);
    if (invalid === 'oversize') data = new Uint8Array(bytes.length + 1);
    if (invalid === 'active-content-type') headers['Content-Type'] = 'text/html';
    if (invalid === 'bad-length-header') headers['Content-Length'] = '99999';
    if (invalid === 'inline') headers['Content-Disposition'] = 'inline';
    await expect(readClientDeliveryFile(response(data, bytes.length, headers), f)).rejects.toMatchObject({ name: 'ClientTicketApiError' });
  });

  it('cancels an oversized streaming body before consuming later chunks', async () => {
    const f = await file(); let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(bytes.length + 1)); },
      cancel() { cancelled = true; } });
    await expect(readClientDeliveryFile(response(stream, bytes.length), f)).rejects.toThrow();
    expect(cancelled).toBe(true);
  });
});
