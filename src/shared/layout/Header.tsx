import React, { useState } from 'react';
import { useApp } from '@/app/AppContext';
import { 
  Search, 
  Bot, 
  Cpu, 
  Plus, 
  Bell,
  ChevronRight,
  Download
} from 'lucide-react';
import { DownloadDesktopModal } from '@/shared/components/DownloadDesktopModal';

interface HeaderProps {
  onOpenNewIssue: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenNewIssue }) => {
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const { 
    activeTab, 
    setCommandPaletteOpen, 
    unreadInboxCount, 
    setActiveTab, 
    agents,
    runtimes,
    settings,
    serverStatus
  } = useApp();

  const activeAgentsRunning = agents.filter(a => a.status === 'executing' || a.status === 'thinking').length;
  const localRuntimesOnline = runtimes.filter(r => r.type === 'local' && r.status === 'online').length;

  const getTabTitle = () => {
    switch (activeTab) {
      case 'inbox': return 'Inbox & Triage';
      case 'chat': return 'Multi-Agent Chat Canvas';
      case 'issues': return 'Issues & Workstreams';
      case 'projects': return 'Strategic Projects';
      case 'agents': return 'Agent Studio';
      case 'squads': return 'Squads & Swarms';
      case 'analytics': return 'Token & Cost Telemetry';
      case 'runtimes': return 'Inference Runtimes';
      case 'skills': return 'MCP & Tool Registry';
      case 'deployments': return 'CI/CD Deployments';
      case 'settings': return 'Settings';
      default: return 'Alpha';
    }
  };

  return (
    <header className="h-14 bg-surface-200/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 flex items-center justify-between z-10">
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
          <span className={serverStatus === 'offline' ? 'text-gray-400' : 'text-amber-300'}>
            {serverStatus === 'offline' ? 'Daemon offline' : 'Connecting'}
          </span>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-400 font-medium hover:text-white cursor-pointer" onClick={() => setActiveTab('issues')}>
          {settings.workspaceName}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
        <span className="capitalize text-white font-semibold flex items-center gap-1.5">
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
          className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-lg bg-surface-100/90 border border-white/10 hover:border-white/20 text-xs text-gray-400 hover:text-gray-200 transition-all shadow-inner"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-gray-400" />
            <span>Search or jump to...</span>
          </div>
          <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-white/5 border border-white/10 rounded">
            <span>⌘</span><span>K</span>
          </kbd>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Mobile Search Button */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="sm:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Local AI Runtime Badge */}
        <button
          onClick={() => setActiveTab('runtimes')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-medium hover:bg-teal-500/20 transition-colors"
          title="Local Runtimes Online"
        >
          <Cpu className="w-3.5 h-3.5 text-teal-400" />
          <span className="hidden lg:inline">{localRuntimesOnline} Local AI Ready</span>
        </button>

        {/* Active Agents Running Indicator */}
        {activeAgentsRunning > 0 && (
          <div 
            onClick={() => setActiveTab('agents')}
            className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-semibold animate-pulse shadow-glow-cyan"
            title="Agents Currently Running Tasks"
          >
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">{activeAgentsRunning} Running</span>
          </div>
        )}

        {/* Inbox Notifications Bell */}
        <button
          onClick={() => setActiveTab('inbox')}
          className="relative p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
          title="Inbox"
        >
          <Bell className="w-4 h-4" />
          {unreadInboxCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-surface-200 animate-pulse" />
          )}
        </button>

        {/* Download Desktop App (.exe) Button */}
        <button
          onClick={() => setDownloadModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 hover:text-white hover:bg-indigo-500/25 text-xs font-semibold transition-all shadow-sm"
          title="Download Desktop App Mode (.exe)"
        >
          <Download className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden md:inline">Desktop App (.exe)</span>
        </button>

        {/* New Issue Button */}
        <button
          onClick={onOpenNewIssue}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-on-accent font-medium text-xs shadow-glow-brand transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Issue</span>
        </button>
      </div>

      {/* Desktop App Download Modal */}
      <DownloadDesktopModal
        isOpen={downloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
      />
    </header>
  );
};
