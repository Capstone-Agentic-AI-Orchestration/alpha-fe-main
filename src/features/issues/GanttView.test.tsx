import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Issue, Project } from '@/shared/types';
import { GanttView, SET_DATES_WIDTH, defaultGanttRange, ganttDayWidth, todayLabelAlign, unscheduledLaneLeft } from './GanttView';

const DAY_MS = 24 * 60 * 60 * 1000;
const day = (key: string) => Math.floor(Date.parse(key + 'T00:00:00.000Z') / DAY_MS);
const issue = (id: string, extra: Partial<Issue> = {}) => ({
  id, identifier: id.toUpperCase(), title: 'Task ' + id, status: 'todo', priority: 'none', labels: [],
  parentIssueId: null, dependsOnIssueIds: [], ...extra,
}) as unknown as Issue;
const project = (extra: Partial<Project> = {}) => ({ id: 'p1', name: 'E-Commerce', milestones: [], ...extra }) as unknown as Project;

describe('gantt default range', () => {
  const today = day('2026-11-18'); // a Wednesday

  it('opens on the current fortnight when nothing has dates yet', () => {
    expect(defaultGanttRange([], today)).toEqual({ start: day('2026-11-16'), end: day('2026-11-29') });
  });

  it('includes today when the planned work is near it, so the Today line shows', () => {
    const range = defaultGanttRange([day('2026-10-24')], today);
    expect(range.start).toBe(day('2026-10-19'));
    expect(range.end).toBe(today);
  });

  it('leaves today out when the plan is far away, and always spans at least a week', () => {
    expect(defaultGanttRange([day('2027-06-02')], today)).toEqual({ start: day('2027-05-31'), end: day('2027-06-06') });
  });
});

describe('gantt day width', () => {
  it('stretches days to fill the chart when Fit is on', () => {
    expect(ganttDayWidth(true, 50, 1400, 7)).toBe(200);
  });

  it('keeps the scale width without Fit, and never shrinks below the minimum', () => {
    expect(ganttDayWidth(false, 50, 1400, 7)).toBe(50);
    expect(ganttDayWidth(true, 50, 100, 365)).toBe(8);
  });
});

describe('gantt rows', () => {
  it('lists tasks without dates inside the chart with a way to schedule them', () => {
    const html = renderToStaticMarkup(<GanttView project={project()} issues={[issue('a'), issue('b')]} canManageIssues onOpenIssue={() => {}} />);
    expect(html).toContain('Not scheduled');
    expect(html).toContain('Set dates for A: Task a');
    expect(html).not.toContain('Unscheduled tasks');
    expect(html).not.toContain('No tasks to plan yet');
  });

  it('tells people who cannot edit that a task has no dates yet', () => {
    const html = renderToStaticMarkup(<GanttView project={project()} issues={[issue('a')]} canManageIssues={false} onOpenIssue={() => {}} />);
    expect(html).toContain('No dates yet');
    expect(html).not.toContain('Set dates for');
  });

  it('marks a one-day project schedule as a point instead of an empty bar', () => {
    const html = renderToStaticMarkup(<GanttView project={project({ startDate: '2026-10-24' } as Partial<Project>)} issues={[]} canManageIssues onOpenIssue={() => {}} />);
    expect(html).toContain('E-Commerce project date 2026-10-24');
    expect(html).not.toContain('project schedule, 2026-10-24 to 2026-10-24');
  });

  it('keeps the empty state for a project with no tasks and no dates', () => {
    const html = renderToStaticMarkup(<GanttView project={project()} issues={[]} canManageIssues onOpenIssue={() => {}} />);
    expect(html).toContain('No tasks to plan yet');
  });
});

describe('Gantt chips and the Today marker', () => {
  it('puts "Set dates" just after the Today line when there is room', () => {
    expect(unscheduledLaneLeft(200, 1000)).toBe(208);
  });

  it('puts "Set dates" before the Today line when Today is near the end, never across it', () => {
    const today = 980;
    const left = unscheduledLaneLeft(today, 1000);
    expect(left + SET_DATES_WIDTH).toBeLessThanOrEqual(today);
    expect(left).toBeGreaterThanOrEqual(0);
  });

  it('keeps "Set dates" inside the chart without a Today line or in a tiny chart', () => {
    expect(unscheduledLaneLeft(undefined, 1000)).toBe(8);
    expect(unscheduledLaneLeft(40, 60)).toBe(8);
  });

  it('pins the Today label inside the chart near either edge', () => {
    expect(todayLabelAlign(5, 1000)).toBe('start');
    expect(todayLabelAlign(500, 1000)).toBe('center');
    expect(todayLabelAlign(990, 1000)).toBe('end');
  });
});
