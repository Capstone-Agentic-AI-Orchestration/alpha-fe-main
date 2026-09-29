import { describe, expect, it } from 'vitest';
import { summarizeCheckouts } from './checkoutSummary';

const here = (repo: string, exists = true) => ({
  repo,
  localDir: `C:/code/${repo}`,
  managed: false,
  status: { exists, clean: true, ahead: 0, behind: 0 }
});
const missing = (repo: string) => ({ repo, localDir: null, managed: false, status: null });

describe('how many of a project’s repositories this machine has', () => {
  it('counts each repository of a pair on its own', () => {
    expect(summarizeCheckouts([here('acme/shop-be'), missing('acme/shop-fe')])).toEqual({
      total: 2,
      onMachine: 1,
      missing: ['acme/shop-fe']
    });
  });

  /** An agent cannot work in a folder that has been moved or deleted, so neither does the count. */
  it('counts a checkout whose folder has gone as missing', () => {
    expect(summarizeCheckouts([here('acme/shop-be', false), here('acme/shop-fe')]).missing).toEqual(['acme/shop-be']);
  });

  it('is nothing for a project with no repository', () => {
    expect(summarizeCheckouts([])).toEqual({ total: 0, onMachine: 0, missing: [] });
  });
});
