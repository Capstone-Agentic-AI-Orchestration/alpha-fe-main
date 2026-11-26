import { describe, expect, it } from 'vitest';
import type { ProjectBuildOrchestration } from '@/shared/types';
import { buildWorkSummary, formatDuration, isWorkingBuildStatus, stepFor, stepGroups, type StepSource } from './transcript';

const activity = (id: string, kind: string, message: string, extra: Partial<StepSource> = {}): StepSource =>
  ({ id, kind, message, createdAt: `2026-11-26T00:00:0${id}.000Z`, ...extra });

describe('steps in the conversation', () => {
  it('reads tool calls as short past-tense steps', () => {
    expect(stepFor(activity('1', 'tool', 'Read src/App.tsx', { toolName: 'mcp__alpha-task-files__project_read_file' })))
      .toMatchObject({ verb: 'Read', target: 'src/App.tsx' });
    expect(stepFor(activity('2', 'tool', 'Used mcp__alpha-task-files__project_run_check', { detail: '{"script":"test"}' })))
      .toMatchObject({ verb: 'Ran the test check' });
    expect(stepFor(activity('3', 'tool', 'Used mcp__alpha-task-files__project_list_repositories', { detail: '{}' })))
      .toMatchObject({ verb: 'Listed the codebases' });
    expect(stepFor(activity('3', 'tool', 'Used mcp__alpha-task-files__project_submit_work', { detail: '{"report":{}}' })))
      .toMatchObject({ verb: 'Handed in the work' });
    expect(stepFor(activity('4', 'tool', 'Ran command: status'))).toMatchObject({ verb: 'Ran', target: 'status' });
    expect(stepFor(activity('5', 'tool', 'Reading project files', { paths: ['src/a.ts', 'src/b.ts'] })))
      .toMatchObject({ verb: 'Read', target: 'src/a.ts', extra: 'and 1 more' });
    expect(stepFor(activity('6', 'tool', 'Command requested', { detail: 'npm test' }))).toMatchObject({ verb: 'Ran', target: 'npm test' });
    expect(stepFor(activity('7', 'tool', 'WebFetch activity'))).toMatchObject({ verb: 'WebFetch' });
  });

  it('shows edits with their file, and leaves bookkeeping out', () => {
    expect(stepFor(activity('1', 'file_change', 'Agent is editing project files', { paths: ['src/App.css'] })))
      .toMatchObject({ verb: 'Edited', target: 'src/App.css' });
    for (const kind of ['status', 'summary', 'tool_result', 'assistant', 'error', 'stage', 'handoff']) {
      expect(stepFor(activity('1', kind, 'Run accepted and workspace preparation started.'))).toBeNull();
    }
  });

  it('groups steps by agent, keeps the latest, and shows a repeated step once', () => {
    const groups = stepGroups([
      { key: 'fe', agentName: 'Frontend agent', working: true, activity: [
        activity('3', 'tool', 'Read src/App.tsx'), activity('1', 'tool', 'Read src/main.tsx'),
        activity('2', 'tool', 'Read src/main.tsx'), activity('4', 'file_change', 'x', { paths: ['src/App.tsx'] })
      ] },
      { key: 'qa', agentName: 'Checking agent', working: false, activity: [activity('1', 'status', 'Run completed')] },
      { key: 'be', agentName: 'Backend agent', working: true, activity: [] }
    ], 2);
    expect(groups.map(group => group.agentName)).toEqual(['Frontend agent', 'Backend agent']);
    expect(groups[0].earlier).toBe(1);
    expect(groups[0].steps.map(step => step.verb + ' ' + step.target)).toEqual(['Read src/App.tsx', 'Edited src/App.tsx']);
    expect(groups[1].steps).toEqual([]);
  });
});

describe('the line a finished build folds into', () => {
  const orchestration = (status: string, commands: Array<{ exitCode: number | null }>) => ({
    run: { status },
    attempts: [{ agentName: 'Frontend agent' }, { agentName: 'Frontend agent' }, { agentName: 'Checking agent' }],
    finalValidation: { commands: commands.map(command => ({ ...command, signal: null })), missingScripts: [], noOpenBlockingFindings: true }
  }) as unknown as ProjectBuildOrchestration;

  it('says how long, how many agents, and how the checks went', () => {
    expect(buildWorkSummary(orchestration('awaiting_approval', [{ exitCode: 0 }, { exitCode: 0 }]), 192_000))
      .toBe('Worked for 3m 12s · 2 agents · every check passed');
    expect(buildWorkSummary(orchestration('failed', [{ exitCode: 0 }, { exitCode: 1 }]), 9_000))
      .toBe('Stopped after 9s · 2 agents · 1 of 2 checks failed');
    expect(buildWorkSummary(orchestration('completed', []), 61_000)).toBe('Worked for 1m 1s · 2 agents');
  });

  it('knows which builds are still working', () => {
    expect(['planning', 'executing', 'validating', 'cancelling'].every(isWorkingBuildStatus)).toBe(true);
    expect(['awaiting_plan_approval', 'awaiting_approval', 'blocked', 'completed', undefined].some(isWorkingBuildStatus)).toBe(false);
    expect(formatDuration(-5)).toBe('0s');
  });
});
