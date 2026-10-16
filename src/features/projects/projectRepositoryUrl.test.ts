import { describe, expect, it } from 'vitest';
import { normalizeProjectRepositoryUrl } from './projectRepositoryUrl';
describe('repository URL entry', () => {
  it('normalizes a pasted GitHub clone URL and leaves omission optional', () => {
    expect(normalizeProjectRepositoryUrl(' https://github.com/team/portal.git/ ')).toBe('https://github.com/team/portal');
    expect(normalizeProjectRepositoryUrl('')).toBe('');
  });
  it.each(['https://github.com/team/portal/tree/main', 'https://example.com/team/repo', 'https://user:secret@github.com/team/repo', 'http://github.com/team/repo', 'https://github.com/team/repo?token=secret'])('rejects a non-repository URL: %s', value => {
    expect(() => normalizeProjectRepositoryUrl(value)).toThrow();
  });
});
