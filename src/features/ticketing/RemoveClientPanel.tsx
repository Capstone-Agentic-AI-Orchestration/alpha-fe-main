import { useEffect, useId, useState } from 'react';
import { UserMinus } from 'lucide-react';

import { Modal } from '@/shared/components/Modal';
import { parseApiError } from '@/shared/services/apiService';
import type { PmClientSummary } from './pmApi';
import type { PmClientRemovalApi, PmClientRemovalPreview, PmClientRemovalResult } from './clientRemovalApi';

/**
 * Remove a client from the workspace, from the client's Access tab. Their
 * access ends, the projects only they use are archived with their
 * repositories, and their sign-in is removed so they can come back later
 * with a new inquiry and a new account. Their requests stay in Tickets.
 */
export function RemoveClientPanel({ api, client, onRemoved }: {
  api: PmClientRemovalApi;
  client: PmClientSummary;
  onRemoved: (result: PmClientRemovalResult) => void;
}) {
  const [open, setOpen] = useState(false);
  return <div className="border-t border-divider pt-4">
    <h2 className="text-[13px] font-semibold text-content">Remove client</h2>
    <p className="mt-1 max-w-prose text-xs text-content-secondary">
      Ends their portal access and archives the projects only they use, with their repositories. Their requests stay in Tickets.
      They can send a new inquiry later and get a new account.
    </p>
    <button type="button" onClick={() => setOpen(true)}
      className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-status-danger-border px-2.5 py-1.5 text-xs font-medium text-status-danger hover:bg-status-danger-subtle">
      <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />Remove client…
    </button>
    {open && <RemoveClientDialog api={api} client={client} onClose={() => setOpen(false)}
      onRemoved={result => { setOpen(false); onRemoved(result); }} />}
  </div>;
}

function RemoveClientDialog({ api, client, onClose, onRemoved }: {
  api: PmClientRemovalApi;
  client: PmClientSummary;
  onClose: () => void;
  onRemoved: (result: PmClientRemovalResult) => void;
}) {
  const nameInput = useId();
  const [preview, setPreview] = useState<PmClientRemovalPreview | null>(null);
  const [loadError, setLoadError] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirmed = typed.trim().toLowerCase() === client.displayName.trim().toLowerCase();

  useEffect(() => {
    let current = true;
    void api.preview(client.key)
      .then(result => { if (current) setPreview(result); })
      .catch(failure => { if (current) setLoadError(parseApiError(failure).message); });
    return () => { current = false; };
  }, [api, client.key]);

  const archiving = preview?.projects.filter(project => !project.sharedWithOtherClients) ?? [];
  const kept = preview?.projects.filter(project => project.sharedWithOtherClients) ?? [];

  const remove = async () => {
    if (!confirmed || busy || !preview) return;
    setBusy(true); setError('');
    try {
      onRemoved(await api.remove(client.key));
    } catch (failure) {
      setError(parseApiError(failure).message);
      setBusy(false);
    }
  };

  return <Modal isOpen onClose={onClose} closeDisabled={busy} title={`Remove ${client.displayName}`}
    subtitle="Their requests and messages stay in Tickets." maxWidth="max-w-lg"
    footer={<div className="flex items-center justify-end gap-2">
      <button type="button" onClick={onClose} disabled={busy} className="rounded-xl px-3 py-1.5 text-xs text-content-secondary hover:text-content disabled:opacity-40">Cancel</button>
      <button type="button" onClick={() => void remove()} disabled={!preview || !confirmed || busy}
        className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-medium text-on-accent transition-colors hover:bg-rose-500 disabled:opacity-40">
        {busy ? 'Removing… archiving repositories' : 'Remove client'}
      </button>
    </div>}>
    <div className="space-y-3 text-xs text-content-secondary">
      {loadError && <p role="alert" className="text-status-danger">{loadError}</p>}
      {!loadError && !preview && <p className="text-content-muted">Checking their projects…</p>}
      {preview && <>
          <ul className="list-disc space-y-1 pl-4">
            <li>Their portal access ends on {preview.tickets === 1 ? 'their 1 request' : `all ${preview.tickets} requests`}, and they are signed out.</li>
            <li>Their sign-in is removed, so the same email can send a new inquiry and get a new account later.</li>
          </ul>
          <div>
            <p className="font-medium text-content">{archiving.length ? 'Projects to archive' : 'No projects to archive'}</p>
            {archiving.length > 0 && <ul className="mt-1 space-y-1">
              {archiving.map(project => <li key={project.projectId}>
                {project.name}{project.archived && <span className="text-content-muted"> (already archived)</span>}
                {project.repositories.length > 0 && <span className="block font-mono text-[11px] text-content-muted">{project.repositories.join(', ')} → read-only on GitHub</span>}
              </li>)}
            </ul>}
          </div>
          {kept.length > 0 && <div>
            <p className="font-medium text-content">Kept, because another client uses them</p>
            <p className="mt-1">{kept.map(project => project.name).join(', ')}</p>
          </div>}
          <p>Archived projects can be restored from the Projects page.</p>
          <label htmlFor={nameInput} className="block pt-1">Type <span className="font-medium text-content">{client.displayName}</span> to confirm</label>
          <input id={nameInput} type="text" value={typed} onChange={event => setTyped(event.target.value)} disabled={busy}
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void remove(); } }}
            autoComplete="off" spellCheck={false}
            className="w-full rounded-xl border border-control bg-surface px-3 py-1.5 text-xs text-content focus:border-status-danger-border focus:outline-none disabled:opacity-50" />
          {error && <p role="alert" className="break-words text-status-danger">{error}</p>}
        </>}
    </div>
  </Modal>;
}
