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
      className: 'text-content-secondary',
      icon: <Circle className="h-3 w-3" />,
    },
    todo: {
      label: 'Todo',
      className: 'text-content-secondary',
      icon: <Clock className="h-3 w-3 text-content-secondary" />,
    },
    in_progress: {
      label: 'In progress',
      className: 'text-status-warning',
      icon: <PlayCircle className="h-3 w-3 text-status-warning" />,
    },
    agent_running: {
      label: 'Building',
      className: 'text-status-info',
      icon: <Bot className="h-3.5 w-3.5 text-status-info" />,
    },
    review: {
      label: 'In review',
      className: 'text-status-info',
      icon: <Activity className="h-3 w-3 text-status-info" />,
    },
    done: {
      label: 'Done',
      className: 'text-status-success',
      icon: <CheckCircle2 className="h-3 w-3 text-status-success" />,
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
      className: 'text-status-danger',
      icon: <Flame className="h-3.5 w-3.5 text-status-danger" />,
    },
    high: {
      label: 'High',
      className: 'text-status-warning',
      icon: <ArrowUp className="h-3.5 w-3.5 text-status-warning" />,
    },
    medium: {
      label: 'Medium',
      className: 'text-status-warning',
      icon: <ArrowRight className="h-3.5 w-3.5 text-status-warning" />,
    },
    low: {
      label: 'Low',
      className: 'text-status-info',
      icon: <ArrowDown className="h-3.5 w-3.5 text-status-info" />,
    },
    none: {
      label: 'None',
      className: 'text-content-muted',
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
    'Orchestrator Agent': 'bg-purple-400',
    'Database Agent': 'bg-teal-400',
    'Backend Agent': 'bg-emerald-400',
    'Frontend Agent': 'bg-blue-400',
    'Mobile Agent': 'bg-orange-400',
    'Security / Code Quality Agent': 'bg-amber-400',
    'Validation / Checking Agent': 'bg-pink-400',
    'GitHub Finalization Agent': 'bg-purple-400',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-content-secondary ${className}`}>
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
    online: { dot: 'bg-current text-status-success', text: 'text-status-success', label: 'Online' },
    scanning: { dot: 'bg-current text-status-info animate-pulse', text: 'text-status-info', label: 'Scanning…' },
    degraded: { dot: 'bg-current text-status-warning', text: 'text-status-warning', label: 'Degraded' },
    offline: { dot: 'bg-current text-status-danger', text: 'text-content-secondary', label: 'Offline' },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${state.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${state.dot}`} aria-hidden="true" />
      <span>{state.label}</span>
      {status === 'online' && latencyMs !== undefined && (
        <span className="font-mono text-[10px] text-content-muted">{latencyMs}ms</span>
      )}
    </span>
  );
};

export const DeploymentStatusBadge: React.FC<{ status: DeploymentStatus }> = ({ status }) => {
  const states: Record<DeploymentStatus, LabelProps> = {
    success: {
      label: 'Deployed',
      className: 'text-status-success',
      icon: <CheckCircle2 className="h-3 w-3 text-status-success" />,
    },
    building: {
      label: 'Building',
      className: 'text-status-info',
      icon: <Bot className="h-3 w-3 text-status-info" />,
    },
    agent_evaluating: {
      label: 'Agent QA',
      className: 'text-status-info',
      icon: <Bot className="h-3 w-3 text-status-info" />,
    },
    failed: {
      label: 'Failed',
      className: 'text-status-danger',
      icon: <AlertCircle className="h-3 w-3 text-status-danger" />,
    },
    queued: {
      label: 'Queued',
      className: 'text-content-secondary',
      icon: <Clock className="h-3 w-3" />,
    },
  };

  return <Label {...states[status]} />;
};
