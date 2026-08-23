import React, { useState, useMemo, useCallback } from 'react';
import { useApp } from '@/app/AppContext';
import { 
  Cpu, 
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
import { RuntimeStatus } from '@/shared/types';

export const RuntimesView: React.FC = () => {
  const { runtimes, scanLocalRuntimes, isScanningRuntimes, setDefaultRuntime } = useApp();
  
  // States
  const [selectedRuntimeId, setSelectedRuntimeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Filter & Sort state
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [sortDropdownOpen, setSortDropdownOpen] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'latency' | 'name' | 'models'>('latency');
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
        const models = r.modelsLoaded || r.models || [];
        const matchesModels = models.some(m => m.toLowerCase().includes(q));
        if (!matchesName && !matchesProvider && !matchesEndpoint && !matchesModels) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'models') cmp = ((a.modelsLoaded || a.models || []).length) - ((b.modelsLoaded || b.models || []).length);
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 text-[11px] font-medium border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Online</span>
          </span>
        );
      case 'scanning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 text-[11px] font-medium border border-cyan-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>Scanning</span>
          </span>
        );
      case 'degraded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 text-[11px] font-medium border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Degraded</span>
          </span>
        );
      case 'offline':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-rose-500/10 text-rose-300 text-[11px] font-medium border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>Offline</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-[#0E0E12] text-gray-300 p-6 space-y-6 select-none font-sans">
      
      {/* ================= TOP HEADER BAR ================= */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-gray-400" />
          <h1 className="text-sm font-semibold text-white tracking-wide">Runtimes</h1>
          <span className="text-xs text-gray-500 font-mono">{runtimes.length}</span>
        </div>

        {/* Scan host engines button */}
        <button
          onClick={scanLocalRuntimes}
          disabled={isScanningRuntimes}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181920] hover:bg-[#22242D] border border-white/10 text-xs font-medium text-white transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanningRuntimes ? 'animate-spin' : ''}`} />
          <span>{isScanningRuntimes ? 'Scanning ports...' : 'Scan host engines'}</span>
        </button>
      </div>

      {/* ================= SEARCH & ACTION ROW ================= */}
      <div className="flex items-center justify-between gap-4">
        {/* Search input */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search runtimes, models, ports..."
            className="w-full bg-[#14151B] border border-white/5 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-white/20 transition-colors"
          />
        </div>

        {/* Right Actions: Filter, Sort, Table indicator */}
        <div className="flex items-center gap-2 relative">
          
          {/* Filter Popover */}
          <div className="relative">
            <button
              onClick={() => {
                setFilterDropdownOpen(prev => !prev);
                setSortDropdownOpen(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                typeFilter !== 'all' || statusFilter !== 'all'
                  ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
                  : 'bg-[#14151B] hover:bg-[#1C1D24] text-gray-400 hover:text-white border-white/5'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>

            {filterDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-48 p-2 rounded-xl bg-[#1A1B22] border border-white/10 shadow-2xl z-30 space-y-2 text-xs">
                <div className="text-[10px] font-mono uppercase text-gray-400 px-2 py-1">Engine Type</div>
                {['all', 'local', 'cloud'].map((tp) => (
                  <button
                    key={tp}
                    onClick={() => {
                      setTypeFilter(tp);
                      setFilterDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1 rounded-lg capitalize flex items-center justify-between ${
                      typeFilter === tp ? 'bg-white/10 text-white font-semibold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <span>{tp === 'all' ? 'All Types' : tp === 'local' ? 'Local Host' : 'Cloud Gateway'}</span>
                    {typeFilter === tp && <Check className="w-3 h-3 text-emerald-400" />}
                  </button>
                ))}

                <div className="text-[10px] font-mono uppercase text-gray-400 px-2 py-1 pt-2 border-t border-white/5">Status</div>
                {['all', 'online', 'offline'].map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setStatusFilter(st);
                      setFilterDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1 rounded-lg capitalize flex items-center justify-between ${
                      statusFilter === st ? 'bg-white/10 text-white font-semibold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <span>{st}</span>
                    {statusFilter === st && <Check className="w-3 h-3 text-emerald-400" />}
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14151B] hover:bg-[#1C1D24] border border-white/5 text-xs font-medium text-gray-400 hover:text-white transition-colors"
            >
              {sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
              <span>{sortBy === 'latency' ? 'Latency' : sortBy === 'name' ? 'Name' : 'Models'}</span>
            </button>

            {sortDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-44 p-2 rounded-xl bg-[#1A1B22] border border-white/10 shadow-2xl z-30 space-y-1 text-xs">
                {(['latency', 'name', 'models'] as const).map((field) => (
                  <button
                    key={field}
                    onClick={() => {
                      setSortBy(field);
                      setSortDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between ${
                      sortBy === field ? 'bg-white/10 text-white font-semibold' : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="capitalize">{field === 'latency' ? 'Inference Latency' : field === 'models' ? 'Models Count' : field}</span>
                    {sortBy === field && <Check className="w-3 h-3 text-emerald-400" />}
                  </button>
                ))}
                <div className="pt-1 border-t border-white/5">
                  <button
                    onClick={() => {
                      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                      setSortDropdownOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 flex items-center justify-between"
                  >
                    <span>Direction</span>
                    <span className="font-mono text-[10px] text-brand-400 uppercase">{sortOrder}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Table View Button */}
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14151B] border border-white/5 text-xs font-medium text-gray-400 shadow-sm cursor-default"
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
        </div>
      </div>

      {/* ================= MINIMALIST RUNTIMES TABLE ================= */}
      <div className="w-full">
        {/* Table Column Headers */}
        <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-normal text-gray-500 border-b border-white/[0.04]">
          <div className="col-span-4">Engine & Endpoint</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Loaded Models</div>
          <div className="col-span-1 text-left">Latency</div>
          <div className="col-span-1 text-right">Default</div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-white/[0.02]">
          {filteredRuntimes.map((rt) => {
            return (
              <div
                key={rt.id}
                onClick={() => setSelectedRuntimeId(rt.id)}
                className={`grid grid-cols-12 gap-4 px-4 py-3.5 items-center text-xs hover:bg-white/[0.02] cursor-pointer transition-colors group ${
                  selectedRuntimeId === rt.id ? 'bg-white/[0.04]' : ''
                }`}
              >
                {/* 1. Engine Name & Endpoint */}
                <div className="col-span-4 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white truncate group-hover:text-gray-200">
                      {rt.name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/5 flex-shrink-0">
                      {rt.provider}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 font-mono truncate">
                    {rt.endpoint}
                  </div>
                </div>

                {/* 2. Type Badge */}
                <div className="col-span-2">
                  <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-medium ${
                    rt.type === 'local' 
                      ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20' 
                      : 'bg-[#1B1C23] text-gray-400'
                  }`}>
                    {rt.type === 'local' ? 'Local Host' : 'Cloud Gateway'}
                  </span>
                </div>

                {/* 3. Status Badge */}
                <div className="col-span-2">
                  {renderStatusBadge(rt.status)}
                </div>

                {/* 4. Loaded Models */}
                <div className="col-span-2 truncate flex items-center gap-1.5">
                  <span className="font-mono text-white text-[11px]">{(rt.modelsLoaded || rt.models || []).length} models</span>
                  <span className="text-gray-500 font-mono text-[10px] truncate">
                    ({(rt.modelsLoaded || rt.models || [])[0]?.split(':')[0] || 'none'})
                  </span>
                </div>

                {/* 5. Latency */}
                <div className="col-span-1 text-left font-mono text-xs">
                  <span className={(rt.latencyMs || 0) < 50 ? 'text-emerald-400' : 'text-gray-400'}>
                    {rt.latencyMs || 25}ms
                  </span>
                </div>

                {/* 6. Default Engine Toggle */}
                <div className="col-span-1 text-right">
                  {rt.isDefault ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-teal-300 font-semibold">
                      <Check className="w-3.5 h-3.5" />
                      <span>Default</span>
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDefaultRuntime(rt.id);
                      }}
                      className="text-[11px] text-gray-500 hover:text-white px-2 py-0.5 rounded hover:bg-white/5 transition-colors"
                    >
                      Make default
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= RUNTIME INSPECTOR DRAWER ================= */}
      {selectedRuntime && (
        <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-[#111218] border-l border-white/10 shadow-2xl z-50 flex flex-col animate-slide-left font-sans">
          
          {/* Drawer Header */}
          <div className="p-5 border-b border-white/5 flex items-start justify-between bg-[#14151B]">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-surface-100 border border-white/10 flex items-center justify-center text-xl shadow-md flex-shrink-0">
                {selectedRuntime.type === 'local' ? <Server className="w-5 h-5 text-teal-400" /> : <Globe className="w-5 h-5 text-indigo-400" />}
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-white truncate">{selectedRuntime.name}</h2>
                  {selectedRuntime.isDefault && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                      DEFAULT
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {renderStatusBadge(selectedRuntime.status)}
                  <span className="text-[11px] text-gray-400 font-mono">
                    {selectedRuntime.provider} • {selectedRuntime.latencyMs}ms latency
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedRuntimeId(null)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-gray-300">
            
            {/* Endpoint Connection Block */}
            <div className="p-3.5 rounded-xl bg-[#15161D] border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-gray-400">
                <span>Inference API Endpoint</span>
                <button
                  onClick={() => handleCopyEndpoint(selectedRuntime.endpoint || '', selectedRuntime.id)}
                  className="flex items-center gap-1 text-gray-400 hover:text-white"
                >
                  {copiedEndpointId === selectedRuntime.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedEndpointId === selectedRuntime.id ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="font-mono text-white text-xs bg-black/30 p-2.5 rounded-lg border border-white/5 truncate">
                {selectedRuntime.endpoint || selectedRuntime.account?.email || 'Local Ambient Process'}
              </div>
            </div>

            {/* Local Host Hardware Telemetry (if local) */}
            {selectedRuntime.type === 'local' && (
              <div className="p-3.5 rounded-xl bg-[#15161D] border border-white/5 space-y-3">
                <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  Host Hardware & VRAM Telemetry
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-lg bg-black/20 border border-white/5 space-y-1">
                    <div className="text-[10px] text-gray-500 font-mono">GPU / Acceleration</div>
                    <div className="text-white font-medium truncate">{selectedRuntime.gpuName || 'Apple Silicon Unified'}</div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/20 border border-white/5 space-y-1">
                    <div className="text-[10px] text-gray-500 font-mono">Allocated VRAM</div>
                    <div className="text-teal-300 font-mono font-medium">
                      {selectedRuntime.vramUsageGb || 38.4} GB / {selectedRuntime.vramTotalGb || 64.0} GB
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loaded Models Catalog */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-teal-400" />
                  <span>Available Model Weights ({(selectedRuntime.modelsLoaded || selectedRuntime.models || []).length})</span>
                </span>
                <span className="text-gray-500 font-mono">Ready for dispatch</span>
              </div>

              <div className="space-y-2">
                {(selectedRuntime.modelsLoaded || selectedRuntime.models || []).map((model) => (
                  <div
                    key={model}
                    className="p-3 rounded-xl bg-[#15161D] border border-white/5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                      <span className="font-mono text-white font-medium truncate">{model}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-400">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Set as default action */}
            {!selectedRuntime.isDefault && (
              <div className="pt-2 border-t border-white/5">
                <button
                  onClick={() => setDefaultRuntime(selectedRuntime.id)}
                  className="w-full py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium text-xs shadow-glow-brand transition-all"
                >
                  Set as Default LLM Engine
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
