import { describe, expect, it } from 'vitest';
import type { AgentCall } from '@/shared/types';
import { reconcileCallSnapshot } from './chatCallSnapshot';
const call = (status: AgentCall['status'], second: number): AgentCall => ({ id: 'call', threadId: 'chat', status, createdAt: '2026-10-25T01:00:00Z', startedAt: '2026-10-25T01:00:01Z', activities: [{ id: 'status', createdAt: `2026-10-25T01:00:${String(second).padStart(2, '0')}Z` }] } as AgentCall);
describe('live call snapshots', () => {
  it.each(['completed','cancelled','failed'] as const)('keeps %s idle when an older running frame arrives', status => {
    const stopped = call(status, 20);
    expect(reconcileCallSnapshot(stopped, call('running', 10), 'chat')).toBe(stopped);
    expect(reconcileCallSnapshot(stopped, call('running', 20), 'chat')).toBe(stopped);
  });
  it('accepts a confirmed retry with new execution evidence', () => {
    expect(reconcileCallSnapshot(call('failed', 20), call('running', 30), 'chat')?.status).toBe('running');
  });
  it('rejects an in-flight response from another conversation', () => {
    expect(reconcileCallSnapshot(undefined, call('running', 30), 'other')).toBeUndefined();
  });
});
