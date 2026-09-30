import type { RepositoryCheckout } from '@/shared/types';

/**
 * How many of a project's repositories this machine has. A checkout whose
 * folder has since been moved or deleted counts as missing: an agent cannot
 * work in it either.
 */
export function summarizeCheckouts(checkouts: RepositoryCheckout[]): { total: number; onMachine: number; missing: string[] } {
  const missing = checkouts.filter(c => !c.localDir || c.status?.exists === false).map(c => c.repo);
  return { total: checkouts.length, onMachine: checkouts.length - missing.length, missing };
}
