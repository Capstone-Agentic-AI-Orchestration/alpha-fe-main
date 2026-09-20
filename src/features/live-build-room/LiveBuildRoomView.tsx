import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Layers3,
  Loader2,
  Play,
  RadioTower,
  RefreshCw,
  ShieldAlert,
  TerminalSquare,
  Users,
  X
} from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { apiService } from '@/shared/services/apiService';
import { runnerSocket } from '@/shared/services/runnerSocket';
import type {
  LiveBuildRoomAgentCard,
  LiveBuildRoomCardStatus,
  LiveBuildRoomPhase,
  LiveBuildRoomSnapshot,
  RunActivity
} from '@/shared/types';

type DetailTab = 'activity' | 'handoff' | 'files' | 'notes';

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
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 45) return 'Just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

function activityLabel(activity: RunActivity): string {
  if (activity.kind === 'tool' || activity.kind === 'tool_result') return 'Tool activity';
  if (activity.kind === 'error') return 'Attention';
  if (activity.kind === 'summary') return 'Summary';
  return 'Agent update';
}

function activityTone(activity: RunActivity): string {
  if (activity.kind === 'error') return 'bg-rose-400';
  if (activity.kind === 'tool' || activity.kind === 'tool_result') return 'bg-sky-400';
  if (activity.kind === 'summary') return 'bg-emerald-400';
  return 'bg-violet-400';
}

function phaseClasses(phase: LiveBuildRoomPhase): string {
  if (phase.status === 'completed') return 'border-emerald-400/30 bg-emerald-400/[0.035]';
  if (phase.status === 'running') return 'border-violet-400/50 bg-violet-400/[0.07] shadow-[0_0_28px_rgba(139,92,246,0.12)]';
  if (phase.status === 'failed') return 'border-rose-400/30 bg-rose-400/[0.035]';
  return 'border-white/[0.08] bg-white/[0.015]';
}

const AgentCard: React.FC<{
  card: LiveBuildRoomAgentCard;
  selected: boolean;
  onSelect: () => void;
}> = ({ card, selected, onSelect }) => {
  const meta = statusMeta[card.status];
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
            <div className="truncate text-[11px] text-slate-400">{card.agentRole}</div>
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${meta.border} ${meta.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${card.status === 'running' ? 'animate-pulse' : ''}`} />
          {meta.label}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-slate-400">
        <span className="truncate">Now doing</span>
        <span className="shrink-0 font-medium text-slate-300">{card.progress}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${card.status === 'completed' ? 'bg-emerald-400' : card.status === 'failed' ? 'bg-rose-400' : card.status === 'review' ? 'bg-amber-400' : 'bg-violet-400'}`}
          style={{ width: `${Math.max(0, Math.min(100, card.progress))}%` }}
        />
      </div>
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
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300" />
      </div>
    </button>
  );
};

const PhaseTimeline: React.FC<{ phases: LiveBuildRoomPhase[] }> = ({ phases }) => (
  <div className="grid gap-2 md:grid-cols-5">
    {phases.map((phase, index) => (
      <React.Fragment key={phase.id}>
        <div className={`min-w-0 rounded-xl border px-3 py-2.5 ${phaseClasses(phase)}`}>
          <div className="flex items-center gap-2">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] ${
              phase.status === 'completed'
                ? 'border-emerald-400/50 text-emerald-300'
                : phase.status === 'running'
                  ? 'border-violet-400/60 text-violet-200'
                  : phase.status === 'failed'
                    ? 'border-rose-400/50 text-rose-200'
                    : 'border-white/15 text-slate-500'
            }`}>
              {phase.status === 'completed' ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[11px] font-semibold text-slate-200">{phase.label}</div>
              <div className="text-[10px] text-slate-500">{phase.status === 'completed' ? 'Completed' : phase.status === 'running' ? 'In progress' : phase.status === 'failed' ? 'Needs attention' : 'Pending'}</div>
            </div>
          </div>
          {phase.status === 'running' && <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full w-2/3 rounded-full bg-violet-400" /></div>}
        </div>
        {index < phases.length - 1 && <div className="hidden items-center justify-center md:flex" aria-hidden="true"><ArrowRight className="h-3.5 w-3.5 text-slate-700" /></div>}
      </React.Fragment>
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
    { id: 'notes', label: 'Notes' }
  ];
  const run = snapshot.activeRun?.memberRuns.find(item => item.id === card.runId);
  const activities = card.activity.length ? card.activity : snapshot.activity;

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
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-violet-400" style={{ width: `${card.progress}%` }} /></div>
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
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Current handoff</div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"><div className="text-[10px] text-slate-500">From</div><div className="mt-1 truncate text-xs font-semibold text-white">{snapshot.handoff.from}</div></div>
              <ArrowRight className="h-4 w-4 text-slate-500" />
              <div className="rounded-xl border border-violet-400/30 bg-violet-400/[0.06] p-3"><div className="text-[10px] text-slate-500">To</div><div className="mt-1 truncate text-xs font-semibold text-white">{snapshot.handoff.to}</div></div>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 text-xs leading-5 text-slate-400">The next agent receives the project context, completed work, and the current branch through the squad handoff.</div>
            {snapshot.handoff.next && <div className="flex items-center gap-2 text-xs text-slate-400"><Clock3 className="h-3.5 w-3.5" /> Next in sequence: <span className="font-medium text-slate-200">{snapshot.handoff.next}</span></div>}
          </div>
        )}

        {tab === 'files' && (
          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Run outputs</div>
            {card.output ? <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"><div className="flex items-center gap-2 text-xs font-medium text-white"><FileCode2 className="h-4 w-4 text-violet-300" />{card.output.label}</div><div className="mt-2 break-all text-[11px] text-slate-500">{card.output.value}</div></div> : <div className="rounded-xl border border-dashed border-white/10 p-4 text-xs leading-5 text-slate-500">No output has been recorded for this agent yet.</div>}
            {run?.branchName && <div className="flex items-center gap-2 text-xs text-slate-400"><GitBranch className="h-3.5 w-3.5" /><span className="truncate">{run.branchName}</span></div>}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 text-xs leading-5 text-slate-400">Only artifacts produced inside this project run are shown here.</div>
          </div>
        )}

        {tab === 'notes' && (
          <div className="space-y-4">
            <div><div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Project mission</div><div className="mt-2 text-xs leading-5 text-slate-300">{snapshot.activeRun?.mission || snapshot.issue?.title || 'No active mission'}</div></div>
            {snapshot.issue && <div><div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Issue context</div><div className="mt-2 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"><div className="text-xs font-semibold text-white">{snapshot.issue.identifier} · {snapshot.issue.title}</div><div className="mt-2 line-clamp-5 text-xs leading-5 text-slate-400">{snapshot.issue.description || 'No additional issue description.'}</div></div></div>}
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
    activeWorkspaceId,
    showToast,
    triggerSquadRun,
    setActiveTab
  } = useApp();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [snapshot, setSnapshot] = useState<LiveBuildRoomSnapshot | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('activity');
  const [detailOpen, setDetailOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const eligibleRole = role !== 'client' && can('view_squads');
  const storageKey = `live_build_room_project:${activeWorkspaceId || 'default'}`;

  useEffect(() => {
    if (!projects.length) {
      setSelectedProjectId('');
      return;
    }
    const stored = window.localStorage.getItem(storageKey);
    const next = stored && projects.some(project => project.id === stored) ? stored : projects[0].id;
    setSelectedProjectId(current => current && projects.some(project => project.id === current) ? current : next);
  }, [projects, storageKey]);

  useEffect(() => {
    if (selectedProjectId) window.localStorage.setItem(storageKey, selectedProjectId);
  }, [selectedProjectId, storageKey]);

  const loadRoom = useCallback(async (silent = false) => {
    if (!selectedProjectId || !eligibleRole) return;
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const next = await apiService.getLiveBuildRoom(selectedProjectId);
      setSnapshot(next);
      setError(null);
      setSelectedAgentId(current => current && next.agentCards.some(card => card.agentId === current) ? current : next.agentCards[0]?.agentId ?? null);
    } catch (err: any) {
      setSnapshot(null);
      setError(err?.message || 'This project does not have an accessible squad room.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eligibleRole, selectedProjectId]);

  useEffect(() => {
    void loadRoom();
    if (!selectedProjectId || !eligibleRole) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadRoom(true);
    }, 10_000);
    const eventNames = ['stage_update', 'run_activity', 'run_started', 'run_completed', 'run_failed', 'run_cancelled', 'squad_member_started', 'squad_run_completed', 'squad_run_failed'];
    const unsubs = eventNames.map(event => runnerSocket.on(event, () => void loadRoom(true)));
    return () => {
      window.clearInterval(interval);
      unsubs.forEach(unsub => unsub());
    };
  }, [eligibleRole, loadRoom, selectedProjectId]);

  const selectedCard = useMemo(() => {
    if (!snapshot) return null;
    return snapshot.agentCards.find(card => card.agentId === selectedAgentId) ?? snapshot.agentCards[0] ?? null;
  }, [selectedAgentId, snapshot]);

  const activeProject = projects.find(project => project.id === selectedProjectId);
  const fallbackIssue = issues.find(issue => issue.projectId === selectedProjectId && issue.assignedSquadId === snapshot?.squad.id)
    ?? issues.find(issue => issue.projectId === selectedProjectId);

  const handleRunBuild = async () => {
    if (!snapshot || starting || !snapshot.canRun) return;
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

  if (!eligibleRole) {
    return (
      <div className="flex h-full items-center justify-center bg-shell p-6 text-center">
        <div className="max-w-md rounded-2xl border border-white/[0.08] bg-surface-100 p-8">
          <ShieldAlert className="mx-auto h-8 w-8 text-slate-500" />
          <h1 className="mt-4 text-lg font-semibold text-white">Live Build Room is an internal view</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Project squad execution is available to developers, project managers, and workspace administrators. Client progress remains available in the project portal.</p>
        </div>
      </div>
    );
  }

  if (!projects.length) {
    return (
      <div className="flex h-full items-center justify-center bg-shell p-6 text-center">
        <div className="max-w-md rounded-2xl border border-white/[0.08] bg-surface-100 p-8">
          <Layers3 className="mx-auto h-8 w-8 text-slate-500" />
          <h1 className="mt-4 text-lg font-semibold text-white">Choose a project to open its room</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">You need an assigned project before squad execution can be displayed.</p>
        </div>
      </div>
    );
  }

  if (error || (!loading && !snapshot)) {
    return (
      <div className="flex h-full items-center justify-center bg-shell p-6 text-center">
        <div className="max-w-lg rounded-2xl border border-white/[0.08] bg-surface-100 p-8">
          <Users className="mx-auto h-8 w-8 text-slate-500" />
          <h1 className="mt-4 text-lg font-semibold text-white">No squad room for this project</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">{error?.includes('404') ? 'Assign an owned or reusable squad to the selected project to open its Live Build Room.' : error || 'The room could not be loaded.'}</p>
          <div className="mt-5 flex justify-center gap-2">
            <button type="button" onClick={() => void loadRoom()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.06]"><RefreshCw className="h-3.5 w-3.5" />Retry</button>
            <button type="button" onClick={() => setActiveTab('squads')} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-400"><Users className="h-3.5 w-3.5" />Open squads</button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !snapshot) {
    return <div className="flex h-full items-center justify-center bg-shell text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /><span className="ml-2 text-sm">Loading project squad room…</span></div>;
  }

  if (!selectedCard) {
    return (
      <div className="flex h-full items-center justify-center bg-shell p-6 text-center">
        <div className="max-w-md rounded-2xl border border-white/[0.08] bg-surface-100 p-8">
          <Users className="mx-auto h-8 w-8 text-slate-500" />
          <h1 className="mt-4 text-lg font-semibold text-white">This squad has no agents yet</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Add at least one member to the project squad before opening its live execution view.</p>
          <button type="button" onClick={() => setActiveTab('squads')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-violet-400"><Users className="h-3.5 w-3.5" />Open squads</button>
        </div>
      </div>
    );
  }

  const roomStatus = snapshot.status === 'idle' ? 'Ready for a build' : snapshot.status === 'awaiting_approval' ? 'Review required' : snapshot.status === 'failed' ? 'Build stopped' : snapshot.status === 'cancelled' ? 'Build stopped' : 'All systems nominal';
  const roomStatusTone = snapshot.status === 'failed' || snapshot.status === 'cancelled' ? 'text-rose-300 bg-rose-400/10 border-rose-400/25' : snapshot.status === 'awaiting_approval' ? 'text-amber-200 bg-amber-400/10 border-amber-400/25' : 'text-emerald-300 bg-emerald-400/10 border-emerald-400/25';

  return (
    <div className="h-full overflow-y-auto bg-shell text-slate-200">
      <div className="mx-auto max-w-[1800px] space-y-4 p-4 pb-8 sm:p-6">
        <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500"><span>Workspace</span><span>/</span><span className="text-slate-300">{activeProject?.name || snapshot.project.name}</span><span>/</span><span>Automation</span></div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-200"><RadioTower className="h-5 w-5" /></div>
              <div><h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Live Build Room</h1><p className="mt-1 text-xs text-slate-400">Build and ship with your project squad</p></div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex min-w-[220px] items-center rounded-xl border border-white/[0.10] bg-surface-100/80 px-3 py-2">
              <span className="mr-2 text-[10px] uppercase tracking-[0.12em] text-slate-500">Project</span>
              <select value={selectedProjectId} onChange={event => { setSelectedProjectId(event.target.value); setSnapshot(null); setError(null); }} className="min-w-0 flex-1 appearance-none bg-transparent pr-6 text-xs font-semibold text-white outline-none">
                {projects.map(project => <option key={project.id} value={project.id} className="bg-surface-100">{project.key} · {project.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-slate-500" />
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.10] bg-surface-100/80 px-3 py-2 text-xs"><Users className="h-3.5 w-3.5 text-violet-300" /><span className="text-slate-400">Squad</span><span className="font-semibold text-white">{snapshot.squad.name}</span><span className="text-slate-500">· {snapshot.squad.memberCount}</span></div>
            <button type="button" onClick={() => { setDetailOpen(true); setDetailTab('activity'); }} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.10] px-3 py-2.5 text-xs font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white"><TerminalSquare className="h-3.5 w-3.5" />View logs</button>
            <button type="button" onClick={() => void loadRoom(true)} className="rounded-xl border border-white/[0.10] p-2.5 text-slate-400 hover:bg-white/[0.06] hover:text-white" title="Refresh room" aria-label="Refresh room"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-surface-100/60 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-slate-300"><TerminalSquare className="h-4 w-4" /></div><div className="min-w-0"><div className="truncate text-sm font-medium text-white">{snapshot.issue ? `${snapshot.issue.identifier} · ${snapshot.issue.title}` : 'Ready for the next project issue'}</div><div className="mt-1 text-xs text-slate-500">{snapshot.activeRun?.mission || 'Run a squad against a project issue to start a live build.'}</div></div></div>
          <div className="flex shrink-0 items-center gap-2"><span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium ${roomStatusTone}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{roomStatus}</span><button type="button" onClick={() => void handleRunBuild()} disabled={!snapshot.canRun || starting || !snapshot.issue && !fallbackIssue} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-3.5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-500/15 transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-45"><Play className="h-3.5 w-3.5 fill-current" />{starting ? 'Starting…' : 'Run Build'}</button></div>
        </div>

        <PhaseTimeline phases={snapshot.phases} />

        <div className={`grid gap-4 ${detailOpen ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : 'xl:grid-cols-1'}`}>
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-semibold text-white">Squad execution</div><div className="mt-1 text-xs text-slate-500">Select an agent card to inspect its operational activity and handoff.</div></div><div className="flex items-center gap-3 text-xs text-slate-500"><span>{snapshot.summary.completed} completed</span><span>{snapshot.summary.running} running</span><span>{snapshot.summary.waiting} waiting</span></div></div>
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {snapshot.agentCards.map(card => <AgentCard key={card.agentId} card={card} selected={selectedCard.agentId === card.agentId} onSelect={() => { setSelectedAgentId(card.agentId); setDetailTab('activity'); setDetailOpen(true); }} />)}
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-surface-100/60 p-4"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-semibold text-white">Build artifacts</div><div className="mt-1 text-xs text-slate-500">Outputs produced by this project squad run</div></div><button type="button" onClick={() => { setSelectedAgentId(selectedCard.agentId); setDetailTab('files'); setDetailOpen(true); }} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.06]">Open artifacts <ExternalLink className="h-3.5 w-3.5" /></button></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{snapshot.artifacts.length ? snapshot.artifacts.map(artifact => <div key={artifact.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-200">{artifact.kind === 'pull_request' ? <GitBranch className="h-4 w-4" /> : <FileCode2 className="h-4 w-4" />}</div><div className="min-w-0"><div className="truncate text-xs font-medium text-slate-200">{artifact.name}</div><div className="truncate text-[10px] text-slate-500">{artifact.detail}</div></div></div>) : <div className="col-span-full rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-xs text-slate-500">Artifacts will appear as agents complete work.</div>}</div></div>
          </div>
          {detailOpen && <ActivityPanel snapshot={snapshot} card={selectedCard} tab={detailTab} setTab={setDetailTab} onClose={() => setDetailOpen(false)} />}
        </div>
      </div>
    </div>
  );
};
