import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { UserRole } from '@/shared/types';

// Project modules read `window` when they load; this suite renders to static markup in Node.
vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });

let currentRole: UserRole = 'pm';
vi.mock('@/app/AppContext', () => ({
  useApp: () => ({ createProject: vi.fn(), updateProject: vi.fn(), projects: [], can: () => true, role: currentRole })
}));

import { CreateProjectModal } from './CreateProjectModal';

const render = (role: UserRole) => {
  currentRole = role;
  return renderToStaticMarkup(<CreateProjectModal isOpen onClose={() => undefined} />);
};

describe('New project for roles without AI features', () => {
  it('shows a project manager only the project name and goal', () => {
    const html = render('pm');
    expect(html).toContain('Project name');
    expect(html).toContain('Goal &amp; ground rules');
    for (const hidden of ['Build lead: Orchestrator', 'Shared with agents', 'Priority', 'Target date',
      'Set up repositories next', 'Repository URL', 'Attach a local folder', 'You can refine the project after creating it.']) {
      expect(html).not.toContain(hidden);
    }
  });

  it('keeps the Orchestrator and repository setup for developers', () => {
    const html = render('dev');
    for (const shown of ['Build lead: Orchestrator', 'Priority', 'Target date', 'Set up repositories next', 'Repository URL']) {
      expect(html).toContain(shown);
    }
  });
});

