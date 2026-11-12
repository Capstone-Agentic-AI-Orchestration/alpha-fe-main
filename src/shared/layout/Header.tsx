import React from 'react';
import { useApp } from '@/app/AppContext';
import {
  Search,
  Bot,
  Cpu,
  Plus,
  Bell,
  ChevronRight
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';

interface HeaderProps {
  onOpenNewIssue: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenNewIssue }) => {
  const {
    activeTab,
    setCommandPaletteOpen,
    unreadInboxCount,
    notificationPanelOpen,
    setActiveTab,
    setNotificationPanelOpen,
    agents,
    runtimes,
    settings,
    activeWorkspace,
    serverStatus
  } = useApp();

  const activeAgentsRunning = agents.filter(a => a.status === 'executing' || a.status === 'thinking').length;
  const localRuntimesOnline = runtimes.filter(r => r.type === 'local' && r.status === 'online').length;

  const getTabTitle = () => {
    switch (activeTab) {
      case 'chat': return 'Multi-Agent Chat Canvas';
      case 'issues': return 'Tasks & Workstreams';
      case 'projects': return 'Strategic Projects';
      case 'agents': return 'Agent Studio';
      case 'analytics': return 'Operational Analytics';
      case 'runtimes': return 'Inference Runtimes';
      case 'skills': return 'MCP & Tool Registry';
      case 'deployments': return 'CI/CD Deployments';
      case 'settings': return 'Settings';
      default: return 'Alpha';
    }
  };

  return (
    <header className="h-14 bg-surface/90 backdrop-blur-md border-b border-divider px-4 sm:px-6 flex items-center justify-between z-10">
      {/* Daemon reachability. Agents cannot run while this is offline, so it is
          stated plainly rather than left for a failed run to reveal. */}
      {serverStatus !== 'online' && (
        <div
          className="flex items-center gap-1.5 text-[11px] font-medium mr-3"
          title={
            serverStatus === 'offline'
              ? 'Showing cached data. Start the Alpha daemon to run agents.'
              : 'Connecting to the Alpha daemon…'
          }
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              serverStatus === 'offline' ? 'bg-rose-400' : 'bg-amber-400 animate-pulse'
            }`}
          />
          <span className={serverStatus === 'offline' ? 'text-content-secondary' : 'text-status-warning'}>
            {serverStatus === 'offline' ? 'Daemon offline' : 'Connecting'}
          </span>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-content-secondary font-medium hover:text-content cursor-pointer" onClick={() => setActiveTab('issues')}>
          {activeWorkspace?.name || settings.workspaceName || 'Workspace'}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-content-muted" />
        <span className="capitalize text-content font-semibold flex items-center gap-1.5">
          <span>{getTabTitle()}</span>
          {activeTab === 'deployments' && (
            <span className="text-[9px] font-mono uppercase bg-pink-500/20 text-pink-300 px-1.5 py-0.2 rounded border border-pink-500/30">
              Custom Engine
            </span>
          )}
        </span>
      </div>

      {/* Center Search / Command Trigger */}
      <div className="flex-1 max-w-md mx-6 hidden sm:block">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-lg bg-surface-raised/90 border border-divider hover:border-divider text-xs text-content-secondary hover:text-content transition-all shadow-inner"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-content-secondary" />
            <span>Search or jump to...</span>
          </div>
          <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-content-secondary bg-surface-raised border border-divider rounded">
            <span>⌘</span><span>K</span>
          </kbd>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Mobile Search Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="Search or jump to"
              className="sm:hidden p-2 rounded-lg text-content-secondary hover:text-content hover:bg-surface-high"
            >
              <Search className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Search or jump to</TooltipContent>
        </Tooltip>

        {/* Local AI Runtime Badge */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setActiveTab('runtimes')}
              aria-label={`${localRuntimesOnline} local runtimes online`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-status-success-subtle border border-status-success-border text-status-success text-xs font-medium hover:bg-status-success-subtle transition-colors"
            >
              <Cpu className="w-3.5 h-3.5 text-status-success" />
              <span className="hidden lg:inline">{localRuntimesOnline} Local AI Ready</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>Open runtime connections and authentication status</TooltipContent>
        </Tooltip>

        {/* Active Agents Running Indicator */}
        {activeAgentsRunning > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setActiveTab('agents')}
                aria-label={`${activeAgentsRunning} agents currently running tasks`}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-status-info-subtle border border-status-info-border text-status-info text-xs font-semibold"
              >
                <Bot className="w-3.5 h-3.5 text-status-info" />
                <span className="hidden sm:inline">{activeAgentsRunning} Running</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Open agents currently running tasks</TooltipContent>
          </Tooltip>
        )}

        {/* New Issue Button */}
        <button
          onClick={onOpenNewIssue}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-action hover:bg-action-hover text-on-action font-medium text-xs shadow-glow-brand transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Task</span>
        </button>

        {/* Notification Bell */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setNotificationPanelOpen(open => !open)}
              className="relative p-2 rounded-lg text-content-secondary hover:text-content hover:bg-surface-high transition-colors"
              aria-label={unreadInboxCount > 0 ? `Notifications, ${unreadInboxCount} unread` : 'Notifications'}
              aria-expanded={notificationPanelOpen}
              aria-haspopup="dialog"
            >
              <Bell className="w-4 h-4" />
              {unreadInboxCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-divider" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>Notifications and updates</TooltipContent>
        </Tooltip>
      </div>

    </header>
  );
};
