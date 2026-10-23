import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CloneToComputerDialog, canCloneToComputer } from './CloneToComputerDialog';

describe('clone to computer', () => {
  it('is only offered where a folder picker exists', () => {
    expect(canCloneToComputer()).toBe(false);
  });

  it('lists every repository, a folder choice and the build option', () => {
    const html = renderToStaticMarkup(<CloneToComputerDialog isOpen onClose={() => undefined} projectId="p1"
      repositories={['acme/app-fe', 'acme/app-be']} />);
    expect(html).toContain('Clone to your computer');
    expect(html).toContain('app-fe');
    expect(html).toContain('app-be');
    expect(html).toContain('No folder chosen');
    expect(html).toContain('Use these copies for Alpha’s builds on this computer');
    expect(html).toContain('Clone 2 repositories');
  });
});

