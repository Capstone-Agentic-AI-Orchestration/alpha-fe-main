import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';

import { pmTicketApi, type PmTicketDetail } from './pmApi';
import type { ClientDeliveryFile, ClientDeliveryManifest } from './clientDelivery';
import { canShareAssessedDelivery } from './pmReview';
import { primary, secondary } from './ticketUi';

/** One-page Tickets inspection of an already assessed immutable delivery.
 * Registration and technical assessment are NOT synthesized by this form.
 */
export function PmDeliveryReview({ ticket, clientAccessActive, disabled, onShare }: {
  ticket: PmTicketDetail; clientAccessActive: boolean; disabled: boolean; onShare: () => Promise<boolean>;
}) {
  const delivery = ticket.internal.deliveryAssessment!;
  const [manifest, setManifest] = useState<ClientDeliveryManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [read, setRead] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const request = useRef<AbortController | null>(null);
  const downloadLock = useRef(false);

  useEffect(() => {
    const controller = new AbortController(); request.current = controller;
    setManifest(null); setLoading(true); setError(''); setRead(false); setAcknowledged(false);
    pmTicketApi.getDelivery(ticket.id, delivery.id, controller.signal).then(value => {
      if (controller.signal.aborted) return;
      if (value.scopeVersionId !== delivery.scopeVersionId) throw new Error('Changed scope');
      setManifest(value);
    }).catch(() => { if (!controller.signal.aborted) setError('Protected delivery is unavailable. Refresh before sharing.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); request.current = null; };
  }, [ticket.id, delivery.id, delivery.scopeVersionId, delivery.pinnedAssetId, retry]);

  async function download(file: ClientDeliveryFile) {
    const controller = request.current;
    if (!controller || controller.signal.aborted || downloadLock.current) return;
    downloadLock.current = true; setDownloading(file.id); setError('');
    try {
      const blob = await pmTicketApi.getDeliveryFile(ticket.id, delivery.id, file, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = file.filename; document.body.appendChild(link);
      try { link.click(); setRead(true); }
      finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch {
      if (!controller.signal.aborted) { setRead(false); setAcknowledged(false); setError('The file could not be verified. No file was opened.'); }
    } finally { downloadLock.current = false; if (!controller.signal.aborted) setDownloading(null); }
  }

  const shareAvailable = canShareAssessedDelivery(ticket, clientAccessActive);
  return <section aria-label="PM result inspection" className="border-b border-white/[0.07] p-4 md:p-5">
    <h3 className="text-sm font-medium text-gray-100">{delivery.shared ? 'Shared result' : 'Assessed result · not shared yet'}</h3>
    <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-300">{delivery.summary}</p>
    {loading && <p role="status" className="mt-3 text-[11px] text-gray-500">Checking protected delivery…</p>}
    {error && <p role="alert" className="mt-3 text-[11px] text-amber-200/80">{error}</p>}
    <div className="mt-3 space-y-2">{manifest?.files.map(file => <div key={file.id} className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-white/[0.06] p-2">
      <span className="min-w-0 break-words text-xs text-gray-300">{file.filename}</span><button className={`${secondary} shrink-0`} disabled={disabled || downloading !== null} onClick={() => void download(file)} aria-label={`Inspect ${file.filename}`}>
        <Download size={12} />{downloading === file.id ? 'Checking…' : 'Inspect file'}</button></div>)}</div>
    {error && <button className={`${secondary} mt-2`} disabled={disabled || downloading !== null || loading} onClick={() => setRetry(value => value + 1)}>Refresh result files</button>}
    {shareAvailable && <div className="mt-3 space-y-3">
      <p className="text-[11px] text-gray-500">Inspect the pinned result before sharing. Only the displayed client-facing summary and permitted files will be shared, not private notes or repository access.</p>
      <label className="flex items-start gap-2 text-[11px] text-gray-300"><input type="checkbox" checked={acknowledged} disabled={disabled || !read || Boolean(error)} onChange={event => setAcknowledged(event.target.checked)} className="mt-0.5 accent-violet-500" />I reviewed this result and its client-facing content against the agreed work.</label>
      <button className={primary} disabled={disabled || !read || !acknowledged || Boolean(error) || downloading !== null} onClick={() => void onShare()}>Share result with client</button>
      <p className="text-[10px] text-gray-500">Sharing asks for client review. It does not close the ticket, complete the project, merge code or deploy.</p>
    </div>}
  </section>;
}
