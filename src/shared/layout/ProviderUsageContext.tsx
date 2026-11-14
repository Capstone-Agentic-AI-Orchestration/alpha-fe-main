import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp } from '@/app/AppContext';
import { isDesktop } from '@/shared/desktop';
import { apiService } from '@/shared/services/apiService';
import type { ProviderLimits, ProviderLimitsSnapshot, RuntimeEngine } from '@/shared/types';

const STALE_AFTER_MS = 15 * 60 * 1000;

export function limitForRuntime(runtime: RuntimeEngine, data: ProviderLimitsSnapshot | null) {
  const id = runtime.id.toLowerCase();
  const key = id === 'openai' ? 'codex' : id === 'anthropic' ? 'claude' : id;
  return data?.providers.find(provider => provider.provider === key);
}

export function quotaWindows(provider?: ProviderLimits) {
  return provider?.status === 'available'
    ? provider.windows.filter(window => Number.isFinite(window.remainingPercent) && window.remainingPercent >= 0 && window.remainingPercent <= 100)
    : [];
}

export function tightestQuota(provider?: ProviderLimits) {
  return quotaWindows(provider).reduce<(ReturnType<typeof quotaWindows>)[number] | undefined>(
    (lowest, window) => !lowest || window.remainingPercent < lowest.remainingPercent ? window : lowest, undefined
  );
}

export function freshQuota(provider: ProviderLimits | undefined, now: number) {
  const checkedAt = Date.parse(provider?.lastCheckedAt ?? '');
  if (!Number.isFinite(checkedAt) || now - checkedAt >= STALE_AFTER_MS) return undefined;
  // An elapsed reset time makes the old allowance unreliable even if it was checked recently.
  return tightestQuota(provider?.windows.some(window => window.resetsAt && Date.parse(window.resetsAt) <= now)
    ? undefined : provider);
}

type ProviderUsageState = { data: ProviderLimitsSnapshot | null; loading: boolean; error: boolean; now: number; load: (refresh?: boolean) => void };
const ProviderUsageContext = createContext<ProviderUsageState>({
  data: null, loading: false, error: false, now: 0, load: () => {},
});
export const useProviderUsage = () => useContext(ProviderUsageContext);

export function ProviderUsageProvider({ children }: { children: ReactNode }) {
  const { identity, identityStatus, role, localMode } = useApp();
  const scope = identity?.login ?? (localMode ? 'local' : '');
  const [result, setResult] = useState<{ scope: string; data: ProviderLimitsSnapshot | null; error: boolean }>({ scope: '', data: null, error: false });
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now);
  const pending = useRef(0);
  const load = useCallback(async (refresh = false) => {
    if (!isDesktop || role === 'client' || !scope) return;
    const request = ++pending.current;
    setLoading(true);
    try {
      const data = await (refresh ? apiService.refreshProviderLimits() : apiService.getProviderLimits());
      if (pending.current === request) setResult({ scope, data, error: false });
    } catch {
      if (pending.current === request) setResult(current => ({ scope, data: current.scope === scope ? current.data : null, error: true }));
    } finally {
      if (pending.current === request) { setNow(Date.now()); setLoading(false); }
    }
  }, [scope, role]);
  useEffect(() => {
    if (localMode || identityStatus === 'ready') void load();
    return () => { pending.current++; };
  }, [identityStatus, load, localMode]);
  useEffect(() => {
    if (!result.data) return;
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [result.data]);
  const current = result.scope === scope ? result : null;
  return <ProviderUsageContext.Provider value={{ data: current?.data ?? null, loading: loading && Boolean(scope), error: current?.error ?? false, now, load }}>
    {children}
  </ProviderUsageContext.Provider>;
}
