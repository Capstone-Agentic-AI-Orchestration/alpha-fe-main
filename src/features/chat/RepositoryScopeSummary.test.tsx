import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RepositoryScopeSummary, repositoryScope } from './RepositoryScopeSummary';

const project = ['acme/web', 'acme/api', 'acme/worker'];

describe('repository picker scope summary', () => {
  it('reads as no limit when every project repository is ticked (the default)', () => {
    const scope = repositoryScope(project, [...project].reverse());
    expect(scope.kind).toBe('all');
    const html = renderToStaticMarkup(<RepositoryScopeSummary scope={scope} />);
    expect(html).toContain('All repositories');
    expect(html).toContain('Agents always see every repository; untick to limit builds.');
    expect(html).not.toContain('Limited to');
  });

  it('names the ticked repositories by short name when a strict subset limits builds', () => {
    const scope = repositoryScope(project, ['acme/worker', 'acme/web']);
    expect(scope).toMatchObject({ kind: 'limited', repositories: ['acme/web', 'acme/worker'] });
    const html = renderToStaticMarkup(<RepositoryScopeSummary scope={scope} />);
    expect(html).toContain('Limited to web, worker');
    expect(html).not.toContain('acme/');
    expect(html).not.toContain('All repositories');
  });

  it('does not count stale selections and asks for a tick when none remain', () => {
    expect(repositoryScope(project, ['acme/gone']).kind).toBe('none');
    expect(repositoryScope(project, [...project, 'acme/gone']).kind).toBe('all');
    expect(renderToStaticMarkup(<RepositoryScopeSummary scope={repositoryScope(project, [])} />)).toContain('Tick at least one repository to build.');
  });
});
