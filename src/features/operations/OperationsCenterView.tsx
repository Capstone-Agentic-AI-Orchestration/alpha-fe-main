import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, Clock3, DollarSign,
  ExternalLink, Globe2, Loader2, RefreshCw, Rocket, Save, Server, ShieldCheck, Target,
  Trash2, XCircle
} from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { apiService } from '@/shared/services/apiService';
import type {
  OperationsDeployment, OperationsExpense, OperationsIncident, OperationsSnapshot, OperationsTarget,
  OperationsTicket, OperationsTicketPolicy, TicketPriority, TicketSlaState
} from '@/shared/types/operations';

type Panel = 'overview' | 'deployments' | 'uptime' | 'costs';
const panels: Array<{ id: Panel; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'deployments', label: 'Deployments' },
  { id: 'uptime', label: 'Uptime & SLAs' },
  { id: 'costs', label: 'Project costs' },
];
const priorities: TicketPriority[] = ['urgent', 'high', 'medium', 'low', 'none'];
const surface = 'rounded-xl border border-divider bg-surface';
const control = 'rounded-lg border border-divider bg-canvas px-3 py-2 text-xs text-content outline-none transition-colors focus:border-focus focus:ring-2 focus:ring-focus/20';

function currency(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Unknown';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

function dateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(time);
}

function dateOnly(value: string | null | undefined): string {
  if (!value) return 'Not set';
  const time = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(time.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(time);
}

function compactDuration(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  return days ? `${days}d ${hours % 24}h` : `${hours}h ${minutes % 60}m`;
}

function StatePill({ state, children }: { state: string; children?: React.ReactNode }) {
  const style = state === 'breached' || state === 'late'
    ? 'bg-status-danger-subtle text-status-danger border-status-danger-border'
    : state === 'at_risk'
      ? 'bg-status-warning-subtle text-status-warning border-status-warning-border'
      : state === 'met' || state === 'on_track'
        ? 'bg-status-success-subtle text-status-success border-status-success-border'
        : state === 'upcoming'
          ? 'bg-surface-raised text-content-secondary border-divider'
          : 'bg-surface-raised text-content-muted border-divider';
  const label = children ?? state.replace(/_/g, ' ');
  return <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium capitalize ${style}`}>
    {state === 'breached' || state === 'late' ? <XCircle className="h-3 w-3" /> : state === 'met' || state === 'on_track' ? <CheckCircle2 className="h-3 w-3" /> : null}
    {label}
  </span>;
}

function deploymentState(status: string): { label: string; tone: string; icon: React.ReactNode } {
  const value = status.toLowerCase();
  if (['live', 'ready', 'success', 'succeeded', 'deployed', 'completed'].includes(value)) return { label: 'Ready', tone: 'text-status-success', icon: <CheckCircle2 className="h-3.5 w-3.5" /> };
  if (['failed', 'failure', 'canceled', 'cancelled', 'build_failed', 'deactivated'].includes(value)) return { label: 'Failed', tone: 'text-status-danger', icon: <XCircle className="h-3.5 w-3.5" /> };
  return { label: status.replace(/_/g, ' '), tone: 'text-status-warning', icon: <Clock3 className="h-3.5 w-3.5" /> };
}

function coverageLabel(target: OperationsTarget): string {
  if (!target.coverageStart) return 'Waiting for first probe';
  const days = Math.max(1, Math.floor((Date.now() - Date.parse(target.coverageStart)) / 86_400_000));
  return days >= 30 ? '30-day window' : `History starts ${dateOnly(target.coverageStart)} · ${days}d observed`;
}

function uptimeTone(value: number | null, target: number | null): string {
  if (value === null) return 'text-content-muted';
  if (target !== null && value < target) return 'text-status-danger';
  return 'text-status-success';
}

const Metric: React.FC<{ label: string; value: string; detail: string; icon: React.ReactNode; tone?: string }> = ({ label, value, detail, icon, tone = 'text-content' }) => (
  <div className={`${surface} p-4`}>
    <div className="flex items-center justify-between gap-3 text-xs text-content-secondary"><span>{label}</span><span className="text-content-muted">{icon}</span></div>
    <div className={`mt-3 text-2xl font-semibold tracking-tight tabular-nums ${tone}`}>{value}</div>
    <p className="mt-1.5 text-[11px] leading-4 text-content-muted">{detail}</p>
  </div>
);

const TargetRow: React.FC<{ target: OperationsTarget; targetPercent: number }> = ({ target, targetPercent }) => {
  const recent = target.recentSamples.slice(-36);
  return (
    <div className="grid gap-3 border-b border-divider px-4 py-3.5 last:border-0 lg:grid-cols-[minmax(220px,1.35fr)_minmax(170px,1fr)_140px_105px] lg:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {target.kind === 'domain' ? <Globe2 className="h-3.5 w-3.5 flex-shrink-0 text-content-muted" /> : <Server className="h-3.5 w-3.5 flex-shrink-0 text-content-muted" />}
          <a href={target.url} target="_blank" rel="noreferrer" className="truncate text-xs font-medium text-content hover:text-link">{target.url}<ExternalLink className="ml-1 inline h-3 w-3 text-content-muted" /></a>
        </div>
        <div className="mt-1 truncate pl-5 text-[10px] text-content-muted">{target.projectName} · {target.repository} · {target.environment}</div>
      </div>
      <div>
        <div className="flex h-7 items-end gap-[2px]" aria-label={`${recent.length} recent health probe results`}>
          {recent.length === 0 ? <span className="text-[10px] text-content-muted">Probe history starts with the first check</span> : recent.map((sample, index) => (
            <span key={`${sample.checkedAt}-${index}`} title={`${dateTime(sample.checkedAt)} · ${sample.ok ? 'Available' : 'Failed'} · ${sample.latencyMs} ms`}
              className={`min-w-[2px] flex-1 rounded-sm ${sample.ok ? 'bg-status-success' : 'bg-status-danger'}`} style={{ height: `${sample.ok ? Math.max(26, Math.min(100, sample.latencyMs / 3)) : 100}%` }} />
          ))}
        </div>
        <div className="mt-1.5 text-[10px] text-content-muted">{coverageLabel(target)} · {target.samples30d.toLocaleString()} checks</div>
      </div>
      <div className={`text-lg font-semibold tabular-nums ${uptimeTone(target.uptimePercent30d, target.targetPercent)}`}>
        {target.uptimePercent30d === null ? 'Unknown' : `${target.uptimePercent30d.toFixed(3)}%`}
        <span className="ml-1 text-[10px] font-normal text-content-muted">30d</span>
      </div>
      <div className="text-xs text-content-secondary">{target.environment === 'production' ? `${targetPercent}% target` : 'No SLA target'}</div>
    </div>
  );
};

const DeploymentTable: React.FC<{ deployments: OperationsDeployment[] }> = ({ deployments }) => (
  <div className={`${surface} overflow-hidden`}>
    <div className="hidden grid-cols-[minmax(190px,1.35fr)_120px_115px_110px_minmax(150px,1fr)] gap-4 border-b border-divider bg-surface-raised px-4 py-2.5 text-[10px] font-medium uppercase tracking-wide text-content-muted md:grid">
      <span>Project / source</span><span>Environment</span><span>Result</span><span>Started</span><span>Commit</span>
    </div>
    {!deployments.length ? <div className="px-5 py-12 text-center"><Rocket className="mx-auto h-5 w-5 text-content-muted" /><p className="mt-3 text-sm font-medium text-content">No deployment history yet</p><p className="mt-1 text-xs text-content-muted">History is imported from configured Render and Vercel projects in the active workspace.</p></div> : deployments.map(deployment => {
      const status = deploymentState(deployment.status);
      return <div key={deployment.id} className="grid gap-2 border-b border-divider px-4 py-3.5 last:border-0 md:grid-cols-[minmax(190px,1.35fr)_120px_115px_110px_minmax(150px,1fr)] md:items-center md:gap-4">
        <div className="min-w-0"><div className="truncate text-xs font-medium text-content">{deployment.projectName}</div><div className="mt-1 truncate font-mono text-[10px] text-content-muted">{deployment.repository} · {deployment.provider}</div></div>
        <span className="w-fit rounded-md bg-surface-raised px-2 py-1 text-[10px] capitalize text-content-secondary">{deployment.environment}</span>
        <span className={`flex items-center gap-1.5 text-xs capitalize ${status.tone}`}>{status.icon}{status.label}</span>
        <span className="text-[11px] text-content-secondary">{dateTime(deployment.startedAt)}</span>
        <div className="min-w-0 text-[10px] text-content-muted">{deployment.commitSha ? <><code>{deployment.commitSha.slice(0, 8)}</code>{deployment.commitMessage && <span className="ml-1 truncate">{deployment.commitMessage}</span>}</> : 'Commit details not provided'}</div>
      </div>;
    })}
  </div>
);

function IncidentList({ incidents }: { incidents: OperationsIncident[] }) {
  return <div className={`${surface} overflow-hidden`}>
    {incidents.length ? incidents.map(incident => <div key={incident.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-divider px-4 py-3.5 last:border-0">
      <div className="flex min-w-0 items-start gap-2.5"><span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${incident.resolvedAt ? 'bg-status-success-subtle text-status-success' : 'bg-status-danger-subtle text-status-danger'}`}>
        {incident.resolvedAt ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}</span>
        <div className="min-w-0"><div className="truncate text-xs font-medium text-content">{incident.projectName} · {incident.kind}</div><div className="mt-1 truncate text-[10px] text-content-muted">{incident.url} · {incident.lastError ?? 'Recovered after consecutive successful checks'}</div></div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2 text-[10px] text-content-muted"><StatePill state={incident.resolvedAt ? 'met' : 'breached'}>{incident.resolvedAt ? 'Resolved' : 'Open'}</StatePill><span>{dateTime(incident.resolvedAt ?? incident.startedAt)}</span></div>
    </div>) : <div className="px-5 py-10 text-center"><ShieldCheck className="mx-auto h-5 w-5 text-status-success" /><p className="mt-2 text-xs text-content-secondary">No incidents in the last 90 days.</p></div>}
  </div>;
}

const SlaMetricCell: React.FC<{ state: TicketSlaState; elapsed: number | null; target: number | null }> = ({ state, elapsed, target }) => (
  <div className="flex flex-wrap items-center gap-2"><StatePill state={state} />
    <span className="text-[10px] tabular-nums text-content-secondary">{compactDuration(elapsed)}{target ? ` / ${compactDuration(target)}` : ''}</span>
  </div>
);

const TicketSlaTable: React.FC<{
  tickets: OperationsTicket[];
  policies: OperationsTicketPolicy[];
  canManage: boolean;
  onPriorityChange: (ticketId: string, priority: TicketPriority) => void;
}> = ({ tickets, policies, canManage, onPriorityChange }) => (
  <div className={`${surface} overflow-hidden`}>
    <div className="hidden grid-cols-[100px_minmax(200px,1fr)_100px_minmax(160px,1fr)_minmax(160px,1fr)] gap-3 border-b border-divider bg-surface-raised px-4 py-2.5 text-[10px] font-medium uppercase tracking-wide text-content-muted md:grid">
      <span>Ticket</span><span>Subject</span><span>Priority</span><span>First response</span><span>Resolution</span>
    </div>
    {!policies.length && <div className="border-b border-divider bg-surface-raised/60 px-4 py-3 text-xs text-content-muted">Ticket targets have not been configured. Add response and resolution targets by priority to start SLA reporting.</div>}
    {tickets.length ? tickets.map(ticket => <div key={ticket.id} className="grid gap-2 border-b border-divider px-4 py-3 last:border-0 md:grid-cols-[100px_minmax(200px,1fr)_100px_minmax(160px,1fr)_minmax(160px,1fr)] md:items-center md:gap-3">
        <span className="font-mono text-[11px] text-content-secondary">{ticket.reference}</span><span className="truncate text-xs text-content">{ticket.title}</span>
        {canManage
          ? <select aria-label={`Priority for ticket ${ticket.reference}`} className={`${control} px-2 py-1.5 capitalize`} value={ticket.priority} onChange={event => onPriorityChange(ticket.id, event.target.value as TicketPriority)}>
              {priorities.map(priority => <option key={priority} value={priority}>{priority === 'none' ? 'unset' : priority}</option>)}
            </select>
          : <span className="text-[10px] capitalize text-content-secondary">{ticket.priority === 'none' ? 'unset' : ticket.priority}</span>}
        <SlaMetricCell state={ticket.response.state} elapsed={ticket.response.elapsedMinutes} target={ticket.response.targetMinutes} />
        <SlaMetricCell state={ticket.resolution.state} elapsed={ticket.resolution.elapsedMinutes} target={ticket.resolution.targetMinutes} />
      </div>) : <div className="px-5 py-8 text-xs text-content-muted">No eligible tickets have been recorded.</div>}
  </div>
);

export const OperationsCenterView: React.FC = () => {
  const { role, activeWorkspace, can, showToast } = useApp();
  const [panel, setPanel] = useState<Panel>('overview');
  const [snapshot, setSnapshot] = useState<OperationsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [targetDraft, setTargetDraft] = useState('99.9');
  const [policyDrafts, setPolicyDrafts] = useState<Record<string, { response: string; resolution: string }>>({});
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});
  const [expenseProjectId, setExpenseProjectId] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseVendor, setExpenseVendor] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Infrastructure');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseRecurrence, setExpenseRecurrence] = useState<OperationsExpense['recurrence']>('one_off');
  const [expenseEffectiveAt, setExpenseEffectiveAt] = useState(new Date().toISOString().slice(0, 10));
  const [expenseEndsAt, setExpenseEndsAt] = useState('');

  const canView = role === 'admin' && can('view_operations');
  const canManage = can('manage_operations');
  const load = useCallback(async (quiet = false) => {
    if (!canView) return;
    if (quiet) setRefreshing(true); else setLoading(true);
    try {
      const data = await apiService.getOperationsSnapshot();
      setSnapshot(data);
      setTargetDraft(String(data.summary.productionTargetPercent));
      setBudgetDrafts(current => {
        const next = { ...current };
        data.projects.forEach(project => { if (!(project.projectId in next)) next[project.projectId] = project.budgetUsd == null ? '' : String(project.budgetUsd); });
        return next;
      });
      setPolicyDrafts(current => {
        const next = { ...current };
        data.ticketPolicies.forEach(policy => { next[policy.priority] = { response: String(policy.responseMinutes), resolution: String(policy.resolutionMinutes) }; });
        return next;
      });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setLoading(false); setRefreshing(false); }
  }, [canView]);

  useEffect(() => { void load(); }, [load, activeWorkspace?.id]);
  useEffect(() => {
    if (!canView) return;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, 60_000);
    return () => window.clearInterval(timer);
  }, [canView, load]);

  const deployments = useMemo(() => snapshot?.deployments ?? [], [snapshot]);
  const timeline = useMemo(() => [...(snapshot?.incidents ?? [])].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)), [snapshot]);

  if (!canView) return <div className="flex h-full items-center justify-center bg-canvas p-6 text-sm text-content-secondary">The Operations Center is available to workspace admins.</div>;

  const runSave = async (action: () => Promise<unknown>, success: string) => {
    setSaving(true);
    try { await action(); await load(true); showToast(success, undefined, 'success'); }
    catch (cause) { showToast('Could not save operations data', cause instanceof Error ? cause.message : String(cause), 'error'); }
    finally { setSaving(false); }
  };

  const saveUptimeTarget = () => {
    const target = Number(targetDraft);
    if (!Number.isFinite(target) || target < 90 || target > 100) return showToast('Invalid uptime target', 'Use a percentage from 90 to 100.', 'error');
    void runSave(() => apiService.setOperationsUptimeTarget(target), 'Production uptime target saved');
  };

  const savePolicies = () => {
    const values = priorities.flatMap(priority => {
      const row = policyDrafts[priority];
      if (!row?.response.trim() && !row?.resolution.trim()) return [];
      return [{ priority, responseMinutes: Number(row.response), resolutionMinutes: Number(row.resolution) }];
    });
    const removePriorities = priorities.filter(priority => !policyDrafts[priority]?.response.trim() && !policyDrafts[priority]?.resolution.trim());
    if ((!values.length && !removePriorities.length) || values.some(value => !Number.isInteger(value.responseMinutes) || value.responseMinutes < 1 || !Number.isInteger(value.resolutionMinutes) || value.resolutionMinutes < 1)) {
      return showToast('Check ticket SLA targets', 'Enter a whole number of minutes for both targets on each configured priority.', 'error');
    }
    void runSave(() => apiService.setOperationsTicketPolicies(values, removePriorities), 'Ticket SLA targets saved').then(() => {
      setPolicyDrafts(current => {
        const next = { ...current };
        removePriorities.forEach(priority => { next[priority] = { response: '', resolution: '' }; });
        return next;
      });
    });
  };

  const addExpense = (event: FormEvent) => {
    event.preventDefault();
    if (!expenseProjectId) return showToast('Choose a project', 'Select the project this cost belongs to.', 'error');
    void runSave(() => apiService.createProjectExpense(expenseProjectId, {
      description: expenseDescription, vendor: expenseVendor || null, category: expenseCategory,
      amountUsd: Number(expenseAmount), recurrence: expenseRecurrence, effectiveAt: expenseEffectiveAt,
      endsAt: expenseEndsAt || null
    }), 'Expense recorded').then(() => {
      setExpenseDescription(''); setExpenseVendor(''); setExpenseAmount(''); setExpenseEndsAt('');
    });
  };

  const deleteExpense = (expense: OperationsExpense) => {
    void runSave(() => apiService.deleteProjectExpense(expense.projectId, expense.id), 'Expense removed');
  };

  const saveBudget = (projectId: string) => {
    const raw = budgetDrafts[projectId]?.trim() ?? '';
    const amount = raw ? Number(raw) : null;
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return showToast('Invalid budget', 'Enter a non-negative USD amount or leave it blank.', 'error');
    void runSave(() => apiService.setProjectBudget(projectId, amount), 'Project budget saved');
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-canvas text-content-secondary select-none">
      <header className="sticky top-0 z-20 border-b border-divider bg-canvas/95 px-5 py-4 backdrop-blur-sm lg:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-raised text-content-secondary"><Activity className="h-4 w-4" /></span>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h1 className="text-base font-semibold tracking-tight text-content">Operations Center</h1><span className="rounded bg-surface-raised px-1.5 py-0.5 text-[9px] text-content-muted">ADMIN</span></div><p className="mt-0.5 truncate text-[11px] text-content-muted">{activeWorkspace?.name ?? 'Active workspace'} · Deployments, availability, service levels, and spend</p></div>
          </div>
          <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg border border-divider bg-surface px-3 py-2 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-raised hover:text-content disabled:opacity-60">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />Refresh
          </button>
        </div>
        <nav aria-label="Operations views" className="mt-4 flex gap-1 overflow-x-auto border-b border-divider">
          {panels.map(item => <button key={item.id} type="button" onClick={() => setPanel(item.id)} className={`-mb-px flex-shrink-0 border-b-2 px-3 py-2 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${panel === item.id ? 'border-action font-medium text-content' : 'border-transparent text-content-muted hover:text-content'}`}>{item.label}</button>)}
        </nav>
      </header>

      <main className="space-y-5 p-5 lg:p-7">
        {error && <div role="alert" className="flex items-start gap-3 rounded-lg border border-status-danger-border bg-status-danger-subtle p-3.5 text-xs text-status-danger"><AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" /><div className="min-w-0"><div className="font-semibold">Operations data could not be loaded</div><div className="mt-1 break-words">{error}</div></div><button type="button" onClick={() => void load()} className="ml-auto flex-shrink-0 rounded px-2 py-1 hover:bg-status-danger/10">Retry</button></div>}
        {loading && !snapshot ? <div className="flex min-h-72 items-center justify-center gap-2 text-xs text-content-muted"><Loader2 className="h-4 w-4 animate-spin" />Loading workspace operations…</div> : null}
        {!loading && !snapshot && !error ? <div className={`${surface} p-8 text-center text-xs text-content-muted`}>No operations snapshot is available for this workspace.</div> : null}

        {snapshot && panel === 'overview' && <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Production uptime" value={snapshot.summary.productionUptimePercent30d === null ? 'Unknown' : `${snapshot.summary.productionUptimePercent30d.toFixed(3)}%`} detail={`${snapshot.summary.productionTargetPercent}% rolling target · ${snapshot.summary.monitoredTargets} monitored targets`} icon={<Activity className="h-4 w-4" />} tone={uptimeTone(snapshot.summary.productionUptimePercent30d, snapshot.summary.productionTargetPercent)} />
            <Metric label="Deployments · 24h" value={String(snapshot.summary.deployments24h)} detail={`${deployments.length} provider deployments in the 30-day history`} icon={<Rocket className="h-4 w-4" />} />
            <Metric label="Open incidents" value={String(snapshot.summary.openIncidents)} detail={snapshot.summary.openIncidents ? 'Admin alerts are sent to the notification bell' : 'No active service incidents'} icon={<AlertTriangle className="h-4 w-4" />} tone={snapshot.summary.openIncidents ? 'text-status-danger' : 'text-content'} />
            <Metric label="Active projects" value={String(snapshot.summary.activeProjects)} detail="In-progress projects in this workspace" icon={<Target className="h-4 w-4" />} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
            <section>
              <div className="mb-2.5 flex items-end justify-between gap-3"><div><h2 className="text-sm font-semibold text-content">Service availability</h2><p className="mt-1 text-[11px] text-content-muted">Rolling probe results · incomplete history is labeled per target</p></div><button type="button" onClick={() => setPanel('uptime')} className="text-[11px] text-link hover:underline">Uptime & SLAs <ArrowUpRight className="ml-0.5 inline h-3 w-3" /></button></div>
              <div className={`${surface} overflow-hidden`}>
                <div className="grid grid-cols-[minmax(200px,1fr)_minmax(140px,1fr)_100px] gap-3 border-b border-divider bg-surface-raised px-4 py-2.5 text-[10px] font-medium uppercase tracking-wide text-content-muted"><span>Target</span><span>Recent checks</span><span>30-day uptime</span></div>
                {snapshot.targets.slice(0, 8).length ? snapshot.targets.slice(0, 8).map(target => <div key={target.id} className="grid grid-cols-[minmax(200px,1fr)_minmax(140px,1fr)_100px] items-center gap-3 border-b border-divider px-4 py-3 last:border-0">
                  <div className="min-w-0"><div className="truncate text-xs font-medium text-content">{target.projectName}</div><div className="truncate text-[10px] text-content-muted">{target.kind} · {target.environment} · {target.url}</div></div>
                  <div className="flex h-5 items-end gap-[2px]">{target.recentSamples.slice(-28).length ? target.recentSamples.slice(-28).map((sample, index) => <span key={`${sample.checkedAt}-${index}`} title={`${dateTime(sample.checkedAt)} · ${sample.ok ? 'Available' : 'Failed'}`} className={`min-w-[2px] flex-1 rounded-sm ${sample.ok ? 'bg-status-success' : 'bg-status-danger'}`} style={{ height: sample.ok ? '65%' : '100%' }} />) : <span className="text-[10px] text-content-muted">Awaiting first probe</span>}</div>
                  <span className={`text-sm font-semibold tabular-nums ${uptimeTone(target.uptimePercent30d, target.targetPercent)}`}>{target.uptimePercent30d === null ? 'Unknown' : `${target.uptimePercent30d.toFixed(2)}%`}</span>
                </div>) : <div className="px-4 py-7 text-center text-xs text-content-muted">No provider services or domains have been discovered yet. Monitoring history begins with the first probe.</div>}
              </div>
            </section>
            <section><div className="mb-2.5"><h2 className="text-sm font-semibold text-content">Incident timeline</h2><p className="mt-1 text-[11px] text-content-muted">Opened after two failed checks · recovered after two successful checks</p></div><IncidentList incidents={timeline.slice(0, 6)} /></section>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <section><div className="mb-2.5 flex items-end justify-between gap-3"><div><h2 className="text-sm font-semibold text-content">Recent deployments</h2><p className="mt-1 text-[11px] text-content-muted">Provider history imported from the last 30 days</p></div><button type="button" onClick={() => setPanel('deployments')} className="text-[11px] text-link hover:underline">All deployments <ArrowUpRight className="ml-0.5 inline h-3 w-3" /></button></div><DeploymentTable deployments={deployments.slice(0, 5)} />{!snapshot.lastDeploymentImportAt && <p className="mt-2 text-[10px] text-content-muted">The first provider history import is pending the monitor worker’s initial sync.</p>}</section>
            <section><div className="mb-2.5"><h2 className="text-sm font-semibold text-content">Known project spend</h2><p className="mt-1 text-[11px] text-content-muted">AI run costs stay unknown until a provider reports them</p></div><div className={`${surface} divide-y divide-divider`}>
              {snapshot.projects.slice(0, 6).map(project => <div key={project.projectId} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><div className="truncate text-xs font-medium text-content">{project.projectName}</div><div className="mt-1 text-[10px] text-content-muted">AI runs: {currency(project.aiRunCostUsd)} · expenses {currency(project.manualExpenseUsd)}</div></div><span className="flex-shrink-0 text-xs font-semibold tabular-nums text-content">{currency(project.totalKnownUsd)}</span></div>)}
              {!snapshot.projects.length && <div className="px-4 py-8 text-center text-xs text-content-muted">No project costs recorded yet.</div>}
            </div></section>
          </div>
        </>}

        {snapshot && panel === 'deployments' && <>
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-sm font-semibold text-content">Deployment history</h2><p className="mt-1 text-[11px] text-content-muted">Render and Vercel production and staging releases · provider IDs prevent duplicate imports</p></div><div className="text-[10px] text-content-muted">Last imported {dateTime(snapshot.lastDeploymentImportAt)}</div></div>
          <DeploymentTable deployments={deployments} />
        </>}

        {snapshot && panel === 'uptime' && <>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.75fr)]">
            <section className={`${surface} p-4`}>
              <div className="flex items-start gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-raised text-content-secondary"><Activity className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-content">Production availability target</h2><p className="mt-1 text-[11px] text-content-muted">Applies to configured production services and domains over a rolling 30-day sample window.</p></div></div>
              <div className="mt-4 flex flex-wrap items-center gap-2"><label htmlFor="ops-target" className="sr-only">Production uptime target percent</label><input id="ops-target" className={`${control} w-28 tabular-nums`} type="number" min="90" max="100" step="0.1" value={targetDraft} onChange={event => setTargetDraft(event.target.value)} disabled={!canManage} /><span className="text-xs text-content-secondary">%</span>
                {canManage && <button type="button" onClick={saveUptimeTarget} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-action px-3 py-2 text-xs font-medium text-action-content hover:bg-action-hover disabled:opacity-60"><Save className="h-3.5 w-3.5" />Save target</button>}
                <span className="text-[10px] text-content-muted">Default: 99.9%</span>
              </div>
            </section>
            <section className={`${surface} p-4`}><h2 className="text-sm font-semibold text-content">Probe policy</h2><div className="mt-3 grid gap-2 text-[11px] text-content-secondary sm:grid-cols-2 lg:grid-cols-1"><div className="flex items-center gap-2"><Clock3 className="h-3.5 w-3.5 text-content-muted" />Checks run every minute</div><div className="flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-content-muted" />Incident after 2 consecutive failures</div><div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-content-muted" />Recovery after 2 consecutive passes</div><div className="flex items-center gap-2"><CalendarClock className="h-3.5 w-3.5 text-content-muted" />90 days of probe history</div></div></section>
          </div>
          <section><div className="mb-2.5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-sm font-semibold text-content">Monitored targets</h2><p className="mt-1 text-[11px] text-content-muted">Configured service URLs and provider-confirmed domains for in-progress projects</p></div><div className="text-[10px] text-content-muted">Availability is calculated from recorded samples; new targets show history coverage.</div></div>
            <div className={surface}><div className="hidden grid-cols-[minmax(220px,1.35fr)_minmax(170px,1fr)_140px_105px] gap-3 border-b border-divider bg-surface-raised px-4 py-2.5 text-[10px] font-medium uppercase tracking-wide text-content-muted lg:grid"><span>Service / domain</span><span>Recent samples</span><span>Observed uptime</span><span>Target</span></div>
              {snapshot.targets.length ? snapshot.targets.map(target => <TargetRow key={target.id} target={target} targetPercent={snapshot.summary.productionTargetPercent} />) : <div className="px-5 py-10 text-center text-xs text-content-muted">No provider targets are configured for active projects.</div>}</div>
          </section>
          <section><div className="mb-2.5"><h2 className="text-sm font-semibold text-content">Incident history</h2><p className="mt-1 text-[11px] text-content-muted">Last 90 days · repeated probes for an open incident are deduplicated</p></div><IncidentList incidents={timeline} /></section>
          <section><div className="mb-2.5"><h2 className="text-sm font-semibold text-content">Ticket response and resolution SLAs</h2><p className="mt-1 text-[11px] text-content-muted">Elapsed time pauses while Alpha is waiting on the client or the ticket is on hold.</p></div>
            <div className={`${surface} mb-3 overflow-hidden`}>
              <div className="grid grid-cols-[100px_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-divider bg-surface-raised px-4 py-2.5 text-[10px] font-medium uppercase tracking-wide text-content-muted"><span>Priority</span><span>First response · min</span><span>Resolution · min</span></div>
              {priorities.map(priority => <div key={priority} className="grid grid-cols-[100px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 border-b border-divider px-4 py-2 last:border-0"><span className="text-xs capitalize text-content-secondary">{priority}</span><input aria-label={`${priority} first response target in minutes`} className={control} type="number" min="1" placeholder="Unconfigured" value={policyDrafts[priority]?.response ?? ''} onChange={event => setPolicyDrafts(current => ({ ...current, [priority]: { response: event.target.value, resolution: current[priority]?.resolution ?? '' } }))} disabled={!canManage} /><input aria-label={`${priority} resolution target in minutes`} className={control} type="number" min="1" placeholder="Unconfigured" value={policyDrafts[priority]?.resolution ?? ''} onChange={event => setPolicyDrafts(current => ({ ...current, [priority]: { response: current[priority]?.response ?? '', resolution: event.target.value } }))} disabled={!canManage} /></div>)}
              {canManage && <div className="flex justify-end border-t border-divider p-3"><button type="button" onClick={savePolicies} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-action px-3 py-2 text-xs font-medium text-action-content hover:bg-action-hover disabled:opacity-60"><Save className="h-3.5 w-3.5" />Save configured priorities</button></div>}
            </div>
            <TicketSlaTable tickets={snapshot.tickets} policies={snapshot.ticketPolicies} canManage={canManage}
              onPriorityChange={(ticketId, priority) => void runSave(() => apiService.setOperationsTicketPriority(ticketId, priority), 'Ticket priority saved')} />
          </section>
          <section><div className="mb-2.5"><h2 className="text-sm font-semibold text-content">Project and milestone target dates</h2><p className="mt-1 text-[11px] text-content-muted">Completion timestamps are recorded when a project or milestone is marked complete. Requested ticket dates are excluded.</p></div>
            <div className={`${surface} overflow-hidden`}>
              <div className="hidden grid-cols-[minmax(220px,1fr)_160px_160px_120px] gap-3 border-b border-divider bg-surface-raised px-4 py-2.5 text-[10px] font-medium uppercase tracking-wide text-content-muted md:grid"><span>Delivery item</span><span>Target date</span><span>Completed</span><span>Performance</span></div>
              {[...snapshot.projects.map(project => ({ id: project.projectId, projectName: project.projectName, title: 'Project delivery', targetDate: project.targetDate, completedAt: project.completedAt, targetPerformance: project.targetPerformance })), ...snapshot.milestones.map(milestone => ({ id: milestone.id, projectName: milestone.projectName, title: milestone.title, targetDate: milestone.targetDate, completedAt: milestone.completedAt ?? null, targetPerformance: milestone.targetPerformance }))].map(item => <div key={item.id} className="grid gap-1.5 border-b border-divider px-4 py-3 last:border-0 md:grid-cols-[minmax(220px,1fr)_160px_160px_120px] md:items-center md:gap-3"><div className="min-w-0"><div className="truncate text-xs font-medium text-content">{item.title}</div><div className="truncate text-[10px] text-content-muted">{item.projectName}</div></div><span className="text-[11px] text-content-secondary">{dateOnly(item.targetDate)}</span><span className="text-[11px] text-content-secondary">{item.completedAt ? dateTime(item.completedAt) : 'Pending'}</span><StatePill state={item.targetPerformance} /></div>)}
              {!snapshot.projects.length && !snapshot.milestones.length && <div className="px-4 py-7 text-xs text-content-muted">No project delivery dates are available.</div>}
            </div>
          </section>
        </>}

        {snapshot && panel === 'costs' && <>
          <section className={`${surface} p-4`}><div className="flex items-start gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-raised text-content-secondary"><DollarSign className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-content">Workspace project costs</h2><p className="mt-1 text-[11px] text-content-muted">Reported AI run usage plus manually entered one-off, monthly, and annual expenses. Budgets and entries use USD.</p></div></div></section>
          <div className={`${surface} overflow-hidden`}>
            <div className="hidden grid-cols-[minmax(190px,1fr)_130px_130px_130px_minmax(170px,0.8fr)] gap-4 border-b border-divider bg-surface-raised px-4 py-2.5 text-[10px] font-medium uppercase tracking-wide text-content-muted lg:grid"><span>Project</span><span>AI run costs</span><span>Expenses to date</span><span>Known total</span><span>Budget · USD</span></div>
            {snapshot.projects.length ? snapshot.projects.map(project => {
              const progress = project.budgetUsd == null || project.budgetUsd <= 0 ? null : Math.min(100, project.totalKnownUsd / project.budgetUsd * 100);
              return <div key={project.projectId} className="grid gap-2 border-b border-divider px-4 py-3.5 last:border-0 lg:grid-cols-[minmax(190px,1fr)_130px_130px_130px_minmax(170px,0.8fr)] lg:items-center lg:gap-4">
                <div className="min-w-0"><div className="truncate text-xs font-medium text-content">{project.projectName}</div><div className="mt-1 text-[10px] text-content-muted">{project.unreportedRunCount ? `${project.unreportedRunCount} run cost${project.unreportedRunCount === 1 ? '' : 's'} unreported` : `${project.reportedRunCount} reported run costs`}</div></div>
                <div className="text-xs tabular-nums text-content-secondary">{currency(project.aiRunCostUsd)}</div><div className="text-xs tabular-nums text-content-secondary">{currency(project.manualExpenseUsd)}</div>
                <div className="text-xs font-semibold tabular-nums text-content">{currency(project.totalKnownUsd)}<span className="ml-1 text-[9px] font-normal text-content-muted">known</span></div>
                <div className="flex items-center gap-2"><label className="sr-only" htmlFor={`budget-${project.projectId}`}>Project budget in USD</label><input id={`budget-${project.projectId}`} className={`${control} min-w-0 flex-1 tabular-nums`} type="number" min="0" step="0.01" placeholder="No budget" value={budgetDrafts[project.projectId] ?? ''} onChange={event => setBudgetDrafts(current => ({ ...current, [project.projectId]: event.target.value }))} disabled={!canManage} /><button type="button" title="Save project budget" onClick={() => saveBudget(project.projectId)} disabled={!canManage || saving} className="rounded-lg border border-divider p-2 text-content-secondary hover:bg-surface-raised disabled:opacity-50"><Save className="h-3.5 w-3.5" /></button></div>
                {progress !== null && <div className="col-span-full -mt-0.5 space-y-1"><div className="h-1.5 overflow-hidden rounded-full bg-surface-raised"><div className={`h-full rounded-full ${progress >= 100 ? 'bg-status-danger' : 'bg-action'}`} style={{ width: `${progress}%` }} /></div><p className="text-[9px] text-content-muted">{project.unreportedRunCount ? 'Known cost floor against budget' : 'Known total against budget'} · {progress.toFixed(1)}%</p></div>}
              </div>;
            }) : <div className="px-5 py-10 text-center text-xs text-content-muted">No projects are available in this workspace.</div>}
          </div>

          {canManage && <section><div className="mb-2.5"><h2 className="text-sm font-semibold text-content">Record an expense</h2><p className="mt-1 text-[11px] text-content-muted">Enter a vendor invoice, service subscription, or other project expense.</p></div>
            <form onSubmit={addExpense} className={`${surface} grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4`}>
              <label className="grid gap-1.5 text-[10px] text-content-secondary">Project<select className={control} required value={expenseProjectId} onChange={event => setExpenseProjectId(event.target.value)}><option value="">Choose project</option>{snapshot.projects.map(project => <option key={project.projectId} value={project.projectId}>{project.projectName}</option>)}</select></label>
              <label className="grid gap-1.5 text-[10px] text-content-secondary">Description<input className={control} required maxLength={240} value={expenseDescription} onChange={event => setExpenseDescription(event.target.value)} placeholder="Production database" /></label>
              <label className="grid gap-1.5 text-[10px] text-content-secondary">Vendor<input className={control} maxLength={120} value={expenseVendor} onChange={event => setExpenseVendor(event.target.value)} placeholder="Provider name" /></label>
              <label className="grid gap-1.5 text-[10px] text-content-secondary">Category<input className={control} required maxLength={80} value={expenseCategory} onChange={event => setExpenseCategory(event.target.value)} /></label>
              <label className="grid gap-1.5 text-[10px] text-content-secondary">Amount · USD<input className={control} required type="number" min="0" step="0.01" value={expenseAmount} onChange={event => setExpenseAmount(event.target.value)} placeholder="0.00" /></label>
              <label className="grid gap-1.5 text-[10px] text-content-secondary">Recurrence<select className={control} value={expenseRecurrence} onChange={event => setExpenseRecurrence(event.target.value as OperationsExpense['recurrence'])}><option value="one_off">One-off</option><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label>
              <label className="grid gap-1.5 text-[10px] text-content-secondary">Effective from<input className={control} type="date" required value={expenseEffectiveAt} onChange={event => setExpenseEffectiveAt(event.target.value)} /></label>
              <label className="grid gap-1.5 text-[10px] text-content-secondary">Ends on · optional<input className={control} type="date" min={expenseEffectiveAt} value={expenseEndsAt} onChange={event => setExpenseEndsAt(event.target.value)} /></label>
              <div className="flex justify-end sm:col-span-2 xl:col-span-4"><button type="submit" disabled={saving} className="rounded-lg bg-action px-4 py-2 text-xs font-medium text-action-content hover:bg-action-hover disabled:opacity-60">Add expense</button></div>
            </form>
          </section>}

          <section><div className="mb-2.5"><h2 className="text-sm font-semibold text-content">Expense ledger</h2><p className="mt-1 text-[11px] text-content-muted">Recurring entries are counted from their effective date through today or their end date.</p></div>
            <div className={`${surface} overflow-hidden`}>
              <div className="hidden grid-cols-[minmax(190px,1.3fr)_minmax(150px,1fr)_110px_110px_115px_44px] gap-3 border-b border-divider bg-surface-raised px-4 py-2.5 text-[10px] font-medium uppercase tracking-wide text-content-muted lg:grid"><span>Expense</span><span>Project</span><span>Amount</span><span>Recurrence</span><span>Effective</span><span /></div>
              {snapshot.expenses.length ? snapshot.expenses.map(expense => <div key={expense.id} className="grid gap-1.5 border-b border-divider px-4 py-3 last:border-0 lg:grid-cols-[minmax(190px,1.3fr)_minmax(150px,1fr)_110px_110px_115px_44px] lg:items-center lg:gap-3">
                <div className="min-w-0"><div className="truncate text-xs font-medium text-content">{expense.description}</div><div className="truncate text-[10px] text-content-muted">{expense.vendor || expense.category}</div></div>
                <span className="truncate text-[11px] text-content-secondary">{expense.projectName ?? 'Project'}</span><span className="text-xs tabular-nums text-content-secondary">{currency(expense.amountUsd)}</span><span className="text-[10px] capitalize text-content-secondary">{expense.recurrence.replace('_', ' ')}</span><span className="text-[10px] text-content-secondary">{dateOnly(expense.effectiveAt)}</span>
                <button type="button" disabled={!canManage || saving} onClick={() => deleteExpense(expense)} title={`Remove ${expense.description}`} className="w-fit rounded-lg p-2 text-content-muted hover:bg-status-danger-subtle hover:text-status-danger disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>) : <div className="px-5 py-9 text-center text-xs text-content-muted">No manually entered expenses yet.</div>}
            </div>
          </section>
        </>}

        {snapshot && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-divider pt-3 text-[10px] text-content-muted"><span>Data is scoped to {activeWorkspace?.name ?? 'the active workspace'} and is refreshed every minute while this view is open.</span><span>Snapshot {dateTime(snapshot.generatedAt)}</span></div>}
      </main>
    </div>
  );
};
