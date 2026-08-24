import React, { useState, useMemo } from 'react';
import { useApp } from '@/app/AppContext';
import { SquadTopology } from '@/shared/types';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  ArrowDown, 
  ArrowUp, 
  Table as TableIcon, 
  Check, 
  X, 
  Play, 
  ArrowRight, 
  Workflow
} from 'lucide-react';
import { CreateSquadModal } from '@/features/squads/CreateSquadModal';

export const SquadsView: React.FC = () => {
  const { squads, agents, triggerSquadRun } = useApp();
  
  // Selected squad for centered pop-up modal
  const [selectedSquadId, setSelectedAgentSquadId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [topologyFilter, setTopologyFilter] = useState<string>('all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState<boolean>(false);
  
  // Sorting state
  const [sortBy, setSortBy] = useState<'runs' | 'name' | 'members'>('runs');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [sortDropdownOpen, setSortDropdownOpen] = useState<boolean>(false);
  
  // Active sub-tab inside centered modal
  const [modalTab, setModalTab] = useState<'flow' | 'members' | 'mission' | 'metrics'>('flow');

  // Selected squad memo
  const selectedSquad = useMemo(() => {
    return squads.find(s => s.id === selectedSquadId) || null;
  }, [squads, selectedSquadId]);

  // Topology Descriptions
  const getTopologyDescription = (top: SquadTopology) => {
    switch (top) {
      case 'hierarchical': return 'Leader delegates to worker agents and aggregates results with a final verification pass.';
      case 'sequential': return 'Linear pipeline where Agent A output serves as input context for Agent B.';
      case 'swarm': return 'Decentralized peer agents collaborating asynchronously on shared memory state.';
      case 'consensus': return 'Multi-agent voting requiring majority approval before committing workspace state.';
      default: return '';
    }
  };

  // Filtered & Sorted Squads
  const filteredSquads = useMemo(() => {
    let list = squads.filter(squad => {
      if (topologyFilter !== 'all' && squad.topology !== topologyFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = squad.name.toLowerCase().includes(q);
        const matchesDesc = (squad.description || '').toLowerCase().includes(q);
        const matchesMission = (squad.mission || '').toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesMission) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'members') cmp = a.memberAgentIds.length - b.memberAgentIds.length;
      else cmp = (a.completedRunsCount + a.activeRunsCount) - (b.completedRunsCount + b.activeRunsCount);
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [squads, topologyFilter, searchQuery, sortBy, sortOrder]);

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-[#0E0E12] text-gray-300 p-6 space-y-6 select-none font-sans relative">
      
      {/* ================= TOP HEADER BAR ================= */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" />
          <h1 className="text-sm font-semibold text-white tracking-wide">Squads</h1>
          <span className="text-xs text-gray-500 font-mono">{squads.length}</span>
        </div>

        {/* + Form squad button */}
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181920] hover:bg-[#22242D] border border-white/10 text-xs font-medium text-white transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Form squad</span>
        </button>
      </div>

      {/* ================= SEARCH & ACTION ROW ================= */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: Search Input */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search squads, missions, agents..."
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
                topologyFilter !== 'all'
                  ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
                  : 'bg-[#14151B] hover:bg-[#1C1D24] text-gray-400 hover:text-white border-white/5'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>

            {filterDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-48 p-2 rounded-xl bg-[#1A1B22] border border-white/10 shadow-2xl z-30 space-y-2 text-xs">
                <div className="text-[10px] font-mono uppercase text-gray-400 px-2 py-1">Topology</div>
                {['all', 'hierarchical', 'sequential', 'swarm', 'consensus'].map((top) => (
                  <button
                    key={top}
                    onClick={() => {
                      setTopologyFilter(top);
                      setFilterDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1 rounded-lg capitalize flex items-center justify-between ${
                      topologyFilter === top ? 'bg-white/10 text-white font-semibold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <span>{top}</span>
                    {topologyFilter === top && <Check className="w-3 h-3 text-emerald-400" />}
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
              {sortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
              <span>{sortBy === 'runs' ? 'Runs' : sortBy === 'members' ? 'Members' : 'Name'}</span>
            </button>

            {sortDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-44 p-2 rounded-xl bg-[#1A1B22] border border-white/10 shadow-2xl z-30 space-y-1 text-xs">
                {(['runs', 'members', 'name'] as const).map((field) => (
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
                    <span className="capitalize">{field === 'runs' ? 'Total Runs' : field === 'members' ? 'Member Count' : field}</span>
                    {sortBy === field && <Check className="w-3 h-3 text-emerald-400" />}
                  </button>
                ))}
                <div className="pt-1 border-t border-white/5">
                  <button
                    onClick={() => {
                      setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));
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

      {/* ================= MINIMALIST CLEAN SQUADS TABLE ================= */}
      <div className="w-full">
        {/* Table Column Headers */}
        <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-normal text-gray-500 border-b border-white/[0.04] items-center">
          <div className="col-span-4">Squad & Mission</div>
          <div className="col-span-2">Topology & Leader</div>
          <div className="col-span-2">Status & Activity</div>
          <div className="col-span-2">Members</div>
          <div className="col-span-1 text-left">Completed</div>
          <div className="col-span-1 text-right">Run</div>
        </div>

        {/* Table Rows (No Pills / Clean Typography) */}
        <div className="divide-y divide-white/[0.02]">
          {filteredSquads.map((squad) => {
            const leader = agents.find(a => a.id === squad.leaderAgentId);
            const isSelected = selectedSquadId === squad.id;

            return (
              <div
                key={squad.id}
                onClick={() => setSelectedAgentSquadId(squad.id)}
                className={`grid grid-cols-12 gap-4 px-4 py-3.5 items-center text-xs hover:bg-white/[0.02] cursor-pointer transition-colors group ${
                  isSelected ? 'bg-white/[0.04]' : ''
                }`}
              >
                {/* 1. Avatar, Name, Topology, Mission */}
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#14151B] border border-white/5 flex items-center justify-center text-base flex-shrink-0">
                    {squad.avatar}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate group-hover:text-gray-200">
                        {squad.name}
                      </span>
                      <span className="text-[11px] text-gray-500 font-mono">
                        • {squad.topology}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 truncate mt-0.5 font-mono">
                      {squad.mission || squad.description}
                    </p>
                  </div>
                </div>

                {/* 2. Topology & Leader */}
                <div className="col-span-2 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-gray-300 truncate font-mono text-[11px]">
                    {leader?.avatar ? (
                      <img src={leader.avatar} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center text-[9px] font-bold">L</span>
                    )}
                    <span className="truncate">{leader?.name || 'Lead'}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono capitalize">
                    {squad.topology} Flow
                  </div>
                </div>

                {/* 3. Status & Activity (Clean dot, no pill container) */}
                <div className="col-span-2">
                  {squad.activeRunsCount > 0 ? (
                    <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-medium font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span>{squad.activeRunsCount} runs active</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Idle</span>
                    </div>
                  )}
                </div>

                {/* 4. Member Avatars */}
                <div className="col-span-2 flex items-center gap-1.5">
                  <div className="flex -space-x-1.5 overflow-hidden">
                    {squad.memberAgentIds.map((agentId) => {
                      const member = agents.find(a => a.id === agentId);
                      if (!member) return null;
                      return (
                        <img
                          key={agentId}
                          src={member.avatar}
                          alt={member.name}
                          title={member.name}
                          className="inline-block h-5 w-5 rounded-full ring-1 ring-[#0E0E12] object-cover"
                        />
                      );
                    })}
                  </div>
                  <span className="text-[11px] text-gray-500 font-mono">
                    {squad.memberAgentIds.length} agents
                  </span>
                </div>

                {/* 5. Completed Missions */}
                <div className="col-span-1 text-left font-mono text-xs text-gray-400">
                  {squad.completedRunsCount} runs
                </div>

                {/* 6. Launch Action */}
                <div className="col-span-1 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerSquadRun(squad.id);
                    }}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                    title="Launch Swarm Run"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= CENTERED SQUAD INSPECTOR POPUP MODAL ================= */}
      {selectedSquad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Overlay */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-fade-in"
            onClick={() => setSelectedAgentSquadId(null)}
          />

          {/* Centered Modal Container */}
          <div className="relative w-full max-w-2xl bg-[#121318] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-10 animate-scale-in flex flex-col max-h-[85vh] font-sans">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-white/5 flex items-start justify-between bg-[#15161D]">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-[#0A0B0E] border border-white/10 flex items-center justify-center text-2xl flex-shrink-0">
                  {selectedSquad.avatar}
                </div>

                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-white truncate">{selectedSquad.name}</h2>
                    <span className="text-xs text-gray-400 font-mono">• {selectedSquad.topology}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {selectedSquad.activeRunsCount > 0 ? (
                      <span className="text-cyan-300 font-mono flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        {selectedSquad.activeRunsCount} active runs
                      </span>
                    ) : (
                      <span className="text-gray-400 font-mono flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Idle
                      </span>
                    )}
                    <span className="text-gray-600 font-mono">•</span>
                    <span className="text-gray-400 font-mono text-[11px]">
                      {selectedSquad.memberAgentIds.length} member agents
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => triggerSquadRun(selectedSquad.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Launch Run</span>
                </button>
                <button
                  onClick={() => setSelectedAgentSquadId(null)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex items-center gap-1 px-5 pt-2 border-b border-white/5 bg-[#15161D] text-xs">
              {[
                { id: 'flow', label: 'Orchestration Flow' },
                { id: 'members', label: 'Member Agents' },
                { id: 'mission', label: 'Mission & Context' },
                { id: 'metrics', label: 'Run Telemetry' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setModalTab(tab.id as any)}
                  className={`px-3 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${
                    modalTab === tab.id
                      ? 'border-white text-white font-semibold'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Body Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-gray-300">
              
              {/* Tab 1: Interactive Orchestration Flow Nodes */}
              {modalTab === 'flow' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-black/30 border border-white/5 text-xs text-gray-400 flex items-center gap-2">
                    <Workflow className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span><b>{selectedSquad.topology.toUpperCase()} Topology:</b> {getTopologyDescription(selectedSquad.topology)}</span>
                  </div>

                  <div className="p-6 rounded-xl bg-[#0A0B0E] border border-white/5 flex flex-wrap items-center justify-center gap-4 min-h-[160px]">
                    {selectedSquad.memberAgentIds.map((agentId, index) => {
                      const agent = agents.find(a => a.id === agentId);
                      if (!agent) return null;
                      const isLeader = agent.id === selectedSquad.leaderAgentId;

                      return (
                        <React.Fragment key={agent.id}>
                          <div className={`p-3 rounded-xl border text-center space-y-1.5 min-w-[130px] transition-all ${
                            isLeader 
                              ? 'bg-white/[0.04] border-white/20' 
                              : 'bg-black/40 border-white/5'
                          }`}>
                            <div className="relative mx-auto w-9 h-9">
                              <img src={agent.avatar} alt="" className="w-9 h-9 rounded-full object-cover ring-1 ring-white/10" />
                              {isLeader && (
                                <span className="absolute -top-1 -right-1 text-[8px] font-mono bg-white/20 text-white px-1 rounded font-bold">
                                  LEAD
                                </span>
                              )}
                            </div>
                            <div className="font-medium text-xs text-white truncate">{agent.name}</div>
                            <div className="text-[10px] font-mono text-gray-400">{agent.role}</div>
                          </div>

                          {index < selectedSquad.memberAgentIds.length - 1 && (
                            <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 2: Member Agents */}
              {modalTab === 'members' && (
                <div className="space-y-2">
                  <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                    Assigned Agent Roster ({selectedSquad.memberAgentIds.length})
                  </div>

                  <div className="space-y-1.5">
                    {selectedSquad.memberAgentIds.map((agentId) => {
                      const agent = agents.find(a => a.id === agentId);
                      if (!agent) return null;
                      const isLeader = agent.id === selectedSquad.leaderAgentId;

                      return (
                        <div
                          key={agent.id}
                          className="p-3 rounded-xl bg-[#0A0B0E] border border-white/5 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img src={agent.avatar} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10 flex-shrink-0" />
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white">{agent.name}</span>
                                {isLeader && <span className="text-[10px] font-mono text-gray-400">• Leader</span>}
                              </div>
                              <div className="text-[11px] text-gray-500 font-mono truncate">
                                {agent.role} • {agent.modelName}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs font-mono text-gray-400">
                            <span className={`w-1.5 h-1.5 rounded-full ${agent.machineStatus === 'online' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            <span className="capitalize">{agent.machineStatus}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 3: Mission & Context */}
              {modalTab === 'mission' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-400">Squad Mission & Ground Rules</label>
                    <div className="p-3.5 rounded-xl bg-[#0A0B0E] border border-white/5 text-white leading-relaxed font-mono text-xs">
                      {selectedSquad.mission || selectedSquad.description}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-400">Squad Description</label>
                    <div className="p-3.5 rounded-xl bg-[#0A0B0E] border border-white/5 text-gray-300 leading-relaxed text-xs">
                      {selectedSquad.description}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Metrics & Run Telemetry */}
              {modalTab === 'metrics' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl bg-[#0A0B0E] border border-white/5 space-y-1 font-mono">
                      <div className="text-[10px] text-gray-500 uppercase">Active Concurrent Runs</div>
                      <div className="text-lg font-semibold text-white">{selectedSquad.activeRunsCount}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#0A0B0E] border border-white/5 space-y-1 font-mono">
                      <div className="text-[10px] text-gray-500 uppercase">Completed Missions</div>
                      <div className="text-lg font-semibold text-white">{selectedSquad.completedRunsCount}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#0A0B0E] border border-white/5 space-y-1 font-mono">
                      <div className="text-[10px] text-gray-500 uppercase">Consensus Tolerance</div>
                      <div className="text-lg font-semibold text-white">99.8%</div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/5 bg-[#15161D] flex items-center justify-between text-xs">
              <span className="text-gray-500 font-mono text-[11px]">
                {selectedSquad.memberAgentIds.length} agents coordinated
              </span>
              <button
                onClick={() => {
                  triggerSquadRun(selectedSquad.id);
                  setSelectedAgentSquadId(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Launch Swarm Run</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= FORM SQUAD MODAL ================= */}
      <CreateSquadModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

    </div>
  );
};
