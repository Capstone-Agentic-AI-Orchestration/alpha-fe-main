import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Code2,
  ExternalLink,
  FileCode2,
  FileText,
  GitBranch,
  MessageSquare,
  Layers3,
  Play,
  RadioTower,
  RefreshCw,
  ShieldAlert,
  TerminalSquare,
  Users,
  X
} from 'lucide-react';
import { useApp, useTabSessionState } from '@/app/AppContext';
import { apiService } from '@/shared/services/apiService';
import { runnerSocket } from '@/shared/services/runnerSocket';
import type {
  LiveBuildRoomAgentCard,
  LiveBuildRoomCardStatus,
  LiveBuildRoomPhase,
  LiveBuildRoomActivity,
  LiveBuildRoomChatCall,
  LiveBuildRoomSnapshot,
} from '@/shared/types';

type DetailTab = 'activity' | 'handoff' | 'files' | 'tools';
type AgentStatusFilter = 'all' | 'running' | 'waiting' | 'review' | 'failed' | 'completed' | 'idle' | 'stale';

const statusMeta: Record<LiveBuildRoomCardStatus, {
  label: string;
  dot: string;
  text: string;
  border: string;
  icon: React.ReactNode;
}> = {
  completed: {
    label: 'Completed',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
    border: 'border-emerald-400/30',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />
  },
  running: {
    label: 'Running',
    dot: 'bg-violet-400',
    text: 'text-violet-200',
    border: 'border-violet-400/30',
    icon: <RadioTower className="h-3.5 w-3.5" />
  },
  waiting: {
    label: 'Waiting',
    dot: 'bg-sky-400',
    text: 'text-sky-200',
    border: 'border-sky-400/20',
    icon: <Clock3 className="h-3.5 w-3.5" />
  },
  review: {
    label: 'Review',
    dot: 'bg-amber-400',
    text: 'text-amber-200',
    border: 'border-amber-400/30',
    icon: <ShieldAlert className="h-3.5 w-3.5" />
  },
  failed: {
    label: 'Stopped',
    dot: 'bg-rose-400',
    text: 'text-rose-200',
    border: 'border-rose-400/30',
    icon: <AlertTriangle className="h-3.5 w-3.5" />
  },
  idle: {
    label: 'Ready',
    dot: 'bg-slate-500',
    text: 'text-slate-300',
    border: 'border-white/10',
    icon: <Circle className="h-3.5 w-3.5" />
  }
};

function timeAgo(value?: string | null): string {
  if (!value) return '—';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '—';
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 45) return 'Just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

function activityLabel(activity: LiveBuildRoomActivity): string {
  if (activity.kind === 'tool') return activity.toolName ? `Tool call · ${activity.toolName}` : 'Tool call';
  if (activity.kind === 'tool_result') return activity.toolName ? `Tool result · ${activity.toolName}` : 'Tool result';
  if (activity.kind === 'file_change') return activity.toolName ? `File change · ${activity.toolName}` : 'File change';
  if (activity.kind === 'handoff') return 'Handoff';
  if (activity.kind === 'error') return 'Attention';
  if (activity.kind === 'summary') return 'Summary';
  if (activity.kind === 'stage') return 'Stage update';
  return 'Agent update';
}

function activityTone(activity: LiveBuildRoomActivity): string {
  if (activity.kind === 'error') return 'bg-rose-400';
  if (activity.kind === 'tool' || activity.kind === 'tool_result') return 'bg-sky-400';
  if (activity.kind === 'file_change') return 'bg-emerald-400';
  if (activity.kind === 'handoff') return 'bg-amber-300';
  if (activity.kind === 'summary') return 'bg-emerald-400';
  return 'bg-violet-400';
}

function toolDetail(activity: LiveBuildRoomActivity): string | undefined {
  if (!activity.detail) return undefined;
  try {
    const parsed = JSON.parse(activity.detail);
    if (typeof parsed.command === 'string') return parsed.command;
    if (typeof parsed.tool === 'string') return `${parsed.tool}${parsed.input ? ` · ${JSON.stringify(parsed.input)}` : ''}`;
  } catch {
    // Most tools provide a plain-text detail rather than a JSON payload.
  }
  return activity.detail;
}

function phaseClasses(phase: LiveBuildRoomPhase): string {
  if (phase.status === 'completed') return 'border-emerald-400/30 bg-emerald-400/[0.035]';
  if (phase.status === 'running') return 'border-violet-400/50 bg-violet-400/[0.07] shadow-[0_0_28px_rgba(139,92,246,0.12)]';
  if (phase.status === 'review') return 'border-amber-400/30 bg-amber-400/[0.035]';
  if (phase.status === 'failed') return 'border-rose-400/30 bg-rose-400/[0.035]';
  return 'border-white/[0.08] bg-white/[0.015]';
}

function progressLabel(card: LiveBuildRoomAgentCard): string {
  if (card.status === 'completed') return 'Complete';
  if (card.status === 'review') return 'Awaiting review';
  if (card.status === 'failed') return card.progress > 0 ? `${card.progress}% stages complete` : 'Stopped';
  if (card.status === 'running') return card.progress > 0 ? `${card.progress}% stages complete` : 'In progress';
  return card.progress > 0 ? `${card.progress}% stages complete` : 'Not started';
}

const AgentCard: React.FC<{
  card: LiveBuildRoomAgentCard;
  selected: boolean;
  onSelect: () => void;
}> = ({ card, selected, onSelect }) => {
  const meta = statusMeta[card.status];
  const hasMeasuredProgress = card.progress > 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group min-w-0 rounded-2xl border p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-violet-400/60 ${
        selected
          ? 'border-violet-400/70 bg-violet-400/[0.075] shadow-[0_0_34px_rgba(139,92,246,0.14)]'
          : `${meta.border} bg-surface-100/70 hover:border-white/20 hover:bg-white/[0.035]`
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-sm font-semibold text-white"
            style={{ backgroundColor: `${card.color || '#8b5cf6'}22` }}
          >
            {card.avatar ? (
              <img src={card.avatar} alt="" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <Code2 className="h-4 w-4 text-violet-200" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{card.agentName}</div>
            <div className="truncate text-[11px] text-slate-400">{card.agentRole} · {card.sourceLabel}</div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {card.isStale && <span title="No execution activity has been recorded for five minutes" className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/[0.06] px-2 py-1 text-[10px] font-semibold text-amber-200"><Clock3 className="h-3 w-3" />No signal</span>}
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${meta.border} ${meta.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${card.status === 'running' && !card.isStale ? 'animate-pulse' : ''}`} />
            {meta.label}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-slate-400">
        <span className="truncate">Now doing</span>
        <span className="shrink-0 font-medium text-slate-300">{progressLabel(card)}</span>
      </div>
      {hasMeasuredProgress && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${card.status === 'completed' ? 'bg-emerald-400' : card.status === 'failed' ? 'bg-rose-400' : card.status === 'review' ? 'bg-amber-400' : 'bg-violet-400'}`}
          style={{ width: `${Math.max(0, Math.min(100, card.progress))}%` }}
        />
      </div>}
      <div className="mt-2 truncate text-xs font-medium text-slate-200">{card.currentTask}</div>

      <div className="mt-4 space-y-2 border-t border-white/[0.07] pt-3">
        {(card.activity.length ? card.activity.slice(-3) : [{ id: 'empty', sequence: 0, kind: 'status' as const, message: 'Waiting for execution activity', createdAt: '' }]).map(activity => (
          <div key={activity.id} className="flex min-w-0 items-center gap-2 text-[11px] text-slate-400">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${activityTone(activity)}`} />
            <span className="truncate">{activity.message}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-3 text-[10px] text-slate-500">
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          <FileText className="h-3.5 w-3.5 shrink-0" />
          {card.output?.value || card.currentStage || 'No output yet'}
        </span>
        <span className="flex shrink-0 items-center gap-2"><span className="text-slate-500">{card.updatedAt ? timeAgo(card.updatedAt) : ''}</span><ArrowRight className="h-3.5 w-3.5 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300" /></span>
      </div>
    </button>
  );
};

const PhaseTimeline: React.FC<{ phases: LiveBuildRoomPhase[] }> = ({ phases }) => (
  <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
    {phases.map((phase, index) => (
      <div key={phase.id} className={`min-w-0 rounded-xl border px-3 py-2.5 ${phaseClasses(phase)}`}>
          <div className="flex items-center gap-2">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] ${
              phase.status === 'completed'
                ? 'border-emerald-400/50 text-emerald-300'
                : phase.status === 'running'
                  ? 'border-violet-400/60 text-violet-200'
                  : phase.status === 'review'
                    ? 'border-amber-400/50 text-amber-200'
                  : phase.status === 'failed'
                    ? 'border-rose-400/50 text-rose-200'
                    : 'border-white/15 text-slate-500'
            }`}>
              {phase.status === 'completed' ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[11px] font-semibold text-slate-200">{phase.label}</div>
              <div className="text-[10px] text-slate-500">{phase.status === 'completed' ? 'Completed' : phase.status === 'running' ? 'In progress' : phase.status === 'review' ? 'Awaiting approval' : phase.status === 'failed' ? 'Needs attention' : 'Pending'}</div>
            </div>
          </div>
          {phase.progress > 0 && <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${phase.status === 'completed' ? 'bg-emerald-400' : phase.status === 'review' ? 'bg-amber-400' : phase.status === 'failed' ? 'bg-rose-400' : 'bg-violet-400'}`} style={{ width: `${Math.max(0, Math.min(100, phase.progress))}%` }} /></div>}
      </div>
    ))}
  </div>
);

const ActivityPanel: React.FC<{
  snapshot: LiveBuildRoomSnapshot;
  card: LiveBuildRoomAgentCard;
  tab: DetailTab;
  setTab: (tab: DetailTab) => void;
  onClose: () => void;
}> = ({ snapshot, card, tab, setTab, onClose }) => {
  const meta = statusMeta[card.status];
  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: 'activity', label: 'Activity' },
    { id: 'handoff', label: 'Handoff' },
    { id: 'files', label: 'Files' },
    { id: 'tools', label: 'Tools' }
  ];
  const activities = card.activity;
  const handoffs = snapshot.handoffs.filter(handoff =>
    card.squadRunId
      ? handoff.squadRunId === card.squadRunId && (handoff.fromAgentId === card.agentId || handoff.toAgentId === card.agentId)
      : card.agentCallId
        ? handoff.agentCallId === card.agentCallId
        : handoff.executionId === card.executionId
  );
  const filePaths = [...new Set([...(card.filePaths ?? []), ...activities.flatMap(activity => activity.paths ?? [])])];
  const toolActivities = activities.filter(activity => activity.kind === 'tool' || activity.kind === 'tool_result' || Boolean(activity.toolName));

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.10] bg-surface-100/90 shadow-2xl shadow-black/20 xl:sticky xl:top-0 xl:h-[calc(100vh-8.5rem)]">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200"><Layers3 className="h-4 w-4" /></div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-300">Agent Activity</div>
            <div className="mt-0.5 truncate text-base font-semibold text-white">{card.agentName}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {card.isStale && <span title="No execution activity has been recorded for five minutes" className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 px-2 py-1 text-[10px] font-semibold text-amber-200"><Clock3 className="h-3 w-3" />No signal</span>}
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${meta.border} ${meta.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${card.status === 'running' ? 'animate-pulse' : ''}`} />
            {meta.label}
          </span>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-white" aria-label="Close agent activity"><X className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-white/[0.08] px-3 pt-2">
        {tabs.map(item => (
          <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`border-b-2 px-2 py-2 text-[11px] font-medium transition-colors ${tab === item.id ? 'border-violet-400 text-white' : 'border-transparent text-slate-500 hover:text-slate-200'}`}>{item.label}</button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'activity' && (
          <div className="space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Now doing</div>
              <div className="mt-1 text-sm font-medium text-white">{card.currentTask}</div>
            </div>
            {card.progress > 0 ? <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-violet-400" style={{ width: `${card.progress}%` }} /></div> : card.status === 'running' ? <div className="text-[11px] text-slate-500">Progress will appear after Alpha confirms a completed stage.</div> : null}
            <div className="space-y-3 border-t border-white/[0.08] pt-4">
              {activities.length ? activities.slice().reverse().map(activity => (
                <div key={activity.id} className="flex gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${activityTone(activity)}`} />
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-500">{activityLabel(activity)} · {timeAgo(activity.createdAt)}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-300">{activity.message}</div>
                    {activity.detail && <div className="mt-1 text-[11px] leading-4 text-slate-500">{activity.detail}</div>}
                  </div>
                </div>
              )) : <div className="rounded-xl border border-dashed border-white/10 p-4 text-xs leading-5 text-slate-500">Activity will appear here once this agent begins working.</div>}
            </div>
          </div>
        )}

        {tab === 'handoff' && (
          <div className="space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Handoff history</div>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">See what moved between agents and when this execution received it.</p>
            </div>
            {card.squadRunId === snapshot.activeRun?.id && snapshot.handoff.next && <div className="rounded-xl border border-violet-400/25 bg-violet-400/[0.06] p-3 text-xs text-slate-300"><span className="font-medium text-white">Next in sequence:</span> {snapshot.handoff.next}</div>}
            {handoffs.length ? <div className="space-y-3">
              {handoffs.map(handoff => (
                <div key={handoff.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2 text-xs"><span className="truncate font-medium text-slate-200">{handoff.from}</span><ArrowRight className="h-3.5 w-3.5 shrink-0 text-violet-300" /><span className="truncate font-semibold text-white">{handoff.to}</span></div>
                    <time className="shrink-0 text-[10px] text-slate-500">{timeAgo(handoff.createdAt)}</time>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-slate-400">{handoff.summary}</p>
                  {handoff.branchName && <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500"><GitBranch className="h-3 w-3" />{handoff.branchName}</div>}
                </div>
              ))}
            </div> : <div className="rounded-xl border border-dashed border-white/10 p-4 text-xs leading-5 text-slate-500">No handoff has reached this execution yet. Transfers will appear here as the project moves between agents.</div>}
          </div>
        )}

        {tab === 'files' && (
          <div className="space-y-3">
            <div><div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Files and outputs</div><p className="mt-1 text-[11px] leading-5 text-slate-400">Paths come from recorded project activity.</p></div>
            {filePaths.length ? <div className="space-y-2">{filePaths.map(file => <div key={file} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 text-xs text-slate-200"><FileCode2 className="h-4 w-4 shrink-0 text-violet-300" /><code className="min-w-0 break-all">{file}</code></div>)}</div> : <div className="rounded-xl border border-dashed border-white/10 p-4 text-xs leading-5 text-slate-500">No changed file paths have been recorded for this execution yet.</div>}
            {card.output ? <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"><div className="flex items-center gap-2 text-xs font-medium text-white"><FileCode2 className="h-4 w-4 text-violet-300" />{card.output.label}</div><div className="mt-2 break-all text-[11px] text-slate-500">{card.output.value}</div></div> : <div className="rounded-xl border border-dashed border-white/10 p-4 text-xs leading-5 text-slate-500">No output has been recorded for this agent yet.</div>}
            {card.branchName && <div className="flex items-center gap-2 text-xs text-slate-400"><GitBranch className="h-3.5 w-3.5" /><span className="truncate">{card.branchName}</span></div>}
            {card.runId && snapshot.artifacts.filter(artifact => artifact.runId === card.runId).map(artifact => <div key={artifact.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"><div className="text-xs font-medium text-white">{artifact.name}</div><div className="mt-1 break-all text-[11px] text-slate-500">{artifact.detail}</div></div>)}
          </div>
        )}

        {tab === 'tools' && (
          <div className="space-y-3">
            <div><div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Commands and tools</div><p className="mt-1 text-[11px] leading-5 text-slate-400">Recorded tool calls and results for this execution.</p></div>
            {toolActivities.length ? toolActivities.slice().reverse().map(activity => (
              <div key={activity.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-slate-200">{activityLabel(activity)}</span><time className="text-[10px] text-slate-500">{timeAgo(activity.createdAt)}</time></div>
                <div className="mt-2 text-xs leading-5 text-white">{activity.message}</div>
                {toolDetail(activity) && <pre className="mt-2 overflow-x-auto rounded-lg bg-black/25 p-2.5 text-[10px] leading-4 text-slate-300">{toolDetail(activity)}</pre>}
                {activity.paths?.length ? <div className="mt-2 flex flex-wrap gap-1.5">{activity.paths.map(file => <code key={file} className="rounded bg-white/[0.05] px-1.5 py-1 text-[10px] text-slate-300">{file}</code>)}</div> : null}
              </div>
            )) : <div className="rounded-xl border border-dashed border-white/10 p-4 text-xs leading-5 text-slate-500">Tool calls and commands will appear here as the agent uses them.</div>}
          </div>
        )}
      </div>
    </aside>
  );
};

export const LiveBuildRoomView: React.FC = () => {
  const {
    projects,
    issues,
    role,
    can,
    isActiveTab,
    showToast,
    triggerSquadRun,
    setActiveTab,
    setActiveThreadId
  } = useApp();
  const [selectedProjectId, setSelectedProjectId] = useTabSessionState<string>('liveBuildProjectId', '');
  const [snapshot, setSnapshot] = useState<LiveBuildRoomSnapshot | null>(null);
  const [selectedExecutionId, setSelectedExecutionId] = useTabSessionState<string | null>('liveBuildExecutionId', null);
  const [agentSearch, setAgentSearch] = useTabSessionState<string>('liveBuildAgentSearch', '');
  const [agentStatusFilter, setAgentStatusFilter] = useTabSessionState<AgentStatusFilter>('liveBuildAgentStatusFilter', 'all');
  const [selectedChatCallId, setSelectedChatCallId] = useTabSessionState<string | null>('liveBuildChatCallId', null);
  const [chatFilter, setChatFilter] = useTabSessionState<string>('liveBuildChatFilter', 'all');
  const [chatAgentFilter, setChatAgentFilter] = useTabSessionState<string>('liveBuildChatAgentFilter', 'all');
  const [chatStatusFilter, setChatStatusFilter] = useTabSessionState<string>('liveBuildChatStatusFilter', 'all');
  const [patchPreview, setPatchPreview] = useState<{ callId: string; content: string } | null>(null);
  const [patchBusyCallId, setPatchBusyCallId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useTabSessionState<DetailTab>('liveBuildDetailTab', 'activity');
  const [detailOpen, setDetailOpen] = useTabSessionState<boolean>('liveBuildDetailOpen', true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const refreshTimerRef = useRef<number | null>(null);

  const eligibleRole = role !== 'client' && can('view_squads');

  useEffect(() => {
    if (!projects.length) {
      setSelectedProjectId('');
      return;
    }
    setSelectedProjectId(current => current && projects.some(project => project.id === current) ? current : projects[0].id);
  }, [projects, setSelectedProjectId]);

  const loadRoom = useCallback(async (silent = false) => {
    if (!selectedProjectId || !eligibleRole) return;
    const requestId = ++requestIdRef.current;
    if (silent) setRefreshing(true);
    else {
      setLoading(true);
      setError(null);
    }
    try {
      const next = await apiService.getLiveBuildRoom(selectedProjectId);
      if (requestId !== requestIdRef.current) return;
      setSnapshot(next);
      setError(null);
      setSelectedExecutionId(current => current && next.agentCards.some(card => card.executionId === current)
        ? current
        : next.agentCards.find(card => card.status === 'running')?.executionId ?? next.agentCards[0]?.executionId ?? null);
      const calls = next.chatCalls ?? [];
      const liveCallIds = new Set(next.agentCards.map(card => card.agentCallId).filter((id): id is string => Boolean(id)));
      setSelectedChatCallId(current => current && calls.some(call => call.id === current && !liveCallIds.has(call.id))
        ? current
        : calls.find(call => !liveCallIds.has(call.id))?.id ?? null);
      setLastSyncedAt(new Date().toISOString());
    } catch (err: any) {
      if (requestId !== requestIdRef.current) return;
      setSnapshot(null);
      setError(err?.message || 'The project room could not be loaded.');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [eligibleRole, selectedProjectId]);

  useEffect(() => {
    if (!isActiveTab) return undefined;
    void loadRoom();
    if (!selectedProjectId || !eligibleRole) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadRoom(true);
    }, 10_000);
    const eventNames = ['stage_update', 'run_activity', 'run_started', 'run_completed', 'run_failed', 'run_cancelled', 'squad_member_started', 'squad_run_completed', 'squad_run_failed', 'agent_call.created', 'agent_call.queued', 'agent_call.started', 'agent_call.activity', 'agent_call.completed', 'agent_call.failed', 'agent_call.cancelled'];
    const scheduleRefresh = () => {
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        void loadRoom(true);
      }, 180);
    };
    const unsubs = eventNames.map(event => runnerSocket.on(event, scheduleRefresh));
    return () => {
      window.clearInterval(interval);
      requestIdRef.current += 1;
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
      unsubs.forEach(unsub => unsub());
    };
  }, [eligibleRole, isActiveTab, loadRoom, selectedProjectId]);

  /**
   * Join the channels of the runs on screen.
   *
   * The room listened for run events and never asked for any: a channel is
   * opened per run by whoever is showing that run, and on the web that was
   * only the run-progress panel. So a project manager watching the room saw
   * nothing until the ten-second poll came round, which is not what "live"
   * means. Every member run of the active squad run is subscribed while the
   * room is open, and released when it is not.
   */
  const runStreamKey = useMemo(() => [...new Set([
    ...(snapshot?.activeRun?.memberRuns ?? []).map(run => run.id),
    ...(snapshot?.agentCards ?? []).map(card => card.runId).filter((id): id is string => Boolean(id))
  ])].sort().join('|'), [snapshot?.activeRun?.memberRuns, snapshot?.agentCards]);

  useEffect(() => {
    if (!isActiveTab) return undefined;
    const runIds = runStreamKey ? runStreamKey.split('|') : [];
    runIds.forEach(runId => runnerSocket.subscribeToRunStream(runId));
    return () => runIds.forEach(runId => runnerSocket.unsubscribeFromRunStream(runId));
  }, [isActiveTab, runStreamKey]);

  const visibleAgentCards = useMemo(() => (snapshot?.agentCards ?? []).filter(card => {
    const matchesStatus = agentStatusFilter === 'all'
      || (agentStatusFilter === 'stale' ? Boolean(card.isStale) : card.status === agentStatusFilter);
    const query = agentSearch.trim().toLocaleLowerCase();
    const matchesSearch = !query || `${card.agentName} ${card.agentRole} ${card.currentTask} ${card.sourceLabel}`.toLocaleLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  }), [agentSearch, agentStatusFilter, snapshot?.agentCards]);

  const selectedCard = useMemo(() =>
    visibleAgentCards.find(card => card.executionId === selectedExecutionId) ?? visibleAgentCards[0] ?? null,
  [selectedExecutionId, visibleAgentCards]);

  const liveCallIds = useMemo(() => new Set(
    (snapshot?.agentCards ?? []).map(card => card.agentCallId).filter((id): id is string => Boolean(id))
  ), [snapshot?.agentCards]);
  const recentChatCalls = (snapshot?.chatCalls ?? []).filter(call => !liveCallIds.has(call.id));

  const visibleChatCalls = recentChatCalls.filter(call =>
    (chatFilter === 'all' || (call.threadId ?? 'private') === chatFilter) &&
    (chatAgentFilter === 'all' || call.agentId === chatAgentFilter) &&
    (chatStatusFilter === 'all' || call.status === chatStatusFilter)
  );
  const selectedChatCall = visibleChatCalls.find(call => call.id === selectedChatCallId) ?? null;
  const chatOptions = [...new Map(recentChatCalls.map(call => [call.threadId ?? 'private', {
    id: call.threadId ?? 'private',
    label: call.threadId ? call.chatLabel : 'Private project chats'
  }] as const)).values()];

  const activeProject = projects.find(project => project.id === selectedProjectId);
  const agentStatusCounts = (snapshot?.agentCards ?? []).reduce<Record<AgentStatusFilter, number>>((counts, card) => {
    counts[card.status] += 1;
    if (card.isStale) counts.stale += 1;
    return counts;
  }, { all: snapshot?.agentCards.length ?? 0, running: 0, waiting: 0, review: 0, failed: 0, completed: 0, idle: 0, stale: 0 });
  const fallbackIssue = issues.find(issue => issue.projectId === selectedProjectId && issue.assignedSquadId === snapshot?.squad?.id)
    ?? issues.find(issue => issue.projectId === selectedProjectId);

  const handleProjectChange = (projectId: string) => {
    requestIdRef.current += 1;
    setSelectedProjectId(projectId);
    setSelectedExecutionId(null);
    setSelectedChatCallId(null);
    setAgentSearch('');
    setAgentStatusFilter('all');
    setChatFilter('all');
    setChatAgentFilter('all');
    setPatchPreview(null);
    setSnapshot(null);
    setError(null);
    setLoading(true);
  };

  const handleRunBuild = async () => {
    if (!snapshot || !snapshot.squad || starting || !snapshot.canRun) return;
    const issue = snapshot.issue ?? fallbackIssue;
    if (!issue) {
      showToast('Add an issue first', 'A squad run needs a project issue as its build target.', 'info');
      return;
    }
    setStarting(true);
    try {
      await triggerSquadRun(snapshot.squad.id, issue.id, undefined, issue.title);
      await loadRoom(true);
    } finally {
      setStarting(false);
    }
  };

  const reviewChatPatch = async (call: LiveBuildRoomChatCall) => {
    try {
      const result = await apiService.getAgentCallPatch(call.id);
      setPatchPreview({ callId: call.id, content: result.patch });
    } catch (error: any) {
      showToast('Patch unavailable', error?.message ?? 'The proposed patch could not be loaded.', 'error');
    }
  };

  const applyChatPatch = async (call: LiveBuildRoomChatCall) => {
    if (!window.confirm('Apply this proposed patch to the project working copy? Review the diff first.')) return;
    setPatchBusyCallId(call.id);
    try {
      await apiService.applyAgentCallPatch(call.id);
      showToast('Patch applied', 'The working copy changed. Review the working tree before committing.', 'success');
      setPatchPreview(null);
      await loadRoom(true);
    } catch (error: any) {
      showToast('Patch not applied', error?.message ?? 'The patch was rejected by the working copy.', 'error');
    } finally {
      setPatchBusyCallId(null);
    }
  };

  if (!eligibleRole) {
    return (
      <div className="flex h-full items-center justify-center bg-shell p-6 text-center">
        <div className="max-w-md rounded-2xl border border-white/[0.08] bg-surface-100 p-8">
          <ShieldAlert className="mx-auto h-8 w-8 text-slate-500" />
          <h1 className="mt-4 text-lg font-semibold text-white">Live Build Room is an internal view</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Project agent activity is available to developers, project managers, and workspace administrators. Client progress remains available in the project portal.</p>
        </div>
      </div>
    );
  }

  if (!projects.length) {
    return (
      <div className="flex h-full items-center justify-center bg-shell p-6 text-center">
        <div className="max-w-md rounded-2xl border border-white/[0.08] bg-surface-100 p-8">
          <Layers3 className="mx-auto h-8 w-8 text-slate-500" />
          <h1 className="mt-4 text-lg font-semibold text-white">No projects available</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Projects you can access will appear here with their live agent activity.</p>
        </div>
      </div>
    );
  }

  if (error || (!loading && !snapshot)) {
    return (
      <div className="h-full overflow-y-auto bg-shell p-4 text-slate-200 sm:p-6">
        <div className="mx-auto flex min-h-full max-w-[1800px] flex-col">
          <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div><h1 className="text-xl font-semibold tracking-tight text-white">Live Build Room</h1><p className="mt-1 text-xs text-slate-400">Project agent activity and execution details.</p></div>
            <label className="relative flex min-w-[220px] items-center rounded-xl border border-white/[0.10] bg-surface-100/80 px-3 py-2"><span className="mr-2 text-[10px] uppercase tracking-[0.12em] text-slate-500">Project</span><select value={selectedProjectId} onChange={event => handleProjectChange(event.target.value)} className="min-w-0 flex-1 appearance-none bg-transparent pr-6 text-xs font-semibold text-white outline-none">{projects.map(project => <option key={project.id} value={project.id} className="bg-surface-100">{project.key} · {project.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-slate-500" /></label>
          </div>
          <div className="flex flex-1 items-center justify-center p-6 text-center">
            <div className="max-w-lg rounded-2xl border border-white/[0.08] bg-surface-100 p-8">
              <AlertTriangle className="mx-auto h-8 w-8 text-amber-300" />
              <h2 className="mt-4 text-lg font-semibold text-white">Could not load this project room</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{error || 'The room could not be loaded. Check your project access and try again.'}</p>
              <div className="mt-5 flex justify-center gap-2">
                <button type="button" onClick={() => void loadRoom()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.06]"><RefreshCw className="h-3.5 w-3.5" />Retry</button>
                <button type="button" onClick={() => setActiveTab('projects')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.06]"><Layers3 className="h-3.5 w-3.5" />Projects</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !snapshot) {
    return (
      <div className="h-full overflow-y-auto bg-shell p-4 text-slate-200 sm:p-6">
        <div className="mx-auto max-w-[1800px] space-y-4">
          <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div><h1 className="text-xl font-semibold tracking-tight text-white">Live Build Room</h1><p className="mt-1 text-xs text-slate-400">Loading project agents and recent activity…</p></div>
            <label className="relative flex min-w-[220px] items-center rounded-xl border border-white/[0.10] bg-surface-100/80 px-3 py-2"><span className="mr-2 text-[10px] uppercase tracking-[0.12em] text-slate-500">Project</span><select value={selectedProjectId} onChange={event => handleProjectChange(event.target.value)} className="min-w-0 flex-1 appearance-none bg-transparent pr-6 text-xs font-semibold text-white outline-none">{projects.map(project => <option key={project.id} value={project.id} className="bg-surface-100">{project.key} · {project.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-slate-500" /></label>
          </div>
          <div className="animate-pulse space-y-4" aria-label="Loading project room" role="status">
          <div className="h-24 rounded-2xl border border-white/[0.08] bg-surface-100/60" />
          <div className="h-24 rounded-2xl border border-white/[0.08] bg-surface-100/60" />
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-52 rounded-2xl border border-white/[0.08] bg-surface-100/60" />)}</div>
          <span className="sr-only">Loading project activity…</span>
          </div>
        </div>
      </div>
    );
  }

  const roomStatus = snapshot.summary.review > 0 || snapshot.status === 'awaiting_approval'
    ? 'Review required'
    : snapshot.summary.failed > 0 || snapshot.status === 'failed' || snapshot.status === 'cancelled'
      ? 'Needs attention'
      : snapshot.summary.stale > 0
        ? 'Signal delayed'
        : snapshot.summary.running > 0
        ? 'Agents working'
        : snapshot.summary.waiting > 0
          ? 'Agents queued'
          : snapshot.status === 'idle' ? 'Ready for a build' : 'Build in progress';
  const roomStatusTone = roomStatus === 'Needs attention'
    ? 'text-rose-300 bg-rose-400/10 border-rose-400/25'
    : roomStatus === 'Review required'
      ? 'text-amber-200 bg-amber-400/10 border-amber-400/25'
      : roomStatus === 'Signal delayed'
        ? 'text-amber-200 bg-amber-400/10 border-amber-400/25'
      : roomStatus === 'Ready for a build'
        ? 'text-slate-300 bg-white/[0.04] border-white/10'
        : 'text-violet-200 bg-violet-400/10 border-violet-400/25';

  return (
    <div className="h-full overflow-y-auto bg-shell text-slate-200">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-4 p-4 pb-8 sm:p-6">
        <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500"><span>Workspace</span><span>/</span><span className="text-slate-300">{activeProject?.name || snapshot.project.name}</span><span>/</span><span>Automation</span></div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-200"><RadioTower className="h-5 w-5" /></div>
              <div><h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Live Build Room</h1><p className="mt-1 text-xs text-slate-400">See which agents are working across this project and inspect their live activity.</p></div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex min-w-[220px] items-center rounded-xl border border-white/[0.10] bg-surface-100/80 px-3 py-2">
              <span className="mr-2 text-[10px] uppercase tracking-[0.12em] text-slate-500">Project</span>
              <select value={selectedProjectId} onChange={event => handleProjectChange(event.target.value)} className="min-w-0 flex-1 appearance-none bg-transparent pr-6 text-xs font-semibold text-white outline-none">
                {projects.map(project => <option key={project.id} value={project.id} className="bg-surface-100">{project.key} · {project.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-slate-500" />
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.10] bg-surface-100/80 px-3 py-2 text-xs"><Users className="h-3.5 w-3.5 text-violet-300" /><span className="text-slate-400">Squad</span><span className="font-semibold text-white">{snapshot.squad?.name ?? 'None assigned'}</span>{snapshot.squad && <span className="text-slate-500">· {snapshot.squad.memberCount}</span>}</div>
            <button type="button" onClick={() => { setDetailOpen(true); setDetailTab('activity'); }} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.10] px-3 py-2.5 text-xs font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white"><TerminalSquare className="h-3.5 w-3.5" />View logs</button>
            <button type="button" onClick={() => void loadRoom(true)} className="rounded-xl border border-white/[0.10] p-2.5 text-slate-400 hover:bg-white/[0.06] hover:text-white" title="Refresh room" aria-label="Refresh room"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /></button>
            <span className="w-full text-right text-[10px] text-slate-500 xl:w-auto">{lastSyncedAt ? `Synced ${timeAgo(lastSyncedAt)}` : 'Waiting for first sync'}</span>
          </div>
        </div>

        <section className="order-5 rounded-2xl border border-violet-400/20 bg-surface-100/60 p-4 sm:p-5">
          <div className="flex flex-col gap-3 border-b border-white/[0.07] pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div><div className="flex items-center gap-2 text-sm font-semibold text-white"><MessageSquare className="h-4 w-4 text-violet-300" />Recent project chat activity</div><p className="mt-1 text-xs text-slate-500">Completed and past chat agent calls. Active calls are shown with the live project agents above.</p></div>
            <div className="flex flex-wrap gap-2">
              <select aria-label="Filter by chat" value={chatFilter} onChange={event => setChatFilter(event.target.value)} className="rounded-lg border border-white/10 bg-surface-100 px-2.5 py-2 text-[11px] text-slate-300 outline-none"><option value="all">All chats</option>{chatOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
              <select aria-label="Filter by agent" value={chatAgentFilter} onChange={event => setChatAgentFilter(event.target.value)} className="rounded-lg border border-white/10 bg-surface-100 px-2.5 py-2 text-[11px] text-slate-300 outline-none"><option value="all">All agents</option>{[...new Map(recentChatCalls.map(call => [call.agentId, call] as const)).values()].map(call => <option key={call.agentId} value={call.agentId}>{call.agentName}</option>)}</select>
              <select aria-label="Filter by status" value={chatStatusFilter} onChange={event => setChatStatusFilter(event.target.value)} className="rounded-lg border border-white/10 bg-surface-100 px-2.5 py-2 text-[11px] text-slate-300 outline-none"><option value="all">All statuses</option>{['awaiting_confirmation', 'queued', 'running', 'completed', 'failed', 'cancelled'].map(status => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}</select>
            </div>
          </div>
          {recentChatCalls.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-7 text-center"><div className="text-sm font-medium text-slate-300">{(snapshot.chatCalls ?? []).length ? 'Active chat calls are in the agent overview' : 'No project chat activity yet'}</div><p className="mt-1 text-xs text-slate-500">{(snapshot.chatCalls ?? []).length ? 'Select a running project chat agent above to inspect its current work.' : 'Past calls will appear here after a project agent is used in chat.'}</p><button type="button" onClick={() => setActiveTab('chat')} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/[0.06]"><MessageSquare className="h-3.5 w-3.5" />Open project chat</button></div>
          ) : (
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.5fr)]">
              <div className="space-y-2">
                {visibleChatCalls.map(call => {
                  const active = call.status === 'running' || call.status === 'queued';
                  const selected = selectedChatCall?.id === call.id;
                  const tone = call.status === 'completed' ? 'text-emerald-300' : call.status === 'failed' || call.status === 'cancelled' ? 'text-rose-300' : call.status === 'awaiting_confirmation' ? 'text-amber-200' : 'text-violet-200';
                  return <button key={call.id} type="button" onClick={() => { setSelectedChatCallId(call.id); setPatchPreview(null); }} aria-pressed={selected} className={`w-full rounded-xl border p-3 text-left transition ${selected ? 'border-violet-400/50 bg-violet-400/[0.07]' : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.045]'}`}>
                    <div className="flex items-center justify-between gap-3"><span className="truncate text-xs font-semibold text-white">{call.agentName}</span><span className={`flex shrink-0 items-center gap-1.5 text-[10px] font-medium ${tone}`}><span className={`h-1.5 w-1.5 rounded-full bg-current ${active ? 'animate-pulse' : ''}`} />{call.status.replace(/_/g, ' ')}</span></div>
                    <div className="mt-1 truncate text-[11px] text-slate-400">{call.origin === 'chat_turn' ? 'Chat message' : 'Agent call'} · {call.chatLabel} · {call.operationMode}</div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-500"><span className="truncate">{call.target?.label || call.target?.type || 'No target'}</span><span className="shrink-0">{timeAgo(call.startedAt || call.createdAt)}</span></div>
                  </button>;
                })}
                {visibleChatCalls.length === 0 && <div className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-slate-500">No calls match these filters.</div>}
              </div>
              {selectedChatCall ? <div className="min-w-0 rounded-xl border border-white/[0.08] bg-black/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="text-sm font-semibold text-white">{selectedChatCall.agentName}<span className="font-normal text-slate-400"> · {selectedChatCall.agentRole}</span></div><div className="mt-1 text-xs text-slate-500">{selectedChatCall.origin === 'chat_turn' ? 'Chat message' : 'Agent call'} · {selectedChatCall.chatLabel} · {selectedChatCall.operationMode} · {selectedChatCall.target?.label || selectedChatCall.target?.type || 'Project chat'}</div></div><div className="flex flex-wrap gap-2">{selectedChatCall.canOpenChat && selectedChatCall.threadId && <button type="button" onClick={() => { setActiveThreadId(selectedChatCall.threadId!); setActiveTab('chat'); }} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 text-[11px] text-slate-200 hover:bg-white/[0.06]"><MessageSquare className="h-3.5 w-3.5" />Open chat</button>}{selectedChatCall.canOpenChat && selectedChatCall.hasPatch && <button type="button" onClick={() => void reviewChatPatch(selectedChatCall)} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/30 px-2.5 py-2 text-[11px] text-violet-200 hover:bg-violet-400/10"><FileCode2 className="h-3.5 w-3.5" />{patchPreview?.callId === selectedChatCall.id ? 'Refresh diff' : 'Review diff'}</button>}{selectedChatCall.canOpenChat && selectedChatCall.hasPatch && selectedChatCall.status === 'completed' && can('run_agents') && !selectedChatCall.patchApplied && <button type="button" disabled={patchBusyCallId === selectedChatCall.id} onClick={() => void applyChatPatch(selectedChatCall)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 px-2.5 py-2 text-[11px] text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-50"><Check className="h-3.5 w-3.5" />{patchBusyCallId === selectedChatCall.id ? 'Applying…' : 'Apply patch'}</button>}{selectedChatCall.patchApplied && <span className="self-center text-[10px] text-emerald-300">Patch applied</span>}</div></div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500"><span>Working copy: {selectedChatCall.workingCopyId?.split(':').at(-1) || 'project workspace'}</span>{selectedChatCall.workingBranch && <span className="inline-flex items-center gap-1"><GitBranch className="h-3 w-3" />{selectedChatCall.workingBranch}</span>}{selectedChatCall.target?.type === 'issue' && <span>Issue: {selectedChatCall.target.label || selectedChatCall.target.id}</span>}{selectedChatCall.target?.type === 'pull_request' && selectedChatCall.target.id && <a href={selectedChatCall.target.id} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-300 hover:text-violet-200">{selectedChatCall.target.label || 'Pull request'}<ExternalLink className="h-3 w-3" /></a>}</div>
                <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto border-t border-white/[0.07] pt-3">
                  {selectedChatCall.activities.length ? selectedChatCall.activities.slice().reverse().map(activity => <div key={activity.id} className="flex gap-3"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${activity.kind === 'error' ? 'bg-rose-400' : activity.kind === 'file_change' ? 'bg-emerald-400' : activity.kind === 'tool' || activity.kind === 'tool_result' ? 'bg-sky-400' : 'bg-violet-400'}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-200">{activity.toolName && <span className="font-medium text-violet-200">{activity.toolName} · </span>}{activity.message}</span><time className="text-[10px] text-slate-500">{timeAgo(activity.createdAt)}</time></div>{activity.detail && <div className="mt-1 text-[11px] leading-4 text-slate-500">{activity.detail}</div>}{activity.paths?.length ? <div className="mt-1 flex flex-wrap gap-1.5">{activity.paths.map(file => <code key={file} className="rounded bg-white/[0.05] px-1.5 py-1 text-[10px] text-slate-300">{file}</code>)}</div> : null}</div></div>) : <div className="text-xs text-slate-500">Waiting for the first activity event.</div>}
                </div>
                {patchPreview?.callId === selectedChatCall.id && <div className="mt-4 border-t border-white/[0.07] pt-3"><div className="mb-2 flex items-center justify-between"><div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Proposed diff</div><button type="button" onClick={() => setPatchPreview(null)} className="text-[10px] text-slate-500 hover:text-slate-200">Close</button></div><pre className="max-h-[420px] overflow-auto rounded-lg border border-white/[0.07] bg-black/30 p-3 text-[10px] leading-5 text-slate-300">{patchPreview.content}</pre></div>}
              </div> : <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-slate-500">Select an agent call to inspect its activity.</div>}
            </div>
          )}
        </section>

        <div className="order-1 flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-surface-100/60 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-slate-300"><TerminalSquare className="h-4 w-4" /></div><div className="min-w-0"><div className="truncate text-sm font-medium text-white">{snapshot.issue ? `${snapshot.issue.identifier} · ${snapshot.issue.title}` : snapshot.squad ? 'Ready for the next project issue' : 'No squad assigned to this project'}</div><div className="mt-1 text-xs text-slate-500">{snapshot.activeRun?.mission || (snapshot.squad ? 'Run a squad against a project issue to start a live build.' : 'Assign a squad before starting a squad build.')}</div></div></div>
          <div className="flex shrink-0 items-center gap-2"><span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium ${roomStatusTone}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{roomStatus}</span>{snapshot.squad ? <button type="button" onClick={() => void handleRunBuild()} disabled={!snapshot.canRun || starting || !snapshot.issue && !fallbackIssue} title={!snapshot.issue && !fallbackIssue ? 'Create a project issue before starting a squad run.' : undefined} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-3.5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-500/15 transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-45"><Play className="h-3.5 w-3.5 fill-current" />{starting ? 'Starting…' : 'Run Build'}</button> : <button type="button" onClick={() => setActiveTab('squads')} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-3.5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-500/15 transition hover:bg-violet-400"><Users className="h-3.5 w-3.5" />Set up a squad</button>}</div>
        </div>

        {snapshot.phases.length > 0 && <div className="order-3"><PhaseTimeline phases={snapshot.phases} /></div>}

        <div className={`order-2 grid gap-4 ${detailOpen && selectedCard ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : 'xl:grid-cols-1'}`}>
          <div className="min-w-0 space-y-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-surface-100/45 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Project agents</div>
                <div className="mt-1 text-xs text-slate-500">Live squad, direct-run, and project-chat executions for {activeProject?.name || snapshot.project.name}.</div>
              </div>
              {snapshot.agentCards.length > 0 && <label className="flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.10] bg-surface-100/80 px-3 py-2 sm:w-72">
                <span className="sr-only">Search project agents</span>
                <Code2 className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <input value={agentSearch} onChange={event => setAgentSearch(event.target.value)} placeholder="Search agents or current work" className="min-w-0 flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 outline-none" />
              </label>}
            </div>
            {snapshot.agentCards.length > 0 && <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter project agents by status">
              {(['all', 'running', 'waiting', 'review', 'failed', 'stale', 'completed', 'idle'] as AgentStatusFilter[]).map(status => {
                const label = status === 'all' ? 'All' : status === 'stale' ? 'No signal' : statusMeta[status].label;
                const count = status === 'all' ? snapshot.summary.totalAgents : status === 'stale' ? snapshot.summary.stale : agentStatusCounts[status];
                return <button key={status} type="button" onClick={() => setAgentStatusFilter(status)} aria-pressed={agentStatusFilter === status} className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${agentStatusFilter === status ? 'border-violet-400/40 bg-violet-400/10 text-violet-100' : 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'}`}>
                  {label}<span className="ml-1.5 text-slate-500">{count}</span>
                </button>;
              })}
            </div>}
            {snapshot.agentCards.length > 0 ? <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {visibleAgentCards.map(card => <AgentCard key={card.executionId} card={card} selected={selectedCard?.executionId === card.executionId} onSelect={() => { setSelectedExecutionId(card.executionId); setDetailTab('activity'); setDetailOpen(true); }} />)}
              {!visibleAgentCards.length && <div className="col-span-full rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center">
                <div className="text-sm font-medium text-slate-300">No agents match these filters</div>
                <p className="mt-1 text-xs text-slate-500">Clear the search or choose another status to see project activity.</p>
                <button type="button" onClick={() => { setAgentSearch(''); setAgentStatusFilter('all'); }} className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/[0.06]">Clear filters</button>
              </div>}
            </div> : <div className="rounded-2xl border border-dashed border-white/10 px-5 py-9 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-slate-400"><Users className="h-5 w-5" /></div>
              <div className="mt-3 text-sm font-medium text-slate-200">No visible agent activity</div>
              <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">When a squad, direct run, or project chat agent starts work, its live status and activity will appear here.{snapshot.squad?.memberCount ? ' This project squad is ready for a build.' : ' Add an agent to a squad or start a project agent to begin.'}</p>
              {(!snapshot.squad || snapshot.squad.memberCount === 0) && <button type="button" onClick={() => setActiveTab('squads')} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/[0.06]"><Users className="h-3.5 w-3.5" />Open squads</button>}
            </div>}
            <div className="rounded-2xl border border-white/[0.08] bg-surface-100/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div><div className="text-sm font-semibold text-white">Build artifacts</div><div className="mt-1 text-xs text-slate-500">Outputs recorded from visible project executions</div></div>
                <button type="button" disabled={!selectedCard} onClick={() => { if (!selectedCard) return; setSelectedExecutionId(selectedCard.executionId); setDetailTab('files'); setDetailOpen(true); }} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40">Open artifacts <ExternalLink className="h-3.5 w-3.5" /></button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {snapshot.artifacts.length ? snapshot.artifacts.map(artifact => <div key={artifact.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-200">{artifact.kind === 'pull_request' ? <GitBranch className="h-4 w-4" /> : <FileCode2 className="h-4 w-4" />}</div>
                  <div className="min-w-0"><div className="truncate text-xs font-medium text-slate-200">{artifact.name}</div><div className="truncate text-[10px] text-slate-500">{artifact.detail}</div></div>
                </div>) : <div className="col-span-full rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-xs text-slate-500">Artifacts will appear as agents produce outputs.</div>}
              </div>
            </div>
          </div>
          {detailOpen && selectedCard && <ActivityPanel snapshot={snapshot} card={selectedCard} tab={detailTab} setTab={setDetailTab} onClose={() => setDetailOpen(false)} />}
        </div>
      </div>
    </div>
  );
};
