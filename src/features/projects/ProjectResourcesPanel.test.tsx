import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ScaffoldOptions } from '@/shared/types';

// Project modules read `window` when they load; this suite renders to static markup in Node.
vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });
vi.mock('@/app/AppContext', () => ({ useApp: () => ({ showToast: vi.fn(), can: () => true, role: 'pm', projects: [] }) }));

import { createdStackFields, monorepoAvailability, scaffoldRequestFor, ShapePicker, type ChosenStacks } from './ProjectResourcesPanel';

const option = (id: 'react' | 'nodejs', label: string, role: 'frontend' | 'backend') => ({ id, label, role });
const offered: ScaffoldOptions = {
  source: 'example-org/ci-library@v1',
  standalone: [],
  paired: { frontend: [], backend: [] },
  monorepo: { frontend: [option('react', 'React', 'frontend')], backend: [option('nodejs', 'Node.js API', 'backend')] }
};
const stacks: ChosenStacks = { single: 'nextjs', frontend: 'nextjs', backend: 'nestjs', monoFrontend: 'react', monoBackend: 'nodejs' };
const base = { projectId: 'p1', repoName: 'shop', org: 'acme', visibility: 'private' as const, deploy: true };

describe('creating a monorepo from the repository form', () => {
  it('asks for one repository with the monorepo’s own stacks', () => {
    expect(scaffoldRequestFor('monorepo', base, stacks)).toEqual({ ...base, shape: 'monorepo', frontendStack: 'react', backendStack: 'nodejs' });
    expect(scaffoldRequestFor('paired', base, stacks)).toEqual({ ...base, shape: 'paired', frontendStack: 'nextjs', backendStack: 'nestjs' });
    expect(scaffoldRequestFor('standalone', base, stacks)).toEqual({ ...base, shape: 'standalone', stack: 'nextjs' });
  });

  it('records a monorepo’s two apps instead of one stack', () => {
    expect(createdStackFields('monorepo', stacks, 'nodejs')).toEqual({
      apps: [
        { id: 'web', role: 'frontend', stack: 'react', path: 'apps/web' },
        { id: 'api', role: 'backend', stack: 'nodejs', path: 'apps/api' }
      ]
    });
    expect(createdStackFields('paired', stacks, 'nestjs')).toEqual({ stack: 'nestjs' });
  });

  it('offers the monorepo only when the server’s workflow library has its CI templates, and says why not', () => {
    expect(monorepoAvailability(offered)).toEqual({ available: true, reason: null });
    expect(monorepoAvailability(undefined)).toEqual({ available: false, reason: null });
    expect(monorepoAvailability(null).reason).toMatch(/cannot create monorepos yet/);
    expect(monorepoAvailability({ ...offered, monorepo: { frontend: [], backend: [] }, error: 'no monorepo CI templates yet' }))
      .toEqual({ available: false, reason: 'no monorepo CI templates yet' });
  });

  it('shows the third shape, disabled with its reason when it cannot be created', () => {
    const render = (monorepo: { available: boolean; reason: string | null }) => renderToStaticMarkup(
      <ShapePicker name="shape" value="standalone" onChange={() => undefined} disabled={false} monorepo={monorepo} />
    );
    const monorepoInput = (html: string) => /<input[^>]*value="monorepo"[^>]*>/.exec(html)?.[0] ?? '';
    const available = render({ available: true, reason: null });
    expect(available).toContain('>Monorepo</span>');
    expect(monorepoInput(available)).not.toContain('disabled');

    const unavailable = render({ available: false, reason: 'no monorepo CI templates yet' });
    expect(monorepoInput(unavailable)).toContain('disabled');
    expect(unavailable).toContain('no monorepo CI templates yet');
  });
});
