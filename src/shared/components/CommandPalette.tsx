import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/app/AppContext';
import { NAV_ITEMS, navIcon } from '@/config/navigation';
import { Search, Bot, FolderKanban, CheckSquare, Cpu, Rocket, ArrowRight, Sparkles } from 'lucide-react';
import { NavigationTab } from '@/shared/types';

export const CommandPalette: React.FC = () => {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    setActiveTab,
    issues,
    agents,
    projects,
    scanLocalRuntimes,
    triggerDeployment,
    visibleTabs,
    can
  } = useApp();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [commandPaletteOpen]);

  // The palette is a navigation surface like any other: derive it from the
  // canonical table so client-only destinations such as Overview and New
  // Request cannot disappear from search when a new tab is added.
  const allNavigationItems: { id: string; title: string; subtitle: string; icon: React.ReactNode; tab: NavigationTab }[] =
    NAV_ITEMS.map(item => ({
      id: `nav-${item.id}`,
      title: item.title,
      subtitle: item.subtitle,
      icon: navIcon(item.id, 'w-4 h-4 text-content-secondary'),
      tab: item.id
    }));

  const navigationItems = allNavigationItems.filter(item => visibleTabs.includes(item.tab));

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
    if (visibleTabs.includes('issues')) issues.forEach(iss => {
      if (iss.identifier.toLowerCase().includes(q) || iss.title.toLowerCase().includes(q)) {
        results.push({
          id: `iss-${iss.id}`,
          title: `${iss.identifier}: ${iss.title}`,
          subtitle: `Status: ${iss.status.toUpperCase()} • Priority: ${iss.priority.toUpperCase()}`,
          icon: <CheckSquare className="w-4 h-4 text-status-info" />,
          type: 'Task',
          action: () => {
            setActiveTab('issues');
            setCommandPaletteOpen(false);
          }
        });
      }
    });

    // Search agents
    if (visibleTabs.includes('agents')) agents.forEach(agent => {
      if (agent.name.toLowerCase().includes(q) || agent.role.toLowerCase().includes(q) || agent.modelName.toLowerCase().includes(q)) {
        results.push({
          id: `agent-${agent.id}`,
          title: `${agent.name} (${agent.role})`,
          subtitle: `Model: ${agent.modelName} • ${agent.autonomyLevel}`,
          icon: <Bot className="w-4 h-4 text-status-info" />,
          type: 'Agent',
          action: () => {
            setActiveTab('agents');
            setCommandPaletteOpen(false);
          }
        });
      }
    });

    // Search projects
    if (visibleTabs.includes('projects')) projects.forEach(proj => {
      if (proj.name.toLowerCase().includes(q) || proj.key.toLowerCase().includes(q)) {
        results.push({
          id: `proj-${proj.id}`,
          title: `Project: ${proj.name} [${proj.key}]`,
          subtitle: `Progress: ${proj.progressPercentage}% • Target: ${proj.targetDate}`,
          icon: <FolderKanban className="w-4 h-4 text-status-info" />,
          type: 'Project',
          action: () => {
            setActiveTab('projects');
            setCommandPaletteOpen(false);
          }
        });
      }
    });

    // Quick Actions — gated on capability, not just tab visibility
    if (can('run_agents') && 'scan local runtimes ollama lmstudio'.includes(q)) {
      results.push({
        id: 'action-scan-runtimes',
        title: 'Action: Scan Local AI Runtimes (Ollama/LM Studio)',
        subtitle: 'Auto-detect local models and check ports 11434 / 1234',
        icon: <Cpu className="w-4 h-4 text-status-success" />,
        type: 'Quick Action',
        action: () => {
          setActiveTab('runtimes');
          setCommandPaletteOpen(false);
          scanLocalRuntimes();
        }
      });
    }

    if (can('approve_production') && 'deploy staging pipeline release build'.includes(q)) {
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
  }, [query, navigationItems, visibleTabs, issues, agents, projects, setActiveTab, setCommandPaletteOpen, scanLocalRuntimes, triggerDeployment, can]);

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

      <div className="relative w-full max-w-xl bg-surface-raised border border-divider rounded-xl shadow-2xl overflow-hidden z-10 animate-slide-up flex flex-col">
        {/* Search input */}
        <div className="flex items-center px-4 py-3.5 border-b border-divider bg-surface">
          <Search className="w-5 h-5 text-content-secondary mr-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, search tasks, agents, or projects..."
            className="w-full bg-transparent text-content placeholder-content-muted text-sm focus:outline-none font-medium"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-mono text-content-secondary bg-surface-raised border border-divider rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-content-muted">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30 text-status-info" />
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
                    isSelected ? 'bg-selected text-selected-content border border-divider' : 'text-content-secondary hover:bg-surface-high border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`p-1.5 rounded-md ${isSelected ? 'bg-selected' : 'bg-surface-raised'}`}>
                      {item.icon}
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-medium text-content truncate">{item.title}</div>
                      <div className="text-xs text-content-secondary truncate">{item.subtitle}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-3">
                    <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-surface-raised text-content-secondary border border-divider">
                      {item.type}
                    </span>
                    {isSelected && <ArrowRight className="w-4 h-4 text-link animate-pulse" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2 bg-shell/80 border-t border-divider text-[11px] text-content-secondary">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono bg-surface-raised px-1 py-0.5 rounded">↑↓</kbd> Navigate</span>
            <span><kbd className="font-mono bg-surface-raised px-1 py-0.5 rounded">↵</kbd> Select</span>
          </div>
          <span>Alpha Orchestration Engine</span>
        </div>
      </div>
    </div>
  );
};
