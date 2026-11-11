import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Progress } from '@/shared/components/ui/progress';
import { apiService } from '@/shared/services/apiService';
import { isDesktop } from '@/shared/desktop';
import type { ProviderLimitsSnapshot } from '@/shared/types';

export function UsageLimitsPopover({ compact }: { compact: boolean }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ProviderLimitsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const load = useCallback(async (refresh = false) => {
    if (!isDesktop) return;
    setLoading(true);
    setError(false);
    try { setData(refresh ? await apiService.refreshProviderLimits() : await apiService.getProviderLimits()); }
    catch { setError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) void load(); }, [open, load]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);

  return <div ref={root} className="relative px-2 pb-1">
    <Button ref={trigger} type="button" variant="ghost" size="sm" aria-expanded={open} aria-controls="sidebar-usage-limits" onClick={() => setOpen(value => !value)} title="AI usage limits" className={`h-9 text-content-secondary ${compact ? 'w-full justify-center px-0' : 'w-full justify-start gap-2.5 px-2'}`}>
      <Activity className="h-4 w-4 shrink-0" aria-hidden="true" />{!compact && <span>AI usage limits</span>}
    </Button>
    {open && <div id="sidebar-usage-limits" role="region" aria-label="AI usage limits" className="absolute bottom-full left-2 z-50 mb-2 w-[min(22rem,calc(100vw-1rem))] rounded-xl border border-divider bg-surface p-4 text-content shadow-lg">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">AI usage limits</h2><p className="mt-0.5 text-[11px] text-content-muted">Provider account limits on this desktop</p></div><Button type="button" variant="ghost" size="sm" onClick={() => void load(true)} disabled={loading || !isDesktop} aria-label="Refresh usage limits"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button></div>
      {!isDesktop ? <p className="mt-4 text-xs text-content-secondary">Open Alpha Desktop to view local provider limits.</p> : loading && !data ? <p className="mt-4 text-xs text-content-muted">Checking limits…</p> : error && !data ? <p className="mt-4 text-xs text-status-danger">Could not load limits. Try refreshing.</p> : <div className="mt-3 space-y-3">{error && <p className="text-xs text-status-danger">Refresh failed. Showing the last result.</p>}{data?.providers.map(provider => <section key={provider.provider} className="border-t border-divider pt-3"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold">{provider.name}</span><span className="text-[11px] text-content-muted">{provider.status.replace('_', ' ')}</span></div>{provider.windows.length ? provider.windows.map(window => <div key={window.id} className="mt-2 space-y-1"><div className="flex justify-between gap-2 text-[11px] text-content-secondary"><span>{window.label}</span><span>{window.remainingPercent}% remaining</span></div><Progress value={window.usedPercent} aria-label={`${provider.name} ${window.label} used`} /><p className="text-[10px] text-content-muted">{window.resetsAt ? `Resets ${new Date(window.resetsAt).toLocaleString()}` : 'Reset time not reported'}</p></div>) : <p className="mt-1 text-[11px] text-content-muted">{provider.detail}</p>}<a href={provider.dashboardUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[11px] text-link hover:underline">Open provider usage</a></section>)}{data && !data.providers.length && <p className="text-xs text-content-muted">No provider limits available.</p>}{data?.lastRefreshedAt && <p className="text-[10px] text-content-muted">Checked {new Date(data.lastRefreshedAt).toLocaleString()}</p>}</div>}
    </div>}
  </div>;
}
