import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Issue } from '@/shared/types';
import type { IssueBuildStatus } from '@/shared/services/apiService';
let role = 'dev';
vi.mock('@/app/AppContext', () => ({ useApp: () => ({ role, can: () => role === 'dev' }) }));
import { BuildRequestPanel } from './BuildRequestPanel';
const issue = { id: 'issue', projectId: 'project' } as Issue;
const build: IssueBuildStatus = { issueId: 'issue', projectId: 'project', runId: 'old-cancelled', status: 'cancelled', updatedAt: '', fresh: true,
  blocker: { identifier: 'CAP-103', issueId: 'other', projectId: 'project', runId: 'parent', status: 'blocked', repository: 'acme/app' } };
const render = (value = build) => renderToStaticMarkup(<BuildRequestPanel issue={issue} build={value} onOpenTask={() => undefined} />);
describe('canonical task waiting controls', () => {
  it('shows the actual blocker and an explicit queue action instead of ready or failed', () => {
    const html = render(); expect(html).toContain('Waiting for CAP-103'); expect(html).toContain('Open CAP-103'); expect(html).toContain('Queue plan');
    expect(html).not.toContain('Ready to build'); expect(html).not.toContain('Retry run');
  });
  it('keeps queued planning distinct from running and offers only removal of that request', () => {
    const html = render({ ...build, request: { id: 'queued', status: 'waiting' } });
    expect(html).toContain('Plan queued'); expect(html).toContain('Remove queued request'); expect(html).not.toContain('Stop build');
  });
  it('does not expose AI actions for PMs or stale state', () => {
    role = 'pm'; try { expect(render()).not.toContain('Queue plan'); } finally { role = 'dev'; }
    const stale = render({ ...build, fresh: false }); expect(stale).toContain('Build status unavailable'); expect(stale).not.toContain('Queue plan');
  });
});
