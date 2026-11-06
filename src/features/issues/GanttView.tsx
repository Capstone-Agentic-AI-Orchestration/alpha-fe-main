import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  Circle,
  Diamond,
  GitBranch,
  Link2,
  List,
  Kanban,
  Minus,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users
} from 'lucide-react';
import type { Issue, Project } from '@/shared/types';

interface GanttViewProps {
  project?: Project;
  issues: Issue[];
  canManageIssues: boolean;
  onOpenIssue: (issueId: string) => void;
  onChangeView?: (view: 'list' | 'board' | 'gantt') => void;
  onOpenNewIssue?: () => void;
  onToggleFilters?: () => void;
  filtersActive?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_WIDTH = 36;
const WEEK_WIDTH = 16;
const TASK_COLUMN_WIDTH = 330;
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

function isOverdue(issue: Issue): boolean {
  if (!issue.dueDate || issue.status === 'done') return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return issue.dueDate < today;
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

function scheduleLabel(issue: Issue): string {
  const start = dayNumber(issue.plannedStartDate);
  const end = dayNumber(issue.plannedEndDate);
  const due = dayNumber(issue.dueDate);
  if (start !== undefined && end !== undefined) {
    return `${dateLabel(start, { month: 'short', day: 'numeric' })} – ${dateLabel(end, { month: 'short', day: 'numeric' })}`;
  }
  if (due !== undefined) return `Due ${dateLabel(due, { month: 'short', day: 'numeric' })}`;
  return 'Unscheduled';
}

const STATUS_DOT: Record<Issue['status'], string> = {
  backlog: 'bg-content-muted',
  todo: 'bg-link',
  in_progress: 'bg-status-warning',
  agent_running: 'bg-status-info',
  review: 'bg-selected',
  done: 'bg-status-success'
};

type ChartRow =
  | { kind: 'task'; issue: Issue; start?: number; end?: number; dueDay?: number }
  | { kind: 'milestone'; id: string; title: string; day: number; completed: boolean };

interface MonthSegment {
  start: number;
  days: number;
  label: string;
}

function monthSegments(startDay: number, endDay: number): MonthSegment[] {
  const segments: MonthSegment[] = [];
  for (let day = startDay; day <= endDay;) {
    const date = new Date(day * DAY_MS);
    const monthEnd = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0) / DAY_MS);
    const segmentEnd = Math.min(monthEnd, endDay);
    segments.push({
      start: day,
      days: segmentEnd - day + 1,
      label: dateLabel(day, { month: 'long', year: 'numeric' })
    });
    day = segmentEnd + 1;
  }
  return segments;
}

export const GanttView: React.FC<GanttViewProps> = ({
  project,
  issues,
  canManageIssues,
  onOpenIssue,
  onChangeView,
  onOpenNewIssue,
  onToggleFilters,
  filtersActive = false
}) => {
  const [scale, setScale] = useState<'days' | 'weeks'>('weeks');
  const timelineRef = useRef<HTMLDivElement>(null);
  const model = useMemo(() => {
    const tasks: ChartRow[] = [];
    const unscheduled: Issue[] = [];
    const days: number[] = [];

    for (const issue of issues) {
      const start = dayNumber(issue.plannedStartDate);
      const end = dayNumber(issue.plannedEndDate);
      const dueDay = dayNumber(issue.dueDate);
      if (start !== undefined && end !== undefined && end >= start) {
        tasks.push({ kind: 'task', issue, start, end, dueDay });
        days.push(start, end);
      } else {
        unscheduled.push(issue);
        if (dueDay !== undefined) tasks.push({ kind: 'task', issue, dueDay });
      }
      if (dueDay !== undefined) days.push(dueDay);
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
      const leftDay = left.kind === 'task' ? left.start ?? left.dueDay ?? 0 : left.day;
      const rightDay = right.kind === 'task' ? right.start ?? right.dueDay ?? 0 : right.day;
      return leftDay - rightDay || (left.kind === right.kind ? 0 : left.kind === 'milestone' ? -1 : 1);
    });

    if (!days.length) {
      return { rows, unscheduled, startDay: undefined, endDay: undefined, dayCount: 0, todayDay: undefined, projectTargetDay: undefined };
    }

    const startDay = mondayOf(Math.min(...days) - 7);
    const endDay = mondayOf(Math.max(...days) + 7) + 6;
    const dayCount = endDay - startDay + 1;
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const today = dayNumber(localToday)!;
    return {
      rows,
      unscheduled,
      startDay,
      endDay,
      dayCount,
      todayDay: today >= startDay && today <= endDay ? today : undefined,
      projectTargetDay: projectEnd
    };
  }, [issues, project]);

  const issueById = useMemo(() => new Map(issues.map(issue => [issue.id, issue])), [issues]);
  const rowIndexByIssueId = new Map<string, number>();
  model.rows.forEach((row, index) => {
    if (row.kind === 'task') rowIndexByIssueId.set(row.issue.id, index);
  });

  const dayWidth = scale === 'days' ? DAY_WIDTH : WEEK_WIDTH;
  const timelineWidth = model.dayCount * dayWidth;
  const plotHeight = Math.max(ROW_HEIGHT, model.rows.length * ROW_HEIGHT);
  const todayOffset = model.todayDay !== undefined && model.startDay !== undefined
    ? (model.todayDay - model.startDay) * dayWidth + dayWidth / 2
    : undefined;
  const projectTargetOffset = model.projectTargetDay !== undefined && model.startDay !== undefined
    ? (model.projectTargetDay - model.startDay) * dayWidth + dayWidth / 2
    : undefined;
  const firstRow = model.rows[0];
  const focusDay = (firstRow?.kind === 'task' ? firstRow.start ?? firstRow.dueDay : firstRow?.day) ?? (model.startDay !== undefined ? model.startDay + 7 : undefined);
  const focusOffset = focusDay !== undefined && model.startDay !== undefined
    ? (focusDay - model.startDay) * dayWidth + dayWidth / 2
    : undefined;
  const months = model.startDay !== undefined && model.endDay !== undefined
    ? monthSegments(model.startDay, model.endDay)
    : [];

  const scrollToToday = () => {
    const viewport = timelineRef.current;
    if (!viewport || todayOffset === undefined) return;
    const visibleTimelineWidth = Math.max(0, viewport.clientWidth - TASK_COLUMN_WIDTH);
    viewport.scrollTo({
      left: Math.max(0, todayOffset - visibleTimelineWidth / 2),
      behavior: 'smooth'
    });
  };

  const fitTimeline = () => {
    const viewport = timelineRef.current;
    if (!viewport || focusOffset === undefined) return;
    const visibleTimelineWidth = Math.max(0, viewport.clientWidth - TASK_COLUMN_WIDTH);
    viewport.scrollTo({
      left: Math.max(0, focusOffset - visibleTimelineWidth / 2),
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    const viewport = timelineRef.current;
    if (!viewport || focusOffset === undefined) return;
    const visibleTimelineWidth = Math.max(0, viewport.clientWidth - TASK_COLUMN_WIDTH);
    viewport.scrollLeft = Math.max(0, focusOffset - visibleTimelineWidth / 2);
  }, [focusOffset, scale]);

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-shell">
      <div className="border-b border-divider bg-surface px-5 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-[20px] font-semibold leading-tight tracking-[-0.02em] text-content">
              {project?.name || 'Project planning'}
            </h1>
            <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-content-muted" />
          </div>
          <div className="flex items-center gap-3 text-[11px] text-content-muted">
            <span className="hidden items-center gap-1.5 sm:inline-flex">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-status-info" />
              {issues.length} {issues.length === 1 ? 'task' : 'tasks'}
            </span>
            {(project?.milestones?.length ?? 0) > 0 && (
              <span className="hidden sm:inline">{project?.milestones?.length} milestones</span>
            )}
          </div>
        </div>

        <nav className="mt-3 flex items-center gap-5 overflow-x-auto text-[12px]" aria-label="Project views">
          <button
            type="button"
            onClick={() => onChangeView?.('list')}
            className="flex shrink-0 items-center gap-1.5 border-b-2 border-transparent pb-2.5 font-medium text-content-muted transition-colors hover:text-content"
          >
            <List aria-hidden="true" className="h-3.5 w-3.5" />
            Main table
          </button>
          <button
            type="button"
            onClick={() => onChangeView?.('board')}
            className="flex shrink-0 items-center gap-1.5 border-b-2 border-transparent pb-2.5 font-medium text-content-muted transition-colors hover:text-content"
          >
            <Kanban aria-hidden="true" className="h-3.5 w-3.5" />
            Board
          </button>
          <button
            type="button"
            aria-current="page"
            className="flex shrink-0 items-center gap-1.5 border-b-2 border-link pb-2.5 font-semibold text-content"
          >
            <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
            Gantt
          </button>
          <span aria-hidden="true" className="pb-2.5 text-content-muted">···</span>
        </nav>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider bg-surface px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {onOpenNewIssue && (
            <button
              type="button"
              onClick={onOpenNewIssue}
              className="inline-flex items-center gap-1.5 rounded-md bg-action px-3 py-1.5 text-[12px] font-semibold text-on-action shadow-sm transition-colors hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
              New task
              <ChevronDown aria-hidden="true" className="ml-0.5 h-3 w-3 opacity-80" />
            </button>
          )}
          {onToggleFilters && (
            <button
              type="button"
              onClick={onToggleFilters}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${filtersActive ? 'border-link bg-selected text-selected-content' : 'border-divider text-content-secondary hover:bg-surface-high hover:text-content'}`}
            >
              <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
              Filter
            </button>
          )}
          <button
            type="button"
            onClick={onToggleFilters}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-content-secondary transition-colors hover:bg-surface-high hover:text-content"
            title="Open task search and filters"
          >
            <Search aria-hidden="true" className="h-3.5 w-3.5" />
            Search
          </button>
          <span className="hidden h-5 w-px bg-divider sm:block" aria-hidden="true" />
          <span className="hidden items-center gap-1.5 text-[11px] text-content-muted sm:inline-flex">
            <Users aria-hidden="true" className="h-3.5 w-3.5" />
            Project schedule
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-content-muted">
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-status-warning" />
          <span>Planning view</span>
        </div>
      </div>

      <main className="px-5 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-semibold text-content">Gantt</h2>
              <button type="button" onClick={onToggleFilters} className="rounded p-1 text-content-muted transition-colors hover:bg-surface-high hover:text-content" title="Filter timeline">
                <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-0.5 text-[11px] text-content-muted">Plan delivery dates, dependencies, milestones, and deadlines.</p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" disabled className="hidden items-center gap-1.5 rounded-md border border-divider px-2.5 py-1.5 text-[11px] font-medium text-content-muted opacity-60 sm:inline-flex" title="Baselines are not configured for this project">
              <span aria-hidden="true" className="h-3.5 w-3.5 rounded-sm border border-current" />
              Baseline
            </button>
            <button type="button" onClick={fitTimeline} className="inline-flex items-center gap-1.5 rounded-md border border-divider bg-surface-raised px-2.5 py-1.5 text-[11px] font-medium text-content-secondary transition-colors hover:bg-surface-high hover:text-content">
              Auto fit
            </button>
            <div role="group" aria-label="Timeline scale" className="inline-flex items-center rounded-md border border-divider bg-surface-raised p-0.5">
              <button type="button" aria-label="Zoom out" onClick={() => setScale('weeks')} className="rounded p-1.5 text-content-muted transition-colors hover:bg-surface-high hover:text-content"><Minus aria-hidden="true" className="h-3.5 w-3.5" /></button>
              <button type="button" aria-pressed={scale === 'weeks'} onClick={() => setScale('weeks')} className={`min-w-[54px] rounded px-2 py-1 text-[11px] font-medium transition-colors ${scale === 'weeks' ? 'bg-selected text-selected-content' : 'text-content-secondary hover:bg-surface-high hover:text-content'}`}>Weeks</button>
              <button type="button" aria-pressed={scale === 'days'} onClick={() => setScale('days')} className={`min-w-[46px] rounded px-2 py-1 text-[11px] font-medium transition-colors ${scale === 'days' ? 'bg-selected text-selected-content' : 'text-content-secondary hover:bg-surface-high hover:text-content'}`}>Days</button>
              <button type="button" aria-label="Zoom in" onClick={() => setScale('days')} className="rounded p-1.5 text-content-muted transition-colors hover:bg-surface-high hover:text-content"><Plus aria-hidden="true" className="h-3.5 w-3.5" /></button>
            </div>
            <button type="button" onClick={scrollToToday} disabled={todayOffset === undefined} className="inline-flex items-center gap-1.5 rounded-md border border-divider bg-surface-raised px-2.5 py-1.5 text-[11px] font-medium text-content-secondary transition-colors hover:bg-surface-high hover:text-content disabled:cursor-not-allowed disabled:opacity-40" title={todayOffset === undefined ? 'Today is outside this schedule range' : 'Scroll to today'}>
              Today
            </button>
            <button type="button" className="rounded-md border border-divider p-1.5 text-content-muted transition-colors hover:bg-surface-high hover:text-content" title="More timeline options">
              <MoreHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-content-muted" aria-label="Timeline legend">
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-3.5 rounded-[3px] bg-link" />Task duration</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rotate-45 border border-status-warning bg-status-warning-subtle" />Milestone</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border-2 border-status-danger bg-status-danger-subtle" />Task deadline</span>
          {project?.targetDate && <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3.5 border-l border-dashed border-status-warning" />Project target</span>}
          <span className="inline-flex items-center gap-1.5"><Link2 aria-hidden="true" className="h-3.5 w-3.5" />Dependency</span>
        </div>

      {model.startDay !== undefined && model.endDay !== undefined && model.dayCount > 0 ? (
        <div ref={timelineRef} className="overflow-x-auto rounded-lg border border-divider bg-surface-raised">
          <div
            className="grid min-w-max"
            style={{ gridTemplateColumns: `minmax(200px, ${TASK_COLUMN_WIDTH}px) ${timelineWidth}px` }}
          >
            <div className="sticky left-0 z-30 row-span-2 flex h-[72px] flex-col justify-center border-b border-r border-divider bg-surface-raised px-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-content-secondary">Task</span>
              <span className="mt-1 text-[11px] text-content-muted">Schedule · owner · status</span>
            </div>

            <div className="relative h-8 border-b border-divider bg-surface-high/50" style={{ width: timelineWidth }}>
              {months.map(month => (
                <div
                  key={`${month.start}-${month.label}`}
                  className="absolute inset-y-0 flex items-center overflow-hidden border-r border-divider px-2 text-[11px] font-semibold text-content-secondary"
                  style={{ left: (month.start - model.startDay!) * dayWidth, width: month.days * dayWidth }}
                >
                  <span className="hidden truncate sm:inline">{month.label}</span>
                </div>
              ))}
            </div>

            <div className="relative flex h-10 border-b border-divider bg-surface-raised" style={{ width: timelineWidth }}>
              {Array.from({ length: model.dayCount }, (_, index) => {
                const day = model.startDay! + index;
                const weekday = new Date(day * DAY_MS).getUTCDay();
                const isWeekend = weekday === 0 || weekday === 6;
                const isMonday = weekday === 1;
                const isToday = day === model.todayDay;
                return (
                  <div
                    key={day}
                    className={`relative flex h-full shrink-0 flex-col items-center justify-center border-r border-divider/60 ${isMonday ? 'border-l border-l-divider' : ''} ${isWeekend ? 'bg-surface-high/60' : ''} ${isToday ? 'bg-selected text-selected-content' : ''}`}
                    style={{ width: dayWidth }}
                    aria-label={dateLabel(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    title={dateLabel(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  >
                    {scale === 'days' ? (
                      <>
                        <span className={`text-[11px] leading-none ${isToday ? 'font-semibold' : 'text-content-muted'}`}>{dateLabel(day, { weekday: 'short' })}</span>
                        <span className="mt-1 text-[12px] font-medium tabular-nums">{dateLabel(day, { day: 'numeric' })}</span>
                      </>
                    ) : isMonday ? (
                      <span className={`absolute left-1 top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-medium tabular-nums ${isToday ? 'text-selected-content' : 'text-content-secondary'}`}>
                        {dateLabel(day, { month: 'short', day: 'numeric' })}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="sticky left-0 z-20">
              {model.rows.length === 0 ? (
                <div className="flex h-14 items-center border-b border-r border-divider bg-surface px-3 text-[11px] text-content-muted">
                  No dated tasks or milestones yet. Add a task due date or schedule dates to see the timeline.
                </div>
              ) : model.rows.map(row => row.kind === 'task' ? (
                (() => {
                  const parent = row.issue.parentIssueId ? issueById.get(row.issue.parentIssueId) : undefined;
                  return (
                    <button
                      key={row.issue.id}
                      type="button"
                      onClick={() => onOpenIssue(row.issue.id)}
                      className="flex h-14 w-full flex-col justify-center border-b border-r border-divider bg-surface px-4 text-left transition-colors hover:bg-surface-high focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                      style={{ paddingLeft: parent ? 28 : 16, paddingRight: 16 }}
                      aria-label={`Open ${row.issue.identifier}: ${row.issue.title}${parent ? `, part of ${parent.identifier}` : ''}`}
                      title={`${row.issue.identifier} · ${row.issue.title}${parent ? ` · Part of ${parent.identifier}` : ''}\n${row.issue.assignedHuman || 'Unassigned'} · ${statusLabel(row.issue.status)} · ${priorityLabel(row.issue.priority)}${row.issue.dueDate ? ` · Due ${row.issue.dueDate}` : ''}`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {parent && <GitBranch aria-hidden="true" className="h-3 w-3 shrink-0 text-content-muted" />}
                        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-content">{row.issue.title}</span>
                        <span className="shrink-0 pl-2 text-[11px] font-medium tabular-nums text-content-secondary">{scheduleLabel(row.issue)}</span>
                      </span>
                      <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-content-muted">
                        <span className="shrink-0 font-mono">{row.issue.identifier}</span>
                        <span aria-hidden="true">·</span>
                        <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[row.issue.status]}`} />
                        <span className="shrink-0 text-content-secondary">{statusLabel(row.issue.status)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{row.issue.assignedHuman || 'Unassigned'}</span>
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
                  );
                })()
              ) : (
                <div key={row.id} className="flex h-14 items-center gap-2 border-b border-r border-divider bg-surface px-3" title={row.title}>
                  <Diamond aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 ${row.completed ? 'fill-status-success text-status-success' : 'fill-status-warning text-status-warning'}`} />
                  <span className="truncate text-[11px] font-semibold text-content">{row.title}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-content-muted">{row.completed ? 'Done' : 'Milestone'}</span>
                </div>
              ))}
            </div>

            <div className="relative" style={{ width: timelineWidth, height: plotHeight }}>
              {Array.from({ length: model.dayCount }, (_, index) => {
                const day = model.startDay! + index;
                const weekday = new Date(day * DAY_MS).getUTCDay();
                const isWeekend = weekday === 0 || weekday === 6;
                const isMonday = weekday === 1;
                return (
                  <div
                    key={day}
                    aria-hidden="true"
                    className={`absolute inset-y-0 border-r border-divider/60 ${isMonday ? 'border-l border-l-divider' : ''} ${isWeekend ? 'bg-surface-high/50' : ''}`}
                    style={{ left: index * dayWidth, width: dayWidth }}
                  />
                );
              })}
              {model.rows.map((_, index) => (
                <div key={`row-${index}`} aria-hidden="true" className="absolute inset-x-0 border-b border-divider" style={{ top: (index + 1) * ROW_HEIGHT }} />
              ))}
              {todayOffset !== undefined && (
                <div aria-hidden="true" className="absolute inset-y-0 z-[7] border-l-2 border-link" style={{ left: todayOffset }} />
              )}
              {projectTargetOffset !== undefined && (
                <div aria-hidden="true" className="absolute inset-y-0 z-[5] border-l border-dashed border-status-warning" style={{ left: projectTargetOffset }} title={`Project target · ${dateLabel(model.projectTargetDay!, { month: 'short', day: 'numeric', year: 'numeric' })}`} />
              )}

              <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[6] h-full w-full overflow-visible" width={timelineWidth} height={plotHeight}>
                <defs>
                  <marker id="gantt-dependency-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 0 0 L 6 3 L 0 6 z" fill="currentColor" className="text-content-muted" />
                  </marker>
                </defs>
                {model.rows.map((row, index) => {
                  if (row.kind !== 'task') return null;
                  return (row.issue.dependsOnIssueIds ?? []).map(dependencyId => {
                    const dependencyRow = rowIndexByIssueId.get(dependencyId);
                    const dependency = issueById.get(dependencyId);
                    if (dependencyRow === undefined || !dependency?.plannedEndDate || !row.issue.plannedStartDate) return null;
                    const dependencyEnd = dayNumber(dependency.plannedEndDate);
                    const dependentStart = dayNumber(row.issue.plannedStartDate);
                    if (dependencyEnd === undefined || dependentStart === undefined) return null;
                    const x1 = (dependencyEnd - model.startDay! + 1) * dayWidth - 2;
                    const x2 = (dependentStart - model.startDay!) * dayWidth + 3;
                    const y1 = dependencyRow * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const y2 = index * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const elbowX = Math.max(x1 + 8, (x1 + x2) / 2);
                    return (
                      <path
                        key={`${dependencyId}-${row.issue.id}`}
                        d={`M ${x1} ${y1} H ${elbowX} V ${y2} H ${x2}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                        markerEnd="url(#gantt-dependency-arrow)"
                        className="text-content-muted opacity-75"
                      />
                    );
                  });
                })}
              </svg>

              {model.rows.map((row, index) => {
                if (row.kind === 'milestone') {
                  const left = ((row.day - model.startDay!) + 0.5) * dayWidth;
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

                const hasSchedule = row.start !== undefined && row.end !== undefined;
                const left = hasSchedule ? (row.start! - model.startDay!) * dayWidth + 2 : 0;
                const width = hasSchedule ? Math.max(dayWidth - 4, (row.end! - row.start! + 1) * dayWidth - 4) : 0;
                return (
                  <React.Fragment key={row.issue.id}>
                    {hasSchedule && (
                      <button
                        type="button"
                        onClick={() => onOpenIssue(row.issue.id)}
                        className="absolute z-10 flex h-6 items-center overflow-hidden rounded-[4px] border-l-[3px] border-link-hover bg-link px-2 text-[11px] font-semibold text-on-action hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        style={{ left, width, top: index * ROW_HEIGHT + 16 }}
                        title={`${row.issue.identifier} · ${row.issue.title}\n${dateLabel(row.start!, { month: 'short', day: 'numeric', year: 'numeric' })} – ${dateLabel(row.end!, { month: 'short', day: 'numeric', year: 'numeric' })} · ${row.end! - row.start! + 1} ${row.end === row.start ? 'day' : 'days'}`}
                        aria-label={`${row.issue.identifier}, ${row.issue.title}, ${dateKey(row.start!)} to ${dateKey(row.end!)}`}
                      >
                        {width >= 72 ? (
                          <span className="truncate">{row.issue.identifier} · {row.issue.title}</span>
                        ) : width >= 32 ? (
                          <span className="truncate">{row.issue.identifier.split('-').slice(-1)[0]}</span>
                        ) : null}
                      </button>
                    )}
                    {row.dueDay !== undefined && (
                      <span
                        role="img"
                        aria-label={`${row.issue.identifier} due ${dateKey(row.dueDay)}`}
                        title={`${row.issue.identifier} · Due ${dateLabel(row.dueDay, { month: 'short', day: 'numeric', year: 'numeric' })}`}
                        className={`absolute z-20 h-3.5 w-3.5 rounded-full border-2 border-surface-raised ${row.issue.status === 'done' ? 'bg-status-success' : isOverdue(row.issue) ? 'bg-status-danger' : 'bg-status-warning'}`}
                        style={{ left: (row.dueDay - model.startDay!) * dayWidth + dayWidth / 2 - 7, top: index * ROW_HEIGHT + 21 }}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-divider bg-surface-raised px-4 py-6">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-selected text-link">
              <CalendarDays aria-hidden="true" className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-content">Add dates to build the timeline</p>
              <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-content-muted">Set a start and end date on a task to place it on the calendar. Unscheduled work stays in the list below until it is ready to plan.</p>
            </div>
          </div>
        </div>
      )}

      <section aria-labelledby="gantt-unscheduled-title" className="mt-5 overflow-hidden rounded-lg border border-divider">
        <div className="flex items-center justify-between border-b border-divider bg-surface-raised px-3 py-2.5">
          <div>
            <h2 id="gantt-unscheduled-title" className="text-[12px] font-semibold text-content">Unscheduled tasks</h2>
            <p className="mt-0.5 text-[11px] text-content-muted">Work without a complete start and end date</p>
          </div>
          <span className="rounded-full bg-surface-high px-2 py-0.5 text-[11px] font-medium tabular-nums text-content-secondary">{model.unscheduled.length}</span>
        </div>
        {model.unscheduled.length === 0 ? (
          <p className="px-3 py-3 text-[12px] text-content-muted">Every task in this project has a start and end date.</p>
        ) : (
          <ul className="divide-y divide-divider">
            {model.unscheduled.map(issue => {
              const parent = issue.parentIssueId ? issueById.get(issue.parentIssueId) : undefined;
              return (
                <li key={issue.id}>
                  <button type="button" onClick={() => onOpenIssue(issue.id)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-high">
                    <Circle aria-hidden="true" className="h-3 w-3 shrink-0 text-content-muted" />
                    <span className="shrink-0 font-mono text-[11px] text-content-muted">{issue.identifier}</span>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-content">{issue.title}</span>
                    {parent && <span className="hidden shrink-0 text-[10.5px] text-content-muted md:inline">Part of {parent.identifier}</span>}
                    <span className="hidden text-[11px] text-content-muted sm:inline">{issue.assignedHuman || 'Unassigned'}</span>
                    <span className="rounded-full bg-surface-high px-2 py-0.5 text-[11px] text-content-secondary">{statusLabel(issue.status)}</span>
                    <span className="hidden text-[11px] text-content-muted md:inline">{priorityLabel(issue.priority)}</span>
                    {canManageIssues && <span className="text-[11px] font-medium text-link">Set dates</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      </main>
    </div>
  );
};
