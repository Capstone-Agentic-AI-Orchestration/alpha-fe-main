import { describe, expect, it } from 'vitest';
import type { ProviderLimits } from '@/shared/types';
import { freshQuota, tightestQuota } from './ProviderUsageContext';

const now = Date.parse('2026-11-14T10:00:00Z');
const provider: ProviderLimits = {
  provider: 'codex', name: 'Codex', status: 'available', dashboardUrl: '', detail: '', lastCheckedAt: new Date(now - 5000).toISOString(),
  windows: [
    { id: 'weekly', label: 'Weekly', usedPercent: 16, remainingPercent: 84, resetsAt: null },
    { id: 'short', label: 'Short window', usedPercent: 100, remainingPercent: 0, resetsAt: new Date(now + 5000).toISOString() },
  ],
};

describe('runtime quota displayed in the sidebar', () => {
  it('uses the tightest real limit and suppresses attention for unsupported, expired or stale checks', () => {
    expect(freshQuota(provider, now)?.remainingPercent).toBe(0);
    expect(freshQuota(provider, now + 5000)).toBeUndefined();
    expect(freshQuota({ ...provider, lastCheckedAt: null }, now)).toBeUndefined();
    expect(freshQuota({ ...provider, lastCheckedAt: new Date(now - 16 * 60_000).toISOString() }, now)).toBeUndefined();
    expect(tightestQuota({ ...provider, status: 'unsupported' })).toBeUndefined();
    expect(tightestQuota({ ...provider, windows: [] })).toBeUndefined();
  });
});
