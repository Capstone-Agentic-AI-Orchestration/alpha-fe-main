import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTabSessionState } from '@/app/AppContext';
import type { Issue, IssueStatus } from '@/shared/types';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { statusLabel } from './taskFlow';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_STYLES: Record<IssueStatus, string> = {
  backlog: 'border-divider bg-surface-raised text-content-secondary',
  todo: 'border-control bg-surface-raised text-content-secondary',
  in_progress: 'border-status-warning-border bg-status-warning-subtle text-status-warning',
  agent_running: 'border-status-info-border bg-status-info-subtle text-status-info',
  review: 'border-status-info-border bg-status-info-subtle text-status-info',
  done: 'border-status-success-border bg-status-success-subtle text-status-success',
};

interface CalendarViewProps {
  issues: Issue[];
  sessionPrefix: string;
  onOpenIssue: (issueId: string) => void;
  isOverdue: (issue: Issue) => boolean;
  loading?: boolean;
}

function currentMonthKey(): string {
  const now = new Date();
  return String(now.getFullYear()) + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

function monthStartFor(key: string): Date {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  if (!match || month < 1 || month > 12) {
    const today = new Date();
    return new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
  }
  return new Date(Date.UTC(year, month - 1, 1));
}

function shiftMonth(key: string, amount: number): string {
  const month = monthStartFor(key);
  const shifted = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + amount, 1));
  return String(shifted.getUTCFullYear()) + '-' + String(shifted.getUTCMonth() + 1).padStart(2, '0');
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeDate(value?: string): string | null {
  if (!value) return null;
  const key = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const parsed = new Date(key + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && dateKey(parsed) === key ? key : null;
}

function issueCalendarDate(issue: Issue): string | null {
  // Deadlines are the most actionable calendar date; planned tasks fall back to their start.
  return normalizeDate(issue.dueDate)
    ?? normalizeDate(issue.plannedStartDate)
    ?? normalizeDate(issue.plannedEndDate);
}

function monthDays(monthStart: Date): Date[] {
  const year = monthStart.getUTCFullYear();
  const month = monthStart.getUTCMonth();
  const firstWeekday = monthStart.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  return Array.from(
    { length: cellCount },
    (_, index) => new Date(Date.UTC(year, month, 1 + index - firstWeekday)),
  );
}

function fullDateLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function localTodayKey(): string {
  const now = new Date();
  return String(now.getFullYear()) + '-'
    + String(now.getMonth() + 1).padStart(2, '0') + '-'
    + String(now.getDate()).padStart(2, '0');
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  issues,
  sessionPrefix,
  onOpenIssue,
  isOverdue,
  loading = false,
}) => {
  const [monthKey, setMonthKey] = useTabSessionState<string>(
    sessionPrefix + '.calendarMonth',
    currentMonthKey,
  );
  const monthStart = monthStartFor(monthKey);
  const days = monthDays(monthStart);
  const { issuesByDate, undatedCount } = useMemo(() => {
    const grouped = new Map<string, Issue[]>();
    let undated = 0;
    for (const issue of issues) {
      const date = issueCalendarDate(issue);
      if (!date) {
        undated += 1;
        continue;
      }
      const dayIssues = grouped.get(date) ?? [];
      dayIssues.push(issue);
      grouped.set(date, dayIssues);
    }
    return { issuesByDate: grouped, undatedCount: undated };
  }, [issues]);
  const monthLabel = monthStart.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const todayKey = localTodayKey();
  const weeks = Array.from({ length: days.length / 7 }, (_, index) =>
    days.slice(index * 7, (index + 1) * 7),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-busy={loading || undefined}>
      {loading && <span role="status" className="sr-only">Loading calendar tasks</span>}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-divider px-4 py-3 sm:px-5">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Previous month"
          onClick={() => setMonthKey(current => shiftMonth(current, -1))}
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </Button>
        <h2 className="min-w-[9.5rem] text-base font-semibold text-content">{monthLabel}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Next month"
          onClick={() => setMonthKey(current => shiftMonth(current, 1))}
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="ml-1"
          disabled={monthKey === currentMonthKey()}
          onClick={() => setMonthKey(currentMonthKey())}
        >
          Today
        </Button>
        {!loading && undatedCount > 0 && (
          <span className="ml-auto text-xs text-content-muted">
            {undatedCount} task{undatedCount === 1 ? '' : 's'} without dates
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
        <div className="min-w-[720px] overflow-hidden rounded-lg border border-divider bg-surface-raised">
          <table className="w-full table-fixed border-collapse" aria-label={monthLabel + ' task calendar'}>
            <thead>
              <tr>
                {WEEKDAYS.map((weekday, index) => (
                  <th
                    key={weekday}
                    scope="col"
                    className={'border-b border-divider bg-surface px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-content-muted '
                      + (index < 6 ? 'border-r' : '')}
                  >
                    {weekday}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={dateKey(week[0])}>
                  {week.map((date, dayIndex) => {
                    const key = dateKey(date);
                    const inMonth = date.getUTCMonth() === monthStart.getUTCMonth();
                    const dayIssues = issuesByDate.get(key) ?? [];
                    const isToday = key === todayKey;
                    return (
                      <td
                        key={key}
                        aria-label={fullDateLabel(date)}
                        aria-current={isToday ? 'date' : undefined}
                        className={(dayIndex < 6 ? 'border-r ' : '')
                          + 'border-b border-divider align-top ' + (inMonth ? 'bg-surface-raised' : 'bg-surface')}
                      >
                        <div className="flex h-[132px] min-w-0 flex-col">
                          <div className="flex h-8 shrink-0 items-center px-2">
                            <span className={'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs tabular-nums '
                              + (isToday
                                ? 'bg-selected font-semibold text-selected-content'
                                : inMonth ? 'text-content-secondary' : 'text-content-muted')}>
                              {date.getUTCDate()}
                            </span>
                          </div>
                          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-1.5 pb-1.5">
                            {loading ? (
                              <Skeleton className="h-8 w-full" />
                            ) : dayIssues.map((issue) => {
                              const overdue = isOverdue(issue);
                              return (
                                <Button
                                  key={issue.id}
                                  variant="ghost"
                                  size="sm"
                                  className={'h-auto min-h-0 w-full flex-col items-stretch gap-0.5 whitespace-normal rounded-md border border-l-2 px-1.5 py-1 text-left text-[10px] leading-tight '
                                    + (overdue
                                      ? 'border-status-danger-border bg-status-danger-subtle text-status-danger'
                                      : STATUS_STYLES[issue.status])}
                                  onClick={() => onOpenIssue(issue.id)}
                                  aria-label={issue.identifier + ': ' + issue.title + ', '
                                    + (overdue ? 'overdue, ' : '') + statusLabel(issue.status)}
                                >
                                  <span className="flex w-full items-center justify-between gap-1">
                                    <span className="truncate font-mono text-[10px] font-semibold text-content">{issue.identifier}</span>
                                    <span className="shrink-0 text-[9px]">{overdue ? 'Overdue' : statusLabel(issue.status)}</span>
                                  </span>
                                  <span className="line-clamp-2 w-full text-left text-[11px] font-medium">{issue.title}</span>
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && issues.length > 0 && undatedCount === issues.length && (
          <p role="status" className="px-3 py-8 text-center text-xs text-content-muted">
            Add a due date or planned date to place tasks on the calendar.
          </p>
        )}
        {!loading && issues.length === 0 && (
          <p role="status" className="px-3 py-8 text-center text-xs text-content-muted">
            No tasks match the current filters.
          </p>
        )}
      </div>
    </div>
  );
};
