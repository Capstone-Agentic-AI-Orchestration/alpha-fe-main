import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  GitBranch,
  Layers,
  Loader2,
  MessageSquarePlus,
  Play,
  RefreshCw,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Square,
  Users,
  Workflow,
  X
} from 'lucide-react';

import { useApp } from '@/app/AppContext';
import { CreateIssueModal } from '@/features/issues/CreateIssueModal';
import { ActivityFeed } from '@/features/runs/ActivityFeed';
import { RemoteActivity } from '@/features/runs/RemoteActivity';
import { SquadRunFlow } from '@/features/runs/SquadRunFlow';
import { Modal } from '@/shared/components/Modal';
import { apiService } from '@/shared/services/apiService';
import { runnerSocket } from '@/shared/services/runnerSocket';
import {
  Agent,
  BuildStepPhase,
  Issue,
  ProjectBuildStep,
  PrototypeRun,
  PrototypeRunStatus,
  Squad,
  SquadRun
} from '@/shared/types';

interface BuildRoomViewProps {
  /** The Projects view supplies this when it opens a project-specific room. */
  projectId?: string;
  /** Selects the issue attached to a run when a room is opened from a run link. */
  buildRunId?: string;
}

type WorkStatus =
  | 'unassigned'
  | 'queued'
  | 'running'
  | 'awaiting_review'
  | 'failed'
  | 'cancelled'
  | 'completed'
  | 'open';

interface WorkItem {
  issue: Issue;
  run?: PrototypeRun;
  squadRun?: SquadRun;
  ownerName: string;
  ownerKind: 'agent' | 'squad' | 'unassigned' | 'conflict';
  status: WorkStatus;
  progress: number;
  currentAction: string;
  updatedAt: string;
}

interface ParticipantConfigModalProps {
  isOpen: boolean;
  projectName: string;
  projectId: string;
  steps: ProjectBuildStep[];
  agents: Agent[];
  squads: Squad[];
  saving: boolean;
  onChange: (steps: ProjectBuildStep[]) => void;
  onSave: () => void;
  onClose: () => void;
}

const ACTIVE_RUN_STATUSES: PrototypeRunStatus[] = [
  'queued',
  'running',
  'awaiting_approval',
  'validating'
];

const isActiveRun = (status?: PrototypeRunStatus) =>
  Boolean(status && ACTIVE_RUN_STATUSES.includes(status));

const isCompletedRun = (status?: PrototypeRunStatus) =>
  status === 'completed' || status === 'awaiting_approval' || status === 'validating';

const isActiveSquadRun = (run?: SquadRun) =>
  Boolean(run && ['running', 'awaiting_approval'].includes(String(run.status)));

const statusLabel: Record<WorkStatus, string> = {
  unassigned: 'Needs owner',
  queued: 'Queued',
  running: 'Running',
  awaiting_review: 'Review required',
  failed: 'Failed',
  cancelled: 'Cancelled',
  completed: 'Complete',
  open: 'Open'
};

function latestFirst<T extends { updatedAt?: string; createdAt?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

function latestRun<T extends PrototypeRun | SquadRun>(items: T[]): T | undefined {
  return [...items].sort((a, b) => {
    const aActive = 'status' in a && (isActiveRun(a.status as PrototypeRunStatus) || isActiveSquadRun(a as SquadRun));
    const bActive = 'status' in b && (isActiveRun(b.status as PrototypeRunStatus) || isActiveSquadRun(b as SquadRun));
    if (aActive !== bActive) return aActive ? -1 : 1;
    return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
  })[0];
}

function runProgress(run?: PrototypeRun): number {
  if (!run) return 0;
  if (run.status === 'completed' || run.status === 'awaiting_approval' || run.status === 'validating') return 100;
  if (!run.stages.length) return run.status === 'running' ? 5 : 0;
  const completed = run.stages.filter(stage => stage.status === 'success').length;
  const current = run.stages[run.currentStageIndex];
  const currentContribution = current?.status === 'running' ? 0.35 : 0;
  return Math.min(99, Math.round(((completed + currentContribution) / run.stages.length) * 100));
}

function squadProgress(squadRun: SquadRun | undefined, memberRuns: PrototypeRun[]): number {
  if (!squadRun) return 0;
  if (String(squadRun.status) === 'completed') return 100;
  const total = squadRun.memberAgentIds.length;
  if (!total) return isActiveSquadRun(squadRun) ? 5 : 0;
  const completedMembers = memberRuns.filter(run => isCompletedRun(run.status)).length;
  const currentMember = memberRuns.find(run => run.squadOrder === squadRun.currentMemberIndex)
    ?? latestRun(memberRuns);
  const currentContribution = currentMember && isActiveRun(currentMember.status)
    ? runProgress(currentMember) / 100
    : 0;
  return Math.min(100, Math.round(((completedMembers + currentContribution) / total) * 100));
}

function runDurationMs(run: PrototypeRun | undefined, now = Date.now()): number | null {
  if (!run) return null;
  const start = new Date(run.createdAt).getTime();
  if (!Number.isFinite(start)) return null;
  const end = isActiveRun(run.status) ? now : new Date(run.updatedAt).getTime();
  return Number.isFinite(end) && end >= start ? end - start : null;
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) return '—';
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

function formatClock(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatRelative(value?: string): string {
  if (!value) return 'No project activity yet';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function latestActivity(run?: PrototypeRun): string | undefined {
  const activities = [...(run?.activities ?? [])].sort((a, b) => a.sequence - b.sequence);
  return activities[activities.length - 1]?.message;
}

function workStatus(issue: Issue, run?: PrototypeRun, squadRun?: SquadRun, ownerKind?: WorkItem['ownerKind']): WorkStatus {
  if (ownerKind === 'unassigned' || ownerKind === 'conflict') return 'unassigned';
  if (String(squadRun?.status) === 'failed' || run?.status === 'failed') return 'failed';
  if (String(squadRun?.status) === 'cancelled' || run?.status === 'cancelled') return 'cancelled';
  if (squadRun?.status === 'awaiting_approval' || run?.status === 'awaiting_approval' || issue.status === 'review') return 'awaiting_review';
  if (isActiveSquadRun(squadRun) || isActiveRun(run?.status)) {
    return run?.status === 'queued' ? 'queued' : 'running';
  }
  if (issue.status === 'done') return 'completed';
  if (run?.status === 'completed' || String(squadRun?.status) === 'completed') return 'awaiting_review';
  return 'open';
}

function statusIcon(status: WorkStatus, className = 'h-4 w-4') {
  if (status === 'running') return <Loader2 className={`${className} animate-spin text-cyan-300`} />;
  if (status === 'queued') return <Clock3 className={`${className} text-blue-300`} />;
  if (status === 'awaiting_review') return <ShieldCheck className={`${className} text-amber-300`} />;
  if (status === 'failed') return <AlertCircle className={`${className} text-rose-300`} />;
  if (status === 'cancelled') return <Square className={`${className} text-gray-500`} />;
  if (status === 'completed') return <CheckCircle2 className={`${className} text-emerald-300`} />;
  if (status === 'unassigned') return <Users className={`${className} text-orange-300`} />;
  return <Layers className={`${className} text-gray-500`} />;
}

function statusTone(status: WorkStatus): string {
  if (status === 'running') return 'border-cyan-400/35 bg-cyan-400/[0.045]';
  if (status === 'queued') return 'border-blue-400/25 bg-blue-400/[0.035]';
  if (status === 'awaiting_review') return 'border-amber-400/35 bg-amber-400/[0.045]';
  if (status === 'failed' || status === 'unassigned') return 'border-rose-400/30 bg-rose-400/[0.035]';
  if (status === 'completed') return 'border-emerald-400/25 bg-emerald-400/[0.025]';
  return 'border-white/[0.07] bg-surface-raised/35';
}

function ProgressBar({ progress, status }: { progress: number; status: WorkStatus }) {
  const color = status === 'failed' || status === 'unassigned'
    ? 'bg-rose-400'
    : status === 'awaiting_review'
      ? 'bg-amber-300'
      : status === 'completed'
        ? 'bg-emerald-400'
        : 'bg-brand-400';
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
    </div>
  );
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail?: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-surface-raised/50 px-3.5 py-3">
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-gray-500">{icon}<span>{label}</span></div>
      <div className="mt-2 truncate text-base font-semibold text-white">{value}</div>
      {detail && <div className="mt-0.5 truncate text-[10px] text-gray-500">{detail}</div>}
    </div>
  );
}

const PARTICIPANT_PHASE: BuildStepPhase = 'implementation';

const ParticipantConfigModal: React.FC<ParticipantConfigModalProps> = ({
  isOpen,
  projectName,
  projectId,
  steps,
  agents,
  squads,
  saving,
  onChange,
  onSave,
  onClose
}) => {
  const updateStep = (id: string, updates: Partial<ProjectBuildStep>) => {
    onChange(steps.map(step => step.id === id ? { ...step, ...updates } : step));
  };

  const addParticipant = () => {
    const usedAgentIds = new Set(steps.map(step => step.agentId).filter(Boolean));
    const availableAgent = agents.find(agent => !agent.isArchived && !usedAgentIds.has(agent.id));
    onChange([...steps, {
      id: `draft-participant-${Date.now()}`,
      projectId,
      label: availableAgent?.name ?? 'New participant',
      phase: PARTICIPANT_PHASE,
      agentId: availableAgent?.id,
      position: steps.length,
      enabled: true,
      required: false,
      approvalGate: false,
      dependsOn: []
    }]);
  };

  const removeParticipant = (id: string) => onChange(
    steps.filter(step => step.id !== id).map((step, index) => ({ ...step, position: index }))
  );

  const targetValue = (step: ProjectBuildStep) => step.agentId
    ? `agent:${step.agentId}`
    : step.squadId
      ? `squad:${step.squadId}`
      : '';

  const setTarget = (step: ProjectBuildStep, value: string) => {
    if (!value) {
      updateStep(step.id, { agentId: undefined, squadId: undefined });
      return;
    }
    const [kind, id] = value.split(':');
    const agent = kind === 'agent' ? agents.find(item => item.id === id) : undefined;
    const squad = kind === 'squad' ? squads.find(item => item.id === id) : undefined;
    updateStep(step.id, {
      agentId: agent?.id,
      squadId: squad?.id,
      label: step.label === 'New participant' ? agent?.name ?? squad?.name ?? step.label : step.label
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configure project participants" subtitle={`${projectName} · visible roster only`} maxWidth="max-w-4xl">
      <div className="rounded-lg border border-blue-400/20 bg-blue-400/[0.04] px-3 py-2.5 text-[11px] leading-relaxed text-blue-100/70">This roster controls which agents and squads appear in this project monitor. It does not change issue ownership, squad member order, or execution behavior. Assign the owner on the issue before starting work.</div>
      <div className="space-y-2">
        {steps.length === 0 && <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-gray-500">No project participants configured. Add the agents or squads that should be visible here.</div>}
        {steps.map(step => (
          <div key={step.id} className={`rounded-xl border p-3 ${step.enabled ? 'border-white/10 bg-surface-raised/55' : 'border-white/[0.05] bg-black/10 opacity-60'}`}>
            <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-[1.2fr_1fr_auto] md:items-end">
              <label className="min-w-0"><span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-500">Display label</span><input value={step.label} onChange={event => updateStep(step.id, { label: event.target.value })} className="w-full rounded-lg border border-white/10 bg-canvas px-2.5 py-2 text-xs text-white outline-none focus:border-brand-400/60" /></label>
              <label className="min-w-0"><span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-500">Participant</span><select value={targetValue(step)} onChange={event => setTarget(step, event.target.value)} className="w-full rounded-lg border border-white/10 bg-canvas px-2.5 py-2 text-xs text-white outline-none [color-scheme:dark] focus:border-brand-400/60"><option value="">Unassigned</option><optgroup label="Agents">{agents.filter(agent => !agent.isArchived).map(agent => <option key={agent.id} value={`agent:${agent.id}`}>{agent.name}</option>)}</optgroup><optgroup label="Squads">{squads.map(squad => <option key={squad.id} value={`squad:${squad.id}`}>{squad.name}</option>)}</optgroup></select>{step.squadId && <span className="mt-1 block text-[10px] text-violet-300/70">Squad handoffs are shown from the squad run.</span>}</label>
              <div className="flex items-center gap-2 md:justify-end"><label className="flex items-center gap-1.5 whitespace-nowrap text-[10px] text-gray-400"><input type="checkbox" checked={step.enabled} onChange={event => updateStep(step.id, { enabled: event.target.checked })} className="accent-brand-400" />Visible</label><button type="button" onClick={() => removeParticipant(step.id)} className="rounded-md p-1.5 text-gray-500 hover:bg-rose-400/10 hover:text-rose-300" title="Remove participant"><X className="h-3.5 w-3.5" /></button></div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-white/[0.07] pt-4"><button type="button" onClick={addParticipant} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-white/[0.05] hover:text-white">+ Add participant</button><div className="flex items-center gap-2"><button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs text-gray-400 hover:text-white">Cancel</button><button type="button" onClick={onSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-brand-500 px-3.5 py-2 text-xs font-semibold text-on-accent hover:bg-brand-600 disabled:opacity-60">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Save participants</button></div></div>
    </Modal>
  );
};

export const BuildRoomView: React.FC<BuildRoomViewProps> = ({ projectId, buildRunId }) => {
  const {
    projects,
    agents,
    squads,
    issues,
    prototypeRuns,
    squadRuns,
    deployments,
    serverStatus,
    showToast,
    openNewTab,
    setActiveTab,
    refreshExecution,
    runAgentOnIssue,
    triggerSquadRun,
    cancelPrototypeRun,
    retryPrototypeRun
  } = useApp();

  const [selectedProjectId, setSelectedProjectId] = useState(projectId ?? projects[0]?.id ?? '');
  const [participants, setParticipants] = useState<ProjectBuildStep[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [draftParticipants, setDraftParticipants] = useState<ProjectBuildStep[]>([]);
  const [savingParticipants, setSavingParticipants] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState('');
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [newIssueOpen, setNewIssueOpen] = useState(false);
  const [newIssuePrompt, setNewIssuePrompt] = useState('');
  const [eventsConnected, setEventsConnected] = useState(serverStatus === 'online');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (projectId && projects.some(project => project.id === projectId)) {
      setSelectedProjectId(projectId);
      return;
    }
    if (!projects.some(project => project.id === selectedProjectId)) setSelectedProjectId(projects[0]?.id ?? '');
  }, [projectId, projects, selectedProjectId]);

  const selectedProject = projects.find(project => project.id === selectedProjectId);

  const loadParticipants = useCallback(async (id: string) => {
    if (!id) {
      setParticipants([]);
      return;
    }
    setParticipantsLoading(true);
    setParticipantsError(null);
    try {
      setParticipants(await apiService.getProjectBuildSteps(id));
    } catch (error: any) {
      setParticipants([]);
      setParticipantsError(error?.message ?? 'Project participants could not be loaded.');
    } finally {
      setParticipantsLoading(false);
    }
  }, []);

  useEffect(() => { void loadParticipants(selectedProjectId); }, [loadParticipants, selectedProjectId]);

  const projectIssues = useMemo(() => latestFirst(issues.filter(issue => issue.projectId === selectedProjectId)), [issues, selectedProjectId]);
  const projectRuns = useMemo(() => latestFirst(prototypeRuns.filter(run => run.projectId === selectedProjectId)), [prototypeRuns, selectedProjectId]);
  const projectSquadRuns = useMemo(() => latestFirst(squadRuns.filter(run => run.projectId === selectedProjectId)), [selectedProjectId, squadRuns]);

  const workItems = useMemo<WorkItem[]>(() => projectIssues.map(issue => {
    const issueRuns = projectRuns.filter(run => run.issueId === issue.id);
    const issueSquadRuns = projectSquadRuns.filter(run => run.issueId === issue.id);
    const squadRun = latestRun(issueSquadRuns);
    const memberRuns = squadRun ? issueRuns.filter(run => run.squadRunId === squadRun.id) : [];
    const run = squadRun
      ? memberRuns.find(item => item.squadOrder === squadRun.currentMemberIndex && isActiveRun(item.status)) ?? latestRun(memberRuns)
      : latestRun(issueRuns);
    const assignedAgent = issue.assignedAgentId ? agents.find(agent => agent.id === issue.assignedAgentId) : undefined;
    const assignedSquad = issue.assignedSquadId ? squads.find(squad => squad.id === issue.assignedSquadId) : undefined;
    const ownerKind: WorkItem['ownerKind'] = assignedAgent && assignedSquad ? 'conflict' : assignedSquad ? 'squad' : assignedAgent ? 'agent' : 'unassigned';
    const status = workStatus(issue, run, squadRun, ownerKind);
    const currentAction = latestActivity(run) ?? run?.stages[run.currentStageIndex]?.description ?? (status === 'unassigned' ? 'Assign one agent or squad on the issue' : statusLabel[status]);
    const updatedAt = latestFirst([
      { updatedAt: issue.updatedAt },
      ...(run ? [{ updatedAt: run.updatedAt }] : []),
      ...(squadRun ? [{ updatedAt: squadRun.updatedAt }] : [])
    ])[0]?.updatedAt ?? issue.updatedAt;
    const progress = squadRun ? squadProgress(squadRun, memberRuns) : runProgress(run);
    return {
      issue,
      run,
      squadRun,
      ownerName: ownerKind === 'conflict' ? 'Assignment conflict' : assignedSquad?.name ?? assignedAgent?.name ?? 'Unassigned',
      ownerKind,
      status,
      progress,
      currentAction,
      updatedAt
    };
  }).sort((a, b) => {
    const rank: Record<WorkStatus, number> = { failed: 0, unassigned: 1, awaiting_review: 2, running: 3, queued: 4, open: 5, cancelled: 6, completed: 7 };
    return rank[a.status] - rank[b.status] || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  }), [agents, projectIssues, projectRuns, projectSquadRuns, squads]);

  const activeWork = workItems.filter(item => item.status === 'running' || item.status === 'queued');
  const attentionWork = workItems.filter(item => item.status === 'failed' || item.status === 'cancelled' || item.status === 'unassigned');
  const reviewWork = workItems.filter(item => item.status === 'awaiting_review');
  const visibleWork = workItems;
  const previewCount = deployments.filter(deployment => deployment.projectId === selectedProjectId && Boolean(deployment.previewUrl)).length;

  useEffect(() => {
    const runMatch = buildRunId ? projectRuns.find(run => run.id === buildRunId) : undefined;
    const initial = runMatch?.issueId ?? workItems.find(item => item.status === 'running' || item.status === 'queued')?.issue.id ?? workItems.find(item => item.status !== 'completed')?.issue.id ?? workItems[0]?.issue.id ?? '';
    if (!workItems.some(item => item.issue.id === selectedIssueId)) setSelectedIssueId(initial);
  }, [buildRunId, projectRuns, selectedIssueId, workItems]);

  useEffect(() => {
    if (!activeWork.length) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeWork.length]);

  const projectRunIds = useMemo(() => new Set(projectRuns.map(run => run.id)), [projectRuns]);
  const projectSquadRunIds = useMemo(() => new Set(projectSquadRuns.map(run => run.id)), [projectSquadRuns]);
  const projectIssueIds = useMemo(() => new Set(projectIssues.map(issue => issue.id)), [projectIssues]);

  useEffect(() => {
    const belongsToProject = (payload: any) => {
      const value = payload ?? {};
      const runId = value.runId ?? value.id;
      const squadRunId = value.squadRunId ?? value.squadRun?.id;
      return value.projectId === selectedProjectId || projectRunIds.has(runId) || projectSquadRunIds.has(squadRunId) || projectIssueIds.has(value.issueId);
    };
    const unsubscribeConnected = runnerSocket.on('connected', () => {
      setEventsConnected(true);
      void refreshExecution().catch(() => {});
    });
    const unsubscribeDisconnected = runnerSocket.on('disconnected', () => setEventsConnected(false));
    const events = ['stage_update', 'log_chunk', 'run_started', 'run_activity', 'run_completed', 'run_failed', 'run_cancelled', 'squad_member_started', 'squad_run_completed', 'squad_run_failed'];
    const unsubs = events.map(event => runnerSocket.on(event, payload => { if (belongsToProject(payload)) setLastEventAt(new Date().toISOString()); }));
    const activeRunIds = projectRuns.filter(run => isActiveRun(run.status)).map(run => run.id);
    activeRunIds.forEach(id => runnerSocket.subscribeToRunStream(id));
    return () => {
      unsubscribeConnected();
      unsubscribeDisconnected();
      unsubs.forEach(unsubscribe => unsubscribe());
      activeRunIds.forEach(id => runnerSocket.unsubscribeFromRunStream(id));
    };
  }, [projectIssueIds, projectRunIds, projectRuns, projectSquadRunIds, refreshExecution, selectedProjectId]);

  useEffect(() => {
    setLastEventAt(null);
    setEventsConnected(serverStatus === 'online');
  }, [selectedProjectId, serverStatus]);

  const selectedItem = workItems.find(item => item.issue.id === selectedIssueId) ?? workItems[0];
  const selectedRun = selectedItem?.run;
  const linkedDeployment = useMemo(() => {
    if (!selectedItem) return undefined;
    return [...deployments]
      .filter(deployment => deployment.projectId === selectedProjectId && (deployment.sourceIssueId === selectedItem.issue.id || (selectedRun && deployment.sourceRunId === selectedRun.id)))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
  }, [deployments, selectedItem, selectedProjectId, selectedRun]);

  const latestProjectActivity = latestFirst([
    ...projectIssues.map(issue => ({ updatedAt: issue.updatedAt })),
    ...projectRuns.map(run => ({ updatedAt: run.updatedAt })),
    ...projectSquadRuns.map(run => ({ updatedAt: run.updatedAt }))
  ])[0]?.updatedAt;
  const lastProjectUpdate = lastEventAt ?? latestProjectActivity;
  const elapsed = formatDuration(runDurationMs(selectedRun, now));

  const participantRows = useMemo(() => {
    const source = participants.length ? participants.filter(participant => participant.enabled).sort((a, b) => a.position - b.position) : [];
    const rows = [...source];
    const seen = new Set(rows.map(row => row.agentId ? `agent:${row.agentId}` : row.squadId ? `squad:${row.squadId}` : row.id));
    const add = (row: ProjectBuildStep) => {
      const key = row.agentId ? `agent:${row.agentId}` : row.squadId ? `squad:${row.squadId}` : row.id;
      if (!seen.has(key)) { seen.add(key); rows.push(row); }
    };
    projectIssues.forEach(issue => {
      if (issue.assignedSquadId) add({ id: `issue-squad-${issue.assignedSquadId}`, projectId: selectedProjectId, label: squads.find(squad => squad.id === issue.assignedSquadId)?.name ?? 'Squad', phase: PARTICIPANT_PHASE, squadId: issue.assignedSquadId, position: rows.length, enabled: true, required: false });
      else if (issue.assignedAgentId) add({ id: `issue-agent-${issue.assignedAgentId}`, projectId: selectedProjectId, label: agents.find(agent => agent.id === issue.assignedAgentId)?.name ?? 'Agent', phase: PARTICIPANT_PHASE, agentId: issue.assignedAgentId, position: rows.length, enabled: true, required: false });
    });
    projectRuns.forEach(run => add({ id: `run-agent-${run.agentId}`, projectId: selectedProjectId, label: agents.find(agent => agent.id === run.agentId)?.name ?? 'Agent', phase: PARTICIPANT_PHASE, agentId: run.agentId, position: rows.length, enabled: true, required: false }));
    projectSquadRuns.forEach(run => add({ id: `run-squad-${run.squadId}`, projectId: selectedProjectId, label: squads.find(squad => squad.id === run.squadId)?.name ?? 'Squad', phase: PARTICIPANT_PHASE, squadId: run.squadId, position: rows.length, enabled: true, required: false }));
    if (!rows.length && selectedProject?.leadAgentId) add({ id: `lead-agent-${selectedProject.leadAgentId}`, projectId: selectedProjectId, label: agents.find(agent => agent.id === selectedProject.leadAgentId)?.name ?? 'Lead agent', phase: PARTICIPANT_PHASE, agentId: selectedProject.leadAgentId, position: 0, enabled: true, required: false });
    return rows;
  }, [agents, participants, projectIssues, projectRuns, projectSquadRuns, selectedProject, selectedProjectId, squads]);

  const participantWorkItem = (participant: ProjectBuildStep) => latestFirst(workItems.filter(item => participant.agentId ? item.issue.assignedAgentId === participant.agentId || item.run?.agentId === participant.agentId : participant.squadId ? item.issue.assignedSquadId === participant.squadId || item.squadRun?.squadId === participant.squadId : false))[0];
  const openProjectIssues = () => openNewTab('issues', selectedProjectId);
  const openNewIssue = (prompt = '') => { setNewIssuePrompt(prompt); setNewIssueOpen(true); };

  const openFollowUpIssue = () => {
    if (!selectedItem) { openNewIssue(); return; }
    const context = [
      `Follow-up request for ${selectedItem.issue.identifier}: ${selectedItem.issue.title}`,
      selectedRun ? `Related run: ${selectedRun.id}` : undefined,
      selectedRun?.branchName ? `Branch: ${selectedRun.branchName}` : undefined,
      selectedRun?.prUrl ? `Pull request: ${selectedRun.prUrl}` : undefined,
      linkedDeployment?.previewUrl ? `Preview: ${linkedDeployment.previewUrl}` : undefined,
      '',
      'Requested change:'
    ].filter(Boolean).join('\n');
    openNewIssue(context);
  };

  const startSelectedWork = async () => {
    if (!selectedItem) { showToast('Create an issue first', 'The monitor starts work from a project issue.', 'info'); openNewIssue(); return; }
    if (selectedItem.status === 'unassigned') {
      showToast('Assign one owner first', selectedItem.ownerKind === 'conflict' ? 'Choose either an agent or a squad on the issue, not both.' : 'Assign an agent or squad on the issue before starting work.', 'info');
      openProjectIssues();
      return;
    }
    if (selectedItem.status === 'running' || selectedItem.status === 'queued') return;
    if (selectedItem.ownerKind === 'squad' && selectedItem.issue.assignedSquadId) {
      await triggerSquadRun(selectedItem.issue.assignedSquadId, selectedItem.issue.id, [], selectedItem.issue.title);
      return;
    }
    if (selectedItem.ownerKind === 'agent' && selectedItem.issue.assignedAgentId) {
      runAgentOnIssue(selectedItem.issue.id, selectedItem.issue.assignedAgentId);
      return;
    }
    showToast('No execution owner', 'Assign exactly one agent or squad to this issue.', 'info');
  };

  const refreshRoom = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshExecution(), loadParticipants(selectedProjectId)]);
      setLastEventAt(new Date().toISOString());
      showToast('Project activity refreshed', `Loaded the latest issues and runs for ${selectedProject?.name ?? 'this project'}.`, 'success');
    } catch (error: any) {
      showToast('Refresh failed', error?.message ?? 'The latest project activity could not be loaded.', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const openConfiguration = () => {
    const source = participants.length ? participants : participantRows;
    setDraftParticipants(source.map((participant, index) => ({ ...participant, position: index, approvalGate: false, dependsOn: [] })));
    setConfigOpen(true);
  };

  const saveConfiguration = async () => {
    if (!selectedProjectId) return;
    setSavingParticipants(true);
    try {
      const saved = await apiService.updateProjectBuildSteps(selectedProjectId, draftParticipants.map(participant => ({ ...participant, approvalGate: false, dependsOn: [] })));
      setParticipants(saved);
      setConfigOpen(false);
      showToast('Project participants saved', `${saved.filter(participant => participant.enabled).length} visible participants are now monitored.`, 'success');
    } catch (error: any) {
      showToast('Participants not saved', error?.message ?? 'Could not save the project roster.', 'error');
    } finally {
      setSavingParticipants(false);
    }
  };

  if (!projects.length) {
    return <div className="flex h-full items-center justify-center bg-shell p-8 text-center"><div className="max-w-md"><Workflow className="mx-auto h-10 w-10 text-gray-600" /><h1 className="mt-4 text-base font-semibold text-white">No project to monitor yet</h1><p className="mt-2 text-xs leading-relaxed text-gray-500">Create a project and attach its issues, agents, or squads before opening a project execution room.</p><button type="button" onClick={() => setActiveTab('projects')} className="mt-5 rounded-lg bg-brand-500 px-3.5 py-2 text-xs font-semibold text-on-accent hover:bg-brand-600">Open Projects</button></div></div>;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-shell text-gray-300">
      <header className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-shell px-5 py-3.5 lg:px-6">
        <div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-brand-400/25 bg-brand-500/10 text-brand-300"><Activity className="h-4.5 w-4.5" /></div><div className="min-w-0"><div className="flex items-center gap-2"><h1 className="truncate text-sm font-semibold tracking-wide text-white">Live Build Room</h1><span className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${eventsConnected && serverStatus === 'online' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/20 bg-amber-400/10 text-amber-200'}`}><span className={`h-1.5 w-1.5 rounded-full ${eventsConnected && serverStatus === 'online' ? 'bg-emerald-400' : 'bg-amber-300'}`} />{eventsConnected && serverStatus === 'online' ? 'Project events connected' : 'Events reconnecting'}</span></div><p className="mt-0.5 truncate text-[11px] text-gray-500">Monitor project issues, agent and squad work, reviews, and outputs.</p></div></div>
        <div className="flex items-center gap-2"><div className="relative"><select aria-label="Select project" value={selectedProjectId} onChange={event => setSelectedProjectId(event.target.value)} className="min-w-[190px] appearance-none rounded-lg border border-white/10 bg-surface-raised py-2 pl-3 pr-8 text-xs font-medium text-white outline-none [color-scheme:dark] focus:border-brand-400/60">{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" /></div><button type="button" onClick={() => void refreshRoom()} disabled={refreshing || participantsLoading} className="rounded-lg border border-white/10 p-2 text-gray-400 hover:bg-white/[0.05] hover:text-white disabled:opacity-50" title="Refresh project activity"><RefreshCw className={`h-3.5 w-3.5 ${refreshing || participantsLoading ? 'animate-spin' : ''}`} /></button><button type="button" onClick={openConfiguration} disabled={!selectedProject} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 text-xs font-medium text-gray-300 hover:bg-white/[0.05] hover:text-white disabled:opacity-50"><Settings2 className="h-3.5 w-3.5" />Participants</button></div>
      </header>

      <div className="flex-1 overflow-y-auto"><div className="space-y-4 p-4 lg:p-6">
        {participantsError && <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-3.5 py-2.5 text-[11px] text-amber-100/80"><span>Participant configuration is unavailable. The room is showing owners found on current project issues.</span><button type="button" onClick={() => void loadParticipants(selectedProjectId)} className="text-amber-200 hover:text-white">Retry</button></div>}

        <section className="grid grid-cols-2 gap-2.5 xl:grid-cols-5"><Metric label="Active work" value={String(activeWork.length)} detail={activeWork.length ? 'Agent or squad is working' : 'Nothing running'} icon={<Loader2 className="h-3.5 w-3.5 text-cyan-300" />} /><Metric label="Needs attention" value={String(attentionWork.length)} detail={attentionWork.length ? 'Failure or owner required' : 'No blockers'} icon={<AlertCircle className="h-3.5 w-3.5 text-rose-300" />} /><Metric label="Review required" value={String(reviewWork.length)} detail={reviewWork.length ? 'Open the review action' : 'No pending reviews'} icon={<ShieldCheck className="h-3.5 w-3.5 text-amber-300" />} /><Metric label="Previews" value={String(previewCount)} detail={previewCount ? 'Project deployments with URLs' : 'No linked previews'} icon={<ExternalLink className="h-3.5 w-3.5 text-emerald-300" />} /><Metric label="Last project update" value={formatRelative(lastProjectUpdate)} detail={serverStatus === 'online' ? `Checked ${formatClock(lastProjectUpdate)}` : 'Connection unavailable'} icon={<RefreshCw className="h-3.5 w-3.5 text-gray-400" />} /></section>

        {!projectIssues.length && <section className="rounded-xl border border-dashed border-brand-400/25 bg-brand-400/[0.035] p-6 text-center"><MessageSquarePlus className="mx-auto h-8 w-8 text-brand-300" /><h2 className="mt-3 text-sm font-semibold text-white">This project has no issues yet</h2><p className="mx-auto mt-1 max-w-md text-[11px] leading-relaxed text-gray-500">The monitor starts with project issues. Create the first request here and keep the project context attached.</p><button type="button" onClick={() => openNewIssue()} className="mt-4 rounded-lg bg-brand-500 px-3.5 py-2 text-xs font-semibold text-on-accent hover:bg-brand-600">Create project issue</button></section>}

        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_350px]"><main className="min-w-0 space-y-4">
          <section className="rounded-xl border border-white/[0.07] bg-surface/40 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Current project work</h2><p className="mt-1 text-[11px] text-gray-500">One card represents one issue and its current execution state.</p></div><div className="flex items-center gap-2"><button type="button" onClick={openProjectIssues} className="rounded-lg border border-white/10 px-2.5 py-2 text-[11px] text-gray-300 hover:bg-white/[0.05] hover:text-white">View project issues</button><button type="button" onClick={() => openNewIssue()} className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-2.5 py-2 text-[11px] font-semibold text-on-accent hover:bg-brand-600"><MessageSquarePlus className="h-3.5 w-3.5" />New issue</button></div></div>
            {visibleWork.length > 0 ? <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">{visibleWork.slice(0, 8).map(item => <button key={item.issue.id} type="button" onClick={() => setSelectedIssueId(item.issue.id)} className={`group rounded-xl border p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-white/20 ${statusTone(item.status)} ${selectedItem?.issue.id === item.issue.id ? 'ring-1 ring-brand-400/45' : ''}`}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-2.5"><span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-black/20">{item.ownerKind === 'squad' ? <Users className="h-3.5 w-3.5 text-violet-300" /> : <Bot className="h-3.5 w-3.5 text-cyan-300" />}</span><div className="min-w-0"><div className="truncate text-xs font-semibold text-white">{item.issue.identifier} · {item.issue.title}</div><div className="mt-0.5 truncate text-[10px] text-gray-500">{item.ownerName} · updated {formatRelative(item.updatedAt)}</div></div></div><span className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-black/20 px-2 py-1 text-[10px] text-gray-300">{statusIcon(item.status, 'h-3 w-3')}{statusLabel[item.status]}</span></div><div className="mt-4 flex items-center justify-between text-[10px] text-gray-500"><span className="truncate pr-2">Now doing · <span className="text-gray-300">{item.currentAction}</span></span><span className="flex-shrink-0 font-mono tabular-nums">{item.progress}%</span></div><div className="mt-2"><ProgressBar progress={item.progress} status={item.status} /></div><div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[10px] text-gray-600"><span>{item.run?.branchName ?? item.issue.branchName ?? 'No branch yet'}</span><span>{item.run?.changedFiles === undefined ? 'No diff reported' : `${item.run.changedFiles} files changed`}</span></div></button>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-gray-500">No open project work. Create an issue when there is a change to make.</div>}
          </section>

          <section className="rounded-xl border border-white/[0.07] bg-surface/40 p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Project participants</h2><p className="mt-1 text-[11px] text-gray-500">A roster of who can appear in this monitor; issue ownership starts the work.</p></div><Users className="h-4 w-4 text-violet-300" /></div>{participantRows.length ? <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{participantRows.map(participant => { const item = participantWorkItem(participant); return <button key={participant.id} type="button" onClick={() => item && setSelectedIssueId(item.issue.id)} className="flex min-w-0 items-center gap-2.5 rounded-lg border border-white/[0.07] bg-black/10 px-3 py-2.5 text-left hover:border-white/15"><span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-black/20">{participant.squadId ? <Users className="h-3.5 w-3.5 text-violet-300" /> : <Bot className="h-3.5 w-3.5 text-cyan-300" />}</span><span className="min-w-0"><span className="block truncate text-xs font-medium text-gray-200">{participant.label}</span><span className="block truncate text-[10px] text-gray-500">{item ? `${statusLabel[item.status]} · ${item.issue.identifier}` : 'No active issue'}</span></span></button>; })}</div> : <div className="mt-4 rounded-lg border border-dashed border-white/10 px-3 py-5 text-center text-[11px] text-gray-500">No project roster configured. Issue owners will still appear here automatically.</div>}</section>
        </main>

        <aside className="min-w-0 space-y-4">
          <section className="rounded-xl border border-white/[0.07] bg-surface/40 p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Next action</h2><p className="mt-1 text-[11px] text-gray-500">The selected issue determines the available action.</p></div>{selectedItem && statusIcon(selectedItem.status)}</div><label className="mt-4 block"><span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-500">Project issue</span><select value={selectedItem?.issue.id ?? ''} onChange={event => setSelectedIssueId(event.target.value)} className="w-full rounded-lg border border-white/10 bg-canvas px-2.5 py-2 text-xs text-white outline-none [color-scheme:dark] focus:border-brand-400/60"><option value="">Select an issue</option>{workItems.map(item => <option key={item.issue.id} value={item.issue.id}>{item.issue.identifier} · {item.issue.title}</option>)}</select></label>{selectedItem ? <><div className="mt-3 rounded-lg border border-white/[0.06] bg-black/10 px-3 py-2.5"><div className="text-[10px] font-medium text-brand-200">{selectedItem.issue.identifier}</div><div className="mt-1 text-xs leading-relaxed text-gray-300">{selectedItem.issue.title}</div><div className="mt-2 text-[10px] text-gray-500">Owner · <span className={selectedItem.status === 'unassigned' ? 'text-orange-300' : 'text-gray-300'}>{selectedItem.ownerName}</span></div></div>{selectedItem.ownerKind === 'conflict' && <div className="mt-3 rounded-lg border border-orange-400/25 bg-orange-400/[0.06] px-3 py-2 text-[10px] leading-relaxed text-orange-100/80">This issue has both an agent and a squad assigned. Choose exactly one owner before starting work.</div>}<div className="mt-3 text-[11px] text-gray-400">{selectedItem.currentAction}</div><div className="mt-4 flex flex-wrap gap-2">{(selectedItem.status === 'open' || selectedItem.status === 'unassigned') && <button type="button" onClick={() => void startSelectedWork()} className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-2.5 py-2 text-[11px] font-semibold text-on-accent hover:bg-brand-600"><Play className="h-3.5 w-3.5" />{selectedItem.status === 'unassigned' ? 'Assign owner' : 'Start work'}</button>}{(selectedItem.status === 'running' || selectedItem.status === 'queued') && <button type="button" onClick={openProjectIssues} className="flex items-center gap-1.5 rounded-lg border border-cyan-400/25 px-2.5 py-2 text-[11px] text-cyan-200 hover:bg-cyan-400/[0.06]">Open active issue</button>}{selectedItem.status === 'awaiting_review' && <button type="button" onClick={() => setActiveTab('inbox')} className="flex items-center gap-1.5 rounded-lg border border-amber-400/25 px-2.5 py-2 text-[11px] text-amber-200 hover:bg-amber-400/[0.06]"><ShieldCheck className="h-3.5 w-3.5" />Open review</button>}{(selectedItem.status === 'failed' || selectedItem.status === 'cancelled') && selectedRun && <button type="button" onClick={() => retryPrototypeRun(selectedRun.id)} className="flex items-center gap-1.5 rounded-lg border border-brand-400/25 px-2.5 py-2 text-[11px] text-brand-200 hover:bg-brand-400/[0.06]"><RotateCcw className="h-3.5 w-3.5" />Retry run</button>}<button type="button" onClick={openFollowUpIssue} className="rounded-lg border border-white/10 px-2.5 py-2 text-[11px] text-gray-300 hover:bg-white/[0.05] hover:text-white">Create follow-up</button></div>{selectedRun && <div className="mt-4 space-y-2 border-t border-white/[0.07] pt-3"><div className="flex items-center justify-between text-[10px] text-gray-500"><span>Run</span><span className="font-mono text-gray-400">{selectedRun.id.slice(-12)}</span></div><div className="flex items-center justify-between text-[10px] text-gray-500"><span>Elapsed</span><span className="text-gray-300">{elapsed}</span></div><div className="flex items-center justify-between text-[10px] text-gray-500"><span>Started</span><span className="text-gray-300">{formatClock(selectedRun.createdAt)}</span></div>{['queued', 'running'].includes(selectedRun.status) && <button type="button" onClick={() => cancelPrototypeRun(selectedRun.id)} className="flex items-center gap-1.5 text-[10px] text-rose-300 hover:text-rose-200"><Square className="h-3 w-3" />Cancel run</button>}</div>}</> : <div className="mt-4 rounded-lg border border-dashed border-white/10 px-3 py-5 text-center text-[11px] text-gray-500">Select a project issue to inspect its owner and execution state.</div>}</section>

          <section className="rounded-xl border border-white/[0.07] bg-surface/40 p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Outputs</h2><p className="mt-1 text-[11px] text-gray-500">Only outputs linked to the selected issue are shown.</p></div><GitBranch className="h-4 w-4 text-indigo-300" /></div><div className="mt-3 space-y-2.5 text-[11px]"><div className="flex items-center justify-between gap-3"><span className="text-gray-500">Branch</span><span className="truncate font-mono text-gray-300">{selectedRun?.branchName ?? selectedItem?.issue.branchName ?? 'Not created'}</span></div><div className="flex items-center justify-between gap-3"><span className="text-gray-500">Changed files</span><span className="text-gray-300">{selectedRun?.changedFiles === undefined ? 'Unreported' : selectedRun.changedFiles}</span></div><div className="flex items-center justify-between gap-3"><span className="text-gray-500">Pull request</span>{selectedRun?.prUrl ?? selectedItem?.issue.prUrl ? <a href={selectedRun?.prUrl ?? selectedItem?.issue.prUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-300 hover:text-brand-200"><span>View PR</span><ExternalLink className="h-3 w-3" /></a> : <span className="text-gray-600">Not opened</span>}</div><div className="flex items-center justify-between gap-3"><span className="text-gray-500">Preview</span>{linkedDeployment?.previewUrl ? <a href={linkedDeployment.previewUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-emerald-300 hover:text-emerald-200"><span>Open preview</span><ExternalLink className="h-3 w-3" /></a> : <span className="text-gray-600">Not linked</span>}</div></div>{selectedRun?.testSummary && <div className="mt-4 border-t border-white/[0.07] pt-3"><div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-gray-500"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />Reported validation</div><p className="mt-2 text-[11px] leading-relaxed text-gray-400">{selectedRun.testSummary}</p></div>}<button type="button" onClick={() => openNewTab('deployments', selectedProjectId)} className="mt-4 w-full rounded-lg border border-white/10 px-3 py-2 text-[11px] text-gray-300 hover:bg-white/[0.05] hover:text-white">Open deployments</button></section>

          {selectedItem?.squadRun && <SquadRunFlow issueId={selectedItem.squadRun.issueId} />}
          {selectedRun && <section className="space-y-3 rounded-xl border border-white/[0.07] bg-surface/40 p-4"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-cyan-300" /><h2 className="text-sm font-semibold text-white">Live activity</h2></div><ActivityFeed activities={selectedRun.activities} live={isActiveRun(selectedRun.status)} /><RemoteActivity runId={selectedRun.id} /></section>}
          <section className="rounded-xl border border-white/[0.07] bg-surface/40 p-4"><div className="flex items-center gap-2"><MessageSquarePlus className="h-4 w-4 text-brand-300" /><h2 className="text-sm font-semibold text-white">How changes enter the room</h2></div><p className="mt-2 text-[11px] leading-relaxed text-gray-500">Create a project issue for new work. Assign one agent or squad, then start it from the issue or this monitor. Use a follow-up issue when a preview, review, or output needs a change.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => openNewIssue()} className="text-[11px] font-medium text-brand-300 hover:text-brand-200">Create project issue →</button><button type="button" onClick={openProjectIssues} className="text-[11px] font-medium text-gray-400 hover:text-white">View issues →</button></div></section>
        </aside></div>
      </div></div>

      {selectedProject && <ParticipantConfigModal isOpen={configOpen} projectName={selectedProject.name} projectId={selectedProject.id} steps={draftParticipants} agents={agents} squads={squads} saving={savingParticipants} onChange={setDraftParticipants} onSave={() => void saveConfiguration()} onClose={() => setConfigOpen(false)} />}
      <CreateIssueModal isOpen={newIssueOpen} onClose={() => setNewIssueOpen(false)} initialProjectId={selectedProjectId} initialPrompt={newIssuePrompt} />
    </div>
  );
};

export default BuildRoomView;
