import { describe, expect, it } from 'vitest';
import { repoResourceState } from './useRepoResource';

describe('repository loading scope', () => {
  const main = { key: 'main', data: ['README.md'], error: null };

  it('loads on the first render and hides another branch before its effect runs', () => {
    expect(repoResourceState(null, 'main', true, false)).toEqual({ data: null, error: null, loading: true });
    expect(repoResourceState(main, 'uat', true, false)).toEqual({ data: null, error: null, loading: true });
  });

  it('keeps same-branch data on refresh and leaves disabled reads idle', () => {
    expect(repoResourceState(main, 'main', true, true)).toEqual({ data: ['README.md'], error: null, loading: true });
    expect(repoResourceState(main, 'main', false, true)).toEqual({ data: null, error: null, loading: false });
  });
});
