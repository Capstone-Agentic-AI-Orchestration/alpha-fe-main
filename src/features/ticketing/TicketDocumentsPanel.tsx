import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Download, FileText, RefreshCw, Upload, X } from 'lucide-react';

import type { TicketDocument, TicketDocumentsApi } from './ticketDocuments';
import { downloadTicketDocument, ticketDocumentOperationId } from './ticketDocuments';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.txt,.csv,application/pdf,image/png,image/jpeg,text/plain,text/csv';
const input = 'w-full rounded-lg border border-control bg-well px-3 py-2 text-xs text-content placeholder:text-content-muted focus:border-control focus:outline-none disabled:opacity-50';
const secondary = 'inline-flex items-center gap-1.5 rounded-lg border border-divider px-3 py-2 text-[11px] text-content hover:bg-surface-high disabled:cursor-not-allowed disabled:opacity-50';
const primary = 'inline-flex items-center gap-1.5 rounded-lg bg-action px-3 py-2 text-[11px] font-medium text-on-action hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-50';

interface PendingUpload { file: File; replacesDocumentId: string | null; operationId: string }

export function TicketDocumentsPanel({
  api, scope, ticketId, canUpload, heading = 'Ticket documents',
}: {
  api: TicketDocumentsApi;
  scope?: string;
  ticketId: string;
  canUpload: boolean;
  heading?: string;
}) {
  const [documents, setDocuments] = useState<TicketDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [replacementId, setReplacementId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setDocuments(await api.list(scope, ticketId));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load ticket documents.');
    } finally {
      setLoading(false);
    }
  }, [api, scope, ticketId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const groups = useMemo(() => {
    const grouped = new Map<string, TicketDocument[]>();
    for (const document of documents) {
      const group = grouped.get(document.groupId) ?? [];
      group.push(document);
      grouped.set(document.groupId, group);
    }
    return [...grouped.entries()].map(([groupId, versions]) => ({
      groupId, versions: versions.sort((a, b) => a.version - b.version),
    })).sort((a, b) => (b.versions.at(-1)?.createdAt ?? '').localeCompare(a.versions.at(-1)?.createdAt ?? ''));
  }, [documents]);

  function selectFile(next: File | null) {
    setFile(next);
    setError('');
    if (next && next.size > MAX_BYTES) setError('Choose a file up to 10 MB.');
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !canUpload || busy || file.size < 1 || file.size > MAX_BYTES) return;
    setBusy(true);
    setError('');
    let operation = pending && pending.file === file
      && pending.replacesDocumentId === replacementId ? pending : null;
    try {
      if (!operation) operation = {
        file, replacesDocumentId: replacementId,
        operationId: await ticketDocumentOperationId(ticketId, file, replacementId),
      };
      setPending(operation);
      await api.upload(scope, ticketId, file, replacementId, operation.operationId);
      setPending(null);
      setFile(null);
      setReplacementId(null);
      if (fileInput.current) fileInput.current.value = '';
      await refresh();
    } catch (reason) {
      // Keep the same content-derived operation ID. Retrying the identical file
      // is idempotent, including after a page refresh; nothing is stored locally.
      setError(reason instanceof Error ? reason.message : 'The document upload could not be confirmed. Retry the same file.');
    } finally {
      setBusy(false);
    }
  }

  async function download(document: TicketDocument) {
    if (document.status !== 'available' || busy) return;
    setBusy(true);
    setError('');
    try { downloadTicketDocument(await api.download(scope, ticketId, document.id), document); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The document could not be downloaded.'); }
    finally { setBusy(false); }
  }

  function proposeReplacement(document: TicketDocument) {
    setReplacementId(document.id);
    setFile(null);
    setPending(null);
    setError('');
    if (fileInput.current) fileInput.current.value = '';
    fileInput.current?.click();
  }

  return <section className="mt-4 rounded-xl border border-divider bg-surface" aria-label={heading}>
    <header className="flex items-center justify-between gap-3 border-b border-divider px-4 py-3">
      <div className="flex items-center gap-2"><FileText size={15} className="text-link" /><h3 className="text-sm font-medium text-content">{heading}</h3></div>
      <button type="button" onClick={() => void refresh()} disabled={loading || busy} className={secondary} aria-label="Refresh ticket documents"><RefreshCw size={12} />Refresh</button>
    </header>

    {error && <p role="alert" className="mx-4 mt-3 rounded-md border border-status-danger-border bg-status-danger-subtle p-2.5 text-[11px] text-status-danger">{error}</p>}
    {loading ? <p role="status" className="p-5 text-center text-[11px] text-content-muted">Loading documents…</p>
      : groups.length === 0 ? <p className="p-5 text-center text-[11px] text-content-muted">No documents have been added to this ticket.</p>
        : <div className="divide-y divide-divider">
          {groups.map(group => <div key={group.groupId} className="space-y-2 p-3">
            {group.versions.map((document, index) => <article key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-divider bg-surface-raised p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-content">{document.filename}<span className="ml-2 text-[10px] font-normal text-content-muted">v{document.version}</span></p>
                <p className="mt-1 text-[10px] text-content-muted">{document.author === 'pm' ? 'Project Manager' : 'Client'} · {new Date(document.createdAt).toLocaleString()}</p>
                {document.changeProposed && <p className="mt-1 text-[10px] text-status-warning">Proposed change · prior version is preserved; this does not change agreed work.</p>}
                {document.status === 'pending' && <p className="mt-1 text-[10px] text-status-warning">Upload not confirmed. Reselect the same file to safely retry.</p>}
                {index < group.versions.length - 1 && <p className="mt-1 text-[10px] text-content-muted">Earlier version retained in this ticket’s history.</p>}
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                {document.status === 'available' && <button type="button" onClick={() => void download(document)} disabled={busy} className={secondary}><Download size={12} />Download</button>}
                {canUpload && index === group.versions.length - 1 && document.status === 'available' && <button type="button" onClick={() => proposeReplacement(document)} disabled={busy} className={secondary}><Upload size={12} />Propose replacement</button>}
              </div>
            </article>)}
          </div>)}
        </div>}

    {canUpload && <form onSubmit={upload} className="space-y-2 border-t border-divider p-3">
      <div className="flex items-center justify-between gap-2"><label htmlFor={`ticket-document-${ticketId}`} className="text-[11px] text-content-secondary">{replacementId ? 'Choose the proposed replacement' : 'Add a document'}</label>
        {replacementId && <button type="button" onClick={() => { setReplacementId(null); setFile(null); setPending(null); if (fileInput.current) fileInput.current.value = ''; }} className="inline-flex items-center gap-1 text-[10px] text-content-muted hover:text-content-secondary"><X size={11} />Cancel replacement</button>}</div>
      <input ref={fileInput} id={`ticket-document-${ticketId}`} type="file" accept={ACCEPT} disabled={busy} onChange={event => selectFile(event.currentTarget.files?.[0] ?? null)} className={input} />
      <p className="text-[10px] leading-relaxed text-content-muted">PDF, PNG, JPEG, plain text or CSV · up to 10 MB. Documents remain private to this ticket. A replacement is a proposal, not an automatic change to agreed work.</p>
      {file && <p className="text-[10px] text-content-secondary">Selected: {file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
      <div className="flex justify-end"><button type="submit" disabled={!file || busy || file.size < 1 || file.size > MAX_BYTES} className={primary}><Upload size={12} />{busy ? 'Working…' : pending ? 'Retry same upload' : replacementId ? 'Propose replacement' : 'Upload document'}</button></div>
    </form>}
    {!canUpload && <p className="border-t border-divider px-4 py-3 text-center text-[10px] text-content-muted">This ticket is closed or document changes are unavailable.</p>}
  </section>;
}
