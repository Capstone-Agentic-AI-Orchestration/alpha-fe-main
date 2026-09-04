import { PrototypeRun, RunUsage } from '@/shared/types';

/**
 * Reading the token figures a run reported.
 *
 * Mirrors the daemon's services/runUsage.ts. The rule both sides keep: a
 * missing figure means the CLI did not report it, never that it was zero.
 * codex reports no cache reads, Claude no separate thinking tokens, and
 * Antigravity no cost at all — rendering any of those as 0 would put an
 * invented number on a billing screen.
 */

/**
 * Every token that moved through the model for this run, or undefined when
 * nothing was reported.
 *
 * Cache reads are included. On the measured Claude turn they were 68,492 of
 * roughly 70,000 tokens against 4 of fresh input, so excluding them would
 * report that run as having used four tokens — true, and useless.
 */
export function runTokenTotal(run: { usage?: RunUsage }): number | undefined {
  const u = run.usage;
  if (!u) return undefined;

  const parts = [
    u.inputTokens,
    u.outputTokens,
    u.cacheReadTokens,
    u.cacheCreationTokens,
    u.thinkingTokens
  ].filter((n): n is number => typeof n === 'number');

  return parts.length ? parts.reduce((a, b) => a + b, 0) : undefined;
}

/** Compact token count for dense UI: 68492 becomes "68.5k". */
export function formatTokens(total: number): string {
  if (total < 1000) return String(total);
  if (total < 1_000_000) return `${(total / 1000).toFixed(1)}k`;
  return `${(total / 1_000_000).toFixed(2)}M`;
}

/**
 * One line describing what a run cost, or null when nothing was measured.
 *
 * Returning null rather than "0 tokens" is the point: every run recorded
 * before token columns existed is unmeasured, not free, and the two must not
 * look the same.
 */
export function describeRunUsage(run: PrototypeRun): string | null {
  const total = runTokenTotal(run);
  if (total === undefined) return null;

  const parts = [`${formatTokens(total)} tokens`];

  const cached = run.usage?.cacheReadTokens;
  if (typeof cached === 'number' && total > 0) {
    parts.push(`${Math.round((cached / total) * 100)}% from cache`);
  }

  // Alpha spawns the machine's own signed-in CLIs, so this is not a bill —
  // it is what the same work would have cost through the API, and only the
  // Claude CLI reports it.
  const cost = run.usage?.costUsd;
  if (typeof cost === 'number') parts.push(`~$${cost.toFixed(2)} at API rates`);

  return parts.join(' · ');
}
