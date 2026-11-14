import { useId, useState, type CSSProperties } from 'react';
import { ChevronUp, Gauge } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { loadFromStorage, saveToStorage } from '@/shared/lib/storage';
import { useApp } from '@/app/AppContext';
import type { ProviderLimits, RuntimeEngine } from '@/shared/types';
import { ProviderBrandIcon } from '@/features/settings/ProviderBrandIcon';
import { freshQuota, limitForRuntime, tightestQuota, useProviderUsage } from './ProviderUsageContext';

const RADIUS = 15;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const STALE_AFTER_MS = 2 * 60 * 1000;

type Ring = {
  runtime: RuntimeEngine;
  provider: ProviderLimits;
  /** Remaining share of the tightest limit, 0-1, or null when there is no quota to draw. */
  fraction: number | null;
  tone: string;
  attention: 0 | 1 | 2;
  headline: string;
  reset?: string;
  /** Short figure for the expanded sidebar row, such as "21%" or "$0.00". */
  value: string;
  /** Second line of the row: when it resets, or why there is no figure. */
  sub: string;
};

/** One glance per provider: its tightest limit, or why there is none. Details live under Manage runtimes. */
function describe(runtime: RuntimeEngine, provider: ProviderLimits, now: number, error: boolean): Ring {
  const quota = tightestQuota(provider);
  const recent = error ? undefined : freshQuota(provider, now);
  const attention: Ring['attention'] = recent?.remainingPercent === 0 ? 2 : recent && recent.remainingPercent <= 25 ? 1 : 0;
  if (quota) {
    return { runtime, provider, attention, fraction: quota.remainingPercent / 100,
      tone: !recent ? 'text-content-muted' : attention === 2 ? 'text-status-danger' : attention === 1 ? 'text-status-warning' : 'text-status-success',
      headline: quota.remainingPercent + '% left' + (recent ? '' : ' (last reported)'),
      reset: quota.resetsAt ? 'Resets ' + new Date(quota.resetsAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : undefined,
      value: quota.remainingPercent + '%',
      sub: (recent ? '' : 'Last reported · ') + (quota.resetsAt ? 'Resets ' + new Date(quota.resetsAt).toLocaleString([], { month: 'short', day: 'numeric' }) : 'left') };
  }
  const headline = provider.spend ? '$' + provider.spend.costUsd.toFixed(2) + ' spent · last ' + provider.spend.days + ' days'
    : provider.status === 'signed_out' ? 'Signed out'
    : provider.status === 'unavailable' ? 'Quota unavailable' : 'Quota not reported';
  return { runtime, provider, attention: 0, fraction: null, tone: 'text-content-muted', headline,
    value: provider.spend ? '$' + provider.spend.costUsd.toFixed(2) : '',
    sub: provider.spend ? 'Spent · last ' + provider.spend.days + ' days' : headline };
}

function UsageRing({ ring }: { ring: Ring }) {
  const signedOut = ring.provider.status === 'signed_out';
  return <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-raised">
    <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true" focusable="false">
      <circle cx="18" cy="18" r={RADIUS} fill="none" stroke="rgb(var(--ui-divider))" strokeWidth="3"
        strokeDasharray={signedOut ? '2 3.5' : undefined} />
      {ring.fraction !== null && ring.fraction > 0 && <circle cx="18" cy="18" r={RADIUS} fill="none" stroke="currentColor" strokeWidth="3"
        strokeLinecap="round" className={ring.tone} strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - ring.fraction)} />}
    </svg>
    <ProviderBrandIcon runtime={ring.runtime} className={'relative h-3.5 w-3.5 ' + (signedOut ? 'opacity-50' : '')} />
  </span>;
}

/**
 * Runtime usage as a dropdown of rings. The gauge button opens a column of
 * provider rings above it; each ring's arc is the remaining share of that
 * provider's tightest limit, and its tooltip says how much is left.
 */
export function UsageLimitsPopover({ compact, onNavigate }: { compact: boolean; onNavigate: () => void }) {
  const { runtimes, tabs, visibleTabs, setActiveTabId, openNewTab } = useApp();
  const { data, loading, error, now, load } = useProviderUsage();
  const [open, setOpen] = useState(() => loadFromStorage<boolean>('usage_rings_open', false) === true);
  const listId = useId();
  const seen = new Set<string>();
  const rings = [...runtimes].sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)) || a.name.localeCompare(b.name))
    .flatMap(runtime => {
      const provider = limitForRuntime(runtime, data);
      const key = runtime.provider.toLowerCase();
      // Every installed CLI Alpha can read is listed, signed out or not, so a missing quota always has a reason.
      if (!provider || !['online', 'degraded'].includes(runtime.status) || seen.has(key)) return [];
      seen.add(key);
      return [describe(runtime, provider, now, error)];
    });
  const badge = Math.max(0, ...rings.map(ring => ring.attention));
  const label = 'Runtime usage' + (badge === 2 ? ' · provider out of quota' : badge === 1 ? ' · provider low on quota' : '');

  const toggle = () => {
    const next = !open;
    setOpen(next);
    saveToStorage('usage_rings_open', next);
    const checked = Date.parse(data?.lastRefreshedAt ?? '');
    if (next && !loading && (!Number.isFinite(checked) || Date.now() - checked > STALE_AFTER_MS)) load(true);
  };
  const manageRuntimes = () => {
    if (!visibleTabs.includes('settings')) return;
    const tab = tabs.find(item => item.view === 'settings' && item.sessionState?.['settings.section'] === 'providers');
    if (tab) setActiveTabId(tab.id);
    else openNewTab('settings', { 'settings.section': 'providers' });
    onNavigate();
  };

  const gauge = <span className={'relative grid h-7 w-7 shrink-0 place-items-center rounded-full border border-divider transition-colors '
    + (open ? 'bg-selected text-link' : 'bg-surface-raised text-content-secondary')}>
    <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
    {badge !== 0 && !open && <span aria-hidden="true" className={'absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-shell ' + (badge === 2 ? 'bg-status-danger' : 'bg-status-warning')} />}
  </span>;
  const worst = badge ? rings.find(ring => ring.attention === badge) : undefined;
  const summary = loading && !data ? 'Checking…' : worst ? worst.runtime.name + ' · ' + worst.value + ' left'
    : rings.length === 1 ? '1 provider' : rings.length + ' providers';


  return <div className={'flex shrink-0 flex-col px-2 pb-1 ' + (compact ? 'items-center gap-1.5' : 'items-stretch gap-0.5')}>
    {open && <ul id={listId} aria-label="Provider usage" className={'flex flex-col ' + (compact ? 'gap-1.5' : 'w-full gap-0.5')}>
      {loading && !data && <li className="usage-ring" style={{ '--ring-index': 0 } as CSSProperties}>
        <span role="status" aria-label="Checking provider usage" className="block h-7 w-7 rounded-full border-2 border-dashed border-divider motion-safe:animate-spin" />
      </li>}
      {!loading && !rings.length && <li className="max-w-[10rem] text-[11px] text-content-muted">No connected providers</li>}
      {rings.map((ring, index) => {
        const accessibleName = ring.runtime.name + ': ' + ring.headline + (ring.reset ? ', ' + ring.reset : '');
        const valueTone = ring.attention === 2 ? 'text-status-danger' : ring.attention === 1 ? 'text-status-warning' : 'text-content';
        return <li key={ring.runtime.id} className="usage-ring" style={{ '--ring-index': rings.length - index } as CSSProperties}>
          {compact ? <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={manageRuntimes} aria-label={accessibleName}
                className="rounded-full transition-transform hover:scale-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none">
                <UsageRing ring={ring} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" data-sidebar-overlay="" className="max-w-56">
              <p className="font-medium">{ring.runtime.name}</p>
              <p className={ring.attention === 2 ? 'text-status-danger' : ring.attention === 1 ? 'text-status-warning' : 'text-content-secondary'}>{ring.headline}</p>
              {ring.reset && <p className="text-content-muted">{ring.reset}</p>}
            </TooltipContent>
          </Tooltip>
          // With room to spare, each ring carries its name and figure, so nothing needs a hover.
          : <button type="button" onClick={manageRuntimes} aria-label={accessibleName} title={ring.reset}
            className="flex w-full min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <UsageRing ring={ring} />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-content">{ring.runtime.name}</span>
                {ring.value && <span className={'shrink-0 text-xs font-semibold tabular-nums ' + valueTone}>{ring.value}</span>}
              </span>
              <span className={'block truncate text-[11px] ' + (ring.provider.status === 'signed_out' ? 'text-status-warning' : 'text-content-muted')}>{ring.sub}</span>
            </span>
          </button>}
        </li>;
      })}

    </ul>}
    {compact ? <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={toggle} aria-label={label} aria-expanded={open} aria-controls={open ? listId : undefined}
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">{gauge}</button>
      </TooltipTrigger>
      <TooltipContent side="right" data-sidebar-overlay="">{open ? 'Hide runtime usage' : label}</TooltipContent>
    </Tooltip>
    // Open sidebar: the button is a row like the providers above it, sized and aligned with the profile row below.
    : <button type="button" onClick={toggle} aria-label={label} aria-expanded={open} aria-controls={open ? listId : undefined}
      className="flex w-full min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
      {gauge}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-content">Runtime usage</span>
        <span className={'block truncate text-[11px] ' + (worst ? (badge === 2 ? 'text-status-danger' : 'text-status-warning') : 'text-content-muted')}>{summary}</span>
      </span>
      <ChevronUp className={'h-3.5 w-3.5 shrink-0 text-content-muted motion-safe:transition-transform ' + (open ? '' : 'rotate-180')} aria-hidden="true" />
    </button>}
  </div>;
}
