import { describe, expect, it } from 'vitest';
import { buildDecisionContext } from './chatBuildDecision';

describe('main-chat review context', () => {
  const build = { runId: 'run-1', revision: 3, status: 'awaiting_plan_approval', orchestration: { run: { planVersion: 2 } } };
  it.each(['awaiting_plan_approval', 'awaiting_approval', 'publishing'])('sends the displayed %s revision without deciding an action', status => {
    expect(buildDecisionContext({ ...build, status }, false)).toEqual({ runId: 'run-1', expectedRevision: 3, planVersion: 2, evidenceReady: true });
  });
  it('marks an unrelated review as unavailable evidence', () => {
    expect(buildDecisionContext(build, true)?.evidenceReady).toBe(false);
  });
  it.each(['executing', 'paused', 'completed', 'blocked'])('does not attach approval context to %s', status => {
    expect(buildDecisionContext({ ...build, status }, false)).toBeUndefined();
  });
  it('handles a conversation without a build', () => expect(buildDecisionContext(null, false)).toBeUndefined());
});
