import { ClientTicketApiError } from './clientApiError';

export interface ClientDeliveryFile {
  id: string; filename: string; mediaType: 'text/plain' | 'application/pdf' | 'image/png' | 'image/jpeg';
  byteLength: number; sha256: string;
}
export interface ClientDeliveryManifest { deliveryId: string; scopeVersionId: string; files: ClientDeliveryFile[] }
const mediaTypes = new Set(['text/plain', 'application/pdf', 'image/png', 'image/jpeg']);
const maxFileBytes = 32 * 1024 * 1024;
function failed(): ClientTicketApiError { return new ClientTicketApiError(null, 'The shared file could not be verified. Refresh or contact your project manager.'); }
function opaque(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 200 && value.trim() === value; }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }

export function parseClientDeliveryFile(value: unknown): ClientDeliveryFile {
  if (!record(value) || !opaque(value.id) || typeof value.filename !== 'string' || !value.filename.length
    || value.filename.length > 160 || value.filename.trim() !== value.filename || ['.', '..'].includes(value.filename)
    || /[\u0000-\u001f\u007f/\\<>:"|?*\u202a-\u202e\u2066-\u2069\ud800-\udfff]/u.test(value.filename)
    || typeof value.mediaType !== 'string' || !mediaTypes.has(value.mediaType)
    || typeof value.byteLength !== 'number' || !Number.isSafeInteger(value.byteLength) || value.byteLength <= 0 || value.byteLength > maxFileBytes
    || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)) throw failed();
  return { id: value.id, filename: value.filename, mediaType: value.mediaType as ClientDeliveryFile['mediaType'], byteLength: value.byteLength, sha256: value.sha256 };
}
export function parseClientDeliveryManifest(value: unknown, deliveryId: string): ClientDeliveryManifest {
  if (!record(value) || !opaque(value.deliveryId) || value.deliveryId !== deliveryId || !opaque(value.scopeVersionId)
    || !Array.isArray(value.files) || value.files.length < 1 || value.files.length > 100) throw failed();
  const files = value.files.map(parseClientDeliveryFile);
  if (new Set(files.map(file => file.id)).size !== files.length
    || files.reduce((total, file) => total + file.byteLength, 0) > 128 * 1024 * 1024) throw failed();
  return { deliveryId, scopeVersionId: value.scopeVersionId, files };
}

export async function verifyDeliveryBytes(bytes: Uint8Array<ArrayBuffer>, input: ClientDeliveryFile): Promise<Blob> {
  const file = parseClientDeliveryFile(input);
  if (bytes.byteLength !== file.byteLength || !globalThis.crypto?.subtle) throw failed();
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map(value => value.toString(16).padStart(2, '0')).join('');
  if (digest !== file.sha256) throw failed();
  return new Blob([bytes], { type: 'application/octet-stream' });
}

/** Bounded canonical JSON envelope used only by the existing internal PM relay. */
export async function readPmDeliveryFile(value: unknown, input: ClientDeliveryFile): Promise<Blob> {
  const file = parseClientDeliveryFile(input);
  if (!record(value) || JSON.stringify(parseClientDeliveryFile(value.file)) !== JSON.stringify(file)
    || typeof value.bytesBase64 !== 'string' || value.bytesBase64.length !== Math.ceil(file.byteLength / 3) * 4
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(value.bytesBase64)) throw failed();
  let decoded: string;
  try { decoded = atob(value.bytesBase64); } catch { throw failed(); }
  if (decoded.length !== file.byteLength || btoa(decoded) !== value.bytesBase64) throw failed();
  return verifyDeliveryBytes(Uint8Array.from(decoded, character => character.charCodeAt(0)), file);
}

/** Bounded binary read; validate exact bytes against the PM-shared manifest.
 * Never render agent files/HTML in the authenticated origin or trust a response
 * filename/redirect. The caller can download the owned Blob, not execute it.
 */
export async function readClientDeliveryFile(response: Response, input: ClientDeliveryFile): Promise<Blob> {
  const file = parseClientDeliveryFile(input);
  if (response.headers.get('Content-Type') !== 'application/octet-stream'
    || response.headers.get('Content-Length') !== String(file.byteLength)
    || !response.headers.get('Content-Disposition')?.startsWith('attachment;')
    || !response.body || !globalThis.crypto?.subtle) {
    await response.body?.cancel(); throw failed();
  }
  const reader = response.body.getReader();
  const bytes = new Uint8Array(file.byteLength);
  let offset = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (offset + chunk.value.byteLength > bytes.length) throw failed();
      bytes.set(chunk.value, offset); offset += chunk.value.byteLength;
    }
    if (offset !== bytes.length) throw failed();
    return await verifyDeliveryBytes(bytes, file);
  } catch {
    try { await reader.cancel(); } catch { /* The connection may already be closed. */ }
    throw failed();
  } finally { reader.releaseLock(); }
}
