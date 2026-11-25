import { describe, expect, it } from 'vitest';
import { initialsOf, lostWorkingCopyText, nextStepFor, suggestSubtasks, taskHandoffContext, taskHandoffMessage, taskStage, visibleLabels, type NextStepInput } from './taskFlow';

const base: NextStepInput = {
  status: 'todo',
  buildActive: false,
  canManageIssues: true,
  canStartBuild: true,
  canHandOffToChat: false,
  hasBuildChat: false
};

describe('suggestSubtasks', () => {
  it('uses list lines when the description has them', () => {
    expect(suggestSubtasks('Goals:\n- show free slots for four weeks\n- hold a slot while confirming\n1) remove booked slots for everyone')).toEqual([
      'Show free slots for four weeks',
      'Hold a slot while confirming',
      'Remove booked slots for everyone'
    ]);
  });

  it('falls back to sentences and skips fragments and duplicates', () => {
    expect(suggestSubtasks('Clients pick a free slot. Ok. Clients pick a free slot! Booked slots disappear for everyone.')).toEqual([
      'Clients pick a free slot',
      'Booked slots disappear for everyone'
    ]);
  });

  it('suggests nothing for an empty description', () => {
    expect(suggestSubtasks('   ')).toEqual([]);
  });
});

describe('task hand-off', () => {
  it('writes one plain sentence naming the task', () => {
    expect(taskHandoffMessage({ identifier: 'WEB-19', title: 'Homepage hero redesign.' })).toBe('Please work on WEB-19: Homepage hero redesign.');
  });

  it('carries the description and only open subtasks', () => {
    const context = taskHandoffContext({
      identifier: 'WEB-19',
      title: 'Homepage hero redesign',
      description: 'Use the darker photo.',
      subtasks: [{ id: 'a', title: 'Shorten headline', completed: false }, { id: 'b', title: 'Done already', completed: true }]
    });
    expect(context).toContain('Use the darker photo.');
    expect(context).toContain('- Shorten headline');
    expect(context).not.toContain('Done already');
  });
});

describe('nextStepFor', () => {
  it('offers a build plan to a role without chat', () => {
    expect(nextStepFor(base).primary).toEqual({ label: 'Build with Alpha', action: 'plan_build' });
  });

  it('offers the chat hand-off first to a role with chat', () => {
    const step = nextStepFor({ ...base, canHandOffToChat: true });
    expect(step.primary?.action).toBe('handoff_chat');
    expect(step.secondary?.action).toBe('plan_build');
  });

  it('explains that review-only roles wait for a developer', () => {
    const step = nextStepFor({ ...base, canStartBuild: false });
    expect(step.title).toBe('Ready for a developer');
    expect(step.text).toContain('review the resulting work');
    expect(step.primary).toBeUndefined();
  });

  it('sends active build decisions to the task, with chat as a secondary way in', () => {
    const step = nextStepFor({ ...base, buildActive: true, buildStatus: 'awaiting_plan_approval', hasBuildChat: true });
    expect(step.title).toBe('Plan ready to approve');
    expect(step.primary?.action).toBe('open_build');
    expect(step.secondary?.action).toBe('open_chat');
  });

  it('needs no chat to act on a build', () => {
    for (const buildStatus of ['awaiting_approval', 'blocked', 'recovery_required', 'paused', 'executing']) {
      const step = nextStepFor({ ...base, buildActive: true, buildStatus });
      expect(step.primary?.action).toBe('open_build');
      expect(step.secondary).toBeUndefined();
      expect(step.text).not.toMatch(/project chat/);
    }
  });

  it('lets managers finish or return reviewed work', () => {
    const step = nextStepFor({ ...base, status: 'review' });
    expect(step.primary?.action).toBe('mark_done');
    expect(step.secondary?.action).toBe('request_changes');
  });

  it('points reviewed work with a pull request at merging it, not at a second review', () => {
    const step = nextStepFor({ ...base, status: 'review', canManageIssues: true, prUrl: 'https://github.com/acme/web/pull/7' });
    expect(step).toMatchObject({ title: 'Pull request open', primary: { action: 'open_pr' }, secondary: { action: 'mark_done' } });
  });

  it('tells the reader a lost build cannot be approved, and where to stop it', () => {
    const step = nextStepFor({ ...base, buildActive: true, buildStatus: 'awaiting_approval', buildLost: true });
    expect(step).toMatchObject({ title: 'This build can no longer be approved', primary: { action: 'open_build' } });
  });

  it('finds the plain sentence in a lost-working-copy reason, even inside an API error', () => {
    expect(lostWorkingCopyText('API Error [404]: Build working copy lost: The acme/web working copy is gone.')).toBe('The acme/web working copy is gone.');
    expect(lostWorkingCopyText('API Error [409]: The build changed.')).toBeUndefined();
    expect(lostWorkingCopyText(undefined)).toBeUndefined();
  });

  it('only offers reopen on done tasks to managers', () => {
    expect(nextStepFor({ ...base, status: 'done' }).secondary?.action).toBe('reopen');
    expect(nextStepFor({ ...base, status: 'done', canManageIssues: false }).secondary).toBeUndefined();
  });
});

describe('taskStage', () => {
  const todo = { status: 'todo' as const };

  it('follows the stored status when no build holds the task', () => {
    for (const build of [undefined, 'none', 'completed', 'cancelled', 'failed']) {
      expect(taskStage(todo, build)).toEqual({ column: 'todo', needsYou: false, buildOwned: false });
    }
  });

  it('puts a finished build waiting for final review in In review', () => {
    expect(taskStage(todo, 'awaiting_approval')).toEqual({ column: 'review', needsYou: true, buildOwned: true });
  });

  it('keeps unfinished builds that wait on a person in Building, flagged', () => {
    for (const build of ['awaiting_plan_approval', 'paused', 'blocked', 'recovery_required']) {
      expect(taskStage(todo, build)).toEqual({ column: 'agent_running', needsYou: true, buildOwned: true });
    }
  });

  it('shows working builds as Building', () => {
    for (const build of ['planning', 'executing', 'validating', 'publishing', 'cancelling']) {
      expect(taskStage({ status: 'in_progress' }, build)).toEqual({ column: 'agent_running', needsYou: false, buildOwned: true });
    }
  });

  it('keeps a build whose working copy is lost out of In review: it can only be stopped', () => {
    expect(taskStage(todo, 'awaiting_approval', true)).toEqual({ column: 'agent_running', needsYou: true, buildOwned: true });
  });

  it('never moves a done task', () => {
    expect(taskStage({ status: 'done' }, 'awaiting_approval').column).toBe('done');
  });
});

describe('visibleLabels', () => {
  it('hides Alpha bookkeeping labels', () => {
    expect(visibleLabels(['alpha:chat-build', 'frontend', 'alpha:task-orchestration'])).toEqual(['frontend']);
  });
});

describe('initialsOf', () => {
  it('takes two initials', () => {
    expect(initialsOf('maya-reyes')).toBe('MR');
    expect(initialsOf('')).toBe('?');
  });
});
