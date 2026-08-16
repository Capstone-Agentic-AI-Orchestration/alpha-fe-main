import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Bot, 
  Plus, 
  Search, 
  Filter, 
  ArrowDown, 
  ArrowUp, 
  Table as TableIcon, 
  Check, 
  X, 
  Copy, 
  Archive, 
  RotateCcw, 
  MessageSquare, 
  Server, 
  Eye, 
  EyeOff, 
  Trash2
} from 'lucide-react';
import { CreateAgentModal } from '../components/agents/CreateAgentModal';
import { Agent, AgentAccessLevel } from '../types';

export const AgentsView: React.FC = () => {
  const { 
    agents, 
    skills, 
    updateAgent, 
    duplicateAgent, 
    archiveAgent, 
    restoreAgent, 
    bulkUpdateAgents, 
    bulkArchiveAgents, 
    setActiveTab, 
    setActiveChatAgentId 
  } = useApp();

  // Selected agent for centered pop-up modal
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [scopeTab, setScopeTab] = useState<'all' | 'mine' | 'archived'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [accessFilter, setAccessFilter] = useState<string>('all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState<boolean>(false);
  
  // Sorting state
  const [sortBy, setSortBy] = useState<'lastActive' | 'name' | 'runs'>('lastActive');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [sortDropdownOpen, setSortDropdownOpen] = useState<boolean>(false);

  // Selection & Modals
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [bulkAccessMenuOpen, setBulkAccessMenuOpen] = useState<boolean>(false);

  // Pop-up Sub-tabs
  const [profileTab, setProfileTab] = useState<'instructions' | 'skills' | 'env' | 'mcp' | 'history'>('instructions');
  const [revealedEnvKeys, setRevealedEnvKeys] = useState<Record<string, boolean>>({});
  const [newEnvKey, setNewEnvKey] = useState<string>('');
  const [newEnvValue, setNewEnvValue] = useState<string>('');
  const [newEnvIsSecret, setNewEnvIsSecret] = useState<boolean>(false);

  // Active agent memo
  const selectedAgent = useMemo(() => {
    return agents.find(a => a.id === selectedAgentId) || null;
  }, [agents, selectedAgentId]);

  // Filtered and Sorted Agents
  const filteredAgents = useMemo(() => {
    let list = agents.filter(agent => {
      // Scope Filter
      if (scopeTab === 'archived') {
        if (!agent.isArchived) return false;
      } else {
        if (agent.isArchived) return false;
        if (scopeTab === 'mine' && !agent.isMine && agent.owner !== 'You') return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = agent.name.toLowerCase().includes(q);
        const matchDesc = (agent.description || '').toLowerCase().includes(q);
        const matchRole = agent.role.toLowerCase().includes(q);
        const matchModel = agent.modelName.toLowerCase().includes(q);
        const matchMachine = (agent.machineName || '').toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchRole && !matchModel && !matchMachine) return false;
      }

      // Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'online' && agent.machineStatus !== 'online') return false;
        if (statusFilter === 'offline' && agent.machineStatus !== 'offline') return false;
        if (statusFilter === 'working' && agent.workStatus !== 'working') return false;
        if (statusFilter === 'idle' && agent.workStatus !== 'idle') return false;
      }

      // Access Filter
      if (accessFilter !== 'all' && agent.allowedUsers !== accessFilter) return false;

      return true;
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'runs') cmp = (a.stats?.totalRuns || 0) - (b.stats?.totalRuns || 0);
      else cmp = (a.lastActive || '').localeCompare(b.lastActive || '');
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [agents, scopeTab, searchQuery, statusFilter, accessFilter, sortBy, sortOrder]);

  // Selection handlers
  const toggleSelectAgent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAgentIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    if (selectedAgentIds.length === filteredAgents.length) {
      setSelectedAgentIds([]);
    } else {
      setSelectedAgentIds(filteredAgents.map(a => a.id));
    }
  };

  const handleChatWithAgent = (agentId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveChatAgentId(agentId);
    setActiveTab('chat');
  };

  // Clean, Minimal Status Dot (No Pill / No Box container)
  const renderStatus = (agent: Agent) => {
    if (agent.isArchived) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
          <span>Archived</span>
        </div>
      );
    }

    if (agent.machineStatus === 'offline') {
      return (
        <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          <span>Offline</span>
        </div>
      );
    }

    if (agent.machineStatus === 'unstable') {
      return (
        <div className="flex items-center gap-1.5 text-xs text-amber-300 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span>Unstable</span>
        </div>
      );
    }

    if (agent.workStatus === 'working') {
      return (
        <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>Working</span>
        </div>
      );
    }

    if (agent.workStatus === 'queued') {
      return (
        <div className="flex items-center gap-1.5 text-xs text-purple-300 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          <span>Queued</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-300 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span>Idle</span>
      </div>
    );
  };

  // Add env var
  const handleAddEnvVar = (agentId: string) => {
    if (!newEnvKey.trim() || !newEnvValue.trim() || !selectedAgent) return;
    const updatedEnv = [
      ...(selectedAgent.envVars || []),
      { key: newEnvKey.trim().toUpperCase(), value: newEnvValue.trim(), isSecret: newEnvIsSecret }
    ];
    updateAgent(agentId, { envVars: updatedEnv });
    setNewEnvKey('');
    setNewEnvValue('');
    setNewEnvIsSecret(false);
  };

  // Remove env var
  const handleRemoveEnvVar = (agentId: string, key: string) => {
    if (!selectedAgent) return;
    const updatedEnv = (selectedAgent.envVars || []).filter(e => e.key !== key);
    updateAgent(agentId, { envVars: updatedEnv });
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-[#0E0E12] text-gray-300 p-6 space-y-6 select-none font-sans relative">
      
      {/* ================= TOP HEADER BAR ================= */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-gray-400" />
          <h1 className="text-sm font-semibold text-white tracking-wide">Agents</h1>
          <span className="text-xs text-gray-500 font-mono">{agents.length}</span>
        </div>

        {/* + New agent button */}
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181920] hover:bg-[#22242D] border border-white/10 text-xs font-medium text-white transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New agent</span>
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
            placeholder="Search agents, roles, models..."
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
                scopeTab !== 'all' || statusFilter !== 'all' || accessFilter !== 'all'
                  ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
                  : 'bg-[#14151B] hover:bg-[#1C1D24] text-gray-400 hover:text-white border-white/5'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>

            {filterDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-48 p-2 rounded-xl bg-[#1A1B22] border border-white/10 shadow-2xl z-30 space-y-2 text-xs">
                <div className="text-[10px] font-mono uppercase text-gray-400 px-2 py-1">Scope</div>
                {(['all', 'mine', 'archived'] as const).map((sc) => (
                  <button
                    key={sc}
                    onClick={() => {
                      setScopeTab(sc);
                      setFilterDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1 rounded-lg capitalize flex items-center justify-between ${
                      scopeTab === sc ? 'bg-white/10 text-white font-semibold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <span>{sc === 'all' ? 'All Agents' : sc === 'mine' ? 'My Agents' : 'Archived'}</span>
                    {scopeTab === sc && <Check className="w-3 h-3 text-emerald-400" />}
                  </button>
                ))}

                <div className="text-[10px] font-mono uppercase text-gray-400 px-2 py-1 pt-2 border-t border-white/5">Status</div>
                {['all', 'online', 'offline', 'working', 'idle'].map((st) => (
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

                <div className="text-[10px] font-mono uppercase text-gray-400 px-2 py-1 pt-2 border-t border-white/5">Access Tier</div>
                {['all', 'team', 'private', 'everyone'].map((acc) => (
                  <button
                    key={acc}
                    onClick={() => {
                      setAccessFilter(acc);
                      setFilterDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1 rounded-lg capitalize flex items-center justify-between ${
                      accessFilter === acc ? 'bg-white/10 text-white font-semibold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <span>{acc === 'all' ? 'All Access' : acc}</span>
                    {accessFilter === acc && <Check className="w-3 h-3 text-emerald-400" />}
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
              <span>{sortBy === 'lastActive' ? 'Active' : sortBy === 'runs' ? 'Runs' : 'Name'}</span>
            </button>

            {sortDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-44 p-2 rounded-xl bg-[#1A1B22] border border-white/10 shadow-2xl z-30 space-y-1 text-xs">
                {(['lastActive', 'runs', 'name'] as const).map((field) => (
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
                    <span className="capitalize">{field === 'lastActive' ? 'Last Active' : field === 'runs' ? 'Total Runs' : field}</span>
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

      {/* ================= MINIMALIST CLEAN AGENTS TABLE ================= */}
      <div className="w-full">
        {/* Table Column Headers */}
        <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-normal text-gray-500 border-b border-white/[0.04] items-center">
          <div className="col-span-4 flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedAgentIds.length > 0 && selectedAgentIds.length === filteredAgents.length}
              onChange={selectAllFiltered}
              className="rounded bg-[#1B1C23] border-white/10 text-brand-500 focus:ring-0 cursor-pointer"
            />
            <span>Agent</span>
          </div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Machine & Model</div>
          <div className="col-span-2">Runs & Active</div>
          <div className="col-span-1 text-left">Access</div>
          <div className="col-span-1 text-right">Chat</div>
        </div>

        {/* Table Rows (No Pills / Clean Typography) */}
        <div className="divide-y divide-white/[0.02]">
          {filteredAgents.map((agent) => {
            const isSelected = selectedAgentIds.includes(agent.id);

            return (
              <div
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`grid grid-cols-12 gap-4 px-4 py-3.5 items-center text-xs hover:bg-white/[0.02] cursor-pointer transition-colors group ${
                  selectedAgentId === agent.id ? 'bg-white/[0.04]' : ''
                }`}
              >
                {/* 1. Avatar, Name, Role, Description */}
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onClick={(e) => toggleSelectAgent(agent.id, e)}
                    onChange={() => {}}
                    className="rounded bg-[#1B1C23] border-white/10 text-brand-500 focus:ring-0 cursor-pointer flex-shrink-0"
                  />
                  
                  <div className="relative flex-shrink-0">
                    <img
                      src={agent.avatar}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10"
                    />
                    <span 
                      className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-[#0E0E12] ${
                        agent.machineStatus === 'online' ? 'bg-emerald-400' :
                        agent.machineStatus === 'unstable' ? 'bg-amber-400' : 'bg-rose-400'
                      }`}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate group-hover:text-gray-200">
                        {agent.name}
                      </span>
                      <span className="text-[11px] text-gray-500 font-mono">
                        • {agent.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 truncate mt-0.5 font-mono">
                      {agent.description || `${agent.role} autonomous assistant`}
                    </p>
                  </div>
                </div>

                {/* 2. Status (Clean Dot & Text - No Pill Container) */}
                <div className="col-span-2">
                  {renderStatus(agent)}
                </div>

                {/* 3. Machine & Model (Plain Text) */}
                <div className="col-span-2 min-w-0 space-y-0.5 font-mono">
                  <div className="flex items-center gap-1.5 text-gray-300 truncate text-[11px]">
                    <Server className="w-3 h-3 text-gray-500 flex-shrink-0" />
                    <span className="truncate">{agent.machineName || 'Host Node'}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {agent.modelName} ({agent.modelProvider})
                  </div>
                </div>

                {/* 4. Runs & Last Active */}
                <div className="col-span-2 space-y-0.5 font-mono">
                  <div className="text-white text-[11px]">
                    {agent.stats?.totalRuns || 0} tasks done
                  </div>
                  <div className="text-[10px] text-gray-500">
                    Active {agent.lastActive || 'recently'}
                  </div>
                </div>

                {/* 5. Access (Plain Text) */}
                <div className="col-span-1 text-[11px] text-gray-400 font-mono capitalize">
                  {agent.allowedUsers || 'team'}
                </div>

                {/* 6. Chat Action */}
                <div className="col-span-1 text-right">
                  <button
                    onClick={(e) => handleChatWithAgent(agent.id, e)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                    title="Direct Chat"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= CENTERED AGENT PROFILE POPUP MODAL ================= */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Overlay */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-fade-in"
            onClick={() => setSelectedAgentId(null)}
          />

          {/* Centered Modal Container */}
          <div className="relative w-full max-w-2xl bg-[#121318] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-10 animate-scale-in flex flex-col max-h-[85vh] font-sans">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-white/5 flex items-start justify-between bg-[#15161D]">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="relative flex-shrink-0">
                  <img
                    src={selectedAgent.avatar}
                    alt=""
                    className="w-11 h-11 rounded-full object-cover ring-1 ring-white/10"
                  />
                  <span 
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-[#15161D] ${
                      selectedAgent.machineStatus === 'online' ? 'bg-emerald-400' :
                      selectedAgent.machineStatus === 'unstable' ? 'bg-amber-400' : 'bg-rose-400'
                    }`}
                  />
                </div>

                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-white truncate">{selectedAgent.name}</h2>
                    <span className="text-xs text-gray-400 font-mono">• {selectedAgent.role}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {renderStatus(selectedAgent)}
                    <span className="text-gray-600 font-mono">•</span>
                    <span className="text-gray-400 font-mono text-[11px] truncate">
                      {selectedAgent.machineName || 'Host Node'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleChatWithAgent(selectedAgent.id);
                    setSelectedAgentId(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Chat</span>
                </button>
                <button
                  onClick={() => setSelectedAgentId(null)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex items-center gap-1 px-5 pt-2 border-b border-white/5 bg-[#15161D] text-xs">
              {[
                { id: 'instructions', label: 'Instructions' },
                { id: 'skills', label: 'Skills & Tools' },
                { id: 'env', label: 'Secrets & Env' },
                { id: 'mcp', label: 'MCP & CLI' },
                { id: 'history', label: 'Run History' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setProfileTab(tab.id as any)}
                  className={`px-3 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${
                    profileTab === tab.id
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
              
              {/* Tab 1: Instructions & Persona */}
              {profileTab === 'instructions' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-400">Specialization Description</label>
                    <input
                      type="text"
                      value={selectedAgent.description || ''}
                      onChange={(e) => updateAgent(selectedAgent.id, { description: e.target.value })}
                      className="w-full bg-[#0A0B0E] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-white/30 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-medium text-gray-400">System Prompt & Persona</label>
                      <span className="text-[10px] text-gray-500 font-mono">Auto-saved</span>
                    </div>
                    <textarea
                      rows={7}
                      value={selectedAgent.systemPrompt || ''}
                      onChange={(e) => updateAgent(selectedAgent.id, { systemPrompt: e.target.value })}
                      className="w-full bg-[#0A0B0E] border border-white/10 rounded-xl p-3 text-white text-xs leading-relaxed font-mono focus:outline-none focus:border-white/30"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <div className="text-[10px] text-gray-500 font-mono uppercase">Model Runtime</div>
                      <div className="text-white font-medium mt-0.5">{selectedAgent.modelName}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 font-mono uppercase">Autonomy Tier</div>
                      <div className="text-white font-medium mt-0.5">{selectedAgent.autonomyLevel}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Skills & MCP Tools */}
              {profileTab === 'skills' && (
                <div className="space-y-3">
                  <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                    Available MCP Tool Bindings
                  </div>

                  <div className="space-y-1.5">
                    {skills.map((skill) => {
                      const isEnabled = (selectedAgent.skills || []).includes(skill.id);

                      return (
                        <div
                          key={skill.id}
                          onClick={() => {
                            const updated = isEnabled
                              ? (selectedAgent.skills || []).filter(s => s !== skill.id)
                              : [...(selectedAgent.skills || []), skill.id];
                            updateAgent(selectedAgent.id, { skills: updated });
                          }}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                            isEnabled
                              ? 'bg-white/[0.04] border-white/15 text-white'
                              : 'bg-transparent border-white/5 text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="font-medium text-xs text-white">{skill.name}</div>
                            <div className="text-[11px] text-gray-400 truncate">{skill.description}</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => {}}
                            className="rounded bg-[#1B1C23] border-white/10 text-brand-500 focus:ring-0 ml-3"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 3: Environment Variables & Secrets */}
              {profileTab === 'env' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-[11px] font-medium text-gray-400">
                    <span>Injected Variables & Secrets</span>
                    <span className="text-gray-500 font-mono">{(selectedAgent.envVars || []).length} keys</span>
                  </div>

                  {/* Key-Value Rows */}
                  <div className="space-y-1.5">
                    {(selectedAgent.envVars || []).length === 0 ? (
                      <p className="p-3 text-gray-500 italic">No environment variables configured.</p>
                    ) : (
                      (selectedAgent.envVars || []).map((ev) => {
                        const isRevealed = revealedEnvKeys[ev.key] ?? false;

                        return (
                          <div
                            key={ev.key}
                            className="p-2.5 rounded-xl bg-[#0A0B0E] border border-white/5 flex items-center justify-between font-mono text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-white font-medium">{ev.key}</span>
                              <span className="text-gray-600">=</span>
                              <span className="text-gray-400 truncate">
                                {ev.isSecret && !isRevealed ? '••••••••••••••••' : ev.value}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {ev.isSecret && (
                                <button
                                  onClick={() => setRevealedEnvKeys(prev => ({ ...prev, [ev.key]: !isRevealed }))}
                                  className="p-1 text-gray-400 hover:text-white"
                                >
                                  {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              )}
                              <button
                                onClick={() => handleRemoveEnvVar(selectedAgent.id, ev.key)}
                                className="p-1 text-gray-500 hover:text-rose-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add New Key */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                    <div className="text-[11px] font-medium text-gray-300">Add Variable</div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={newEnvKey}
                        onChange={(e) => setNewEnvKey(e.target.value)}
                        placeholder="KEY_NAME"
                        className="bg-[#0A0B0E] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white uppercase font-mono focus:outline-none focus:border-white/30"
                      />
                      <input
                        type="text"
                        value={newEnvValue}
                        onChange={(e) => setNewEnvValue(e.target.value)}
                        placeholder="value"
                        className="bg-[#0A0B0E] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-white/30"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newEnvIsSecret}
                          onChange={(e) => setNewEnvIsSecret(e.target.checked)}
                          className="rounded bg-[#1B1C23] border-white/10 text-brand-500 focus:ring-0"
                        />
                        <span>Treat as masked secret</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleAddEnvVar(selectedAgent.id)}
                        className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-colors"
                      >
                        Add Key
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: MCP & CLI Settings */}
              {profileTab === 'mcp' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-400">Connected MCP Server Sockets</label>
                    <div className="p-3 rounded-xl bg-[#0A0B0E] border border-white/5 font-mono text-xs text-gray-300">
                      {(selectedAgent.mcpServers || []).join(', ') || 'git, filesystem, browser'}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-400">Custom CLI Arguments</label>
                    <input
                      type="text"
                      value={selectedAgent.customCliArgs || ''}
                      onChange={(e) => updateAgent(selectedAgent.id, { customCliArgs: e.target.value })}
                      placeholder="e.g. --strict-mode --max-depth 4"
                      className="w-full bg-[#0A0B0E] border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-white/30"
                    />
                  </div>
                </div>
              )}

              {/* Tab 5: Run History Logs */}
              {profileTab === 'history' && (
                <div className="space-y-3">
                  <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                    Audit Execution Trail
                  </div>

                  {(selectedAgent.runHistory || []).length === 0 ? (
                    <p className="p-3 text-gray-500 italic">No execution history recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {(selectedAgent.runHistory || []).map((run) => (
                        <div
                          key={run.id}
                          className="p-3 rounded-xl bg-[#0A0B0E] border border-white/5 space-y-1.5 font-mono text-xs"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-white font-semibold">{run.issueKey}</span>
                            <span className="text-gray-500">{run.timestamp}</span>
                          </div>
                          <div className="text-gray-300 text-[11px] bg-black/40 p-2 rounded border border-white/5">
                            {run.command}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-gray-500 pt-0.5">
                            <span className="text-emerald-400">{run.status}</span>
                            <span>{run.durationMs}ms</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Modal Footer: Duplicate / Archive */}
            <div className="p-4 border-t border-white/5 bg-[#15161D] flex items-center justify-between text-xs">
              <button
                onClick={() => {
                  duplicateAgent(selectedAgent.id);
                  setSelectedAgentId(null);
                }}
                className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Duplicate Agent</span>
              </button>

              {selectedAgent.isArchived ? (
                <button
                  onClick={() => {
                    restoreAgent(selectedAgent.id);
                    setSelectedAgentId(null);
                  }}
                  className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Agent</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    archiveAgent(selectedAgent.id);
                    setSelectedAgentId(null);
                  }}
                  className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 transition-colors"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive Agent</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ================= FLOATING BULK ACTIONS TOOLBAR ================= */}
      {selectedAgentIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#181920] border border-white/10 rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 z-40 animate-slide-up text-xs">
          <span className="font-mono text-white font-medium">
            {selectedAgentIds.length} agents selected
          </span>

          <div className="h-4 w-px bg-white/10" />

          {/* Change Access Dropdown */}
          <div className="relative">
            <button
              onClick={() => setBulkAccessMenuOpen(prev => !prev)}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
            >
              Change Access
            </button>

            {bulkAccessMenuOpen && (
              <div className="absolute bottom-full mb-2 left-0 w-36 bg-[#1A1B22] border border-white/10 rounded-xl shadow-2xl p-1.5 space-y-1">
                {(['team', 'private', 'everyone'] as AgentAccessLevel[]).map(tier => (
                  <button
                    key={tier}
                    onClick={() => {
                      bulkUpdateAgents(selectedAgentIds, { allowedUsers: tier });
                      setBulkAccessMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1 rounded-lg text-xs capitalize text-gray-300 hover:text-white hover:bg-white/10"
                  >
                    {tier}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              bulkArchiveAgents(selectedAgentIds);
              setSelectedAgentIds([]);
            }}
            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-medium transition-colors"
          >
            Bulk Archive
          </button>

          <button
            onClick={() => setSelectedAgentIds([])}
            className="text-gray-400 hover:text-white"
          >
            Deselect All
          </button>
        </div>
      )}

      {/* ================= CREATE AGENT MODAL ================= */}
      <CreateAgentModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

    </div>
  );
};
