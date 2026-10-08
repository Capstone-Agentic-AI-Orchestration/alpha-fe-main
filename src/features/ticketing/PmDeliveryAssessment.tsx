import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';

import { pmTicketApi, type PmTicketDetail } from './pmApi';
import type { ClientDeliveryFile, ClientDeliveryManifest } from './clientDelivery';
import type { PmDeliveryCandidate } from './pmDeliveryCandidates';
import { canAssessTicketDelivery } from './pmReview';
import { input, primary, secondary } from './ticketUi';

/** Inline on the existing PM Tickets page; registration does not pre-approve
 * the result, and assessment never publishes it to the client automatically.
 */
export function PmDeliveryAssessment({ ticket, clientAccessActive, disabled, onAssess }: {
  ticket: PmTicketDetail; clientAccessActive: boolean; disabled: boolean; onAssess: (deliveryId: string) => Promise<boolean>;
}) {
  const [candidates, setCandidates] = useState<PmDeliveryCandidate[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [manifest, setManifest] = useState<ClientDeliveryManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [error, setError] = useState('');
  const [read, setRead] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const listRequest = useRef<AbortController | null>(null);
  const fileRequest = useRef<AbortController | null>(null);
  const downloadLock = useRef(false);
  const moreLock = useRef(false);
  const selected = candidates.find(candidate => candidate.id === selectedId);

  function checkScope(items: PmDeliveryCandidate[]) {
    if (items.some(item => item.scopeVersionId !== ticket.scope?.id)) throw new Error('Changed scope');
  }
  useEffect(() => {
    const controller = new AbortController(); listRequest.current = controller;
    setCandidates([]); setSelectedId(''); setCursor(null); setLoading(true); setError('');
    pmTicketApi.getDeliveryCandidates(ticket.id, null, controller.signal).then(page => {
      if (controller.signal.aborted) return;
      checkScope(page.items); setCandidates(page.items); setCursor(page.nextCursor); setSelectedId(page.items[0]?.id ?? '');
    }).catch(() => { if (!controller.signal.aborted) setError('Protected result candidates are unavailable. Refresh to try again.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); listRequest.current = null; };
  }, [ticket.id, ticket.version, ticket.scope?.id, retry]);

  useEffect(() => {
    const controller = new AbortController(); fileRequest.current = controller;
    setManifest(null); setRead([]); setAcknowledged(false); setManifestLoading(Boolean(selectedId));
    if (selectedId) pmTicketApi.getDeliveryCandidate(ticket.id, selectedId, controller.signal).then(value => {
      if (controller.signal.aborted) return;
      if (value.scopeVersionId !== ticket.scope?.id || value.files.length !== selected?.fileCount) throw new Error('Changed result');
      setManifest(value);
    }).catch(() => { if (!controller.signal.aborted) setError('This candidate could not be verified. Refresh before assessing it.'); })
      .finally(() => { if (!controller.signal.aborted) setManifestLoading(false); });
    return () => { controller.abort(); fileRequest.current = null; };
  }, [ticket.id, ticket.version, ticket.scope?.id, selectedId, selected?.fileCount, retry]);

  async function more() {
    const controller = listRequest.current;
    if (!cursor || !controller || controller.signal.aborted || moreLock.current) return;
    moreLock.current = true; setLoadingMore(true);
    try {
      const page = await pmTicketApi.getDeliveryCandidates(ticket.id, cursor, controller.signal);
      if (controller.signal.aborted) return;
      checkScope(page.items);
      if (page.items.some(row => row.id <= cursor || candidates.some(existing => existing.id === row.id))) throw new Error('Changed page');
      setCandidates(current => [...current, ...page.items]); setCursor(page.nextCursor);
    } catch { if (!controller.signal.aborted) setError('More results could not be verified. Refresh the candidate list.'); }
    finally { moreLock.current = false; if (!controller.signal.aborted) setLoadingMore(false); }
  }
  async function download(file: ClientDeliveryFile) {
    const controller = fileRequest.current;
    if (!selected || !controller || controller.signal.aborted || downloadLock.current) return;
    downloadLock.current = true; setDownloading(file.id); setError('');
    try {
      const blob = await pmTicketApi.getDeliveryCandidateFile(ticket.id, selected.id, file, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = file.filename; document.body.appendChild(link);
      try { link.click(); setRead(current => current.includes(file.id) ? current : [...current, file.id]); }
      finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { if (!controller.signal.aborted) { setRead([]); setAcknowledged(false); setError('The file could not be verified. No file was opened.'); } }
    finally { downloadLock.current = false; if (!controller.signal.aborted) setDownloading(null); }
  }
  const inspected = manifest !== null && manifest.files.every(file => read.includes(file.id));
  const available = canAssessTicketDelivery(ticket, clientAccessActive);
  return <section aria-label="PM result assessment" className="border-b border-white/[0.07] p-4 md:p-5">
    <h3 className="text-sm font-medium text-gray-100">Review a prepared result</h3>
    <p className="mt-2 text-[11px] leading-relaxed text-gray-500">These protected candidates are not approved or visible to the client. Inspect the files and client-facing summary against the agreed work.</p>
    {loading && <p role="status" className="mt-3 text-xs text-gray-500">Checking prepared results…</p>}
    {!loading && !error && candidates.length === 0 && <p className="mt-3 text-xs text-gray-500">No verified delivery is prepared yet. Completing Issues alone does not create a client delivery.</p>}
    {error && <p role="alert" className="mt-3 text-xs text-amber-200/80">{error}</p>}
    {candidates.length > 0 && <label className="mt-3 block text-xs text-gray-300">Prepared result<select aria-label="Prepared result" className={`${input} mt-2`} value={selectedId} disabled={disabled || downloading !== null} onChange={event => { setManifest(null); setRead([]); setAcknowledged(false); setSelectedId(event.target.value); setError(''); }}>
      {candidates.map((candidate, index) => <option key={candidate.id} value={candidate.id}>Result {index + 1} · {candidate.fileCount} file{candidate.fileCount === 1 ? '' : 's'}</option>)}
    </select></label>}
    {cursor && <button className={`${secondary} mt-2`} disabled={disabled || loadingMore} onClick={() => void more()}>{loadingMore ? 'Loading…' : 'More prepared results'}</button>}
    {selected && <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-white/[0.07] p-3 text-xs leading-relaxed text-gray-300">{selected.summary}</p>}
    {manifestLoading && <p role="status" className="mt-3 text-xs text-gray-500">Checking protected files…</p>}
    <div className="mt-3 space-y-2">{manifest?.files.map(file => <div key={file.id} className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-white/[0.06] p-2">
      <span className="min-w-0 break-words text-xs text-gray-300">{file.filename}{read.includes(file.id) ? ' · inspected' : ''}</span>
      <button className={`${secondary} shrink-0`} disabled={disabled || downloading !== null} aria-label={`Inspect candidate ${file.filename}`} onClick={() => void download(file)}><Download size={12} />{downloading === file.id ? 'Checking…' : 'Inspect file'}</button>
    </div>)}</div>
    {selected && <div className="mt-3 space-y-3">
      <label className="flex items-start gap-2 text-[11px] text-gray-300"><input type="checkbox" checked={acknowledged} disabled={disabled || !inspected || Boolean(error)} onChange={event => setAcknowledged(event.target.checked)} className="mt-0.5 accent-violet-500" />I inspected all result files and the summary, and confirm they match the agreed work and are suitable to share with the client.</label>
      <button className={primary} disabled={disabled || !available || !inspected || !acknowledged || Boolean(error) || downloading !== null} onClick={() => { if (selected && inspected && acknowledged && available && !error) void onAssess(selected.id); }}>Approve result for sharing</button>
      <p className="text-[10px] text-gray-500">This records PM assessment only. Sharing with the client is a separate action. If work needs fixing, use Return affected Issues above.</p>
    </div>}
    {error && <button className={`${secondary} mt-3`} disabled={disabled || downloading !== null || loading} onClick={() => setRetry(value => value + 1)}>Refresh prepared results</button>}
  </section>;
}
