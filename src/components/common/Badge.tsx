import React from 'react';
import { IssueStatus, IssuePriority, AgentRole, RuntimeStatus, DeploymentStatus } from '../../types';
import { 
  Circle, 
  Clock, 
  PlayCircle, 
  CheckCircle2, 
  AlertCircle, 
  Flame, 
  ArrowUp, 
  ArrowRight, 
  ArrowDown, 
  Minus, 
  Bot, 
  Activity 
} from 'lucide-react';

export const StatusBadge: React.FC<{ status: IssueStatus; className?: string }> = ({ status, className = '' }) => {
  switch (status) {
    case 'backlog':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-gray-800/80 text-gray-400 border border-gray-700/50 ${className}`}>
          <Circle className="w-3 h-3 text-gray-400" />
          <span>Backlog</span>
        </span>
      );
    case 'todo':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700/60 ${className}`}>
          <Clock className="w-3 h-3 text-slate-400" />
          <span>Todo</span>
        </span>
      );
    case 'in_progress':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 ${className}`}>
          <PlayCircle className="w-3 h-3 text-amber-400 animate-spin-slow" />
          <span>In Progress</span>
        </span>
      );
    case 'agent_running':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-glow-cyan ${className}`}>
          <Bot className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span className="font-semibold tracking-wide">Agent Running</span>
        </span>
      );
    case 'review':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20 ${className}`}>
          <Activity className="w-3 h-3 text-purple-400" />
          <span>In Review</span>
        </span>
      );
    case 'done':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 ${className}`}>
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>Done</span>
        </span>
      );
    default:
      return null;
  }
};

export const PriorityBadge: React.FC<{ priority: IssuePriority; showLabel?: boolean; className?: string }> = ({ 
  priority, 
  showLabel = true, 
  className = '' 
}) => {
  switch (priority) {
    case 'urgent':
      return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 ${className}`} title="Urgent Priority">
          <Flame className="w-3.5 h-3.5 text-rose-400" />
          {showLabel && <span>Urgent</span>}
        </span>
      );
    case 'high':
      return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-500/15 text-orange-300 border border-orange-500/20 ${className}`} title="High Priority">
          <ArrowUp className="w-3.5 h-3.5 text-orange-400" />
          {showLabel && <span>High</span>}
        </span>
      );
    case 'medium':
      return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 ${className}`} title="Medium Priority">
          <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
          {showLabel && <span>Medium</span>}
        </span>
      );
    case 'low':
      return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20 ${className}`} title="Low Priority">
          <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
          {showLabel && <span>Low</span>}
        </span>
      );
    case 'none':
    default:
      return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700/50 ${className}`} title="No Priority">
          <Minus className="w-3.5 h-3.5 text-gray-500" />
          {showLabel && <span>None</span>}
        </span>
      );
  }
};

export const RoleBadge: React.FC<{ role: AgentRole; className?: string }> = ({ role, className = '' }) => {
  const getColors = () => {
    switch (role) {
      case 'Architect': return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
      case 'Coder': return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
      case 'Reviewer': return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'QA Tester': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'DevOps Engineer': return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'Researcher': return 'bg-pink-500/15 text-pink-300 border-pink-500/30';
      case 'Triager': return 'bg-teal-500/15 text-teal-300 border-teal-500/30';
      default: return 'bg-gray-700 text-gray-300 border-gray-600';
    }
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${getColors()} ${className}`}>
      {role}
    </span>
  );
};

export const RuntimeStatusBadge: React.FC<{ status: RuntimeStatus; latencyMs?: number }> = ({ status, latencyMs }) => {
  if (status === 'online') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>Online</span>
        {latencyMs !== undefined && <span className="text-emerald-400/70 font-mono text-[10px]">({latencyMs}ms)</span>}
      </span>
    );
  }
  if (status === 'scanning') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
        <span>Scanning...</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20">
      <span className="w-2 h-2 rounded-full bg-rose-400" />
      <span>Offline</span>
    </span>
  );
};

export const DeploymentStatusBadge: React.FC<{ status: DeploymentStatus }> = ({ status }) => {
  switch (status) {
    case 'success':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>Deployed</span>
        </span>
      );
    case 'building':
    case 'agent_evaluating':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 animate-pulse">
          <Bot className="w-3 h-3 text-cyan-400" />
          <span>{status === 'building' ? 'Building...' : 'Agent QA...'}</span>
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30">
          <AlertCircle className="w-3 h-3 text-rose-400" />
          <span>Failed</span>
        </span>
      );
    case 'queued':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700">
          <Clock className="w-3 h-3 text-gray-400" />
          <span>Queued</span>
        </span>
      );
  }
};
