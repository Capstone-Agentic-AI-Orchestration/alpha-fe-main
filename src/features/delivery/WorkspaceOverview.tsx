import React, { useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  FolderKanban,
  GitBranch,
  Inbox,
  ListChecks,
  MessageSquare,
  Plus,
  RefreshCw,
  Rocket,
  Sparkles,
} from 'lucide-react';

import { useApp } from '@/app/AppContext';
import { Issue, Project, ProjectStatus, UserRole } from '@/shared/types';
import { ProgressRing, SectionLabel } from '@/features/delivery/Ledger';

const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = ['active', 'in_progress', 'planned'];

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  in_progress: 'In progress',
  planned: 'Planned',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  active: 'border-status-success-border bg-status-success-subtle text-status-success',
  in_progress: 'border-divider bg-selected text-selected-content',
  planned: 'border-status-info-border bg-status-info-subtle text-status-info',
  paused: 'border-status-warning-border bg-status-warning-subtle text-status-warning',
  completed: 'border-divider bg-surface-raised text-content-secondary',
  cancelled: 'border-status-danger-border bg-status-danger-subtle text-status-danger',
};

const ROLE_COPY: Record<UserRole, { eyebrow: string; description: string }> = {
  client: {
    eyebrow: 'Client workspace',
    description: 'Keep requests, scope, and delivery progress in one place.',
  },
  dev: {
    eyebrow: 'Developer workspace',
    description: 'Your assigned work, project context, and agent activity at a glance.',
  },
  pm: {
    eyebrow: 'Project workspace',
    description: 'A clear view of delivery, decisions, and the work that needs your attention.',
  },
  admin: {
    eyebrow: 'Workspace operations',
    description: 'Monitor delivery health and keep the workspace running smoothly.',
  },
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}

function relativeTime(timestamp: string | null): string {
  if (!timestamp) return 'Not synced yet';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Not synced yet';

  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'Synced just now';
  if (minutes < 60) return `Synced ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Synced ${hours}h ago`;
  return `Synced ${Math.floor(hours / 24)}d ago`;
}

function projectProgress(project: Project, projectIssues: Issue[]): number {
  if (projectIssues.length > 0) {
    return Math.round((projectIssues.filter(issue => issue.status === 'done').length / projectIssues.length) * 100);
  }
  return Math.max(0, Math.min(100, Math.round(project.progressPercentage ?? 0)));
}

function indexProjectIssues(projects: Project[], issues: Issue[]) {
  return projects.reduce<Record<string, Issue[]>>((result, project) => {
    result[project.id] = issues.filter(issue => issue.projectId === project.id);
    return result;
  }, {});
}

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  detail: string;
  icon: React.ElementType;
  tone?: 'brand' | 'emerald' | 'amber' | 'rose';
  onClick?: () => void;
}> = ({ label, value, detail, icon: Icon, tone = 'brand', onClick }) => {
  const toneStyles = {
    brand: 'text-link',
    emerald: 'text-status-success',
    amber: 'text-status-warning',
    rose: 'text-status-danger',
  }[tone];
  const content = (
    <span className="flex min-w-0 items-center gap-3">
      <Icon className={`h-4 w-4 flex-shrink-0 ${toneStyles}`} aria-hidden="true" />
      <span className="min-w-0">
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-xl font-semibold tabular-nums tracking-tight text-content">{value}</span>
          <span className="truncate text-xs font-medium text-content-secondary">{label}</span>
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-content-muted">{detail}</span>
      </span>
      {onClick && <ArrowRight className="ml-auto h-4 w-4 flex-shrink-0 text-content-muted transition-transform group-hover:translate-x-0.5 group-hover:text-content-secondary" />}
    </span>
  );

  if (!onClick) {
    return <div className="min-w-0 px-3 py-2">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-w-0 border-l border-divider px-4 py-2 text-left transition-colors hover:bg-surface-high focus:outline-none focus:ring-2 focus:ring-inset focus:ring-focus first:border-l-0"
    >
      {content}
    </button>
  );
};

const ProjectRow: React.FC<{
  project: Project;
  issues: Issue[];
  onOpen: () => void;
}> = ({ project, issues, onOpen }) => {
  const progress = projectProgress(project, issues);
  const total = issues.length;
  const done = issues.filter(issue => issue.status === 'done').length;
  const status = project.status || 'planned';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3.5 border-b border-divider px-2 py-3 text-left transition-colors last:border-0 hover:bg-surface-high focus:outline-none focus:ring-2 focus:ring-inset focus:ring-focus"
    >
      <span
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-link"
        aria-hidden="true"
      >
        <FolderKanban className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-content">{project.name}</span>
          <span className="font-mono text-[10px] uppercase tracking-wide text-content-muted">{project.key}</span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-content-muted">
          <span className={`rounded-md border px-1.5 py-0.5 ${PROJECT_STATUS_STYLES[status]}`}>
            {PROJECT_STATUS_LABELS[status]}
          </span>
          <span>{total > 0 ? `${done} of ${total} tasks complete` : 'No tasks yet'}</span>
        </span>
      </span>
      <span className="flex flex-shrink-0 items-center gap-2.5">
        <span className="hidden items-center gap-2 sm:flex">
          <ProgressRing value={progress} total={100} size={30} tone={progress === 100 ? 'emerald' : 'brand'} />
          <span className="font-mono text-xs tabular-nums text-content-secondary">{progress}%</span>
        </span>
        <ArrowRight className="h-4 w-4 text-content-muted transition-transform group-hover:translate-x-0.5 group-hover:text-content-secondary" />
      </span>
    </button>
  );
};

export const WorkspaceOverview: React.FC = () => {
  const {
    activeWorkspace,
    agents,
    analytics,
    can,
    currentUser,
    deployments,
    inbox,
    issues,
    lastSyncedAt,
    projects,
    requirementDocs,
    role,
    serverStatus,
    setActiveTab,
    syncBoard,
    syncing,
    settings,
  } = useApp();

  const first = firstName(currentUser.name);
  const roleCopy = ROLE_COPY[role];
  const issueIndex = indexProjectIssues(projects, issues);

  const allActiveProjects = useMemo(
    () => projects.filter(project => ACTIVE_PROJECT_STATUSES.includes(project.status)),
    [projects],
  );
  const activeProjects = allActiveProjects.slice(0, 5);
  const openIssues = useMemo(() => issues.filter(issue => issue.status !== 'done'), [issues]);
  const reviewIssues = useMemo(() => issues.filter(issue => issue.status === 'review'), [issues]);
  const pendingDocs = useMemo(
    () => requirementDocs.filter(doc => doc.status === 'in_review' || doc.status === 'draft'),
    [requirementDocs],
  );
  const unreadInbox = useMemo(() => inbox.filter(item => !item.read && !item.archived), [inbox]);
  const failedDeployments = useMemo(() => deployments.filter(item => item.status === 'failed'), [deployments]);
  const completedIssues = issues.filter(issue => issue.status === 'done').length;
  const deliveryProgress = issues.length > 0 ? Math.round((completedIssues / issues.length) * 100) : 0;
  const projectLabel = activeWorkspace?.name || settings.workspaceName || 'Your workspace';

  const attentionCount = new Set([
    ...pendingDocs.map(doc => `doc:${doc.id}`),
    ...reviewIssues.map(issue => `issue:${issue.id}`),
    ...failedDeployments.map(deployment => `deployment:${deployment.id}`),
    ...unreadInbox.map(notification => `notification:${notification.id}`),
  ]).size;

  const syncLabel = syncing
    ? 'Syncing workspace'
    : serverStatus === 'offline'
      ? 'Offline cache'
      : relativeTime(lastSyncedAt);
  const syncTone = serverStatus === 'offline' ? 'bg-amber-400' : serverStatus === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400';

  const quickActions = [
    ...(can('create_project') ? [{ label: 'Create a project', detail: 'Set a delivery goal and invite the right people.', icon: Plus, tab: 'projects' as const }] : []),
    { label: 'Review the inbox', detail: unreadInbox.length > 0 ? `${unreadInbox.length} unread item${unreadInbox.length === 1 ? '' : 's'}` : 'Nothing waiting right now.', icon: Inbox, tab: 'inbox' as const },
    { label: role === 'dev' ? 'Open assigned work' : 'Review tasks', detail: openIssues.length > 0 ? `${openIssues.length} open task${openIssues.length === 1 ? '' : 's'}` : 'No open tasks yet.', icon: ListChecks, tab: 'issues' as const },
    { label: 'Message the team', detail: 'Keep a decision or handoff in one shared thread.', icon: MessageSquare, tab: 'chat' as const },
  ];

  return (
    <div className="h-full min-h-0 overflow-hidden bg-canvas text-content">
      <div className="mx-auto grid h-full min-h-0 max-w-[1800px] grid-rows-[auto_auto_minmax(0,1fr)] gap-4 px-5 py-5 sm:px-7 lg:gap-5 lg:px-10 lg:py-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="max-w-2xl space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-content-muted">
              <span>{roleCopy.eyebrow}</span>
              <span className="h-1 w-1 rounded-full bg-gray-700" aria-hidden="true" />
              <span className="normal-case tracking-normal text-content-secondary">{projectLabel}</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-content sm:text-3xl">{greeting()}, {first}.</h1>
            <p className="max-w-xl text-sm leading-6 text-content-secondary">{roleCopy.description}</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void syncBoard()} disabled={syncing || !can('sync_board')} className="inline-flex h-9 items-center gap-2 px-3 text-xs font-medium text-content-secondary transition hover:text-content focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-50">
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />{syncing ? 'Syncing' : 'Sync board'}
              </button>
              {can('create_project') && <button type="button" onClick={() => setActiveTab('projects')} className="inline-flex h-9 items-center gap-2 rounded-lg bg-action px-3.5 text-xs font-semibold text-on-action shadow-lg shadow-brand-500/20 transition hover:bg-action-hover focus:outline-none focus:ring-2 focus:ring-focus active:translate-y-px"><Plus className="h-3.5 w-3.5" />New project</button>}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-content-muted">
              <span className="inline-flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${syncTone}`} aria-hidden="true" />{syncLabel}</span>
              <span className="hidden h-3 w-px bg-surface-raised sm:block" aria-hidden="true" />
              <span>{projects.length} visible project{projects.length === 1 ? '' : 's'}</span>
              {activeWorkspace?.memberCount !== undefined && <><span className="hidden h-3 w-px bg-surface-raised sm:block" aria-hidden="true" /><span>{activeWorkspace.memberCount} workspace member{activeWorkspace.memberCount === 1 ? '' : 's'}</span></>}
            </div>
          </div>
        </header>

        <section aria-label="Workspace summary" className="grid grid-cols-2 divide-y divide-divider border-y border-divider py-2 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <MetricCard label="Active projects" value={allActiveProjects.length} detail={projects.length === allActiveProjects.length ? 'Across the workspace' : `${projects.length} total visible`} icon={FolderKanban} onClick={() => setActiveTab('projects')} />
          <MetricCard label={role === 'dev' ? 'Assigned tasks' : 'Open tasks'} value={openIssues.length} detail={reviewIssues.length > 0 ? `${reviewIssues.length} ready for review` : 'Nothing waiting for review'} icon={ListChecks} tone={reviewIssues.length > 0 ? 'amber' : 'brand'} onClick={() => setActiveTab('issues')} />
          <MetricCard label="Needs attention" value={attentionCount} detail={attentionCount === 0 ? 'You are all caught up' : 'Unread items and delivery decisions'} icon={attentionCount > 0 ? AlertCircle : CheckCircle2} tone={attentionCount > 0 ? 'amber' : 'emerald'} onClick={() => setActiveTab(attentionCount > 0 ? 'inbox' : 'projects')} />
          <MetricCard label="Delivery progress" value={`${deliveryProgress}%`} detail={issues.length > 0 ? `${completedIssues} of ${issues.length} tasks complete` : 'Progress appears as work is added'} icon={Activity} tone={deliveryProgress === 100 && issues.length > 0 ? 'emerald' : 'brand'} onClick={role === 'pm' || role === 'admin' ? () => setActiveTab('analytics') : undefined} />
        </section>

        <div className="grid min-h-0 grid-cols-1 gap-5 overflow-y-auto sm:grid-cols-[minmax(0,1.45fr)_minmax(260px,1fr)] sm:overflow-hidden">
          <section className="min-h-0 overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-divider pb-3">
              <div>
                <SectionLabel>Delivery</SectionLabel>
                <h2 className="mt-1 text-base font-semibold tracking-tight text-content">Active projects</h2>
              </div>
              <button type="button" onClick={() => setActiveTab('projects')} className="inline-flex items-center gap-1.5 pt-1 text-xs font-medium text-content-secondary transition hover:text-content focus:outline-none focus:ring-2 focus:ring-focus">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {activeProjects.length > 0 ? (
              <div>
                {activeProjects.map(project => <ProjectRow key={project.id} project={project} issues={issueIndex[project.id] ?? []} onOpen={() => setActiveTab('projects')} />)}
              </div>
            ) : (
              <div className="py-6">
                <div className="flex items-start gap-4">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center text-link"><Sparkles className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-content">{can('create_project') ? 'Start with your first project' : 'No assigned projects yet'}</h3>
                    <p className="mt-1 max-w-lg text-xs leading-5 text-content-muted">
                      {can('create_project')
                        ? 'Create the delivery boundary first. You can connect a repository, add milestones, and staff the work from there.'
                        : 'Projects become available here when a project manager assigns you work in this workspace.'}
                    </p>
                    {can('create_project') && <button type="button" onClick={() => setActiveTab('projects')} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-surface-raised px-3 py-2 text-xs font-medium text-content transition hover:bg-surface-high hover:text-content focus:outline-none focus:ring-2 focus:ring-focus"><Plus className="h-3.5 w-3.5" />Create project</button>}
                  </div>
                </div>
              </div>
            )}
          </section>

          <div className="grid min-h-0 grid-cols-1 gap-5 sm:grid-rows-[minmax(0,1fr)_auto]">
          <section className="min-h-0 overflow-hidden">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SectionLabel>Focus</SectionLabel>
                <h2 className="mt-1 text-base font-semibold tracking-tight text-content">Needs attention</h2>
              </div>
              {attentionCount > 0 && <span className="rounded-md bg-status-warning-subtle px-2 py-1 font-mono text-[10px] tabular-nums text-status-warning">{attentionCount}</span>}
            </div>

            <div className="mt-4 space-y-1">
              {pendingDocs.length > 0 && <AttentionRow icon={GitBranch} tone="amber" title={`${pendingDocs.length} specification${pendingDocs.length === 1 ? '' : 's'} need review`} detail="Refine scope before work starts." onClick={() => setActiveTab('documents')} />}
              {reviewIssues.length > 0 && <AttentionRow icon={ListChecks} tone="amber" title={`${reviewIssues.length} task${reviewIssues.length === 1 ? '' : 's'} ready for review`} detail="Check the latest work before it moves on." onClick={() => setActiveTab('issues')} />}
              {failedDeployments.length > 0 && <AttentionRow icon={Rocket} tone="rose" title={`${failedDeployments.length} deployment${failedDeployments.length === 1 ? '' : 's'} failed`} detail="Open delivery history to inspect the failure." onClick={() => setActiveTab('deployments')} />}
              {unreadInbox.length > 0 && <AttentionRow icon={Inbox} tone="brand" title={`${unreadInbox.length} unread inbox item${unreadInbox.length === 1 ? '' : 's'}`} detail="Approvals and updates are waiting for you." onClick={() => setActiveTab('inbox')} />}
              {attentionCount === 0 && <div className="flex items-start gap-3 py-4"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-status-success" /><div><p className="text-sm font-medium text-status-success">You are all caught up</p><p className="mt-1 text-xs leading-5 text-content-muted">New decisions and delivery updates will appear here.</p></div></div>}
            </div>
          </section>
          <div className="grid grid-cols-1 gap-5 border-t border-divider pt-3 xl:grid-cols-2">
        <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <SectionLabel>Workspace health</SectionLabel>
                <h2 className="mt-1 text-base font-semibold tracking-tight text-content">System pulse</h2>
              </div>
              <Activity className="h-4 w-4 text-content-muted" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
              <PulseStat icon={Bot} label="Agents" value={agents.filter(agent => !agent.isArchived).length} />
              <PulseStat icon={Bot} label="Building" value={issues.filter(issue => issue.status === 'agent_running').length} />
              <PulseStat icon={Activity} label="Runs · 24h" value={analytics.totalRuns24h} />
              <PulseStat icon={CheckCircle2} label="Success rate" value={`${analytics.successRate}%`} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-divider pt-3 text-[11px] text-content-muted">
              <span className="inline-flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${serverStatus === 'online' ? 'bg-emerald-400' : serverStatus === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-rose-400'}`} />{serverStatus === 'online' ? 'Alpha daemon online' : serverStatus === 'connecting' ? 'Connecting to Alpha daemon' : 'Alpha daemon offline'}</span>
              <span className="hidden h-3 w-px bg-surface-raised sm:block" aria-hidden="true" />
              <span>{analytics.totalAgentRuns} total run{analytics.totalAgentRuns === 1 ? '' : 's'} tracked</span>
            </div>
        </div>

          <section className="border-t border-divider pt-3">
            <div>
              <SectionLabel>Shortcuts</SectionLabel>
              <h2 className="mt-1 text-base font-semibold tracking-tight text-content">Move work forward</h2>
            </div>
            <div className="mt-3 grid gap-x-4 gap-y-1 sm:grid-cols-2">
              {quickActions.map(action => {
                const Icon = action.icon;
                return <button key={action.label} type="button" onClick={() => setActiveTab(action.tab)} className="group flex min-h-[40px] items-start gap-2.5 py-2 text-left transition-colors hover:text-content focus:outline-none focus:ring-2 focus:ring-focus"><span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center text-content-muted transition-colors group-hover:text-link-hover"><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-xs font-medium text-content">{action.label}</span><span className="mt-1 hidden text-[11px] leading-4 text-content-muted xl:block">{action.detail}</span></span></button>;
              })}
            </div>
          </section>
          </div>
        </div>
      </div>
    </div>
      </div>
  );
};

const AttentionRow: React.FC<{
  icon: React.ElementType;
  tone: 'brand' | 'amber' | 'rose';
  title: string;
  detail: string;
  onClick: () => void;
}> = ({ icon: Icon, tone, title, detail, onClick }) => {
  const toneStyles = {
    brand: 'bg-selected text-selected-content',
    amber: 'bg-status-warning-subtle text-status-warning',
    rose: 'bg-status-danger-subtle text-status-danger',
  }[tone];
  return <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 border-b border-divider py-2.5 text-left transition hover:bg-surface-high focus:outline-none focus:ring-2 focus:ring-focus"><span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center ${toneStyles}`}><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-content">{title}</span><span className="mt-0.5 block truncate text-[11px] text-content-muted">{detail}</span></span><ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-content-muted transition-transform group-hover:translate-x-0.5 group-hover:text-content-secondary" /></button>;
};

const PulseStat: React.FC<{ icon: React.ElementType; label: string; value: string | number }> = ({ icon: Icon, label, value }) => <div className="flex items-center gap-2 border-l border-divider pl-2 first:border-0 first:pl-0"><Icon className="h-3.5 w-3.5 flex-shrink-0 text-content-muted" /><span className="font-mono text-base font-semibold tabular-nums text-content">{value}</span><span className="truncate text-[10px] text-content-muted">{label}</span></div>;
