import { useEffect, useRef, useState } from 'react';
import { apiService } from '@/shared/services/apiService';
import type { DeliveryAction, DeliveryResponse, OrchestrationDelivery } from '@/shared/types/delivery';

export function deliveryActionFor(delivery: OrchestrationDelivery, canControl: boolean, _canPromote: boolean): { action: DeliveryAction; label: string } | null {
  if (!canControl) return null;
  if (delivery.authorization?.paused) return { action: 'resume_delivery', label: 'Resume delivery to UAT' };
  if (delivery.stage === 'repair_required') return delivery.repairAttempts < 2 && !delivery.repairRunId ? { action: 'prepare_repair', label: 'Prepare CI repair plan' } : null;
  if (delivery.authorization) return null;
  switch (delivery.stage) {
    case 'pr_checks': case 'dev_approval': case 'dev_checks': case 'uat_prepare': case 'uat_checks': case 'uat_approval': case 'uat_deploying':
      return { action: 'enable_uat', label: 'Deliver to UAT automatically' };
    default: return null;
  }
}
function githubLink(value: string | undefined): string | undefined {
  try { const url = new URL(value ?? ''); return url.protocol === 'https:' && url.hostname === 'github.com' ? url.href : undefined; }
  catch { return undefined; }
}
const labels: Record<string, string> = {
  pr_checks: 'PR checks', dev_approval: 'Ready for dev', dev_checks: 'Dev checks', uat_prepare: 'Preparing UAT',
  uat_checks: 'UAT promotion checks', uat_approval: 'Ready to promote to UAT', uat_deploying: 'Verifying UAT',
  uat_ready: 'UAT ready for PM review', repair_required: 'CI needs repair', blocked: 'Delivery needs attention', superseded: 'Replaced by repair build'
};

export function OrchestrationDeliveryPanel({ projectId, runId, onRepairPrepared }: { projectId: string; runId: string; onRepairPrepared?: () => void }) {
  const scope = projectId + ':' + runId;
  const [loaded, setLoaded] = useState<{ scope: string; response: DeliveryResponse } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(false);
  const generation = useRef(0);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    const request = ++generation.current;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    setLoaded(null); setError(''); setFresh(false); setBusy(false);
    const refresh = async () => {
      try {
        const response = await apiService.getOrchestrationDelivery(projectId, runId);
        if (!stopped && request === generation.current) { setLoaded({ scope, response }); setFresh(true); setError(''); }
      } catch {
        if (!stopped && request === generation.current) { setFresh(false); setError('Delivery status could not be refreshed. Reconnect and retry.'); }
      }
    };
    refreshRef.current = refresh;
    const poll = async () => {
      if (document.visibilityState !== 'hidden') await refresh();
      if (!stopped) timer = setTimeout(() => void poll(), 30_000);
    };
    void poll();
    return () => { stopped = true; generation.current += 1; clearTimeout(timer); };
  }, [projectId, runId, scope]);
  const response = loaded?.scope === scope ? loaded.response : null;
  const delivery = response?.delivery;
  if (!delivery && !error) return null;
  const next = delivery && response && fresh ? deliveryActionFor(delivery, response.canControl, response.canPromote) : null;
  const act = async () => {
    if (!next || !delivery || busy || !fresh) return;
    const current = generation.current;
    setBusy(true); setError('');
    try {
      await apiService.orchestrationDeliveryAction(projectId, runId, next.action, delivery.revision, crypto.randomUUID());
      if (generation.current !== current) return;
      setFresh(false); await refreshRef.current();
      if (next.action === 'prepare_repair') onRepairPrepared?.();
    } catch (failure) {
      if (generation.current === current) { setFresh(false); setError(failure instanceof Error ? failure.message : 'Delivery action failed. Refresh before retrying.'); }
    } finally { if (generation.current === current) setBusy(false); }
  };
  return <section aria-label="Delivery to UAT" className="mt-2 rounded-xl border border-divider bg-surface-raised px-4 py-3 text-xs text-content-secondary">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="font-medium text-content-primary">Delivery · {delivery ? labels[delivery.stage] ?? 'Checking status' : 'Status unavailable'}</p>
      <button type="button" disabled={busy} onClick={() => void refreshRef.current()} className="rounded px-2 py-1 hover:bg-surface-high focus-visible:outline focus-visible:outline-2">Refresh</button>
    </div>
    {delivery && <>
      <p role="status" className="mt-1">{delivery.reason}</p>
      <p className="mt-1 break-words">{delivery.repositories.map(repo => `${repo.repository} · ${(delivery.stage.startsWith('uat') ? repo.devHead ?? repo.head : repo.head).slice(0, 12)}`).join(' / ')}</p>
      <details className="mt-2 max-h-64 overflow-y-auto">
        <summary className="cursor-pointer">Review commits and CI evidence</summary>
        {delivery.repositories.map(repo => <div key={repo.repository} className="mt-2 break-words border-t border-divider pt-2">
          <p className="font-medium text-content-primary">{repo.repository}</p>
          <p>Published: <code>{repo.head}</code></p>
          {repo.devBase && <p>Dev target reviewed: <code>{repo.devBase}</code></p>}
          {repo.devHead && <p>Dev: <code>{repo.devHead}</code></p>}
          {repo.uatBase && <p>UAT target reviewed: <code>{repo.uatBase}</code></p>}
          {repo.uatHead && <p>UAT: <code>{repo.uatHead}</code></p>}
          <div className="flex gap-3 py-1">
            {githubLink(repo.prUrl) && <a href={githubLink(repo.prUrl)} target="_blank" rel="noopener noreferrer" className="underline">Code PR</a>}
            {githubLink(repo.uatPrUrl) && <a href={githubLink(repo.uatPrUrl)} target="_blank" rel="noopener noreferrer" className="underline">UAT promotion PR</a>}
          </div>
          <ul>{repo.checks.map(check => <li key={check.name}>{check.name}: {check.state}</li>)}</ul>
          {repo.deployment?.verifiedAt && <p>HTTP smoke check passed at {repo.deployment.verifiedAt}. Browser acceptance remains part of PM review.</p>}
        </div>)}
        <p className="mt-2">CI repair plans used: {delivery.repairAttempts}/2.</p>
        <ul className="mt-2">{delivery.history.slice(-5).map((event, index) => <li key={index}>{event.actorId} · {event.detail}</li>)}</ul>
      </details>
      {delivery.authorization && <p className="mt-2">{delivery.authorization.paused ? 'Automatic delivery is paused.' : 'Automatic delivery is enabled. Passing CI and independent review are required; UAT needs no PM/admin approval.'}</p>}
      {delivery.authorization && !delivery.authorization.paused && response?.canControl && <button type="button" disabled={busy || !fresh} onClick={async () => {
        const current = generation.current; setBusy(true);
        try { await apiService.orchestrationDeliveryAction(projectId, runId, 'pause_delivery', delivery.revision, crypto.randomUUID()); if (generation.current === current) await refreshRef.current(); }
        catch { if (generation.current === current) { setFresh(false); setError('Pause could not be confirmed. Refresh delivery status.'); } }
        finally { if (generation.current === current) setBusy(false); }
      }} className="mt-2 rounded border border-divider px-3 py-2 disabled:opacity-50">Pause automatic delivery</button>}
      {next && <div className="mt-3">
        <p className="mb-2">{next.action === 'prepare_repair' ? 'This prepares a plan. Specialists wait for your plan approval before editing.' : 'Alpha will merge these reviewed changes into dev, promote to UAT after required checks, and verify the deployment. You can pause delivery. Production and client handoff stay separate.'}</p>
        <button type="button" disabled={busy} onClick={() => void act()} className="rounded-lg bg-action px-3 py-2 font-medium text-on-action disabled:opacity-50 focus-visible:outline focus-visible:outline-2">{busy ? 'Working…' : next.label}</button>
      </div>}
    </>}
    {error && <p role="alert" className="mt-2 text-status-danger">{error}</p>}
  </section>;
}
