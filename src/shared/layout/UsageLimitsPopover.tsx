import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Progress } from '@/shared/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { apiService } from '@/shared/services/apiService';
import { isDesktop } from '@/shared/desktop';
import { providerUsageUrl } from '@/shared/lib/providerUsageUrl';
import type { ProviderLimits, ProviderLimitsSnapshot, RuntimeEngine } from '@/shared/types';
import { useApp } from '@/app/AppContext';
import { ProviderBrandIcon } from '@/features/settings/ProviderBrandIcon';

function limitProviderId(runtime: RuntimeEngine): ProviderLimits['provider'] | null {
  const id = runtime.id.toLowerCase();
  if (id === 'codex' || id === 'openai') return 'codex';
  if (id === 'claude' || id === 'anthropic') return 'claude';
  return null;
}

function availablePercent(provider?: ProviderLimits): number | null {
  const values = provider?.windows
    .map(window => window.remainingPercent)
    .filter(value => Number.isFinite(value));
  if (!values?.length) return null;
  return Math.max(0, Math.min(100, Math.min(...values)));
}

function QuotaRing({ runtime, remaining }: { runtime: RuntimeEngine; remaining: number | null }) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const tone = remaining === null
    ? 'text-content-muted'
    : remaining <= 10 ? 'text-status-danger' : remaining <= 25 ? 'text-status-warning' : 'text-status-success';
  const offset = remaining === null ? circumference : circumference * (1 - remaining / 100);

  return (
    <span className="relative inline-flex h-9 w-9 items-center justify-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full" aria-hidden="true" focusable="false">
        <circle cx="18" cy="18" r={radius} fill="none" stroke="rgb(var(--ui-divider))" strokeWidth="2.5" />
        <circle
          cx="18" cy="18" r={radius} fill="none"
          className={tone}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={remaining === null ? '1.75 3.5' : circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 18 18)"
        />
      </svg>
      <ProviderBrandIcon runtime={runtime} className="pointer-events-none relative z-10 h-3.5 w-3.5" />
    </span>
  );
}

function providerDescription(runtime: RuntimeEngine, remaining: number | null, provider?: ProviderLimits) {
  if (provider?.status === 'signed_out') return `${runtime.name}: signed out`;
  if (remaining !== null) return `${runtime.name}: ${remaining}% available`;
  return `${runtime.name}: quota not reported`;
}

export function UsageLimitsPopover({ compact }: { compact: boolean }) {
  const { runtimes } = useApp();
  const [data, setData] = useState<ProviderLimitsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (!isDesktop) return;
    setLoading(true);
    setError(false);
    try {
      setData(refresh ? await apiService.refreshProviderLimits() : await apiService.getProviderLimits());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Do not present merely installed or ready-to-run providers as authenticated.
  // A runtime auth method or provider-limits status that confirms an account is
  // required. The current quota API supports Codex and Claude only.
  const authenticated = runtimes
    .filter(runtime => runtime.status === 'online' && Boolean(limitProviderId(runtime)))
    .filter(runtime => {
      const providerId = limitProviderId(runtime);
      const limit = providerId ? data?.providers.find(provider => provider.provider === providerId) : undefined;
      if (limit?.status === 'signed_out') return false;
      return Boolean(runtime.account?.authMethod?.trim())
        || limit?.status === 'available'
        || (limit?.status === 'unsupported' && Boolean(limit.accountLabel));
    })
    .sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)) || a.name.localeCompare(b.name));
  const seenProviders = new Set<string>();
  const providers = authenticated.filter(runtime => {
    const key = runtime.provider.toLowerCase();
    if (seenProviders.has(key)) return false;
    const limit = limitProviderId(runtime);
    if (limit && data?.providers.some(provider => provider.provider === limit && provider.status === 'signed_out')) return false;
    seenProviders.add(key);
    return true;
  });

  if (!providers.length) return null;

  return (
    <div
      aria-label="Connected provider usage"
      className={`flex flex-col items-center gap-2 px-2 pb-2 ${compact ? '' : 'self-center'}`}
    >
      {providers.map(runtime => {
        const providerId = limitProviderId(runtime);
        const provider = providerId ? data?.providers.find(item => item.provider === providerId) : undefined;
        const remaining = availablePercent(provider);
        const description = providerDescription(runtime, remaining, provider);
        const windows = provider?.windows ?? [];

        return (
          <Popover key={runtime.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${runtime.name} quota. ${remaining === null ? 'Quota not reported' : `${remaining}% available`}. Open details`}
                    className="h-9 w-9 rounded-full p-0 transition-transform hover:scale-[1.04]"
                  >
                    <QuotaRing runtime={runtime} remaining={remaining} />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-64">
                <span className="font-medium">{runtime.name}</span>
                <span className="ml-1 text-content-secondary">{remaining === null ? 'Quota not reported' : `${remaining}% available`}</span>
              </TooltipContent>
            </Tooltip>
            <PopoverContent side="right" align="center" className="w-[min(21rem,calc(100vw-1rem))] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-divider bg-surface">
                    <ProviderBrandIcon runtime={runtime} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-content">{runtime.name}</h2>
                    <p className="mt-0.5 truncate text-[11px] text-content-muted">{runtime.account?.authMethod || 'Authenticated connection'}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Refresh ${runtime.name} usage`}
                  disabled={loading || !isDesktop}
                  onClick={() => void load(true)}
                  className="h-8 w-8 shrink-0"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {!isDesktop ? (
                <p className="mt-4 text-xs text-content-secondary">Open Alpha Desktop to check local provider limits.</p>
              ) : loading && !data ? (
                <p className="mt-4 text-xs text-content-muted">Checking provider limits…</p>
              ) : error && !data ? (
                <p className="mt-4 text-xs text-status-danger">Could not load usage. Try refreshing.</p>
              ) : provider?.windows.length ? (
                <div className="mt-3 space-y-3">
                  {error && <p className="text-[11px] text-status-danger">Refresh failed. Showing the last result.</p>}
                  {windows.map(window => (
                    <section key={window.id} className="border-t border-divider pt-3">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium text-content-secondary">{window.label}</span>
                        <span className="tabular-nums text-content">{window.remainingPercent}% available</span>
                      </div>
                      <Progress value={window.usedPercent} aria-label={`${runtime.name} ${window.label} used`} className="mt-2 h-1.5" />
                      <p className="mt-1.5 text-[10px] text-content-muted">{window.resetsAt ? `Resets ${new Date(window.resetsAt).toLocaleString()}` : 'Reset time not reported'}</p>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-md border border-divider bg-surface px-3 py-2.5">
                  <p className="text-xs font-medium text-content-secondary">Quota not reported</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-content-muted">{provider?.detail || `${runtime.name} is connected, but Alpha has no quota window for this provider.`}</p>
                </div>
              )}

              {provider && <a
                href={providerUsageUrl(provider)}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-link hover:text-link-hover"
              >
                Open provider usage <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>}
              {data?.lastRefreshedAt && <p className="mt-3 text-[10px] text-content-muted">Checked {new Date(data.lastRefreshedAt).toLocaleString()}</p>}
              <span className="sr-only">{description}</span>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
