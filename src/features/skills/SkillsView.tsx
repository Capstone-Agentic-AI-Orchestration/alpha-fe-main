import React, { useState, useMemo, useCallback } from 'react';
import { useApp } from '@/app/AppContext';
import { 
  Terminal, 
  Search, 
  Code, 
  Database, 
  Globe, 
  FolderKanban, 
  Command, 
  GitBranch, 
  Box, 
  ToggleLeft, 
  ToggleRight, 
  Copy, 
  Check, 
  Filter, 
  ArrowDown, 
  ArrowUp, 
  Table as TableIcon, 
  X,
  RefreshCw
} from 'lucide-react';
import { SkillCategory } from '@/shared/types';

export const SkillsView: React.FC = () => {
  const { skills, toggleSkill, agents } = useApp();
  
  // Selected skill for centered popup modal
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState<boolean>(false);
  
  // Sort state
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'agents'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [sortDropdownOpen, setSortDropdownOpen] = useState<boolean>(false);
  
  // Copied indicator
  const [copiedSkillId, setCopiedSkillId] = useState<string | null>(null);

  // Selected skill memo
  const selectedSkill = useMemo(() => {
    return skills.find(s => s.id === selectedSkillId) || null;
  }, [skills, selectedSkillId]);

  // Categories list
  const categories: SkillCategory[] = [
    'File Operations',
    'Code Execution',
    'Browser & Web',
    'Terminal & Shell',
    'Git & GitHub',
    'MCP Servers',
    'Cloud & API'
  ];

  const getCategoryIcon = (cat: SkillCategory) => {
    switch (cat) {
      case 'File Operations': return <FolderKanban className="w-3.5 h-3.5 text-cyan-400" />;
      case 'Code Execution': return <Code className="w-3.5 h-3.5 text-emerald-400" />;
      case 'Browser & Web': return <Globe className="w-3.5 h-3.5 text-blue-400" />;
      case 'Terminal & Shell': return <Command className="w-3.5 h-3.5 text-amber-400" />;
      case 'Git & GitHub': return <GitBranch className="w-3.5 h-3.5 text-purple-400" />;
      case 'MCP Servers': return <Database className="w-3.5 h-3.5 text-pink-400" />;
      case 'Cloud & API': return <Box className="w-3.5 h-3.5 text-indigo-400" />;
      default: return <Terminal className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  const handleCopyCommand = useCallback((skillId: string, cmd: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(cmd);
    setCopiedSkillId(skillId);
    setTimeout(() => setCopiedSkillId(null), 2000);
  }, []);

  // Filtered & Sorted Skills
  const filteredSkills = useMemo(() => {
    let list = skills.filter(skill => {
      if (selectedCategory !== 'all' && skill.category !== selectedCategory) return false;
      if (statusFilter === 'enabled' && !skill.enabled) return false;
      if (statusFilter === 'disabled' && skill.enabled) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          skill.name.toLowerCase().includes(q) ||
          skill.description.toLowerCase().includes(q) ||
          skill.category.toLowerCase().includes(q) ||
          (skill.commandExample && skill.commandExample.toLowerCase().includes(q))
        );
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'category') cmp = a.category.localeCompare(b.category);
      else {
        const aCount = agents.filter(ag => (ag.skills || []).includes(a.id)).length;
        const bCount = agents.filter(ag => (ag.skills || []).includes(b.id)).length;
        cmp = aCount - bCount;
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [skills, selectedCategory, statusFilter, searchQuery, sortBy, sortOrder, agents]);

  const enabledCount = skills.filter(s => s.enabled).length;

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-[#0E0E12] text-gray-300 p-6 space-y-6 select-none font-sans relative">
      
      {/* ================= TOP HEADER BAR ================= */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-gray-400" />
          <h1 className="text-sm font-semibold text-white tracking-wide">Skills & Tools</h1>
          <span className="text-xs text-gray-500 font-mono">{enabledCount}/{skills.length} active</span>
        </div>

        {/* Scan / Register Tools button */}
        <button
          onClick={() => {}}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181920] hover:bg-[#22242D] border border-white/10 text-xs font-medium text-white transition-colors shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Scan MCP tools</span>
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
            placeholder="Search tools & MCP schemas..."
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
                selectedCategory !== 'all' || statusFilter !== 'all'
                  ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
                  : 'bg-[#14151B] hover:bg-[#1C1D24] text-gray-400 hover:text-white border-white/5'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>

            {filterDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-52 p-2 rounded-xl bg-[#1A1B22] border border-white/10 shadow-2xl z-30 space-y-2 text-xs">
                <div className="text-[10px] font-mono uppercase text-gray-400 px-2 py-1">Category</div>
                {['all', ...categories].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setFilterDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1 rounded-lg flex items-center justify-between ${
                      selectedCategory === cat ? 'bg-white/10 text-white font-semibold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <span>{cat === 'all' ? 'All Categories' : cat}</span>
                    {selectedCategory === cat && <Check className="w-3 h-3 text-emerald-400" />}
                  </button>
                ))}

                <div className="text-[10px] font-mono uppercase text-gray-400 px-2 py-1 pt-2 border-t border-white/5">Status</div>
                {(['all', 'enabled', 'disabled'] as const).map((st) => (
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
                    <span>{st === 'all' ? 'All' : st === 'enabled' ? 'Active' : 'Disabled'}</span>
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
              <span>{sortBy === 'name' ? 'Name' : sortBy === 'category' ? 'Category' : 'Agents'}</span>
            </button>

            {sortDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-44 p-2 rounded-xl bg-[#1A1B22] border border-white/10 shadow-2xl z-30 space-y-1 text-xs">
                {(['name', 'category', 'agents'] as const).map((field) => (
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
                    <span className="capitalize">{field === 'agents' ? 'Agent Count' : field}</span>
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

      {/* ================= STREAMLINED CLEAN SKILLS TABLE ================= */}
      <div className="w-full">
        {/* Table Column Headers */}
        <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-normal text-gray-500 border-b border-white/[0.04] items-center">
          <div className="col-span-4">Tool & Schema</div>
          <div className="col-span-4">Description</div>
          <div className="col-span-2">Active in Agents</div>
          <div className="col-span-2 text-right">Status</div>
        </div>

        {/* Table Rows (No Pills / Clean Typography) */}
        <div className="divide-y divide-white/[0.02]">
          {filteredSkills.map((skill) => {
            const isSelected = selectedSkillId === skill.id;
            const isCopied = copiedSkillId === skill.id;
            const boundAgents = agents.filter(a => (a.skills || []).includes(skill.id));

            return (
              <div
                key={skill.id}
                onClick={() => setSelectedSkillId(skill.id)}
                className={`grid grid-cols-12 gap-4 px-4 py-3.5 items-center text-xs hover:bg-white/[0.02] cursor-pointer transition-colors group ${
                  isSelected ? 'bg-white/[0.04]' : ''
                } ${!skill.enabled ? 'opacity-60' : ''}`}
              >
                {/* 1. Tool Name & Command Schema with 1-Click Copy */}
                <div className="col-span-4 flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-[#14151B] border border-white/5 flex-shrink-0 mt-0.5">
                    {getCategoryIcon(skill.category)}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate group-hover:text-gray-200">
                        {skill.name}
                      </span>
                      {skill.source === 'mcp_server' && (
                        <span className="text-[10px] text-cyan-400 font-mono">MCP</span>
                      )}
                    </div>

                    {skill.commandExample && (
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-gray-400 group/cmd max-w-sm">
                        <span className="truncate text-gray-400 hover:text-gray-200">{skill.commandExample}</span>
                        <button
                          onClick={(e) => handleCopyCommand(skill.id, skill.commandExample!, e)}
                          className="text-gray-500 hover:text-white transition-colors p-0.5 flex-shrink-0"
                          title="Copy invocation schema"
                        >
                          {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Plain Text Description */}
                <div className="col-span-4 min-w-0 pr-4">
                  <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">
                    {skill.description}
                  </p>
                </div>

                {/* 3. Active in Agents (Avatars & Count) */}
                <div className="col-span-2 flex items-center gap-2 min-w-0">
                  {boundAgents.length > 0 ? (
                    <>
                      <div className="flex -space-x-1.5 overflow-hidden flex-shrink-0">
                        {boundAgents.slice(0, 3).map((agent) => (
                          <img
                            key={agent.id}
                            src={agent.avatar}
                            alt={agent.name}
                            title={agent.name}
                            className="inline-block h-5 w-5 rounded-full ring-1 ring-[#0E0E12] object-cover"
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-gray-400 font-mono truncate">
                        {boundAgents.length} {boundAgents.length === 1 ? 'agent' : 'agents'}
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] text-gray-600 font-mono">—</span>
                  )}
                </div>

                {/* 4. Status Dot & Toggle Switch */}
                <div className="col-span-2 flex items-center justify-end gap-3 text-right">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono">
                    <span className={`w-1.5 h-1.5 rounded-full ${skill.enabled ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                    <span className={skill.enabled ? 'text-gray-300' : 'text-gray-500'}>
                      {skill.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSkill(skill.id);
                    }}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                  >
                    {skill.enabled ? (
                      <ToggleRight className="w-6 h-6 text-brand-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-gray-600" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= CENTERED SKILL INSPECTOR POPUP MODAL ================= */}
      {selectedSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Overlay */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-fade-in"
            onClick={() => setSelectedSkillId(null)}
          />

          {/* Centered Modal Container */}
          <div className="relative w-full max-w-2xl bg-[#121318] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-10 animate-scale-in flex flex-col max-h-[85vh] font-sans">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-white/5 flex items-start justify-between bg-[#15161D]">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="p-2.5 rounded-xl bg-[#0A0B0E] border border-white/10 flex-shrink-0">
                  {getCategoryIcon(selectedSkill.category)}
                </div>

                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-white truncate">{selectedSkill.name}</h2>
                    <span className="text-xs text-gray-400 font-mono">• {selectedSkill.category}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedSkill.enabled ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                    <span className={selectedSkill.enabled ? 'text-gray-300' : 'text-gray-500'}>
                      {selectedSkill.enabled ? 'Active for Agents' : 'Disabled'}
                    </span>
                    <span className="text-gray-600">•</span>
                    <span className="text-gray-400 capitalize">{selectedSkill.source.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleSkill(selectedSkill.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedSkill.enabled
                      ? 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/20'
                      : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20'
                  }`}
                >
                  {selectedSkill.enabled ? 'Disable Tool' : 'Enable Tool'}
                </button>
                <button
                  onClick={() => setSelectedSkillId(null)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-gray-300">
              
              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400">Tool Purpose & Capability</label>
                <p className="text-white leading-relaxed bg-[#0A0B0E] p-3 rounded-xl border border-white/5">
                  {selectedSkill.description}
                </p>
              </div>

              {/* Schema Invocation Example */}
              {selectedSkill.commandExample && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-gray-400">Invocation Command Schema</label>
                    <button
                      onClick={() => handleCopyCommand(selectedSkill.id, selectedSkill.commandExample!)}
                      className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white font-mono"
                    >
                      {copiedSkillId === selectedSkill.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSkillId === selectedSkill.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-cyan-300 bg-[#0A0B0E] p-3 rounded-xl border border-white/5 overflow-x-auto leading-relaxed">
                    {selectedSkill.commandExample}
                  </div>
                </div>
              )}

              {/* Bound Agents List */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-gray-400">
                  Active in Agents ({agents.filter(a => (a.skills || []).includes(selectedSkill.id)).length})
                </label>
                <div className="flex flex-wrap gap-2">
                  {agents.filter(a => (a.skills || []).includes(selectedSkill.id)).length === 0 ? (
                    <p className="text-gray-500 italic">No agents are currently using this skill.</p>
                  ) : (
                    agents.filter(a => (a.skills || []).includes(selectedSkill.id)).map(agent => (
                      <div key={agent.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0A0B0E] border border-white/5 text-xs text-white">
                        <img src={agent.avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                        <span>{agent.name}</span>
                        <span className="text-[10px] text-gray-500 font-mono">• {agent.role}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/5 bg-[#15161D] flex items-center justify-between text-xs font-mono text-gray-500">
              <span>{selectedSkill.category}</span>
              <button
                onClick={() => setSelectedSkillId(null)}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
