import type { AgentCall } from '@/shared/types';
const terminal = new Set(['completed', 'failed', 'cancelled']);
const time = (call: AgentCall) => Math.max(0, ...[call.createdAt, call.startedAt, call.completedAt, ...call.activities.map(item => item.createdAt)]
  .map(value => Date.parse(value ?? '')).filter(Number.isFinite));

/** An older HTTP/socket snapshot must not restart a completed invocation or cross chat boundaries. */
export function reconcileCallSnapshot(current: AgentCall | undefined, next: AgentCall, threadId: string): AgentCall | undefined {
  if (next.threadId !== threadId) return undefined;
  if (!current || current.threadId !== threadId) return next;
  const previousTime = time(current), nextTime = time(next);
  if (nextTime < previousTime || (terminal.has(current.status) && !terminal.has(next.status) && nextTime <= previousTime)) return current;
  return next;
}
