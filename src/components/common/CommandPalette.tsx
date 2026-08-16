import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Search, 
  Bot, 
  Users, 
  FolderKanban, 
  CheckSquare, 
  Cpu, 
  Terminal, 
  Rocket, 
  Settings, 
  Inbox, 
  MessageSquare, 
  BarChart3, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { NavigationTab } from '../../types';

export const CommandPalette: React.FC = () => {
  const { 
    commandPaletteOpen, 
    setCommandPaletteOpen, 
    setActiveTab, 
    issues, 
    agents, 
    squads, 
    projects, 
    scanLocalRuntimes,
    triggerDeployment
  } = useApp();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [commandPaletteOpen]);

  const navigationItems: { id: string; title: string; subtitle: string; icon: React.ReactNode; tab: NavigationTab }[] = [
    { id: 'nav-inbox', title: 'Inbox & Approvals', subtitle: 'View issue updates & agent approvals', icon: <Inbox className="w-4 h-4 text-amber-400" />, tab: 'inbox' },
    { id: 'nav-chat', title: 'Agent Chat Canvas', subtitle: 'Chat with autonomous agents & squads', icon: <MessageSquare className="w-4 h-4 text-cyan-400" />, tab: 'chat' },
    { id: 'nav-issues', title: 'Issues & Tasks', subtitle: 'Kanban board & issue tracking', icon: <CheckSquare className="w-4 h-4 text-indigo-400" />, tab: 'issues' },
    { id: 'nav-projects', title: 'Projects & Milestones', subtitle: 'Project roadmap & deliverable progress', icon: <FolderKanban className="w-4 h-4 text-blue-400" />, tab: 'projects' },
    { id: 'nav-agents', title: 'Agent Studio', subtitle: 'Manage personas, models, and autonomy', icon: <Bot className="w-4 h-4 text-purple-400" />, tab: 'agents' },
    { id: 'nav-squads', title: 'Agent Squads & Swarms', subtitle: 'Configure multi-agent topologies', icon: <Users className="w-4 h-4 text-emerald-400" />, tab: 'squads' },
    { id: 'nav-analytics', title: 'Token & Cost Analytics', subtitle: 'Token consumption & model latency', icon: <BarChart3 className="w-4 h-4 text-rose-400" />, tab: 'analytics' },
    { id: 'nav-runtimes', title: 'AI Runtimes & Endpoints', subtitle: 'Local Ollama/LM Studio & cloud APIs', icon: <Cpu className="w-4 h-4 text-teal-400" />, tab: 'runtimes' },
    { id: 'nav-skills', title: 'System Skills & MCP', subtitle: 'Tool registry, bash, browser, & MCP', icon: <Terminal className="w-4 h-4 text-orange-400" />, tab: 'skills' },
    { id: 'nav-deployments', title: 'Deployments & CI/CD', subtitle: 'Release pipelines & preview builds', icon: <Rocket className="w-4 h-4 text-pink-400" />, tab: 'deployments' },
    { id: 'nav-settings', title: 'Settings', subtitle: 'Workspace preferences & API keys', icon: <Settings className="w-4 h-4 text-gray-400" />, tab: 'settings' },
  ];

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      return navigationItems.map(item => ({
        ...item,
        type: 'Navigation' as const,
        action: () => {
          setActiveTab(item.tab);
          setCommandPaletteOpen(false);
        }
      }));
    }

    const results: { id: string; title: string; subtitle: string; icon: React.ReactNode; type: string; action: () => void }[] = [];

    // Search navigation
    navigationItems.forEach(item => {
      if (item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q)) {
        results.push({
          ...item,
          type: 'Navigation',
          action: () => {
            setActiveTab(item.tab);
            setCommandPaletteOpen(false);
          }
        });
      }
    });

    // Search issues
    issues.forEach(iss => {
      if (iss.identifier.toLowerCase().includes(q) || iss.title.toLowerCase().includes(q)) {
        results.push({
          id: `iss-${iss.id}`,
          title: `${iss.identifier}: ${iss.title}`,
          subtitle: `Status: ${iss.status.toUpperCase()} • Priority: ${iss.priority.toUpperCase()}`,
          icon: <CheckSquare className="w-4 h-4 text-indigo-400" />,
          type: 'Issue',
          action: () => {
            setActiveTab('issues');
            setCommandPaletteOpen(false);
          }
        });
      }
    });

    // Search agents
    agents.forEach(agent => {
      if (agent.name.toLowerCase().includes(q) || agent.role.toLowerCase().includes(q) || agent.modelName.toLowerCase().includes(q)) {
        results.push({
          id: `agent-${agent.id}`,
          title: `${agent.name} (${agent.role})`,
          subtitle: `Model: ${agent.modelName} • ${agent.autonomyLevel}`,
          icon: <Bot className="w-4 h-4 text-cyan-400" />,
          type: 'Agent',
          action: () => {
            setActiveTab('agents');
            setCommandPaletteOpen(false);
          }
        });
      }
    });

    // Search squads
    squads.forEach(sq => {
      if (sq.name.toLowerCase().includes(q) || sq.mission.toLowerCase().includes(q)) {
        results.push({
          id: `sq-${sq.id}`,
          title: `Squad: ${sq.name}`,
          subtitle: `Topology: ${sq.topology.toUpperCase()} • ${sq.memberAgentIds.length} members`,
          icon: <Users className="w-4 h-4 text-emerald-400" />,
          type: 'Squad',
          action: () => {
            setActiveTab('squads');
            setCommandPaletteOpen(false);
          }
        });
      }
    });

    // Search projects
    projects.forEach(proj => {
      if (proj.name.toLowerCase().includes(q) || proj.key.toLowerCase().includes(q)) {
        results.push({
          id: `proj-${proj.id}`,
          title: `Project: ${proj.name} [${proj.key}]`,
          subtitle: `Progress: ${proj.progressPercentage}% • Target: ${proj.targetDate}`,
          icon: <FolderKanban className="w-4 h-4 text-blue-400" />,
          type: 'Project',
          action: () => {
            setActiveTab('projects');
            setCommandPaletteOpen(false);
          }
        });
      }
    });

    // Quick Actions
    if ('scan local runtimes ollama lmstudio'.includes(q)) {
      results.push({
        id: 'action-scan-runtimes',
        title: 'Action: Scan Local AI Runtimes (Ollama/LM Studio)',
        subtitle: 'Auto-detect local models and check ports 11434 / 1234',
        icon: <Cpu className="w-4 h-4 text-teal-400" />,
        type: 'Quick Action',
        action: () => {
          setActiveTab('runtimes');
          setCommandPaletteOpen(false);
          scanLocalRuntimes();
        }
      });
    }

    if ('deploy staging pipeline release build'.includes(q)) {
      results.push({
        id: 'action-deploy-staging',
        title: 'Action: Trigger Staging CI/CD Deployment',
        subtitle: 'Start automated test, lint, and canary rollout',
        icon: <Rocket className="w-4 h-4 text-pink-400" />,
        type: 'Quick Action',
        action: () => {
          setActiveTab('deployments');
          setCommandPaletteOpen(false);
          if (projects[0]) triggerDeployment(projects[0].id, 'Staging');
        }
      });
    }

    return results;
  }, [query, navigationItems, issues, agents, squads, projects, setActiveTab, setCommandPaletteOpen, scanLocalRuntimes, triggerDeployment]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!commandPaletteOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (filteredItems.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, filteredItems, selectedIndex, setCommandPaletteOpen]);

  if (!commandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-fade-in"
        onClick={() => setCommandPaletteOpen(false)}
      />

      <div className="relative w-full max-w-xl bg-surface-100 border border-white/15 rounded-xl shadow-2xl overflow-hidden z-10 animate-slide-up flex flex-col">
        {/* Search input */}
        <div className="flex items-center px-4 py-3.5 border-b border-white/10 bg-surface-200">
          <Search className="w-5 h-5 text-gray-400 mr-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, search issues, agents, or squads..."
            className="w-full bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none font-medium"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-mono text-gray-400 bg-white/5 border border-white/10 rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30 text-indigo-400" />
              <p className="text-sm">No matching items or commands found.</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all ${
                    isSelected ? 'bg-brand-500/20 text-white border border-brand-500/40' : 'text-gray-300 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`p-1.5 rounded-md ${isSelected ? 'bg-brand-500/30' : 'bg-white/5'}`}>
                      {item.icon}
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-medium text-white truncate">{item.title}</div>
                      <div className="text-xs text-gray-400 truncate">{item.subtitle}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-3">
                    <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/5">
                      {item.type}
                    </span>
                    {isSelected && <ArrowRight className="w-4 h-4 text-brand-400 animate-pulse" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2 bg-surface-300/80 border-t border-white/5 text-[11px] text-gray-400">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono bg-white/5 px-1 py-0.5 rounded">↑↓</kbd> Navigate</span>
            <span><kbd className="font-mono bg-white/5 px-1 py-0.5 rounded">↵</kbd> Select</span>
          </div>
          <span>Alpha Orchestration Engine</span>
        </div>
      </div>
    </div>
  );
};
