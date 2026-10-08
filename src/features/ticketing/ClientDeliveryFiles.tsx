import { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';

import { clientTicketApi } from './clientApi';
import type { ClientDeliveryFile, ClientDeliveryManifest } from './clientDelivery';
import { secondary } from './ticketUi';

/** Rendered only for the exact currently shared delivery, not a project URL. */
export function ClientDeliveryFiles({ workspaceId, ticketId, deliveryId, scopeVersionId, onInspectionChange, api = clientTicketApi }: {
  workspaceId: string; ticketId: string; deliveryId: string; scopeVersionId: string;
  onInspectionChange?: (verified: boolean) => void;
  api?: typeof clientTicketApi;
}) {
  const [manifest, setManifest] = useState<ClientDeliveryManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const request = useRef<AbortController | null>(null);
  const downloadLock = useRef(false);
  const inspectionCallback = useRef(onInspectionChange); inspectionCallback.current = onInspectionChange;

  useEffect(() => {
    const controller = new AbortController(); request.current = controller;
    setManifest(null); setLoading(true); setError('');
    inspectionCallback.current?.(false);
    api.getDelivery(workspaceId, ticketId, deliveryId, controller.signal).then(value => {
      if (controller.signal.aborted) return;
      if (value.scopeVersionId !== scopeVersionId) throw new Error('Changed scope');
      setManifest(value);
    }).catch(() => {
      if (!controller.signal.aborted) setError('Protected result files are unavailable. Refresh or ask your project manager.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); request.current = null; inspectionCallback.current?.(false); };
  }, [workspaceId, ticketId, deliveryId, scopeVersionId, retry, api]);

  async function download(file: ClientDeliveryFile) {
    const controller = request.current;
    if (!controller || controller.signal.aborted || downloadLock.current) return;
    downloadLock.current = true; setDownloading(file.id); setError('');
    try {
      const blob = await api.getDeliveryFile(workspaceId, ticketId, deliveryId, file, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = file.filename;
      document.body.appendChild(link);
      try { link.click(); }
      finally {
        link.remove();
        // Allow the browser to start its download before revoking the local URL.
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      inspectionCallback.current?.(true);
    } catch {
      inspectionCallback.current?.(false);
      if (!controller.signal.aborted) setError('The download could not be verified. No file was opened. Refresh or contact your project manager.');
    } finally {
      downloadLock.current = false;
      if (!controller.signal.aborted) setDownloading(null);
    }
  }

  return <section aria-label="Protected delivery files" className="mt-3 space-y-2 border-t border-white/[0.07] pt-3">
    {loading && <p role="status" className="text-[11px] text-gray-400">Checking protected result files…</p>}
    {error && <div role="alert" className="space-y-2 text-[11px] text-amber-200/80"><p>{error}</p>
      <button onClick={() => setRetry(value => value + 1)} disabled={loading || downloading !== null} className={secondary}><RefreshCw size={12} />Refresh files</button></div>}
    {manifest?.files.map(file => <div key={file.id} className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-white/[0.06] p-2">
      <div className="min-w-0"><p className="break-words text-xs text-gray-200">{file.filename}</p>
        <p className="text-[10px] text-gray-500">{new Intl.NumberFormat().format(file.byteLength)} bytes · pinned result</p></div>
      <button onClick={() => void download(file)} disabled={downloading !== null} className={`${secondary} shrink-0`} aria-label={`Download ${file.filename}`}>
        <Download size={12} />{downloading === file.id ? 'Checking…' : 'Download'}</button>
    </div>)}
    {manifest && <p className="text-[10px] leading-relaxed text-gray-500">Downloads are checked against this shared result. These files do not grant repository or internal project access.</p>}
  </section>;
}
