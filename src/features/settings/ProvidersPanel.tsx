import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, CircleAlert, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Progress } from '@/shared/components/ui/progress';
import { RuntimeIsolationPanel } from '@/features/runtimes/RuntimeIsolationPanel';
import { apiService } from '@/shared/services/apiService';
import { isDesktop } from '@/shared/desktop';
import type { ProviderLimitsSnapshot, RuntimeEngine, RuntimeStatus } from '@/shared/types';
import { ProviderBrandIcon } from './ProviderBrandIcon';

const statusLabel = (runtime: RuntimeEngine) => {
  if (runtime.status === 'online') return runtime.account?.authMethod ? `Authenticated · ${runtime.account.authMethod}` : 'Online · ready';
  if (runtime.status === 'degraded') return 'Needs attention';
  if (runtime.status === 'scanning') return 'Scanning';
  return 'Not found or offline';
};

const statusFallback: Record<RuntimeStatus, string> = {
  online: 'Online · ready',
  degraded: 'Needs attention',
  offline: 'Not found or offline',
  scanning: 'Scanning'
};

const providerName = (runtime: RuntimeEngine) => ({
  codex: 'Codex', claude: 'Claude', anthropic: 'Anthropic', openai: 'OpenAI', antigravity: 'Antigravity', gemini: 'Google Gemini',
  googlegemini: 'Google Gemini', 'google-gemini': 'Google Gemini', opencode: 'OpenCode',
  ollama: 'Ollama', lmstudio: 'LM Studio'
}[runtime.id.toLowerCase()] ?? runtime.name.replace(/ CLI$/i, ''));

const statusTone = (status: RuntimeStatus) => {
  if (status === 'online') return 'border-status-success-border bg-status-success-subtle text-status-success';
  if (status === 'degraded') return 'border-status-warning-border bg-status-warning-subtle text-status-warning';
  if (status === 'scanning') return 'border-status-info-border bg-status-info-subtle text-status-info';
  return 'border-status-danger-border bg-status-danger-subtle text-status-danger';
};

const statusDot = (status: RuntimeStatus) => status === 'online'
  ? 'bg-status-success'
  : status === 'degraded'
    ? 'bg-status-warning'
    : status === 'scanning'
      ? 'bg-status-info animate-pulse'
      : 'bg-status-danger';

const ProvidersPanelContent: React.FC = () => {
  const { runtimes, workspaceLoading, scanLocalRuntimes, isScanningRuntimes, setDefaultRuntime, can } = useApp();
  const canManageRuntimes = can('manage_runtimes');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [providerLimits, setProviderLimits] = useState<ProviderLimitsSnapshot | null>(null);
  const [limitsLoading, setLimitsLoading] = useState(false);
  const [limitsRefreshing, setLimitsRefreshing] = useState(false);
  const selected = runtimes.find(runtime => runtime.id === selectedId) ?? runtimes[0] ?? null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return runtimes.filter(runtime => !needle || [runtime.name, runtime.provider, runtime.account?.authMethod, ...(runtime.models ?? [])]
      .some(value => value?.toLowerCase().includes(needle)));
  }, [query, runtimes]);
  const lastChecked = runtimes.map(runtime => runtime.detectedAt).filter((value): value is string => Boolean(value)).sort().at(-1);
  const selectedLimit = providerLimits?.providers.find(limit => limit.provider === selected?.id);

  const loadProviderLimits = useCallback(async (refresh = false) => {
    if (!isDesktop) return;
    setLimitsRefreshing(refresh);
    setLimitsLoading(!refresh);
    try {
      setProviderLimits(refresh ? await apiService.refreshProviderLimits() : await apiService.getProviderLimits());
    } catch {
      setProviderLimits(null);
    } finally {
      setLimitsLoading(false);
      setLimitsRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadProviderLimits(); }, [loadProviderLimits]);

  const copyLoginCommand = async () => {
    if (!selected) return;
    const command = selected.id === 'codex' ? 'codex login' : selected.id === 'claude' ? 'claude auth login' : null;
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* The command remains visible for manual copying. */ }
  };

  const copyEndpoint = async () => {
    if (!selected?.endpoint) return;
    try {
      await navigator.clipboard.writeText(selected.endpoint);
      setCopiedEndpoint(true);
      window.setTimeout(() => setCopiedEndpoint(false), 1500);
    } catch { /* Endpoint remains visible for manual copying. */ }
  };

  const loginCommand = selected?.id === 'codex' ? 'codex login' : selected?.id === 'claude' ? 'claude auth login' : null;

  if (!isDesktop) return <Card className="p-5">
    <div className="flex items-start gap-3">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-content-muted" />
      <div>
        <h3 className="text-sm font-semibold text-content">Provider runtimes are local to Alpha Desktop</h3>
        <p className="mt-1 text-xs leading-relaxed text-content-secondary">The desktop that launches provider CLIs holds their configured sign-in. Open this section in Alpha Desktop to check providers, manage the local runtime, and view supported quota data.</p>
      </div>
    </div>
  </Card>;

  return <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(18rem,0.38fr)_minmax(0,0.62fr)]">
    <section className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-content">Providers</h3>
          <p className="mt-1 text-xs text-content-muted">Accounts and runtimes on this desktop.</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-content-muted">
          <span>Checked {lastChecked ? new Date(lastChecked).toLocaleTimeString() : 'not yet'}</span>
          <Button variant="outline" size="sm" onClick={() => void scanLocalRuntimes()} disabled={!isDesktop || !canManageRuntimes || isScanningRuntimes}>
            <RefreshCw className={`h-3.5 w-3.5 ${isScanningRuntimes ? 'animate-spin' : ''}`} />
            {isScanningRuntimes ? 'Checking…' : 'Check providers'}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-divider px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-medium text-content">Available on this machine</div>
            <Input aria-label="Search providers" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search providers or models" className="h-9 w-full text-xs" />
          </div>
        </div>
        <div className="divide-y divide-divider">
          {filtered.map(runtime => {
            const active = selected?.id === runtime.id;
            const accountText = runtime.account?.authMethod ?? runtime.catalogError ?? (runtime.type === 'local' ? 'Local engine' : 'Sign-in not confirmed');
            return <Button
              type="button"
              variant="ghost"
              size="default"
              key={runtime.id}
              onClick={() => setSelectedId(runtime.id)}
              aria-pressed={active}
              className={`h-auto w-full justify-start rounded-none px-4 py-3.5 text-left transition-colors hover:bg-surface-high ${active ? 'bg-surface-high' : 'bg-surface'}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-divider bg-surface-raised text-content-secondary">
                <ProviderBrandIcon runtime={runtime} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-content">{providerName(runtime)}</span>
                  {runtime.version && <span className="font-mono text-[10px] text-content-muted">v{runtime.version}</span>}
                  {runtime.isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                </span>
                <span className="mt-1 block truncate text-xs text-content-muted">{accountText}</span>
                <span className="mt-1 flex items-center gap-1.5 text-[11px] text-content-secondary 2xl:hidden"><span className={`h-1.5 w-1.5 rounded-full ${statusDot(runtime.status)}`} />{statusLabel(runtime)}</span>
              </span>
              <Badge variant="outline" className={`${statusTone(runtime.status)} hidden 2xl:inline-flex`}>
                <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${statusDot(runtime.status)}`} />
                {statusLabel(runtime) || statusFallback[runtime.status]}
              </Badge>
              <span className={`h-3.5 w-3.5 shrink-0 rounded-full border ${active ? 'border-action bg-action ring-2 ring-action/20' : 'border-control'}`} aria-hidden="true" />
            </Button>;
          })}
          {workspaceLoading && !runtimes.length && <div className="px-4 py-8 text-center text-xs text-content-muted">Loading providers…</div>}
          {!workspaceLoading && !filtered.length && <div className="px-4 py-8 text-center text-xs text-content-muted">{runtimes.length ? 'No providers match this search.' : 'No providers detected yet.'}</div>}
        </div>
      </Card>
      {!canManageRuntimes && <p className="text-[11px] text-content-muted">Provider discovery and default selection are read-only for this role.</p>}
    </section>

    {selected && <Card className="min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-divider px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-content-secondary"><ProviderBrandIcon runtime={selected} className="h-6 w-6" /></span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-content">{providerName(selected)}</h3>
            <p className="mt-0.5 truncate text-xs text-content-muted">{selected.provider}{selected.version ? ` · v${selected.version}` : ''}</p>
          </div>
        </div>
        <Badge variant="outline" className={statusTone(selected.status)}><span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${statusDot(selected.status)}`} />{statusLabel(selected) || statusFallback[selected.status]}</Badge>
      </div>

      <div className="divide-y divide-divider">
        <section className="space-y-2 px-5 py-4">
          <h4 className="text-sm font-semibold text-content">Status</h4>
          <p className="text-xs text-content-secondary">
            {selected.account?.authMethod ? `Authenticated with ${selected.account.authMethod}` : selected.catalogError ?? (selected.status === 'online' ? 'Provider is ready on this desktop.' : 'Provider account status is unavailable.')}
            {selected.account?.plan ? ` · ${selected.account.plan}` : ''}
            {selected.account?.billing === 'api' ? ' · API billing' : selected.account?.billing === 'subscription' ? ' · Subscription account' : ''}
          </p>
          {selected.account?.note && <p className="text-xs text-content-muted">{selected.account.note}</p>}
        </section>

        <section className="space-y-3 px-5 py-4">
          <div>
            <h4 className="text-sm font-semibold text-content">Setup</h4>
            <p className="mt-1 text-xs leading-relaxed text-content-secondary">Sign in through the provider on this desktop.</p>
          </div>
          {selected.isolation && <RuntimeIsolationPanel runtime={selected} allowSignIn={canManageRuntimes} onSignedIn={() => void scanLocalRuntimes()} />}
          {loginCommand && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-divider bg-surface-raised/40 px-3 py-2.5">
            <code className="flex-1 font-mono text-xs text-content">{loginCommand}</code>
            <Button variant="outline" size="sm" onClick={() => void copyLoginCommand()} disabled={!canManageRuntimes}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy CLI command'}
            </Button>
            {selected.status !== 'online' && <span className="w-full text-[11px] text-content-muted">Run this in a terminal on the Alpha desktop, then check providers again.</span>}
          </div>}
          {!selected.isolation && !loginCommand && <div className="flex items-start gap-2 rounded-lg border border-divider bg-surface-raised/40 px-3 py-2.5 text-xs text-content-secondary">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-content-muted" />Manage sign-in in this provider’s own app or CLI. Alpha reads runtime status and does not copy provider credentials.
          </div>}
          {selected.id === 'codex' && <a href="https://developers.openai.com/codex/cli" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-link hover:underline">Codex CLI setup <ExternalLink className="h-3.5 w-3.5" /></a>}
          {selected.id === 'claude' && <a href="https://docs.anthropic.com/en/docs/claude-code/overview" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-link hover:underline">Claude Code setup <ExternalLink className="h-3.5 w-3.5" /></a>}
        </section>

        <section className="space-y-3 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-content">Usage limits</h4>
              <p className="mt-1 text-xs text-content-muted">Provider-reported quota windows; separate from API-equivalent cost estimates.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadProviderLimits(true)} disabled={limitsRefreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${limitsRefreshing ? 'animate-spin' : ''}`} />Refresh limits
            </Button>
          </div>
          {limitsLoading && !providerLimits ? <p className="text-xs text-content-muted">Checking provider quota support…</p> : selectedLimit ? <div className="space-y-3 rounded-lg border border-divider bg-surface-raised/40 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-content">{selectedLimit.name}{selectedLimit.plan ? ` · ${selectedLimit.plan}` : ''}</p>
                <p className="mt-1 text-[11px] text-content-muted">{selectedLimit.detail}</p>
              </div>
              <Badge variant="outline" className={selectedLimit.status === 'available' ? 'border-status-success-border bg-status-success-subtle text-status-success' : selectedLimit.status === 'signed_out' ? 'border-status-warning-border bg-status-warning-subtle text-status-warning' : 'border-control bg-surface-high text-content-secondary'}>{selectedLimit.status.replace('_', ' ')}</Badge>
            </div>
            {selectedLimit.windows.map(window => <div key={window.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-[11px]"><span className="text-content-secondary">{window.label}</span><span className="text-content">{window.usedPercent}% used · {window.remainingPercent}% remaining</span></div>
              <Progress value={window.usedPercent} aria-label={`${window.label} used`} />
              <p className="text-[10px] text-content-muted">{window.resetsAt ? `Resets ${new Date(window.resetsAt).toLocaleString()}` : 'Reset time not reported'}</p>
            </div>)}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-divider pt-2">
              <span className="text-[10px] text-content-muted">Last checked {selectedLimit.lastCheckedAt ? new Date(selectedLimit.lastCheckedAt).toLocaleString() : 'not yet'}</span>
              <a href={selectedLimit.dashboardUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-link hover:underline">Open provider usage <ExternalLink className="h-3.5 w-3.5" /></a>
            </div>
          </div> : <p className="rounded-lg border border-divider bg-surface-raised/40 p-3 text-xs text-content-secondary">{selected?.id === 'antigravity' ? 'Antigravity limits are not included in this first release.' : 'Provider quota data is not available yet. Check the provider CLI sign-in and refresh.'}</p>}
        </section>

        <section className="space-y-3 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-content">Available models</h4>
            <span className="text-[11px] text-content-muted">{(selected.models ?? selected.modelsLoaded ?? []).length} detected</span>
          </div>
          {(selected.models ?? selected.modelsLoaded ?? []).length ? <div className="flex flex-wrap gap-2">
            {(selected.models ?? selected.modelsLoaded ?? []).map(model => <Badge key={model} variant="secondary" className="font-mono text-[10px]">{model}</Badge>)}
          </div> : <p className="text-xs text-content-muted">No model catalog was reported. Check the provider and refresh the scan.</p>}
        </section>

        {selected.endpoint && selected.id !== 'ollama' && <section className="space-y-2 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-content">Endpoint</h4>
            <Button variant="ghost" size="sm" onClick={() => void copyEndpoint()}><Copy className="h-3.5 w-3.5" />{copiedEndpoint ? 'Copied' : 'Copy endpoint'}</Button>
          </div>
          <div className="break-all rounded-md border border-control bg-surface-raised px-3 py-2 font-mono text-xs text-content">{selected.endpoint}</div>
        </section>}

        {selected.type === 'local' && <details className="px-5 py-4">
          <summary className="cursor-pointer text-sm font-semibold text-content">Host hardware</summary>
          <dl className="mt-3 grid grid-cols-[10rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
            <dt className="text-content-muted">GPU / acceleration</dt><dd className="truncate text-content">{selected.gpuName || 'Not reported'}</dd>
            <dt className="text-content-muted">Allocated VRAM</dt><dd className="font-mono text-content">{selected.vramUsageGb != null ? `${selected.vramUsageGb} GB` : 'Not reported'}{selected.vramTotalGb != null ? ` / ${selected.vramTotalGb} GB` : ''}</dd>
          </dl>
        </details>}

        {canManageRuntimes && !selected.isDefault && <div className="flex justify-end px-5 py-4">
          <Button onClick={() => setDefaultRuntime(selected.id)} disabled={selected.status !== 'online' || !(selected.models ?? selected.modelsLoaded ?? []).length}>Set as default runtime</Button>
        </div>}
      </div>
    </Card>}
  </div>;
};

export const ProvidersPanel: React.FC = () => {
  const { role } = useApp();
  if (role !== 'dev') return null;
  return <ProvidersPanelContent />;
};
