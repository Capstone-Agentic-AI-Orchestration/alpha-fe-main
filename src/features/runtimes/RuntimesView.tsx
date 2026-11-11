import { LoadingRows } from '@/shared/components/ui/skeleton';
import React, { useState, useMemo, useCallback } from 'react';
import { useApp, useTabSessionState } from '@/app/AppContext';
import {
  RefreshCw,
  Server,
  Globe,
  Search,
  Filter,
  ArrowDown,
  ArrowUp,
  Table as TableIcon,
  Check,
  X,
  Copy,
  Layers
} from 'lucide-react';
import { RuntimeEngine, RuntimeStatus } from '@/shared/types';
import { RuntimeIsolationPanel } from './RuntimeIsolationPanel';

/** Prefer the current daemon field, while still reading older cached rows. */
const runtimeModels = (runtime: RuntimeEngine): string[] =>
  runtime.models ?? runtime.modelsLoaded ?? [];

type RuntimeBilling = NonNullable<RuntimeEngine['account']>['billing'];

const billingLabel = (billing: RuntimeBilling) => {
  switch (billing) {
    case 'subscription': return 'Subscription';
    case 'api': return 'API usage';
    case 'account': return 'Account-based access';
    case 'unknown': return 'Unknown';
    default: return undefined;
  }
};

export const RuntimesView: React.FC = () => {
  const { runtimes, workspaceLoading, scanLocalRuntimes, isScanningRuntimes, setDefaultRuntime, can } = useApp();
  const canManageRuntimes = can('manage_runtimes');

  // States
  const [selectedRuntimeId, setSelectedRuntimeId] = useTabSessionState<string | null>('runtimes.selectedRuntime', null);
  const [searchQuery, setSearchQuery] = useTabSessionState<string>('runtimes.search', '');

  // Filter & Sort state
  const [typeFilter, setTypeFilter] = useTabSessionState<string>('runtimes.typeFilter', 'all');
  const [statusFilter, setStatusFilter] = useTabSessionState<string>('runtimes.statusFilter', 'all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useTabSessionState<'asc' | 'desc'>('runtimes.sortOrder', 'asc');
  const [sortDropdownOpen, setSortDropdownOpen] = useState<boolean>(false);
  const [sortBy, setSortBy] = useTabSessionState<'latency' | 'name' | 'models'>('runtimes.sortBy', 'latency');
  const [copiedEndpointId, setCopiedEndpointId] = useState<string | null>(null);

  // Selected Runtime Memo
  const selectedRuntime = useMemo(() => {
    return runtimes.find(r => r.id === selectedRuntimeId) || null;
  }, [runtimes, selectedRuntimeId]);

  // Copy Endpoint Helper
  const handleCopyEndpoint = useCallback((endpoint: string, id: string) => {
    navigator.clipboard.writeText(endpoint);
    setCopiedEndpointId(id);
    setTimeout(() => setCopiedEndpointId(null), 2000);
  }, []);

  // Filter and Sort Runtimes
  const filteredRuntimes = useMemo(() => {
    let list = runtimes.filter(r => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.name.toLowerCase().includes(q);
        const matchesProvider = r.provider.toLowerCase().includes(q);
        const matchesEndpoint = (r.endpoint || '').toLowerCase().includes(q);
        const models = runtimeModels(r);
        const matchesModels = models.some(m => m.toLowerCase().includes(q));
        if (!matchesName && !matchesProvider && !matchesEndpoint && !matchesModels) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'models') cmp = runtimeModels(a).length - runtimeModels(b).length;
      else cmp = (a.latencyMs || 0) - (b.latencyMs || 0); // default latency
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [runtimes, typeFilter, statusFilter, searchQuery, sortBy, sortOrder]);

  // Status Badge
  const renderStatusBadge = (status: RuntimeStatus) => {
    switch (status) {
      case 'online':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-status-success-subtle text-status-success text-[11px] font-medium border border-status-success-border">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Online</span>
          </span>
        );
      case 'scanning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-status-info-subtle text-status-info text-[11px] font-medium border border-status-info-border">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>Scanning</span>
          </span>
        );
      case 'degraded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-status-warning-subtle text-status-warning text-[11px] font-medium border border-status-warning-border">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Degraded</span>
          </span>
        );
      case 'offline':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-status-danger-subtle text-status-danger text-[11px] font-medium border border-status-danger-border">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>Offline</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col space-y-5 overflow-y-auto bg-canvas p-5 text-content-secondary select-none font-sans pt-3 lg:p-6 lg:pt-3">

      {/* ================= SEARCH & ACTION ROW ================= */}
      <div className="flex items-center justify-between gap-4">
        {/* The open tab already names the page; this heading is for screen readers. It sits inside the first row so the page's spacing does not leave a gap above it. */}
        <h1 className="sr-only">Runtimes</h1>
        {/* Search input */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search runtimes, models, ports..."
            className="w-full bg-surface border border-control rounded-xl pl-8 pr-3 py-1.5 text-xs text-content placeholder-content-muted focus:outline-none focus:border-control transition-colors"
          />
        </div>

        {/* Right Actions: Filter, Sort, Table indicator */}
        <div className="flex items-center gap-2 relative">

          {canManageRuntimes && (
            <button
              onClick={scanLocalRuntimes}
              disabled={isScanningRuntimes}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-raised hover:bg-surface-high border border-divider text-xs font-medium text-content transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanningRuntimes ? 'animate-spin' : ''}`} />
              <span>{isScanningRuntimes ? 'Scanning runtimes…' : 'Scan host engines'}</span>
            </button>
          )}

          {/* Filter Popover */}
          <div className="relative">
            <button
              onClick={() => {
                setFilterDropdownOpen(prev => !prev);
                setSortDropdownOpen(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                typeFilter !== 'all' || statusFilter !== 'all'
                  ? 'bg-selected text-selected-content border-divider'
                  : 'bg-surface hover:bg-surface-raised text-content-secondary hover:text-content border-divider'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>

            {filterDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-48 p-2 rounded-xl bg-surface-raised border border-divider shadow-2xl z-30 space-y-2 text-xs">
                <div className="text-[10px] font-mono uppercase text-content-secondary px-2 py-1">Engine Type</div>
                {['all', 'local', 'cloud'].map((tp) => (
                  <button
                    key={tp}
                    onClick={() => {
                      setTypeFilter(tp);
                      setFilterDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1 rounded-lg capitalize flex items-center justify-between ${
                      typeFilter === tp ? 'bg-surface-raised text-content font-semibold' : 'text-content-secondary hover:text-content'
                    }`}
                  >
                    <span>{tp === 'all' ? 'All Types' : tp === 'local' ? 'Local Host' : 'Cloud Gateway'}</span>
                    {typeFilter === tp && <Check className="w-3 h-3 text-status-success" />}
                  </button>
                ))}

                <div className="text-[10px] font-mono uppercase text-content-secondary px-2 py-1 pt-2 border-t border-divider">Status</div>
                {['all', 'online', 'offline'].map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setStatusFilter(st);
                      setFilterDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1 rounded-lg capitalize flex items-center justify-between ${
                      statusFilter === st ? 'bg-surface-raised text-content font-semibold' : 'text-content-secondary hover:text-content'
                    }`}
                  >
                    <span>{st}</span>
                    {statusFilter === st && <Check className="w-3 h-3 text-status-success" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort Button */}
          <div className="relative">
            <button
              onClick={() => {
                setSortDropdownOpen(prev => !prev);
                setFilterDropdownOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-raised border border-divider text-xs font-medium text-content-secondary hover:text-content transition-colors"
            >
              {sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
              <span>{sortBy === 'latency' ? 'Latency' : sortBy === 'name' ? 'Name' : 'Models'}</span>
            </button>

            {sortDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-44 p-2 rounded-xl bg-surface-raised border border-divider shadow-2xl z-30 space-y-1 text-xs">
                {(['latency', 'name', 'models'] as const).map((field) => (
                  <button
                    key={field}
                    onClick={() => {
                      setSortBy(field);
                      setSortDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between ${
                      sortBy === field ? 'bg-surface-raised text-content font-semibold' : 'text-content-secondary hover:text-content hover:bg-surface-high'
                    }`}
                  >
                    <span className="capitalize">{field === 'latency' ? 'Inference Latency' : field === 'models' ? 'Models Count' : field}</span>
                    {sortBy === field && <Check className="w-3 h-3 text-status-success" />}
                  </button>
                ))}
                <div className="pt-1 border-t border-divider">
                  <button
                    onClick={() => {
                      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                      setSortDropdownOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-content-secondary hover:text-content hover:bg-surface-high flex items-center justify-between"
                  >
                    <span>Direction</span>
                    <span className="font-mono text-[10px] text-link uppercase">{sortOrder}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Table View Button */}
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-divider text-xs font-medium text-content-secondary shadow-sm cursor-default"
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
        </div>
      </div>

      {/* ================= MINIMALIST RUNTIMES TABLE ================= */}
      <div className="w-full">
        {/* Table Column Headers */}
        <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-normal text-content-muted border-b border-divider">
          <div className="col-span-4">Engine & Account</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Available models</div>
          <div className="col-span-1 text-left">Latency</div>
          <div className="col-span-1 text-right">Default</div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-divider">
          {filteredRuntimes.map((rt) => {
            const models = runtimeModels(rt);
            const modelLabel = models.length ? models.join(', ') : 'none detected';
            return (
              <div
                key={rt.id}
                onClick={() => setSelectedRuntimeId(rt.id)}
                className={`grid grid-cols-12 gap-4 px-4 py-3.5 items-center text-xs hover:bg-surface-high cursor-pointer transition-colors group ${
                  selectedRuntimeId === rt.id ? 'bg-surface-raised' : ''
                }`}
              >
                {/* 1. Engine Name & Account */}
                <div className="col-span-4 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-content truncate group-hover:text-content">
                      {rt.name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-raised text-content-secondary border border-divider flex-shrink-0">
                      {rt.provider}
                    </span>
                  </div>
                  <div className="text-[11px] text-content-secondary truncate">
                    {rt.type !== 'local' && rt.account && Object.values(rt.account).some(Boolean)
                      ? [
                          rt.account.authMethod || rt.account.email || 'Account information unavailable',
                          rt.account.plan || (rt.account.billing === 'account'
                            ? 'Plan not reported'
                            : billingLabel(rt.account.billing))
                        ].filter(Boolean).join(' · ')
                      : rt.endpoint || (rt.type === 'local' ? 'Local installation detected' : 'Local CLI process')}
                  </div>
                  {rt.account && rt.endpoint && (
                    <div className="text-[10px] text-content-muted font-mono truncate">{rt.endpoint}</div>
                  )}
                  {rt.isolation && !rt.isolation.isolated && (
                    <div className="text-[10px] text-status-warning truncate">Shares your personal setup</div>
                  )}
                </div>

                {/* 2. Type Badge */}
                <div className="col-span-2">
                  <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-medium ${
                    rt.type === 'local'
                      ? 'bg-status-success-subtle text-status-success border border-status-success-border'
                      : 'bg-surface-raised text-content-secondary'
                  }`}>
                    {rt.type === 'local' ? 'Local Host' : 'Cloud Gateway'}
                  </span>
                </div>

                {/* 3. Status Badge */}
                <div className="col-span-2">
                  {renderStatusBadge(rt.status)}
                </div>

                {/* 4. Available models */}
                <div className="col-span-2 min-w-0" title={modelLabel}>
                  <div className="font-mono text-content text-[11px]">
                    {models.length} {models.length === 1 ? 'model' : 'models'}
                    {rt.catalogStale && <span className="ml-2 font-sans text-[10px] text-status-warning">Cached</span>}
                  </div>
                  <div className="text-content-muted font-mono text-[10px] leading-4 line-clamp-2 break-words">
                    {modelLabel}
                  </div>
                </div>

                {/* 5. Latency */}
                <div className="col-span-1 text-left font-mono text-xs">
                  <span className={(rt.latencyMs || 0) < 50 ? 'text-status-success' : 'text-content-secondary'}>
                    {rt.latencyMs != null ? `${rt.latencyMs}ms` : '—'}
                  </span>
                </div>

                {/* 6. Default Engine Toggle */}
                <div className="col-span-1 text-right">
                  {rt.isDefault ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-status-success font-semibold">
                      <Check className="w-3.5 h-3.5" />
                      <span>Default</span>
                    </span>
                  ) : canManageRuntimes ? (
                    <button
                      disabled={rt.status !== 'online' || models.length === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDefaultRuntime(rt.id);
                      }}
                      className="text-[11px] text-content-muted hover:text-content px-2 py-0.5 rounded hover:bg-surface-high transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Make default
                    </button>
                  ) : (
                    <span className="text-[10px] text-content-muted" title="Only developers and admins can change the default runtime">
                      Read only
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {workspaceLoading && !runtimes.length && <LoadingRows label="Loading runtimes" layout="table" className="px-4" />}
        {!(workspaceLoading && !runtimes.length) && filteredRuntimes.length === 0 && <div role="status" className="py-16 text-center">
          <p className="text-sm font-medium text-content-secondary">{runtimes.length ? 'No runtimes match your filters' : canManageRuntimes ? 'No runtimes detected yet' : 'No cached runtimes available'}</p>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-content-muted">{runtimes.length ? 'Try another search or clear the filters to see your detected engines.' : canManageRuntimes ? 'Start an installed engine, then scan this host to discover its available models.' : 'A developer or admin must scan the host before a runtime can be reviewed here.'}</p>
        </div>}
      </div>

      {/* ================= RUNTIME INSPECTOR DRAWER =================
          Opens inside the page panel, below the tab row, so it never covers the
          notification bell or the window controls. */}
      {selectedRuntime && (
        <div className="absolute inset-y-0 right-0 z-40 !mt-0 flex w-full max-w-xl flex-col border-l border-divider bg-canvas shadow-2xl animate-slide-left font-sans">

          {/* Drawer Header */}
          <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface-raised">
                {selectedRuntime.type === 'local' ? <Server className="w-5 h-5 text-status-success" /> : <Globe className="w-5 h-5 text-status-info" />}
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-content truncate">{selectedRuntime.name}</h2>
                  {selectedRuntime.isDefault && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-status-success-subtle text-status-success border border-status-success-border">
                      DEFAULT
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {renderStatusBadge(selectedRuntime.status)}
                  <span className="text-[11px] text-content-secondary font-mono">
                    {selectedRuntime.provider} • {selectedRuntime.latencyMs}ms latency
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedRuntimeId(null)}
                className="p-1.5 rounded-lg hover:bg-surface-high text-content-secondary hover:text-content transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Drawer Body: plain sections with one level of grouping. */}
          <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-5 text-xs text-content-secondary">

            {/* Runtime connection */}
            <section className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-content-muted">
                <span>{selectedRuntime.endpoint ? 'Inference API Endpoint' : 'Runtime connection'}</span>
                {selectedRuntime.endpoint && (
                  <button
                    onClick={() => handleCopyEndpoint(selectedRuntime.endpoint || '', selectedRuntime.id)}
                    className="flex items-center gap-1 normal-case tracking-normal text-content-secondary hover:text-content"
                  >
                    {copiedEndpointId === selectedRuntime.id ? <Check className="w-3 h-3 text-status-success" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedEndpointId === selectedRuntime.id ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
              <div className="truncate rounded-lg bg-well px-3 py-2 font-mono text-xs text-content">
                {selectedRuntime.endpoint || 'Local CLI process'}
              </div>
            </section>

            {selectedRuntime.isolation && (
              <RuntimeIsolationPanel
                runtime={selectedRuntime}
                allowSignIn={canManageRuntimes}
                onSignedIn={() => { void scanLocalRuntimes(); }}
              />
            )}

            {selectedRuntime.account && (
              <section className="space-y-2">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-content-muted">Account &amp; billing</h3>
                <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-2">
                  <dt className="text-content-muted">Authentication</dt>
                  <dd className="truncate font-medium text-content">{selectedRuntime.account.authMethod || selectedRuntime.account.email || 'Not reported'}</dd>
                  <dt className="text-content-muted">Billing route</dt>
                  <dd className="font-medium text-status-success">{billingLabel(selectedRuntime.account.billing) || 'Not reported'}</dd>
                  {selectedRuntime.account.plan && <><dt className="text-content-muted">Plan</dt><dd className="text-content">{selectedRuntime.account.plan}</dd></>}
                  {selectedRuntime.account.org && <><dt className="text-content-muted">Organization</dt><dd className="truncate text-content">{selectedRuntime.account.org}</dd></>}
                  {selectedRuntime.account.email && <><dt className="text-content-muted">Account</dt><dd className="truncate text-content">{selectedRuntime.account.email}</dd></>}
                </dl>
                {selectedRuntime.account.note && <p className="leading-relaxed text-content-secondary">{selectedRuntime.account.note}</p>}
              </section>
            )}

            {/* Local Host Hardware Telemetry (if local) */}
            {selectedRuntime.type === 'local' && (
              <section className="space-y-2">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-content-muted">Host hardware</h3>
                <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-2">
                  <dt className="text-content-muted">GPU / acceleration</dt>
                  <dd className="truncate font-medium text-content">{selectedRuntime.gpuName || 'Apple Silicon Unified'}</dd>
                  <dt className="text-content-muted">Allocated VRAM</dt>
                  <dd className="font-mono font-medium text-status-success">{selectedRuntime.vramUsageGb || 38.4} GB / {selectedRuntime.vramTotalGb || 64.0} GB</dd>
                </dl>
              </section>
            )}

            {/* Available models Catalog */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-medium text-content-secondary uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-status-success" />
                  <span>Available models ({runtimeModels(selectedRuntime).length})</span>
                </span>
                <span className="text-content-muted font-mono">
                  {selectedRuntime.catalogStale ? 'Cached catalog · refresh to verify' : selectedRuntime.status === 'online' && runtimeModels(selectedRuntime).length > 0 ? 'Ready for dispatch' : 'Catalog snapshot'}
                </span>
              </div>

              {runtimeModels(selectedRuntime).length === 0 && <p className="rounded-lg border border-dashed border-divider p-4 text-xs leading-relaxed text-content-muted">No models reported. Check the engine’s model catalog, then scan this host again.</p>}
              <div className={runtimeModels(selectedRuntime).length ? 'divide-y divide-divider rounded-lg border border-divider' : 'hidden'}>
                {runtimeModels(selectedRuntime).map((model) => (
                  <div
                    key={model}
                    className="flex items-center justify-between px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                      <span className="font-mono text-content font-medium truncate">{model}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-raised text-content-secondary">
                      {selectedRuntime.catalogStale ? 'Cached' : selectedRuntime.status === 'online' ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Set as default action */}
            {!selectedRuntime.isDefault && canManageRuntimes && (
              <div className="pt-2 border-t border-divider">
                <button
                  onClick={() => setDefaultRuntime(selectedRuntime.id)}
                  disabled={selectedRuntime.status !== 'online' || runtimeModels(selectedRuntime).length === 0}
                  className="w-full py-2 rounded-xl bg-action hover:bg-action-hover text-on-action font-medium text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Set as Default LLM Engine
                </button>
              </div>
            )}
            {!selectedRuntime.isDefault && !canManageRuntimes && (
              <p className="border-t border-divider pt-3 text-[11px] leading-relaxed text-content-muted">
                Runtime selection is read-only for PMs. Ask a developer or admin to change the default engine.
              </p>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
