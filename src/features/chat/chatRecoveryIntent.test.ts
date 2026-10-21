import { describe, expect, it } from 'vitest';
import { inferRecoveryAction, isExplicitBuildRetry } from './chatRecoveryIntent';

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
});
