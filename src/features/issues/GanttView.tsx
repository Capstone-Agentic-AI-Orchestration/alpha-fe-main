import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Circle,
  Diamond,
  GitBranch,
  Link2
} from 'lucide-react';
import type { Issue, Project } from '@/shared/types';
import { DatePicker } from '@/shared/components/ui/date-picker';

interface GanttViewProps {
  project?: Project;
  issues: Issue[];
  canManageIssues: boolean;
  onOpenIssue: (issueId: string) => void;
  /** The project page already owns the project identity row above the planner. */
  showProjectIdentity?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_WIDTH = 50;
const WEEK_DAY_WIDTH = 34;
const MONTH_DAY_WIDTH = 11;
const TASK_COLUMN_WIDTH = 400;
const MIN_TASK_COLUMN_WIDTH = 320;
const MAX_TASK_COLUMN_WIDTH = 560;
const MIN_FIT_DAY_WIDTH = 8;
const ROW_HEIGHT = 56;

interface DateRange {
  start: number;
  end: number;
}

type ChartRow =
  | { kind: 'project'; id: string; title: string; start?: number; end?: number; milestoneDay?: number }
  | { kind: 'task'; issue: Issue; start?: number; end?: number; dueDay?: number; depth: number; isGroup: boolean }
  | { kind: 'milestone'; id: string; title: string; day: number; completed: boolean };

interface MonthSegment {
  start: number;
  days: number;
  label: string;
}

function dayNumber(value?: string | null): number | undefined {
  const key = value?.slice(0, 10);
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return undefined;
  const timestamp = Date.parse(key + 'T00:00:00.000Z');
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== key) return undefined;
  return Math.floor(timestamp / DAY_MS);
}

function dateKey(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

function dateLabel(day: number, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(new Date(day * DAY_MS));
}

function dateRangeLabel(start: number, end: number): string {
  return dateLabel(start, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' – ' +
    dateLabel(end, { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayNumber(): number {
  const now = new Date();
  const localDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');
  return dayNumber(localDate)!;
}

function isOverdue(issue: Issue): boolean {
  if (!issue.dueDate || issue.status === 'done') return false;
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');
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
  showProjectIdentity = false
}) => {
  const [scale, setScale] = useState<'weeks' | 'days' | 'months'>('weeks');
  const [rangeOverride, setRangeOverride] = useState<DateRange | null>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeDraftStart, setRangeDraftStart] = useState('');
  const [rangeDraftEnd, setRangeDraftEnd] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [fitTimeline, setFitTimeline] = useState(true);
  const [taskColumnWidth, setTaskColumnWidth] = useState(TASK_COLUMN_WIDTH);
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(0);
  const [unscheduledExpanded, setUnscheduledExpanded] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const taskColumnResizeStart = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);

  const model = useMemo(() => {
    const issueById = new Map(issues.map(issue => [issue.id, issue]));
    const childrenByParent = new Map<string, Issue[]>();
    for (const issue of issues) {
      const parentId = issue.parentIssueId;
      if (!parentId || !issueById.has(parentId)) continue;
      const children = childrenByParent.get(parentId) ?? [];
      children.push(issue);
      childrenByParent.set(parentId, children);
    }

    const rangeCache = new Map<string, DateRange | undefined>();
    const subtreeRange = (issueId: string, visiting = new Set<string>()): DateRange | undefined => {
      if (rangeCache.has(issueId)) return rangeCache.get(issueId);
      const issue = issueById.get(issueId);
      if (!issue || visiting.has(issueId)) return undefined;

      const nextVisiting = new Set(visiting);
      nextVisiting.add(issueId);
      const ownStart = dayNumber(issue.plannedStartDate);
      const ownEnd = dayNumber(issue.plannedEndDate);
      let start = ownStart !== undefined && ownEnd !== undefined && ownEnd >= ownStart ? ownStart : undefined;
      let end = start !== undefined ? ownEnd : undefined;

      for (const child of childrenByParent.get(issueId) ?? []) {
        const childRange = subtreeRange(child.id, nextVisiting);
        if (!childRange) continue;
        start = start === undefined ? childRange.start : Math.min(start, childRange.start);
        end = end === undefined ? childRange.end : Math.max(end, childRange.end);
      }

      const range = start !== undefined && end !== undefined ? { start, end } : undefined;
      rangeCache.set(issueId, range);
      return range;
    };

    const issueDate = (issue: Issue): number =>
      subtreeRange(issue.id)?.start ?? dayNumber(issue.dueDate) ?? Number.MAX_SAFE_INTEGER;

    const unscheduled = issues.filter(issue => {
      const start = dayNumber(issue.plannedStartDate);
      const end = dayNumber(issue.plannedEndDate);
      return start === undefined || end === undefined || end < start;
    });

    const visited = new Set<string>();
    const issueBlocks: { day: number; rows: ChartRow[] }[] = [];
    const flattenIssue = (issue: Issue, depth: number): ChartRow[] => {
      if (visited.has(issue.id)) return [];
      visited.add(issue.id);

      const children = [...(childrenByParent.get(issue.id) ?? [])].sort((left, right) => issueDate(left) - issueDate(right));
      const range = subtreeRange(issue.id);
      const dueDay = dayNumber(issue.dueDate);
      const rows: ChartRow[] = [];
      if (range || dueDay !== undefined) {
        rows.push({
          kind: 'task',
          issue,
          start: range?.start,
          end: range?.end,
          dueDay,
          depth,
          isGroup: children.length > 0
        });
      }
      for (const child of children) rows.push(...flattenIssue(child, depth + 1));
      return rows;
    };

    const rootIssues = issues
      .filter(issue => !issue.parentIssueId || !issueById.has(issue.parentIssueId))
      .sort((left, right) => issueDate(left) - issueDate(right));

    for (const root of rootIssues) {
      const rows = flattenIssue(root, 1);
      if (!rows.length) continue;
      const firstDay = rows.reduce((earliest, row) => {
        if (row.kind !== 'task') return earliest;
        const rowDay = row.start ?? row.dueDay;
        return rowDay === undefined ? earliest : Math.min(earliest, rowDay);
      }, Number.MAX_SAFE_INTEGER);
      issueBlocks.push({ day: firstDay, rows });
    }

    // If the input contains a malformed parent cycle, still show each task once.
    for (const issue of [...issues].sort((left, right) => issueDate(left) - issueDate(right))) {
      if (visited.has(issue.id)) continue;
      const rows = flattenIssue(issue, 1);
      if (!rows.length) continue;
      const firstDay = rows.reduce((earliest, row) => {
        if (row.kind !== 'task') return earliest;
        const rowDay = row.start ?? row.dueDay;
        return rowDay === undefined ? earliest : Math.min(earliest, rowDay);
      }, Number.MAX_SAFE_INTEGER);
      issueBlocks.push({ day: firstDay, rows });
    }

    const milestoneBlocks = (project?.milestones ?? []).flatMap(milestone => {
      const day = dayNumber(milestone.targetDate);
      if (day === undefined) return [];
      return [{
        day,
        rows: [{
          kind: 'milestone' as const,
          id: milestone.id,
          title: milestone.title,
          day,
          completed: milestone.completed
        }]
      }];
    });

    const bodyRows = [...issueBlocks, ...milestoneBlocks]
      .sort((left, right) => left.day - right.day)
      .flatMap(block => block.rows);

    const allDays: number[] = [];
    for (const issue of issues) {
      const start = dayNumber(issue.plannedStartDate);
      const end = dayNumber(issue.plannedEndDate);
      const dueDay = dayNumber(issue.dueDate);
      if (start !== undefined && end !== undefined && end >= start) allDays.push(start, end);
      if (dueDay !== undefined) allDays.push(dueDay);
    }
    for (const milestone of project?.milestones ?? []) {
      const day = dayNumber(milestone.targetDate);
      if (day !== undefined) allDays.push(day);
    }

    const projectStartDay = dayNumber(project?.startDate);
    const projectTargetDay = dayNumber(project?.targetDate);
    const showProjectRow = projectStartDay !== undefined || projectTargetDay !== undefined;
    if (projectStartDay !== undefined) allDays.push(projectStartDay);
    if (projectTargetDay !== undefined) allDays.push(projectTargetDay);

    const dataStart = allDays.length ? Math.min(...allDays) : undefined;
    const dataEnd = allDays.length ? Math.max(...allDays) : undefined;
    const projectRowStart = projectStartDay ?? dataStart;
    const projectRowEnd = projectTargetDay === undefined
      ? dataEnd
      : Math.max(projectTargetDay, dataEnd ?? projectTargetDay);

    const rows: ChartRow[] = [];
    if (project && showProjectRow) {
      rows.push({
        kind: 'project',
        id: project.id,
        title: project.name,
        start: projectRowStart,
        end: projectRowEnd,
        milestoneDay: projectTargetDay
      });
    }
    rows.push(...bodyRows);

    if (!allDays.length) {
      return { rows, unscheduled, startDay: undefined, endDay: undefined, showProjectRow };
    }

    const startDay = mondayOf(Math.min(...allDays));
    const endDay = Math.max(Math.max(...allDays), startDay + 6);
    return {
      rows,
      unscheduled,
      startDay,
      endDay,
      showProjectRow
    };
  }, [issues, project]);

  const issueById = useMemo(() => new Map(issues.map(issue => [issue.id, issue])), [issues]);
  const visibleRows = useMemo(() => model.rows.filter(row => {
    if (row.kind === 'project') return true;
    if (project?.id && collapsedGroups.has(project.id)) return false;
    if (row.kind !== 'task') return true;

    let parentId = row.issue.parentIssueId;
    const visited = new Set<string>();
    while (parentId && issueById.has(parentId) && !visited.has(parentId)) {
      if (collapsedGroups.has(parentId)) return false;
      visited.add(parentId);
      parentId = issueById.get(parentId)?.parentIssueId;
    }
    return true;
  }), [collapsedGroups, issueById, model.rows, project?.id]);

  const rowIndexByIssueId = new Map<string, number>();
  visibleRows.forEach((row, index) => {
    if (row.kind === 'task') rowIndexByIssueId.set(row.issue.id, index);
  });

  const visibleStartDay = rangeOverride?.start ?? model.startDay;
  const visibleEndDay = rangeOverride?.end ?? model.endDay;
  const dayCount = visibleStartDay !== undefined && visibleEndDay !== undefined
    ? visibleEndDay - visibleStartDay + 1
    : 0;
  const effectiveTaskColumnWidth = timelineViewportWidth > 0 && timelineViewportWidth < 720
    ? Math.min(taskColumnWidth, Math.min(320, Math.max(180, timelineViewportWidth * 0.68)))
    : taskColumnWidth;
  const baseDayWidth = scale === 'days' ? DAY_WIDTH : scale === 'weeks' ? WEEK_DAY_WIDTH : MONTH_DAY_WIDTH;
  const fitDayWidth = dayCount > 0 && timelineViewportWidth > effectiveTaskColumnWidth
    ? (timelineViewportWidth - effectiveTaskColumnWidth) / dayCount
    : baseDayWidth;
  const dayWidth = fitTimeline
    ? Math.min(baseDayWidth, Math.max(MIN_FIT_DAY_WIDTH, fitDayWidth))
    : baseDayWidth;
  const timelineWidth = dayCount * dayWidth;
  const plotHeight = Math.max(ROW_HEIGHT, visibleRows.length * ROW_HEIGHT);
  const todayDay = todayNumber();
  const todayOffset = visibleStartDay !== undefined && visibleEndDay !== undefined &&
    todayDay >= visibleStartDay && todayDay <= visibleEndDay
    ? (todayDay - visibleStartDay + 0.5) * dayWidth
    : undefined;
  const months = visibleStartDay !== undefined && visibleEndDay !== undefined
    ? monthSegments(visibleStartDay, visibleEndDay)
    : [];

  const rangeLabel = visibleStartDay !== undefined && visibleEndDay !== undefined
    ? dateRangeLabel(visibleStartDay, visibleEndDay)
    : 'Choose date range';
  const draftStartDay = dayNumber(rangeDraftStart);
  const draftEndDay = dayNumber(rangeDraftEnd);
  const canApplyRange = draftStartDay !== undefined && draftEndDay !== undefined && draftEndDay >= draftStartDay;

  const hasScheduledTasks = visibleRows.some(row => row.kind === 'task' && row.start !== undefined && row.end !== undefined &&
    visibleStartDay !== undefined && visibleEndDay !== undefined && row.end >= visibleStartDay && row.start <= visibleEndDay);
  const hasVisibleMilestones = visibleRows.some(row =>
    (row.kind === 'milestone' && visibleStartDay !== undefined && visibleEndDay !== undefined && row.day >= visibleStartDay && row.day <= visibleEndDay) ||
    (row.kind === 'project' && row.milestoneDay !== undefined && visibleStartDay !== undefined && visibleEndDay !== undefined &&
      row.milestoneDay >= visibleStartDay && row.milestoneDay <= visibleEndDay));
  const hasVisibleDeadlines = visibleRows.some(row => row.kind === 'task' && row.dueDay !== undefined &&
    visibleStartDay !== undefined && visibleEndDay !== undefined && row.dueDay >= visibleStartDay && row.dueDay <= visibleEndDay);
  const hasVisibleDependencies = visibleRows.some(row => row.kind === 'task' &&
    (row.issue.dependsOnIssueIds ?? []).some(dependencyId => {
      const dependency = issueById.get(dependencyId);
      return rowIndexByIssueId.has(dependencyId) && Boolean(dependency?.plannedEndDate && row.issue.plannedStartDate);
    }));
  const showTimelineLegend = hasScheduledTasks || hasVisibleMilestones || hasVisibleDeadlines || hasVisibleDependencies;

  useEffect(() => {
    const viewport = timelineRef.current;
    if (!viewport) return;

    const measureViewport = () => setTimelineViewportWidth(viewport.clientWidth);
    measureViewport();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measureViewport);
      observer.observe(viewport);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', measureViewport);
    return () => window.removeEventListener('resize', measureViewport);
  }, [visibleStartDay, visibleEndDay]);

  useEffect(() => {
    setRangeOverride(null);
    setRangeOpen(false);
    setCollapsedGroups(new Set());
    setFitTimeline(true);
    setUnscheduledExpanded(false);
  }, [project?.id]);

  useEffect(() => {
    const viewport = timelineRef.current;
    if (viewport) viewport.scrollLeft = 0;
  }, [scale, visibleStartDay, visibleEndDay, fitTimeline]);

  const toggleGroup = (id: string) => {
    setCollapsedGroups(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const beginTaskColumnResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    taskColumnResizeStart.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: taskColumnWidth
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const updateTaskColumnResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = taskColumnResizeStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    setTaskColumnWidth(Math.min(MAX_TASK_COLUMN_WIDTH, Math.max(MIN_TASK_COLUMN_WIDTH, start.startWidth + event.clientX - start.startX)));
  };

  const endTaskColumnResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (taskColumnResizeStart.current?.pointerId === event.pointerId) taskColumnResizeStart.current = null;
  };

  const resizeTaskColumnByKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 16 : -16;
    setTaskColumnWidth(width => Math.min(MAX_TASK_COLUMN_WIDTH, Math.max(MIN_TASK_COLUMN_WIDTH, width + delta)));
  };

  const toggleRangePicker = () => {
    if (!rangeOpen && visibleStartDay !== undefined && visibleEndDay !== undefined) {
      setRangeDraftStart(dateKey(visibleStartDay));
      setRangeDraftEnd(dateKey(visibleEndDay));
    }
    setRangeOpen(open => !open);
  };

  const applyDateRange = () => {
    if (!canApplyRange || draftStartDay === undefined || draftEndDay === undefined) return;
    setRangeOverride({ start: draftStartDay, end: draftEndDay });
    setRangeOpen(false);
  };

  const resetDateRange = () => {
    setRangeOverride(null);
    setRangeOpen(false);
  };

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-shell">
      {showProjectIdentity && (
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
        </div>
      )}

      <main className="px-5 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[20px] font-semibold leading-tight tracking-[-0.02em] text-content">Gantt</h2>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={fitTimeline}
              aria-label="Fit timeline to available width"
              title="Fit the selected date range inside the chart"
              onClick={() => setFitTimeline(value => !value)}
              className={'rounded-lg border border-divider px-3 py-2 text-[13px] font-medium transition-colors ' +
                (fitTimeline ? 'bg-selected text-selected-content shadow-sm' : 'bg-surface-raised text-content-secondary hover:bg-surface-high hover:text-content')}
            >
              Fit
            </button>

            <div role="group" aria-label="Timeline scale" className="inline-flex items-center rounded-lg border border-divider bg-surface-raised p-0.5">
              {(['weeks', 'days', 'months'] as const).map(option => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={scale === option}
                  onClick={() => setScale(option)}
                  className={'min-w-[78px] rounded-md px-3 py-2 text-[13px] font-medium capitalize transition-colors ' +
                    (scale === option ? 'bg-selected text-selected-content shadow-sm' : 'text-content-secondary hover:bg-surface-high hover:text-content')}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-auto">
              <button
                type="button"
                onClick={toggleRangePicker}
                aria-haspopup="dialog"
                aria-expanded={rangeOpen}
                aria-controls="gantt-date-range"
                className="inline-flex w-full min-w-0 items-center gap-2 rounded-lg border border-divider bg-surface-raised px-3 py-2 text-left text-[13px] font-medium text-content-secondary transition-colors hover:bg-surface-high hover:text-content sm:w-auto sm:min-w-[260px] sm:max-w-[360px]"
              >
                <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-content-muted" />
                <span className="min-w-0 flex-1 truncate">{rangeLabel}</span>
                <ChevronDown aria-hidden="true" className={'h-4 w-4 shrink-0 text-content-muted transition-transform ' + (rangeOpen ? 'rotate-180' : '')} />
              </button>
              {rangeOpen && (
                <div
                  id="gantt-date-range"
                  role="dialog"
                  aria-label="Choose timeline date range"
                  className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-divider bg-surface-raised p-3 shadow-xl shadow-black/30"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1 text-[11px] font-medium text-content-secondary">
                      <span className="block">Start date</span>
                      <DatePicker
                        value={rangeDraftStart}
                        onChange={setRangeDraftStart}
                        aria-label="Timeline start date"
                        buttonClassName="h-8 w-full justify-start px-2 text-[12px]"
                      />
                    </label>
                    <label className="space-y-1 text-[11px] font-medium text-content-secondary">
                      <span className="block">End date</span>
                      <DatePicker
                        value={rangeDraftEnd}
                        onChange={setRangeDraftEnd}
                        aria-label="Timeline end date"
                        min={rangeDraftStart || undefined}
                        buttonClassName="h-8 w-full justify-start px-2 text-[12px]"
                      />
                    </label>
                  </div>
                  {!canApplyRange && rangeDraftStart && rangeDraftEnd && (
                    <p role="alert" className="mt-2 text-[11px] text-status-danger">End date must be on or after the start date.</p>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-divider pt-3">
                    <button
                      type="button"
                      onClick={resetDateRange}
                      className="text-[11px] font-medium text-content-muted hover:text-content"
                    >
                      Show all dates
                    </button>
                    <button
                      type="button"
                      onClick={applyDateRange}
                      disabled={!canApplyRange}
                      className="rounded-md bg-selected px-3 py-1.5 text-[11px] font-semibold text-selected-content hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Apply range
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {showTimelineLegend && (
          <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-content-muted" aria-label="Timeline legend">
            {hasScheduledTasks && <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-3 w-4 rounded-[4px] bg-link" />Task duration</span>}
            {hasVisibleMilestones && <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 rotate-45 border border-status-warning bg-status-warning-subtle" />Milestone</span>}
            {hasVisibleDeadlines && <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 rounded-full border-2 border-status-warning bg-status-warning-subtle" />Task deadline</span>}
            {hasVisibleDependencies && <span className="inline-flex items-center gap-2"><Link2 aria-hidden="true" className="h-4 w-4" />Dependency</span>}
          </div>
        )}

        {visibleStartDay !== undefined && visibleEndDay !== undefined && dayCount > 0 ? (
          <div ref={timelineRef} className="relative overflow-x-auto rounded-xl border border-divider bg-surface-raised">
            <div className="relative min-w-max" style={{ width: effectiveTaskColumnWidth + timelineWidth }}>
              <div
                className="grid min-w-max"
                style={{ gridTemplateColumns: effectiveTaskColumnWidth + 'px ' + timelineWidth + 'px' }}
              >
                <div className="sticky left-0 z-30 row-span-2 flex h-16 items-center justify-between border-b border-r border-divider bg-surface-raised pl-6 pr-4">
                  <span className="text-[13px] font-semibold uppercase tracking-[0.1em] text-content-secondary">Task</span>
                  {project?.id && !model.showProjectRow && model.rows.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleGroup(project.id)}
                      aria-label={collapsedGroups.has(project.id) ? 'Expand all project tasks' : 'Collapse all project tasks'}
                      aria-expanded={!collapsedGroups.has(project.id)}
                      title={collapsedGroups.has(project.id) ? 'Show all tasks' : 'Collapse all tasks'}
                      className="grid h-7 w-7 place-items-center rounded-md text-content-muted hover:bg-surface-high hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      {collapsedGroups.has(project.id)
                        ? <ChevronRight aria-hidden="true" className="h-4 w-4" />
                        : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
                    </button>
                  )}
                  {timelineViewportWidth >= 720 && (
                    <div
                      role="separator"
                      aria-label="Resize task column"
                      aria-orientation="vertical"
                      aria-valuemin={MIN_TASK_COLUMN_WIDTH}
                      aria-valuemax={MAX_TASK_COLUMN_WIDTH}
                      aria-valuenow={taskColumnWidth}
                      aria-valuetext={taskColumnWidth + ' pixels'}
                      tabIndex={0}
                      onPointerDown={beginTaskColumnResize}
                      onPointerMove={updateTaskColumnResize}
                      onPointerUp={endTaskColumnResize}
                      onPointerCancel={endTaskColumnResize}
                      onKeyDown={resizeTaskColumnByKeyboard}
                      title="Drag or use arrow keys to resize the task column"
                      className="absolute inset-y-0 right-0 z-40 w-2 cursor-col-resize touch-none border-r border-transparent transition-colors hover:border-link focus:outline-none focus-visible:border-link focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                    />
                  )}
                </div>

                <div className="relative h-8 border-b border-divider bg-surface-high/50" style={{ width: timelineWidth }}>
                  {months.map(month => {
                    const segmentWidth = month.days * dayWidth;
                    const label = segmentWidth < 150
                      ? dateLabel(month.start, { month: 'short', year: segmentWidth < 64 ? undefined : 'numeric' })
                      : month.label;
                    return (
                      <div
                        key={month.start + '-' + month.label}
                        className="absolute inset-y-0 flex items-center overflow-hidden border-r border-divider px-3 text-[13px] font-semibold text-content-secondary"
                        style={{ left: (month.start - visibleStartDay) * dayWidth, width: segmentWidth }}
                      >
                        <span className="truncate">{label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="relative flex h-8 border-b border-divider bg-surface-raised" style={{ width: timelineWidth }}>
                  {Array.from({ length: dayCount }, (_, index) => {
                    const day = visibleStartDay + index;
                    const weekday = new Date(day * DAY_MS).getUTCDay();
                    const isWeekend = weekday === 0 || weekday === 6;
                    const isMonday = weekday === 1;
                    const isMonthStart = new Date(day * DAY_MS).getUTCDate() === 1;
                    const isToday = day === todayDay;
                    const showLabel = (scale === 'days' && (dayWidth >= 42 || isMonday || index === 0)) ||
                      (scale === 'weeks' && (isMonday || index === 0)) ||
                      (scale === 'months' && (isMonthStart || index === 0));
                    const label = scale === 'days'
                      ? dateLabel(day, { weekday: 'short', day: 'numeric' })
                      : scale === 'weeks'
                        ? dateLabel(day, { month: 'short', day: 'numeric' })
                        : dateLabel(day, { day: 'numeric' });

                    return (
                      <div
                        key={day}
                        className={'relative flex h-full shrink-0 items-center border-r ' + (scale === 'days' && dayWidth >= 36 ? 'border-divider/40 ' : 'border-divider/15 ') +
                          (scale === 'days' && isWeekend ? 'bg-surface-high/50 ' : '') +
                          (isToday ? 'bg-selected/30 ' : '') +
                          (isMonday || isMonthStart ? 'border-l border-l-divider/80' : '')}
                        style={{ width: dayWidth }}
                        aria-label={dateLabel(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        title={dateLabel(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      >
                        {showLabel && (
                          <span className={'absolute left-2 whitespace-nowrap text-[12px] font-medium tabular-nums ' + (isToday ? 'text-selected-content' : 'text-content-secondary')}>
                            {label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="sticky left-0 z-20">
                  {visibleRows.length === 0 ? (
                    <div className="flex h-12 items-center border-b border-r border-divider bg-surface px-4 text-[11px] text-content-muted">
                      No scheduled tasks or milestones yet.
                    </div>
                  ) : visibleRows.map(row => {
                    if (row.kind === 'project') {
                      const canCollapse = model.rows.some(candidate => candidate.kind !== 'project');
                      const isCollapsed = collapsedGroups.has(row.id);
                      return (
                        <div
                          key={row.id}
                          className="flex h-14 items-center gap-2 border-b border-r border-divider bg-surface px-4"
                        >
                          {canCollapse ? (
                            <button
                              type="button"
                              onClick={() => toggleGroup(row.id)}
                              aria-label={(isCollapsed ? 'Expand' : 'Collapse') + ' project tasks'}
                              aria-expanded={!isCollapsed}
                              className="grid h-6 w-6 shrink-0 place-items-center rounded text-content-secondary hover:bg-surface-high hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                            >
                              {isCollapsed ? <ChevronRight aria-hidden="true" className="h-4 w-4" /> : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
                            </button>
                          ) : <span className="w-6 shrink-0" />}
                          <Diamond aria-hidden="true" className="h-4 w-4 shrink-0 fill-status-warning text-status-warning" />
                          <span className="min-w-0 truncate text-[14px] font-semibold text-content" title={row.title}>Project schedule</span>
                        </div>
                      );
                    }

                    if (row.kind === 'milestone') {
                      return (
                        <div
                          key={row.id}
                          className="flex h-14 items-center gap-2 border-b border-r border-divider bg-surface px-5"
                          title={row.title}
                        >
                          <Diamond aria-hidden="true" className={'h-3.5 w-3.5 shrink-0 ' + (row.completed ? 'fill-status-success text-status-success' : 'fill-status-warning text-status-warning')} />
                          <span className="min-w-0 truncate text-[13px] font-medium text-content">{row.title}</span>
                          <span className="ml-auto shrink-0 text-[10px] text-content-muted">{row.completed ? 'Done' : 'Milestone'}</span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={row.issue.id}
                        className="flex h-14 items-center gap-2 border-b border-r border-divider bg-surface px-3"
                        style={{ paddingLeft: 32 + row.depth * 18 }}
                      >
                        {row.isGroup ? (
                          <button
                            type="button"
                            onClick={() => toggleGroup(row.issue.id)}
                            aria-label={(collapsedGroups.has(row.issue.id) ? 'Expand ' : 'Collapse ') + row.issue.title}
                            aria-expanded={!collapsedGroups.has(row.issue.id)}
                            className="grid h-6 w-5 shrink-0 place-items-center rounded text-content-muted hover:bg-surface-high hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                          >
                            {collapsedGroups.has(row.issue.id) ? <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" /> : <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />}
                          </button>
                        ) : <span aria-hidden="true" className="w-5 shrink-0" />}
                        {row.isGroup
                          ? <GitBranch aria-hidden="true" className="h-3 w-3 shrink-0 text-content-muted" />
                          : <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-selected" />}
                        <button
                          type="button"
                          onClick={() => onOpenIssue(row.issue.id)}
                          className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden text-left transition-colors hover:text-link focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                          aria-label={'Open ' + row.issue.identifier + ': ' + row.issue.title}
                          title={row.issue.identifier + ' · ' + row.issue.title}
                        >
                          <span className="block truncate font-mono text-[11px] leading-[14px] text-content-muted">{row.issue.identifier}</span>
                          <span className="block overflow-hidden text-[14px] font-medium leading-[17px] text-content [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                            {row.issue.title}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="relative overflow-hidden" style={{ width: timelineWidth, height: plotHeight }}>
                  {Array.from({ length: dayCount }, (_, index) => {
                    const day = visibleStartDay + index;
                    const weekday = new Date(day * DAY_MS).getUTCDay();
                    const isWeekend = weekday === 0 || weekday === 6;
                    const isMonday = weekday === 1;
                    const weekIndex = Math.floor((day - visibleStartDay) / 7);
                    const isMonthStart = new Date(day * DAY_MS).getUTCDate() === 1;
                    const weekShade = scale === 'weeks' && weekIndex % 2 === 1;
                    const showBoundary = (scale === 'days' && (!fitTimeline || dayWidth >= 36 || isMonday)) ||
                      (scale === 'weeks' && isMonday) || (scale === 'months' && isMonthStart);

                    return (
                      <div
                        key={day}
                        aria-hidden="true"
                        className={'absolute inset-y-0 ' +
                          (showBoundary ? 'border-l border-divider/70 ' : '') +
                          (scale === 'days' && isWeekend ? 'bg-surface-high/40 ' : '') +
                          (weekShade ? 'bg-surface-high/15 ' : '')}
                        style={{ left: index * dayWidth, width: dayWidth }}
                      />
                    );
                  })}
                  {visibleRows.map((_, index) => (
                    <div key={'row-' + index} aria-hidden="true" className="absolute inset-x-0 border-b border-divider" style={{ top: (index + 1) * ROW_HEIGHT }} />
                  ))}
                  <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[6] h-full w-full overflow-visible" width={timelineWidth} height={plotHeight}>
                    <defs>
                      <marker id="gantt-dependency-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
                        <path d="M 0 0 L 6 3 L 0 6 z" fill="currentColor" className="text-content-muted" />
                      </marker>
                    </defs>
                    {visibleRows.map((row, index) => {
                      if (row.kind !== 'task') return null;
                      return (row.issue.dependsOnIssueIds ?? []).map(dependencyId => {
                        const dependencyRow = rowIndexByIssueId.get(dependencyId);
                        const dependency = issueById.get(dependencyId);
                        if (dependencyRow === undefined || !dependency?.plannedEndDate || !row.issue.plannedStartDate) return null;
                        const dependencyEnd = dayNumber(dependency.plannedEndDate);
                        const dependentStart = dayNumber(row.issue.plannedStartDate);
                        if (dependencyEnd === undefined || dependentStart === undefined || visibleStartDay === undefined) return null;
                        const x1 = (dependencyEnd - visibleStartDay + 1) * dayWidth - 2;
                        const x2 = (dependentStart - visibleStartDay) * dayWidth + 3;
                        const y1 = dependencyRow * ROW_HEIGHT + ROW_HEIGHT / 2;
                        const y2 = index * ROW_HEIGHT + ROW_HEIGHT / 2;
                        const elbowX = Math.max(x1 + 8, (x1 + x2) / 2);
                        return (
                          <path
                            key={dependencyId + '-' + row.issue.id}
                            d={'M ' + x1 + ' ' + y1 + ' H ' + elbowX + ' V ' + y2 + ' H ' + x2}
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

                  {visibleRows.map((row, index) => {
                    if (row.kind === 'milestone') {
                      const left = (row.day - (visibleStartDay ?? row.day) + 0.5) * dayWidth;
                      return (
                        <div key={row.id} className="absolute z-10" style={{ left: left - 7, top: index * ROW_HEIGHT + 21 }}>
                          <span
                            role="img"
                            aria-label={row.title + ', ' + (row.completed ? 'completed' : 'milestone') + ' on ' + dateKey(row.day)}
                            title={row.title + ' · ' + dateLabel(row.day, { month: 'short', day: 'numeric', year: 'numeric' }) + (row.completed ? ' · Completed' : '')}
                            className={'block h-3.5 w-3.5 rotate-45 border-2 border-surface-raised ' + (row.completed ? 'bg-status-success' : 'bg-status-warning')}
                          />
                        </div>
                      );
                    }

                    if (row.kind === 'project') {
                      const hasSchedule = row.start !== undefined && row.end !== undefined && row.end >= row.start;
                      const left = hasSchedule ? (row.start! - (visibleStartDay ?? row.start!)) * dayWidth + 2 : 0;
                      const width = hasSchedule ? Math.max(dayWidth - 4, (row.end! - row.start! + 1) * dayWidth - 4) : 0;
                      const markerLeft = row.milestoneDay !== undefined
                        ? (row.milestoneDay - (visibleStartDay ?? row.milestoneDay) + 0.5) * dayWidth - 7
                        : undefined;
                      const markerVisible = row.milestoneDay !== undefined &&
                        row.milestoneDay >= (visibleStartDay ?? row.milestoneDay) &&
                        row.milestoneDay <= (visibleEndDay ?? row.milestoneDay);
                      return (
                        <React.Fragment key={row.id}>
                          {hasSchedule && (
                            <div
                              role="img"
                              aria-label={row.title + ' project schedule, ' + dateKey(row.start!) + ' to ' + dateKey(row.end!)}
                              title={row.title + ' · ' + dateLabel(row.start!, { month: 'short', day: 'numeric', year: 'numeric' }) + ' – ' + dateLabel(row.end!, { month: 'short', day: 'numeric', year: 'numeric' })}
                              className="absolute z-10 h-3.5 rounded-full border border-selected-content/25 bg-gradient-to-r from-selected/80 to-selected"
                              style={{ left, width, top: index * ROW_HEIGHT + 21 }}
                            />
                          )}
                          {markerVisible && markerLeft !== undefined && (
                            <span
                              role="img"
                              aria-label={'Project milestone on ' + dateKey(row.milestoneDay!)}
                              title={'Project target · ' + dateLabel(row.milestoneDay!, { month: 'short', day: 'numeric', year: 'numeric' })}
                              className="absolute z-20 block h-3.5 w-3.5 rotate-45 border-2 border-surface-raised bg-status-warning"
                              style={{ left: markerLeft, top: index * ROW_HEIGHT + 21 }}
                            />
                          )}
                        </React.Fragment>
                      );
                    }

                    const hasSchedule = row.start !== undefined && row.end !== undefined;
                    const left = hasSchedule ? (row.start! - (visibleStartDay ?? row.start!)) * dayWidth + 2 : 0;
                    const width = hasSchedule ? Math.max(dayWidth - 4, (row.end! - row.start! + 1) * dayWidth - 4) : 0;
                    const dueVisible = row.dueDay !== undefined && row.dueDay >= (visibleStartDay ?? row.dueDay) && row.dueDay <= (visibleEndDay ?? row.dueDay);
                    const dueLeft = row.dueDay === undefined ? 0 : (row.dueDay - (visibleStartDay ?? row.dueDay)) * dayWidth + dayWidth / 2 - 7;
                    const dueColor = row.issue.status === 'done'
                      ? 'bg-status-success'
                      : isOverdue(row.issue)
                        ? 'bg-status-danger'
                        : 'bg-status-warning';
                    return (
                      <React.Fragment key={row.issue.id}>
                        {hasSchedule && (
                          <button
                            type="button"
                            onClick={() => onOpenIssue(row.issue.id)}
                            className={'absolute z-10 overflow-hidden border-l-[3px] border-link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ' +
                              (row.isGroup ? 'h-3.5 rounded-full bg-gradient-to-r from-selected/65 to-selected' : 'h-6 rounded-md bg-link hover:brightness-110')}
                            style={{ left, width, top: index * ROW_HEIGHT + (row.isGroup ? 21 : 16) }}
                            title={row.issue.identifier + ' · ' + row.issue.title + '\n' + dateLabel(row.start!, { month: 'short', day: 'numeric', year: 'numeric' }) + ' – ' + dateLabel(row.end!, { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + (row.end! - row.start! + 1) + ' ' + (row.end === row.start ? 'day' : 'days')}
                            aria-label={row.issue.identifier + ', ' + row.issue.title + ', ' + dateKey(row.start!) + ' to ' + dateKey(row.end!)}
                          />
                        )}
                        {dueVisible && (
                          <span
                            role="img"
                            aria-label={row.issue.identifier + ' due ' + dateKey(row.dueDay!)}
                            title={row.issue.identifier + ' · Due ' + dateLabel(row.dueDay!, { month: 'short', day: 'numeric', year: 'numeric' })}
                            className={'absolute z-20 h-3.5 w-3.5 rounded-full border-2 border-surface-raised ' + dueColor}
                            style={{ left: dueLeft, top: index * ROW_HEIGHT + 21 }}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {todayOffset !== undefined && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 z-30"
                  style={{ left: effectiveTaskColumnWidth + todayOffset, top: 64 }}
                >
                  <div className="absolute inset-y-0 border-l-2 border-selected" />
                  <span className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-md bg-selected px-2 py-1 text-[11px] font-semibold leading-none text-selected-content shadow">
                    Today
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-divider bg-surface-raised px-4 py-6">
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

        <section aria-labelledby="gantt-unscheduled-title" className="mt-4 overflow-hidden rounded-xl border border-divider">
          <h2 id="gantt-unscheduled-title" className="border-b border-divider bg-surface-raised">
            <button
              type="button"
              aria-expanded={unscheduledExpanded}
              aria-controls="gantt-unscheduled-list"
              onClick={() => setUnscheduledExpanded(expanded => !expanded)}
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-surface-high focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
            >
              <span className="flex items-center gap-2 text-[13px] font-semibold text-content">
                Unscheduled tasks
                <span className="rounded-full bg-surface-high px-2 py-0.5 text-[11px] font-medium tabular-nums text-content-secondary">{model.unscheduled.length}</span>
              </span>
              {unscheduledExpanded
                ? <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-content-muted" />
                : <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-content-muted" />}
            </button>
          </h2>
          <div id="gantt-unscheduled-list" hidden={!unscheduledExpanded}>
            {unscheduledExpanded && (
              <>
                <p className="px-3 py-2 text-[11px] text-content-muted">Work without a complete start and end date</p>
                {model.unscheduled.length === 0 ? (
                  <p className="px-3 pb-3 text-[12px] text-content-muted">Every task in this project has a start and end date.</p>
                ) : (
                  <ul className="divide-y divide-divider">
                    {model.unscheduled.map(issue => {
                      const parent = issue.parentIssueId ? issueById.get(issue.parentIssueId) : undefined;
                      return (
                        <li key={issue.id}>
                          <button type="button" onClick={() => onOpenIssue(issue.id)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-high">
                            <Circle aria-hidden="true" className="h-3 w-3 shrink-0 text-content-muted" />
                            <span className="shrink-0 font-mono text-[11px] text-content-muted">{issue.identifier}</span>
                            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-content">{issue.title}</span>
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
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

