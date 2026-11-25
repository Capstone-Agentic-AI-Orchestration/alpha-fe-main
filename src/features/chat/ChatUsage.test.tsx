import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { usageTotal, workDuration, WorkUsageRow, type UsageEntry } from './ChatUsage';

const entry = (id: string, start: number, end?: number, totalTokens?: number): UsageEntry => ({ id, messageId: 'request', agentId: 'backend', provider: 'codex', model: 'model',
  startedAt: new Date(start).toISOString(), updatedAt: new Date(end ?? start).toISOString(), endedAt: end === undefined ? undefined : new Date(end).toISOString(),
  status: end === undefined ? 'running' : 'completed', usage: totalTokens === undefined ? {} : { totalTokens } });

describe('work and session usage', () => {
  it('unions parallel work and excludes the human waiting gap and the time after stopping', () => {
    const rows = [entry('a', 1_000, 11_000), entry('b', 6_000, 16_000), entry('retry', 40_000, 50_000)];
    expect(workDuration(rows, 100_000)).toBe(25_000);
    expect(workDuration([...rows, entry('live', 70_000)], 75_000)).toBe(30_000);
    expect(workDuration([{ ...entry('invalid', 100), startedAt: 'invalid' }])).toBe(0);
  });
  it('preserves unknown versus a measured zero and labels partial sessions', () => {
    expect(usageTotal([entry('unknown', 0, 1_000)])).toBeUndefined();
    expect(usageTotal([entry('zero', 0, 1_000, 0)])).toBe(0);
    const html = renderToStaticMarkup(<WorkUsageRow now={4_000} entries={[entry('one', 0, 1_000, 10), entry('unknown', 0, 1_000)]} />);
    expect(html).toContain('10 tokens'); expect(html).toContain('partial');
    expect(renderToStaticMarkup(<WorkUsageRow entries={[entry('unknown', 0, 3_000)]} now={100_000} />)).toContain('Worked for');
    expect(renderToStaticMarkup(<WorkUsageRow entries={[entry('unknown', 0, 3_000)]} now={100_000} />)).toContain('Tokens not reported');
  });
  it('uses a plain expandable work row and never fabricates a cost or subscription balance', () => {
    const html = renderToStaticMarkup(<WorkUsageRow entries={[entry('one', 0, undefined, 123)]} now={202_000} />);
    expect(html).toContain('Working for'); expect(html).toContain('3m 22s'); expect(html).toContain('123 tokens');
    expect(html).toContain('aria-expanded="false"'); expect(html).not.toContain('rounded-xl'); expect(html).not.toContain('$');
  });
});
