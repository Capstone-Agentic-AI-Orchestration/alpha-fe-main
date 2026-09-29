import { useCallback, useEffect, useState } from 'react';
import { Check, KeyRound, Loader2, X } from 'lucide-react';

import { useApp } from '@/app/AppContext';
import { apiService, parseApiError } from '@/shared/services/apiService';
import { isDesktop } from '@/shared/desktop';

type Approval = Awaited<ReturnType<typeof apiService.getRunHostingApprovals>>['approvals'][number];

/** An agent may ask while the run is going; look again this often. */
const POLL_MS = 10_000;

/**
 * Production variable changes an agent asked for in this run, waiting for a
 * person. Shown by key only: the values are held in the desktop app's memory
 * until someone approves (they go to the platform) or rejects (they are
 * dropped). Only a project manager or admin may decide. Renders nothing when
 * nothing is waiting -- and outside the desktop app, where runs do not happen.
 */
export function HostingApprovals({ runId }: Readonly<{ runId: string }>) {
  const { can } = useApp();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);
  const canDecide = can('manage_deployments');

  const load = useCallback(async () => {
    try {
      setApprovals((await apiService.getRunHostingApprovals(runId)).approvals);
    } catch {
      // Nothing to show is the right answer when the list cannot be read.
      setApprovals([]);
    }
  }, [runId]);

  useEffect(() => {
    if (!isDesktop) return;
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const decide = async (approval: Approval, decision: 'approve' | 'reject') => {
    setBusy(approval.id);
    setMessage(null);
    try {
      const result = await apiService.decideRunHostingApproval(runId, approval.id, decision);
      if ('changed' in result) {
        const failed = result.failed.map(f => `${f.key} (${f.error})`).join('; ');
        setMessage({
          tone: failed || result.redeployError ? 'warn' : 'ok',
          text:
            `Set ${result.changed.join(', ') || 'nothing'} on production.` +
            (failed ? ` Not set: ${failed}.` : '') +
            (result.redeployed ? ' Redeploying.' : '') +
            (result.redeployError ? ` The redeploy did not start: ${result.redeployError}` : '')
        });
      } else {
        setMessage({ tone: 'ok', text: `Rejected; ${result.keys.join(', ')} were not changed.` });
      }
    } catch (err) {
      const { status, message: detail } = parseApiError(err);
      setMessage({ tone: 'warn', text: status === 404 ? 'That change is no longer waiting.' : detail });
    } finally {
      setBusy(null);
      void load();
    }
  };

  if (!isDesktop || (approvals.length === 0 && !message)) return null;

  return (
    <div className="space-y-2 rounded-lg border border-amber-400/30 bg-amber-400/[0.06] p-3">
      {approvals.map(approval => (
        <div key={approval.id} className="space-y-2">
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-200">
            <KeyRound className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden />
            <span>
              The agent wants to set <span className="font-mono">{approval.keys.join(', ')}</span> on{' '}
              <span className="font-mono">{approval.repo}</span> production
              {approval.redeploy ? ', then redeploy it' : ''}. Values are hidden and are only sent if you approve.
            </span>
          </p>
          {canDecide ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void decide(approval, 'approve')}
                disabled={busy !== null}
                className="inline-flex items-center gap-1 rounded-md bg-amber-400/20 px-2 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-400/30 disabled:opacity-50"
              >
                {busy === approval.id ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Check className="h-3 w-3" aria-hidden />}
                Approve and apply
              </button>
              <button
                type="button"
                onClick={() => void decide(approval, 'reject')}
                disabled={busy !== null}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-gray-300 hover:bg-white/5 disabled:opacity-50"
              >
                <X className="h-3 w-3" aria-hidden /> Reject
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-gray-400">A project manager or admin has to approve production changes.</p>
          )}
        </div>
      ))}
      {message && (
        <p role="status" className={`text-[11px] ${message.tone === 'ok' ? 'text-emerald-300' : 'text-amber-300'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
