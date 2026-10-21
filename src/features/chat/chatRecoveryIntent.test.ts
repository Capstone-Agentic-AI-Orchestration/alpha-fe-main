import { describe, expect, it } from 'vitest';
import { inferRecoveryAction, isExplicitBuildRetry, resolveRecoveryAction } from './chatRecoveryIntent';

describe('chat recovery intent', () => {
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
});
