import { describe, expect, it } from 'vitest';
import { inferRecoveryAction, isContinueRequest, isExplicitBuildRetry, resolveRecoveryAction } from './chatRecoveryIntent';

describe('chat recovery intent', () => {
  it('treats everyday ways of saying carry on as a request to continue the build', () => {
    for (const message of [
      'continue', 'Continue.', 'continue with the plan', 'can you continue with the plan', 'Could you continue?',
      'fix and continue', 'go ahead', 'keep going please', 'proceed', 'resume the build', 'start the planned work',
      "ok let's go", 'yes, carry on'
    ]) expect(isContinueRequest(message), message).toBe(true);
  });

  it('ignores questions, negations and requests to continue an answer', () => {
    for (const message of [
      'should we continue?', 'what happens if we continue', 'why did it stop, can it continue?', "don't continue yet",
      'wait, do not proceed', 'hold off before you start the plan', 'continue explaining the login flow',
      'continue to describe the architecture', 'add a dark mode toggle'
    ]) expect(isContinueRequest(message), message).toBe(false);
  });

  it('routes a direct build rerun request to build recovery', () => {
    expect(isExplicitBuildRetry('Can you rerun the build?')).toBe(true);
    expect(inferRecoveryAction('Can you rerun the build?')).toBe('repair_and_continue');
  });

  it('does not launch a rerun when the user says not to', () => {
    expect(isExplicitBuildRetry("Don't rerun the build")).toBe(false);
    expect(inferRecoveryAction("Don't rerun the build")).toBeUndefined();
  });

  it('explains a blocked retry question instead of starting another attempt', () => {
    expect(isExplicitBuildRetry("Why can't I rerun the build?")).toBe(false);
    expect(inferRecoveryAction("Why can't I rerun the build?")).toBe('explain_failure');
  });

  it('routes report-format corrections to the report-only action', () => {
    expect(inferRecoveryAction('Please fix the missing report field')).toBe('retry_report_format');
  });

  it('routes explicit repair guidance before checkpoint continuation wording', () => {
    expect(inferRecoveryAction('Fix the failing checks and continue from checkpoint')).toBe('repair_and_continue');
    expect(inferRecoveryAction('Please rerun this build from the saved checkpoint')).toBe('repair_and_continue');
    expect(inferRecoveryAction('Resume from checkpoint')).toBe('recheck_prerequisite');
  });

  it('resolves checkpoint continuation against the actual recovery category and available actions', () => {
    const continuation = inferRecoveryAction('Continue this build from the saved checkpoint')!;
    expect(continuation).toBe('recheck_prerequisite');
    expect(resolveRecoveryAction(continuation, {
      category: 'project_code', availableActions: ['repair_and_continue']
    })).toBe('repair_and_continue');
    expect(resolveRecoveryAction('repair_and_continue', {
      category: 'project_code', availableActions: ['provide_guidance']
    })).toBe('provide_guidance');
    expect(resolveRecoveryAction('repair_and_continue', {
      category: 'report', availableActions: ['retry_report_format']
    })).toBe('retry_report_format');
  });

  it('uses the available workspace prerequisite retry instead of an unavailable checkpoint resume', () => {
    expect(resolveRecoveryAction('repair_and_continue', {
      category: 'workspace', availableActions: ['recheck_prerequisite', 'review_saved_changes']
    })).toBe('recheck_prerequisite');
    expect(resolveRecoveryAction('recheck_prerequisite', {
      category: 'workspace', availableActions: ['resume_checkpoint', 'review_saved_changes']
    })).toBe('resume_checkpoint');
  });
});
