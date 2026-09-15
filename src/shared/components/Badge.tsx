import React from 'react';
import type {
  AgentRole,
  DeploymentStatus,
  IssuePriority,
  IssueStatus,
  RuntimeStatus,
} from '@/shared/types';
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bot,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  Minus,
  PlayCircle,
} from 'lucide-react';

interface LabelProps {
  icon: React.ReactNode;
  label: string;
  className?: string;
}

const Label: React.FC<LabelProps> = ({ icon, label, className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${className}`}>
    {icon}
    <span>{label}</span>
  </span>
);

export const StatusBadge: React.FC<{ status: IssueStatus; className?: string }> = ({
  status,
  className = '',
}) => {
  const labels: Record<IssueStatus, LabelProps> = {
    backlog: {
      label: 'Backlog',
      className: 'text-gray-400',
      icon: <Circle className="h-3 w-3" />,
    },
    todo: {
      label: 'Todo',
      className: 'text-slate-300',
      icon: <Clock className="h-3 w-3 text-slate-400" />,
    },
    in_progress: {
      label: 'In progress',
      className: 'text-amber-300',
      icon: <PlayCircle className="h-3 w-3 text-amber-400" />,
    },
    agent_running: {
      label: 'Agent running',
      className: 'text-cyan-300',
      icon: <Bot className="h-3.5 w-3.5 text-cyan-400" />,
    },
    review: {
      label: 'In review',
      className: 'text-violet-300',
      icon: <Activity className="h-3 w-3 text-violet-400" />,
    },
    done: {
      label: 'Done',
      className: 'text-emerald-300',
      icon: <CheckCircle2 className="h-3 w-3 text-emerald-400" />,
    },
  };

  return <Label {...labels[status]} className={`${labels[status].className} ${className}`} />;
};

export const PriorityBadge: React.FC<{
  priority: IssuePriority;
  showLabel?: boolean;
  className?: string;
}> = ({ priority, showLabel = true, className = '' }) => {
  const labels: Record<IssuePriority, LabelProps> = {
    urgent: {
      label: 'Urgent',
      className: 'text-rose-300',
      icon: <Flame className="h-3.5 w-3.5 text-rose-400" />,
    },
    high: {
      label: 'High',
      className: 'text-orange-300',
      icon: <ArrowUp className="h-3.5 w-3.5 text-orange-400" />,
    },
    medium: {
      label: 'Medium',
      className: 'text-amber-300',
      icon: <ArrowRight className="h-3.5 w-3.5 text-amber-400" />,
    },
    low: {
      label: 'Low',
      className: 'text-blue-300',
      icon: <ArrowDown className="h-3.5 w-3.5 text-blue-400" />,
    },
    none: {
      label: 'None',
      className: 'text-gray-500',
      icon: <Minus className="h-3.5 w-3.5" />,
    },
  };
  const item = labels[priority];

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${item.className} ${className}`}
      title={`${item.label} priority`}
    >
      {item.icon}
      {showLabel && <span>{item.label}</span>}
    </span>
  );
};

export const RoleBadge: React.FC<{ role: AgentRole; className?: string }> = ({
  role,
  className = '',
}) => {
  const colors: Record<AgentRole, string> = {
    Architect: 'bg-indigo-400',
    Coder: 'bg-cyan-400',
    Reviewer: 'bg-violet-400',
    'QA Tester': 'bg-emerald-400',
    'DevOps Engineer': 'bg-amber-400',
    Researcher: 'bg-pink-400',
    Triager: 'bg-teal-400',
    'Research Agent': 'bg-cyan-400',
    'Architecture Agent': 'bg-indigo-400',
    'Manager Agent': 'bg-violet-400',
    'Database Agent': 'bg-teal-400',
    'Backend Agent': 'bg-emerald-400',
    'Frontend Agent': 'bg-blue-400',
    'Mobile Agent': 'bg-orange-400',
    'Security / Code Quality Agent': 'bg-amber-400',
    'Validation / Checking Agent': 'bg-pink-400',
    'GitHub Finalization Agent': 'bg-purple-400',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-400 ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${colors[role]}`} aria-hidden="true" />
      {role}
    </span>
  );
};

export const RuntimeStatusBadge: React.FC<{ status: RuntimeStatus; latencyMs?: number }> = ({
  status,
  latencyMs,
}) => {
  const state = {
    online: { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'Online' },
    scanning: { dot: 'bg-cyan-400 animate-pulse', text: 'text-cyan-300', label: 'Scanning…' },
    degraded: { dot: 'bg-amber-400', text: 'text-amber-300', label: 'Degraded' },
    offline: { dot: 'bg-rose-400', text: 'text-gray-400', label: 'Offline' },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${state.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${state.dot}`} aria-hidden="true" />
      <span>{state.label}</span>
      {status === 'online' && latencyMs !== undefined && (
        <span className="font-mono text-[10px] text-gray-500">{latencyMs}ms</span>
      )}
    </span>
  );
};

export const DeploymentStatusBadge: React.FC<{ status: DeploymentStatus }> = ({ status }) => {
  const states: Record<DeploymentStatus, LabelProps> = {
    success: {
      label: 'Deployed',
      className: 'text-emerald-300',
      icon: <CheckCircle2 className="h-3 w-3 text-emerald-400" />,
    },
    building: {
      label: 'Building',
      className: 'text-cyan-300',
      icon: <Bot className="h-3 w-3 text-cyan-400" />,
    },
    agent_evaluating: {
      label: 'Agent QA',
      className: 'text-cyan-300',
      icon: <Bot className="h-3 w-3 text-cyan-400" />,
    },
    failed: {
      label: 'Failed',
      className: 'text-rose-300',
      icon: <AlertCircle className="h-3 w-3 text-rose-400" />,
    },
    queued: {
      label: 'Queued',
      className: 'text-gray-400',
      icon: <Clock className="h-3 w-3" />,
    },
  };

  return <Label {...states[status]} />;
};
