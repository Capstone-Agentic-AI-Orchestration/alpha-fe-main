import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActionsRunDetail, ActionsStatus } from './ActionsRunDetail';
import { ProjectActionsView } from './ProjectActionsView';
import { actionsDuration, actionsSize } from './actionsFormat';
import { actionsError } from './useActionsResource';
import { ApiRequestError } from '@/shared/services/apiService';
import type { ActionsRun } from '@/shared/types/actions';

const selected: ActionsRun = { id: 11, repository: 'acme/shop', name: 'Backend CI', title: 'Fix health endpoint', number: 8, attempt: 2,
  workflowId: 4, branch: 'dev', sha: 'abc1234', actor: 'octocat', event: 'push', status: 'completed', conclusion: 'failure',
  createdAt: '2026-10-25T00:00:00Z', updatedAt: '2026-10-25T00:01:00Z', url: 'https://github.com/acme/shop/actions/runs/11' };

describe('project Actions UI', () => {
  it('keeps history filters in the project rather than sending users to GitHub', () => {
    const html = renderToStaticMarkup(<ProjectActionsView projectId="p1" repositories={['acme/shop']} repository={null} active={false} canPromote={false} />);
    expect(html).toContain('Actions run filters'); expect(html).toContain('All branches');
    expect(html).toContain('Workflow in acme/shop'); expect(html).toContain('All workflows');
    expect(html).not.toContain('href="https://github.com');
  });
  it('renders project-local run detail tabs and metadata', () => {
    const html = renderToStaticMarkup(<ActionsRunDetail projectId="p1" selected={selected} active={false} onBack={vi.fn()} />);
    for (const text of ['Back to runs', 'Jobs and steps', 'Summary', 'Logs', 'Artifacts', 'Fix health endpoint', 'octocat', 'Run attempt']) expect(html).toContain(text);
    expect(html).toContain('Failed'); expect(html).not.toContain('Success');
  });
  it('does not confuse completed runs with successful or skipped results', () => {
    expect(renderToStaticMarkup(<ActionsStatus value={{ status: 'completed', conclusion: 'timed_out' }} />)).toContain('Timed out');
    expect(renderToStaticMarkup(<ActionsStatus value={{ status: 'completed', conclusion: 'skipped' }} />)).toContain('Skipped');
    expect(renderToStaticMarkup(<ActionsStatus value={{ status: 'in_progress', conclusion: null }} />)).toContain('In progress');
  });
  it('only calculates duration from valid ordered timestamps', () => {
    expect(actionsDuration(undefined, selected.updatedAt)).toBe('—');
    expect(actionsDuration('invalid', selected.updatedAt)).toBe('—');
    expect(actionsDuration(selected.updatedAt, selected.createdAt)).toBe('—');
    expect(actionsDuration(selected.createdAt, selected.updatedAt)).toBe('1m 0s');
    expect(actionsSize(1048576)).toBe('1.0 MB');
  });
  it('distinguishes sign-in, access, provider throttling and missing records', () => {
    expect(actionsError(new ApiRequestError(401, 'API Error [401]: Signed out'))).toContain('Sign in');
    expect(actionsError(new ApiRequestError(403, 'API Error [403]: Forbidden'))).toContain('SSO');
    expect(actionsError(new ApiRequestError(429, 'API Error [429]: Limited'))).toContain('limiting');
    expect(actionsError(new ApiRequestError(404, 'API Error [404]: Not Found'))).toContain('deleted');
  });
});
