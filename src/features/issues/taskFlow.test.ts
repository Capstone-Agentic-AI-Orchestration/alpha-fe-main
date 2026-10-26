import { describe, expect, it } from 'vitest';
import { initialsOf, nextStepFor, suggestSubtasks, taskHandoffContext, taskHandoffMessage, type NextStepInput } from './taskFlow';

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
    expect(nextStepFor(base).primary).toEqual({ label: 'Plan a build', action: 'plan_build' });
  });

  it('offers the chat hand-off first to a role with chat', () => {
    const step = nextStepFor({ ...base, canHandOffToChat: true });
    expect(step.primary?.action).toBe('handoff_chat');
    expect(step.secondary?.action).toBe('plan_build');
  });

  it('sends active builds to their chat', () => {
    const step = nextStepFor({ ...base, buildActive: true, buildStatus: 'awaiting_plan_approval', hasBuildChat: true });
    expect(step.title).toBe('Plan ready to approve');
    expect(step.primary?.action).toBe('open_chat');
  });

  it('has no chat button when the build chat is unknown', () => {
    expect(nextStepFor({ ...base, buildActive: true, buildStatus: 'executing' }).primary).toBeUndefined();
  });

  it('lets managers finish or return reviewed work', () => {
    const step = nextStepFor({ ...base, status: 'review' });
    expect(step.primary?.action).toBe('mark_done');
    expect(step.secondary?.action).toBe('request_changes');
  });

  it('only offers reopen on done tasks to managers', () => {
    expect(nextStepFor({ ...base, status: 'done' }).secondary?.action).toBe('reopen');
    expect(nextStepFor({ ...base, status: 'done', canManageIssues: false }).secondary).toBeUndefined();
  });
});

describe('initialsOf', () => {
  it('takes two initials', () => {
    expect(initialsOf('maya-reyes')).toBe('MR');
    expect(initialsOf('')).toBe('?');
  });
});
