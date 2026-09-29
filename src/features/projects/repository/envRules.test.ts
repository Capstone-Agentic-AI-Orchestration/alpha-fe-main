import { describe, expect, it } from 'vitest';

import { envKeyProblem, envRowsProblem, parseEnvText } from './envRules';

const MANAGED = new Set(['VITE_API_URL', 'CORS_ORIGINS']);

describe('hosting variable names', () => {
  it.each([
    ['STRIPE_KEY', null],
    ['_PRIVATE', null],
    ['', 'Name required.'],
    ['1ST', 'Use A–Z, 0–9 and _, not starting with a digit.'],
    ['lower', 'Use A–Z, 0–9 and _, not starting with a digit.'],
    ['VITE_API_URL', 'Set by Alpha from the paired repository.'],
    ['VERCEL_ENV', 'Reserved by the hosting platform.']
  ])('%s -> %s', (key, problem) => {
    expect(envKeyProblem(key, MANAGED)).toBe(problem);
  });

  it('reports the first problem across rows', () => {
    expect(envRowsProblem([], MANAGED)).toBe('Add at least one variable.');
    expect(envRowsProblem([{ key: 'A_KEY', value: 'x' }, { key: 'A_KEY', value: 'y' }], MANAGED)).toBe('A_KEY is listed twice.');
    expect(envRowsProblem([{ key: 'A_KEY', value: '' }], MANAGED)).toBe('A_KEY needs a value.');
    expect(envRowsProblem([{ key: 'A_KEY', value: 'x' }], MANAGED)).toBeNull();
  });
});

describe('pasting a .env file', () => {
  it('reads keys and values, skipping comments, blanks and export, unquoting values', () => {
    const parsed = parseEnvText(
      ['# comment', '', 'export DATABASE_URL="postgres://app:pw@db/shop"', "STRIPE_KEY='sk_test_1'", 'EMPTY=', 'not a pair'].join('\n')
    );

    expect(parsed.rows).toEqual([
      { key: 'DATABASE_URL', value: 'postgres://app:pw@db/shop' },
      { key: 'STRIPE_KEY', value: 'sk_test_1' },
      { key: 'EMPTY', value: '' }
    ]);
    expect(parsed.skipped).toBe(1);
  });

  it('keeps the last of a duplicated key, and says which', () => {
    expect(parseEnvText('A_KEY=1\nA_KEY=2')).toEqual({ rows: [{ key: 'A_KEY', value: '2' }], duplicates: ['A_KEY'], skipped: 0 });
  });

  it('keeps an = inside a value', () => {
    expect(parseEnvText('TOKEN=abc==').rows).toEqual([{ key: 'TOKEN', value: 'abc==' }]);
  });
});
