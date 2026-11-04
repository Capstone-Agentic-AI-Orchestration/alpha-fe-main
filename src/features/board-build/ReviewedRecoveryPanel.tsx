import { useState } from 'react';
import { apiService } from '@/shared/services/apiService';

export function ReviewedRecoveryPanel({ projectId, runId, canControl, onChanged }: { projectId: string; runId: string; canControl: boolean; onChanged: () => void }) {
  const [candidate, setCandidate] = useState<Awaited<ReturnType<typeof apiService.getRecoveryCandidate>> | null>(null);
  const [guidance, setGuidance] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <section aria-label="Saved work" className="space-y-2 text-[12.5px] text-content-secondary">
    <button type="button" disabled={busy} className="text-link" onClick={async () => {
      setBusy(true); setError(''); setReviewed(false);
      try { setCandidate(await apiService.getRecoveryCandidate(projectId, runId)); }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'Saved work could not be loaded.'); }
      finally { setBusy(false); }
    }}>Review saved work</button>
    {candidate && <>
      <p>These candidate edits are unverified. Accepted work and earlier attempts remain in the build history.</p>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded border border-divider bg-well p-2 text-[11px]">{JSON.stringify(candidate.changes, null, 2)}</pre>
      {(candidate.archives ?? []).map(archive => <details key={archive.id} className="rounded border border-divider p-2">
        <summary>Saved archive · {archive.savedAt}</summary>
        <p className="mt-2">{archive.files.join(', ')}</p>
        <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-[11px]">{archive.patch}{archive.patchTruncated ? '\nPreview truncated; inspect the full local archive before restoring.' : ''}</pre>
        {(archive.untracked ?? []).map(file => <details key={file.path}><summary>{file.path}{file.truncated ? ' (truncated)' : ''}</summary><pre className="max-h-52 overflow-auto whitespace-pre-wrap text-[11px]">{file.content}</pre></details>)}
        {canControl && !archive.patchTruncated && !archive.untracked?.some(file => file.truncated) && <button type="button" disabled={busy} className="mt-2 text-link" onClick={async () => {
          if (!window.confirm('Restore this inspected archive into the unchanged, clean candidate? It remains unverified and will not start an agent.')) return;
          setBusy(true); setError(''); setReviewed(false);
          try { await apiService.restoreRecoveryArchive(projectId, runId, { expectedRevision: candidate.runRevision, taskId: candidate.taskId, archiveId: archive.id, archiveHash: archive.hash, candidateHash: candidate.candidateHash }); setCandidate(await apiService.getRecoveryCandidate(projectId, runId)); onChanged(); }
          catch (failure) { setError(failure instanceof Error ? failure.message : 'Archive restoration failed. Review the candidate before continuing.'); }
          finally { setBusy(false); }
        }}>Restore inspected archive</button>}
      </details>)}
      {candidate.restartAvailable && canControl && <>
        <label className="block">What changed since the failures? Describe the recovery instructions.
          <textarea rows={3} maxLength={2000} value={guidance} onChange={event => setGuidance(event.target.value)} className="mt-1 w-full rounded border border-control bg-well p-2" />
        </label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />I reviewed the saved changes and authorize a bounded restart of this failed step. Checks and final approval still apply.</label>
        <button type="button" disabled={busy || !reviewed || guidance.trim().length < 20} className="rounded border border-control px-3 py-1 text-link" onClick={async () => {
          setBusy(true); setError('');
          try { await apiService.restartReviewedRecovery(projectId, runId, { expectedRevision: candidate.runRevision, taskId: candidate.taskId, taskRevision: candidate.taskRevision, candidateHash: candidate.candidateHash, guidance }); setCandidate(null); onChanged(); }
          catch (failure) { setError(failure instanceof Error ? failure.message : 'Recovery was not started.'); setReviewed(false); }
          finally { setBusy(false); }
        }}>Authorize recovery restart</button>
      </>}
    </>}
    {error && <p role="alert" className="text-status-danger">{error}</p>}
  </section>;
}
