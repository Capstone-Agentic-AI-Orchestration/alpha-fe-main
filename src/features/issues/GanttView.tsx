import React, { useMemo } from 'react';
import { CalendarDays, Circle, Diamond, Link2 } from 'lucide-react';
import type { Issue, Project } from '@/shared/types';

interface GanttViewProps {
  project?: Project;
  issues: Issue[];
  canManageIssues: boolean;
  onOpenIssue: (issueId: string) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_WIDTH = 28;
const ROW_HEIGHT = 56;

function dayNumber(value?: string | null): number | undefined {
  const key = value?.slice(0, 10);
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return undefined;
  const timestamp = Date.parse(`${key}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== key) return undefined;
  return Math.floor(timestamp / DAY_MS);
}

function dateKey(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

function dateLabel(day: number, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(new Date(day * DAY_MS));
}

function mondayOf(day: number): number {
  const weekday = new Date(day * DAY_MS).getUTCDay();
  return day - ((weekday + 6) % 7);
}

function statusLabel(status: Issue['status']): string {
  return status.replace('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function priorityLabel(priority: Issue['priority']): string {
  return priority === 'none' ? 'No priority' : priority.replace(/\b\w/g, letter => letter.toUpperCase());
}

const BAR_COLOR: Record<Issue['status'], string> = {
  backlog: 'bg-surface-high text-content-secondary',
  todo: 'bg-link text-on-action',
  in_progress: 'bg-status-warning text-content',
  agent_running: 'bg-status-info text-on-action',
  review: 'bg-selected text-selected-content',
  done: 'bg-status-success text-on-action'
};

type ChartRow =
  | { kind: 'task'; issue: Issue; start: number; end: number }
  | { kind: 'milestone'; id: string; title: string; day: number; completed: boolean };

export const GanttView: React.FC<GanttViewProps> = ({ project, issues, canManageIssues, onOpenIssue }) => {
  const model = useMemo(() => {
    const tasks: ChartRow[] = [];
    const unscheduled: Issue[] = [];
    const days: number[] = [];

    for (const issue of issues) {
      const start = dayNumber(issue.plannedStartDate);
      const end = dayNumber(issue.plannedEndDate);
      if (start !== undefined && end !== undefined && end >= start) {
        tasks.push({ kind: 'task', issue, start, end });
        days.push(start, end);
      } else {
        unscheduled.push(issue);
      }
    }

    const milestones: ChartRow[] = (project?.milestones ?? []).flatMap(milestone => {
      const day = dayNumber(milestone.targetDate);
      if (day === undefined) return [];
      days.push(day);
      return [{ kind: 'milestone' as const, id: milestone.id, title: milestone.title, day, completed: milestone.completed }];
    });

    const projectStart = dayNumber(project?.startDate);
    const projectEnd = dayNumber(project?.targetDate);
    if (projectStart !== undefined) days.push(projectStart);
    if (projectEnd !== undefined) days.push(projectEnd);

    const rows = [...tasks, ...milestones].sort((left, right) => {
      const leftDay = left.kind === 'task' ? left.start : left.day;
      const rightDay = right.kind === 'task' ? right.start : right.day;
      return leftDay - rightDay || (left.kind === right.kind ? 0 : left.kind === 'milestone' ? -1 : 1);
    });

    if (!days.length) {
      return { rows, unscheduled, startDay: undefined, dayCount: 0, timelineWidth: 0, todayDay: undefined };
    }

    const startDay = mondayOf(Math.min(...days) - 7);
    const endDay = mondayOf(Math.max(...days) + 7) + 6;
    const dayCount = endDay - startDay + 1;
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayDay = dayNumber(localToday)!;
    return {
      rows,
      unscheduled,
      startDay,
      dayCount,
      timelineWidth: dayCount * DAY_WIDTH,
      todayDay: todayDay >= startDay && todayDay <= endDay ? todayDay : undefined
    };
  }, [issues, project]);

  const issueById = useMemo(() => new Map(issues.map(issue => [issue.id, issue])), [issues]);
  const rowIndexByIssueId = new Map<string, number>();
  model.rows.forEach((row, index) => {
    if (row.kind === 'task') rowIndexByIssueId.set(row.issue.id, index);
  });

  const plotHeight = Math.max(ROW_HEIGHT, model.rows.length * ROW_HEIGHT);
  const todayOffset = model.todayDay !== undefined && model.startDay !== undefined
    ? (model.todayDay - model.startDay) * DAY_WIDTH + DAY_WIDTH / 2
    : undefined;

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-surface px-4 py-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-content-muted">
        <div className="flex items-center gap-2">
          <CalendarDays aria-hidden="true" className="h-4 w-4 text-content-secondary" />
          <span>{project?.name ? `${project.name} schedule` : 'Project schedule'}</span>
          <span aria-hidden="true">·</span>
          <span>{issues.length} tasks</span>
          {(project?.milestones?.length ?? 0) > 0 && <span>· {project?.milestones?.length} milestones</span>}
        </div>
        <span>Dates are planning dates; changing them does not move or reschedule work automatically.</span>
      </div>

      {model.startDay !== undefined && model.dayCount > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-divider">
          <div
            className="grid min-w-max"
            style={{ gridTemplateColumns: `minmax(250px, 290px) ${model.timelineWidth}px` }}
          >
            <div className="sticky left-0 z-20 flex h-10 items-center border-b border-r border-divider bg-surface-raised px-3 text-[11px] font-semibold uppercase tracking-wide text-content-muted">
              Task / milestone
            </div>
            <div className="relative flex h-10 border-b border-divider bg-surface-raised" style={{ width: model.timelineWidth }}>
              {Array.from({ length: model.dayCount }, (_, index) => {
                const day = model.startDay! + index;
                const isMonday = new Date(day * DAY_MS).getUTCDay() === 1;
                return (
                  <div key={day} className="relative h-full shrink-0 border-r border-divider/60" style={{ width: DAY_WIDTH }}>
                    {isMonday && <span className="absolute left-1 top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] font-medium text-content-secondary">{dateLabel(day, { month: 'short', day: 'numeric' })}</span>}
                  </div>
                );
              })}
            </div>

            <div className="sticky left-0 z-10">
              {model.rows.length === 0 ? (
                <div className="flex h-14 items-center border-b border-r border-divider bg-surface px-3 text-[12px] text-content-muted">
                  No dated tasks or milestones yet. Open an unscheduled task to add dates.
                </div>
              ) : model.rows.map(row => row.kind === 'task' ? (
                <button
                  key={row.issue.id}
                  type="button"
                  onClick={() => onOpenIssue(row.issue.id)}
                  className="flex h-14 w-full flex-col justify-center border-b border-r border-divider bg-surface px-3 text-left hover:bg-surface-high focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                  aria-label={`Open ${row.issue.identifier}: ${row.issue.title}`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 font-mono text-[10px] text-content-muted">{row.issue.identifier}</span>
                    <span className="truncate text-[12px] font-medium text-content">{row.issue.title}</span>
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] text-content-muted">
                    <span className="truncate">{row.issue.assignedHuman || 'Unassigned'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="shrink-0">{statusLabel(row.issue.status)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="shrink-0">{priorityLabel(row.issue.priority)}</span>
                    {(row.issue.dependsOnIssueIds?.length ?? 0) > 0 && (
                      <span
                        className="ml-auto inline-flex shrink-0 items-center gap-0.5"
                        title={`Depends on: ${(row.issue.dependsOnIssueIds ?? []).map(id => issueById.get(id)?.identifier ?? id).join(', ')}`}
                      >
                        <Link2 aria-hidden="true" className="h-3 w-3" />{row.issue.dependsOnIssueIds?.length}
                      </span>
                    )}
                  </span>
                </button>
              ) : (
                <div key={row.id} className="flex h-14 items-center gap-2 border-b border-r border-divider bg-surface px-3">
                  <Diamond aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 ${row.completed ? 'fill-status-success text-status-success' : 'fill-status-warning text-status-warning'}`} />
                  <span className="truncate text-[12px] font-medium text-content">{row.title}</span>
                  <span className="ml-auto text-[10px] text-content-muted">{row.completed ? 'Done' : 'Milestone'}</span>
                </div>
              ))}
            </div>

            <div className="relative" style={{ width: model.timelineWidth, height: plotHeight }}>
              <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${DAY_WIDTH - 1}px, rgba(128, 128, 128, 0.16) ${DAY_WIDTH - 1}px, rgba(128, 128, 128, 0.16) ${DAY_WIDTH}px)`,
                  backgroundSize: `${DAY_WIDTH}px 100%`
                }}
              />
              {model.rows.map((_, index) => <div key={`row-${index}`} className="absolute inset-x-0 border-b border-divider" style={{ top: (index + 1) * ROW_HEIGHT }} />)}
              {todayOffset !== undefined && <div aria-label="Today" className="absolute inset-y-0 z-[5] w-px bg-status-danger/70" style={{ left: todayOffset }} />}

              <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[6] h-full w-full overflow-visible" width={model.timelineWidth} height={plotHeight}>
                {model.rows.map((row, index) => {
                  if (row.kind !== 'task') return null;
                  return (row.issue.dependsOnIssueIds ?? []).map(dependencyId => {
                    const dependencyRow = rowIndexByIssueId.get(dependencyId);
                    const dependency = issueById.get(dependencyId);
                    if (dependencyRow === undefined || !dependency?.plannedEndDate) return null;
                    const dependencyEnd = dayNumber(dependency.plannedEndDate);
                    const dependentStart = dayNumber(row.issue.plannedStartDate);
                    if (dependencyEnd === undefined || dependentStart === undefined) return null;
                    const x1 = (dependencyEnd - model.startDay! + 1) * DAY_WIDTH - 2;
                    const x2 = (dependentStart - model.startDay!) * DAY_WIDTH + 3;
                    const y1 = dependencyRow * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const y2 = index * ROW_HEIGHT + ROW_HEIGHT / 2;
                    return (
                      <path
                        key={`${dependencyId}-${row.issue.id}`}
                        d={`M ${x1} ${y1} H ${x1 + 8} V ${y2} H ${x2 - 5} M ${x2 - 8} ${y2 - 3} L ${x2 - 5} ${y2} L ${x2 - 8} ${y2 + 3}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className="text-content-muted opacity-70"
                      />
                    );
                  });
                })}
              </svg>

              {model.rows.map((row, index) => {
                if (row.kind === 'milestone') {
                  const left = ((row.day - model.startDay!) + 0.5) * DAY_WIDTH;
                  return (
                    <div key={row.id} className="absolute z-10" style={{ left: left - 7, top: index * ROW_HEIGHT + 21 }}>
                      <span
                        role="img"
                        aria-label={`${row.title}, ${row.completed ? 'completed' : 'milestone'} on ${dateKey(row.day)}`}
                        title={`${row.title} · ${dateLabel(row.day, { month: 'short', day: 'numeric', year: 'numeric' })}${row.completed ? ' · Completed' : ''}`}
                        className={`block h-3.5 w-3.5 rotate-45 border-2 border-surface-raised ${row.completed ? 'bg-status-success' : 'bg-status-warning'}`}
                      />
                    </div>
                  );
                }

                const left = (row.start - model.startDay!) * DAY_WIDTH + 2;
                const width = Math.max(DAY_WIDTH - 4, (row.end - row.start + 1) * DAY_WIDTH - 4);
                return (
                  <button
                    type="button"
                    onClick={() => onOpenIssue(row.issue.id)}
                    key={row.issue.id}
                    className={`absolute z-10 flex h-6 items-center overflow-hidden rounded-full px-2 text-[10px] font-semibold shadow-sm hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${BAR_COLOR[row.issue.status]}`}
                    style={{ left, width, top: index * ROW_HEIGHT + 15 }}
                    title={`${row.issue.identifier} · ${row.issue.title}\n${dateLabel(row.start, { month: 'short', day: 'numeric' })} – ${dateLabel(row.end, { month: 'short', day: 'numeric' })}`}
                    aria-label={`${row.issue.title}, ${dateKey(row.start)} to ${dateKey(row.end)}`}
                  >
                    {width >= 74 && <span className="truncate">{row.issue.identifier}</span>}
                  </button>
                );
              })}

            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-divider bg-surface-raised px-4 py-5 text-[13px] text-content-secondary">
          <p className="font-medium text-content">Add task dates to build the timeline</p>
          <p className="mt-1 text-content-muted">Open a task and set its start and end dates. Tasks can stay unscheduled until the team is ready to plan them.</p>
        </div>
      )}

      <section aria-labelledby="gantt-unscheduled-title" className="mt-5 overflow-hidden rounded-lg border border-divider">
        <div className="flex items-center justify-between border-b border-divider bg-surface-raised px-3 py-2">
          <h2 id="gantt-unscheduled-title" className="text-[12px] font-semibold text-content">Unscheduled</h2>
          <span className="text-[11px] tabular-nums text-content-muted">{model.unscheduled.length}</span>
        </div>
        {model.unscheduled.length === 0 ? (
          <p className="px-3 py-3 text-[12px] text-content-muted">Every task in this project has a start and end date.</p>
        ) : (
          <ul className="divide-y divide-divider">
            {model.unscheduled.map(issue => (
              <li key={issue.id}>
                <button type="button" onClick={() => onOpenIssue(issue.id)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-high">
                  <Circle aria-hidden="true" className="h-3 w-3 shrink-0 text-content-muted" />
                  <span className="shrink-0 font-mono text-[10px] text-content-muted">{issue.identifier}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-content">{issue.title}</span>
                  <span className="hidden text-[11px] text-content-muted sm:inline">{issue.assignedHuman || 'Unassigned'}</span>
                  <span className="rounded-full bg-surface-high px-2 py-0.5 text-[10px] text-content-secondary">{statusLabel(issue.status)}</span>
                  <span className="hidden text-[11px] text-content-muted md:inline">{priorityLabel(issue.priority)}</span>
                  {canManageIssues && <span className="text-[10px] font-medium text-link">Set dates</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
