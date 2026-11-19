import { describe, expect, it } from 'vitest';
import { orgBlocksRepoCreation } from './orgRepoPolicy';

describe('warning that an org stops members creating repositories', () => {
  it('warns a member only when GitHub says the org blocks them', () => {
    expect(orgBlocksRepoCreation({ login: 'acme', role: 'member', membersCanCreateRepositories: false })).toBe(true);
    expect(orgBlocksRepoCreation({ login: 'acme', role: 'member', membersCanCreateRepositories: true })).toBe(false);
  });

  it('stays quiet for owners and when the rule is unknown', () => {
    expect(orgBlocksRepoCreation({ login: 'acme', role: 'admin', membersCanCreateRepositories: false })).toBe(false);
    expect(orgBlocksRepoCreation({ login: 'acme', role: 'member' })).toBe(false);
    expect(orgBlocksRepoCreation(undefined)).toBe(false);
  });
});
