import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowUpRight, Clock3, Coins, Hash, RefreshCw } from 'lucide-react';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Select } from '@/shared/components/ui/select';
import { Progress } from '@/shared/components/ui/progress';
import { apiService } from '@/shared/services/apiService';
import { isDesktop } from '@/shared/desktop';
import { providerUsageUrl } from '@/shared/lib/providerUsageUrl';
import type { AiUsageBreakdown, AiUsageProvider, AiUsageSummary, ProviderLimitsSnapshot } from '@/shared/types';

const providerLabels: Record<AiUsageProvider, string> = {
  claude: 'Claude Code', codex: 'Codex', antigravity: 'Antigravity'
};

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function rangeForDays(days: number) {
  const tomorrow = new Date();
  tomorrow.setUTCHours(0, 0, 0, 0);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const from = new Date(tomorrow);
  from.setUTCDate(from.getUTCDate() - days);
  return { from: dateOnly(from), to: dateOnly(tomorrow) };
}

function formatNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '—';
}

function formatCurrency(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value)
    : '—';
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not checked yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not checked yet' : date.toLocaleString();
}

function statusTone(status: string) {
  if (status === 'available') return 'border-status-success-border bg-status-success-subtle text-status-success';
  if (status === 'signed_out') return 'border-status-warning-border bg-status-warning-subtle text-status-warning';
  if (status === 'unsupported') return 'border-control bg-surface-high text-content-secondary';
  return 'border-status-danger-border bg-status-danger-subtle text-status-danger';
}

function BreakdownTable({ title, detail, rows }: {
  title: string;
  detail: string;
  rows: AiUsageBreakdown[];
}) {
  return <Card className="overflow-hidden">
    <div className="border-b border-divider px-4 py-3">
      <h3 className="text-sm font-semibold text-content">{title}</h3>
      <p className="mt-0.5 text-[11px] text-content-muted">{detail}</p>
    </div>
    {!rows.length ? <div className="px-4 py-8 text-center text-xs text-content-muted">No usage recorded for this selection.</div> : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[940px] text-left text-xs">
          <thead className="bg-surface-raised text-[10px] uppercase tracking-wide text-content-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">{title === 'By day' ? 'Day' : title === 'By model' ? 'Model' : title === 'By agent' ? 'Agent' : 'Provider'}</th>
              <th className="px-4 py-2.5 text-right font-medium">Calls</th>
              <th className="px-4 py-2.5 text-right font-medium">Input</th>
              <th className="px-4 py-2.5 text-right font-medium">Output</th>
              <th className="px-4 py-2.5 text-right font-medium">Cache read</th>
              <th className="px-4 py-2.5 text-right font-medium">Cache write</th>
              <th className="px-4 py-2.5 text-right font-medium">Reasoning</th>
              <th className="px-4 py-2.5 text-right font-medium">Total tokens</th>
              <th className="px-4 py-2.5 text-right font-medium">Reported</th>
              <th className="px-4 py-2.5 text-right font-medium">API-equivalent estimate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {rows.map(row => <tr key={row.key} className="hover:bg-surface-high/50">
              <td className="max-w-[18rem] truncate px-4 py-3 text-content">
                <span>{row.label}</span>
                {row.provider && title === 'By model' && <span className="ml-2 text-[10px] text-content-muted">{providerLabels[row.provider]}</span>}
              </td>
              <td className="px-4 py-3 text-right text-content-secondary">{formatNumber(row.invocations)}</td>
              <td className="px-4 py-3 text-right text-content-secondary">{formatNumber(row.inputTokens)}</td>
              <td className="px-4 py-3 text-right text-content-secondary">{formatNumber(row.outputTokens)}</td>
              <td className="px-4 py-3 text-right text-content-secondary">{formatNumber(row.cacheReadTokens)}</td>
              <td className="px-4 py-3 text-right text-content-secondary">{formatNumber(row.cacheCreationTokens)}</td>
              <td className="px-4 py-3 text-right text-content-secondary">{formatNumber(row.thinkingTokens)}</td>
              <td className="px-4 py-3 text-right text-content-secondary">{formatNumber(row.totalTokens)}</td>
              <td className="px-4 py-3 text-right text-content-secondary">{formatCurrency(row.reportedCostUsd)}</td>
              <td className="px-4 py-3 text-right text-content-secondary">{formatCurrency(row.estimatedCostUsd)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    )}
  </Card>;
}

export const AiUsageDashboard: React.FC = () => {
  const [days, setDays] = useState(30);
  const [provider, setProvider] = useState<AiUsageProvider | 'all'>('all');
  const [summary, setSummary] = useState<AiUsageSummary | null>(null);
  const [limits, setLimits] = useState<ProviderLimitsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshingLimits, setRefreshingLimits] = useState(false);
  const [usageRefreshedAt, setUsageRefreshedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const period = useMemo(() => rangeForDays(days), [days]);

  const loadSummary = useCallback(async () => {
    if (!isDesktop) return;
    setLoading(true);
    setError(null);
    try {
      setSummary(await apiService.getAiUsageSummary({ ...period, provider }));
      setUsageRefreshedAt(new Date().toISOString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'AI usage could not be loaded.');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [period, provider]);

  const loadLimits = useCallback(async (refresh = false) => {
    if (!isDesktop) return;
    setRefreshingLimits(refresh);
    try {
      setLimits(refresh ? await apiService.refreshProviderLimits() : await apiService.getProviderLimits());
    } catch {
      setLimits(null);
    } finally {
      setRefreshingLimits(false);
    }
  }, []);

  useEffect(() => { void loadSummary(); }, [loadSummary]);
  useEffect(() => { void loadLimits(); }, [loadLimits]);

  if (!isDesktop) return <Card className="p-6">
    <div className="flex items-start gap-3">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-content-muted" />
      <div>
        <h2 className="text-sm font-semibold text-content">AI usage is local to Alpha Desktop</h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-content-secondary">Alpha records usage on the computer that launches each model run. The cloud app cannot inspect local CLI sessions or their credentials, so this view is available in the desktop app.</p>
      </div>
    </div>
  </Card>;

  const totals = summary?.totals;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-content">AI Usage</h2>
          <Badge variant="secondary">This desktop</Badge>
        </div>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-content-muted">Alpha-launched work only. CLI sessions started outside Alpha are not imported. Cost figures are provider-reported values or estimates at public API prices; they are not actual bills or subscription quota.</p>
        <p className="mt-1 text-[10px] text-content-muted">Usage view refreshed {formatDateTime(usageRefreshedAt)} · latest recorded event {formatDateTime(summary?.lastUpdatedAt)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Usage date range" value={String(days)} onChange={event => setDays(Number(event.target.value))} className="w-36 text-xs">
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
        </Select>
        <Select aria-label="Usage provider" value={provider} onChange={event => setProvider(event.target.value as AiUsageProvider | 'all')} className="w-40 text-xs">
          <option value="all">All providers</option><option value="claude">Claude Code</option><option value="codex">Codex</option><option value="antigravity">Antigravity</option>
        </Select>
        <Button variant="outline" size="sm" onClick={() => void loadSummary()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>
    </div>

    {error && <div role="alert" className="rounded-lg border border-status-danger-border bg-status-danger-subtle px-4 py-3 text-xs text-status-danger">{error}</div>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="p-4">
        <div className="flex items-center justify-between text-xs text-content-secondary"><span>Total tokens</span><Hash className="h-4 w-4 text-content-muted" /></div>
        <div className="mt-2 text-2xl font-semibold text-content">{loading && !summary ? '…' : formatNumber(totals?.totalTokens)}</div>
        <p className="mt-1 text-[11px] text-content-muted">{totals?.unreportedTokenInvocations ? `${totals.unreportedTokenInvocations} calls had no token report` : 'Reported by provider runtimes'}</p>
      </Card>
      <Card className="p-4">
        <div className="flex items-center justify-between text-xs text-content-secondary"><span>API-equivalent estimate</span><Coins className="h-4 w-4 text-content-muted" /></div>
        <div className="mt-2 text-2xl font-semibold text-content">{loading && !summary ? '…' : formatCurrency(totals?.estimatedCostUsd)}</div>
        <p className="mt-1 text-[11px] text-content-muted">Public API price snapshot · {summary?.priceTableVersion ?? '—'}</p>
      </Card>
      <Card className="p-4">
        <div className="flex items-center justify-between text-xs text-content-secondary"><span>Provider-reported cost</span><Coins className="h-4 w-4 text-content-muted" /></div>
        <div className="mt-2 text-2xl font-semibold text-content">{loading && !summary ? '…' : formatCurrency(totals?.reportedCostUsd)}</div>
        <p className="mt-1 text-[11px] text-content-muted">CLI-reported equivalent, when available</p>
      </Card>
      <Card className="p-4">
        <div className="flex items-center justify-between text-xs text-content-secondary"><span>Model calls</span><Clock3 className="h-4 w-4 text-content-muted" /></div>
        <div className="mt-2 text-2xl font-semibold text-content">{loading && !summary ? '…' : formatNumber(totals?.invocations ?? 0)}</div>
        <p className="mt-1 text-[11px] text-content-muted">{totals?.unknownCostInvocations ?? 0} calls have unknown cost</p>
      </Card>
    </div>
    <p className="-mt-3 text-[10px] leading-relaxed text-content-muted">Token categories follow each provider’s telemetry and can overlap. Estimates use the dated standard API rates shown above; cache retention, volume discounts, tools, and multimodal charges may differ.</p>

    {summary && summary.totals.invocations === 0 && !loading ? <Card className="px-5 py-9 text-center">
      <p className="text-sm font-medium text-content">No Alpha-launched usage in this period</p>
      <p className="mt-1 text-xs text-content-muted">Choose a longer date range or launch a model run from Alpha.</p>
    </Card> : <>
      <div className="grid gap-4 xl:grid-cols-2">
        <BreakdownTable title="By provider" detail="Input, output, cache and reasoning remain in the recorded invocation details." rows={summary?.byProvider ?? []} />
        <BreakdownTable title="By model" detail="Models without a current price entry retain usage counts and show cost as unknown." rows={summary?.byModel ?? []} />
      </div>
      <BreakdownTable title="By agent" detail="Usage is grouped by the Alpha agent or assistant that launched each invocation." rows={summary?.byAgent ?? []} />
      <BreakdownTable title="By day" detail="UTC day buckets for the selected date range." rows={(summary?.byDay ?? []).map(day => ({ ...day, key: day.date, label: day.date }))} />
    </>}

    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-content">Provider limits</h3>
          <p className="mt-0.5 text-xs text-content-muted">Read-only status from supported local interfaces. Alpha cannot change provider limits.</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-content-muted">
          <span>Last refreshed: {formatDateTime(limits?.lastRefreshedAt)}</span>
          <Button variant="outline" size="sm" onClick={() => void loadLimits(true)} disabled={refreshingLimits}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshingLimits ? 'animate-spin' : ''}`} /> Refresh limits
          </Button>
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {(limits?.providers ?? [
          { provider: 'codex' as const, name: 'Codex', status: 'unavailable' as const, windows: [], dashboardUrl: 'https://chatgpt.com/settings/usage', detail: 'Limits have not been checked yet.', lastCheckedAt: null },
          { provider: 'claude' as const, name: 'Claude Code', status: 'unavailable' as const, windows: [], dashboardUrl: 'https://claude.ai/settings/usage', detail: 'Limits have not been checked yet.', lastCheckedAt: null }
        ]).map(providerLimit => <Card key={providerLimit.provider} className="space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-content">{providerLimit.name}</h4>
              <p className="mt-1 text-[11px] text-content-muted">{providerLimit.accountLabel ?? 'Current account on this desktop'}{providerLimit.plan ? ` · ${providerLimit.plan}` : ''}</p>
            </div>
            <Badge variant="outline" className={statusTone(providerLimit.status)}>{providerLimit.status.replace('_', ' ')}</Badge>
          </div>
          {providerLimit.windows.length ? <div className="space-y-3">
            {providerLimit.windows.map(window => <div key={window.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-xs"><span className="text-content-secondary">{window.label}</span><span className="font-medium text-content">{window.usedPercent}% used · {window.remainingPercent}% remaining</span></div>
              <Progress value={window.usedPercent} aria-label={`${window.label} used`} />
              <div className="text-[10px] text-content-muted">{window.resetsAt ? `Resets ${formatDateTime(window.resetsAt)}` : 'Reset time not reported'}</div>
            </div>)}
          </div> : <p className="text-xs leading-relaxed text-content-secondary">{providerLimit.detail}</p>}
          <div className="flex items-center justify-between gap-3 border-t border-divider pt-3">
            <span className="text-[10px] text-content-muted">Checked {formatDateTime(providerLimit.lastCheckedAt)}</span>
            <a href={providerUsageUrl(providerLimit)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-link hover:underline">
              Open provider usage <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </Card>)}
      </div>
    </section>
  </div>;
};
