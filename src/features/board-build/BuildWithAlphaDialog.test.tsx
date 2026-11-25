import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Issue } from '@/shared/types';

const app = { can: (_: string) => true, agents: [{ id: 'a1', name: 'Bea', role: 'Backend Agent' }, { id: 'old', name: 'Old', role: 'Backend Agent', isArchived: true }] };
let specRecord: unknown = null;
vi.mock('@/app/AppContext', () => ({ useApp: () => app }));
vi.mock('@/shared/desktop', () => ({ isDesktop: true }));
vi.mock('./useTaskBuild', () => ({ useFeatureSpec: () => ({ record: specRecord, loaded: true }) }));
vi.mock('@/shared/components/Modal', () => ({
  Modal: ({ title, children, footer }: { title: string; children: React.ReactNode; footer: React.ReactNode }) => <div><h2>{title}</h2>{children}{footer}</div>
}));

const { BuildWithAlphaDialog, buildWithAlphaSteps } = await import('./BuildWithAlphaDialog');
const issue = { id: 'i1', identifier: 'LUM-21', title: 'Patient intake form', projectId: 'p1' } as Issue;
const render = () => renderToStaticMarkup(<BuildWithAlphaDialog issue={issue} submitting={false} onPlan={() => {}} onSpecFirst={() => {}} onPickAgent={() => {}} onClose={() => {}} />);

describe('Build with Alpha', () => {
  beforeEach(() => { specRecord = null; app.can = () => true; });

  it('explains what follows each choice', () => {
    expect(buildWithAlphaSteps('alpha', 'plan')[0]).toContain('proposes a plan');
    expect(buildWithAlphaSteps('alpha', 'spec')[0]).toContain('drafts a spec');
    expect(buildWithAlphaSteps('agent', 'plan')[0]).toContain('checklist');
  });

  it('starts on Let Alpha choose and a plan, with a spec offered for a task without one', () => {
    const html = render();
    expect(html).toContain('Build LUM-21 with Alpha');
    expect(html).toContain('Let Alpha choose (recommended)');
    expect(html).toContain('One agent I pick');
    expect(html).toContain('A written spec first');
    expect(html).toContain('Instructions for Alpha');
    expect(html).toContain('>Plan build<');
  });

  it('leaves the spec step to a task that already has a spec', () => {
    specRecord = { status: 'approved', stale: false };
    const html = render();
    expect(html).not.toContain('A written spec first');
    expect(html).toContain('The plan will follow this task');
  });

  it('will not plan from a spec the task has outgrown', () => {
    specRecord = { status: 'approved', stale: true };
    const html = render();
    expect(html).toContain('Approve the spec again before building');
    expect(html).toMatch(/disabled=""[^>]*>Plan build</);
  });

  it('offers no spec and no agent choice to someone who cannot use them', () => {
    app.can = (capability: string) => capability === 'run_builds';
    const html = render();
    expect(html).not.toContain('A written spec first');
    expect(html).toMatch(/<input[^>]*disabled=""[^>]*value="agent"/);
  });
});

