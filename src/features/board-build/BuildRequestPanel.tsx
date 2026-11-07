import { useState } from 'react';
import { useApp } from '@/app/AppContext';
import { apiService, type IssueBuildStatus } from '@/shared/services/apiService';
import type { Issue } from '@/shared/types';

export function BuildRequestPanel({ issue, build, onChanged, onOpenTask }: {
  issue: Issue; build?: IssueBuildStatus; onChanged?: () => void;
  onOpenTask?: (id: string, projectId: string) => void;
}) {
  const { can, role } = useApp();
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const blocker = build?.blocker;
  const request = build?.request;
  const pending = request && ['waiting', 'planning'].includes(request.status);
  const allowed = role === 'dev' && can('run_builds') && can('manage_chat') && build?.fresh !== false;
  if (!blocker && !request && build?.fresh !== false) return null;
  return <section aria-label="Planning request" className="space-y-2 rounded-md border border-divider bg-well p-3 text-[12.5px] text-content-secondary">
    <h3 className="font-semibold">{build?.fresh === false ? 'Build status unavailable' : request?.status === 'planning' ? 'Preparing plan' : pending ? 'Plan queued' : blocker ? `Waiting for ${blocker.identifier ?? 'another build'}` : 'Planning needs review'}</h3>
    <p>{build?.fresh === false ? 'Reconnect or refresh before changing the build.' : request?.reason ?? (blocker ? `A selected repository is reserved by a ${blocker.status.replace(/_/g, ' ')} build. Waiting does not cancel either task.` : 'Your request is saved on this desktop. Code changes require plan approval.')}</p>
    {blocker?.issueId && blocker.projectId && onOpenTask && <button type="button" className="text-link" onClick={() => onOpenTask(blocker.issueId!, blocker.projectId!)}>Open {blocker.identifier ?? 'blocking task'}</button>}
    {allowed && blocker && !pending && <>
      <label className="block">Developer instructions (optional)
        <textarea rows={2} maxLength={2000} value={instructions} onChange={event => setInstructions(event.target.value)} className="mt-1 w-full rounded border border-control bg-well p-2" />
      </label>
      <button type="button" disabled={busy} className="rounded border border-control px-3 py-1 text-link" onClick={async () => {
        setBusy(true); setError('');
        try { await apiService.requestIssueBuild(issue.projectId, issue.id, { requestId: crypto.randomUUID(), instructions, queue: true }); onChanged?.(); }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'The plan was not queued.'); }
        finally { setBusy(false); }
      }}>Queue plan</button>
    </>}
    {allowed && request?.status === 'waiting' && <button type="button" disabled={busy} className="text-link" onClick={async () => {
      setBusy(true); setError('');
      try { await apiService.cancelBuildRequest(issue.projectId, request.id); onChanged?.(); }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'The queued request was not removed.'); }
      finally { setBusy(false); }
    }}>Remove queued request</button>}
    {error && <p role="alert" className="text-status-danger">{error}</p>}
  </section>;
}
