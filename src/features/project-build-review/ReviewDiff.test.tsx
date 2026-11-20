import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });
import { ReadOnlyRepositoryChanges, ReviewDiff } from './OrchestrationWorkflowPanel';

const diff = [
  'diff --git a/index.html b/index.html', '@@ -1 +1 @@', '-old', '+new',
  'diff --git a/src/App.tsx b/src/App.tsx', '@@ -1 +1,2 @@', '+line'
].join('\n');
const repository = { repository: 'acme/web', branchName: 'alpha/build', resultCommit: 'abcdef1234', changedPaths: ['index.html', 'src/App.tsx'], diff };

/** The chat's side panel shows the changes; it never asks the reader to click to see them. */
describe('code changes in the read-only side panel', () => {
  it('has no toggle, unlike the interactive review', () => {
    const readOnly = renderToStaticMarkup(<ReviewDiff projectId="p" runId="r" readOnly />);
    expect(readOnly).not.toContain('<button');
    expect(readOnly).not.toContain('Review code changes');
    expect(readOnly).not.toContain('Open review');
    const interactive = renderToStaticMarkup(<ReviewDiff projectId="p" runId="r" />);
    expect(interactive).toContain('Open review');
  });

  it('shows every file in full under its own heading, with no file tabs', () => {
    const html = renderToStaticMarkup(<ReadOnlyRepositoryChanges repository={repository} />);
    expect(html).not.toContain('<button');
    expect(html).not.toContain('role="tab');
    expect(html).toContain('>index.html</h4>');
    expect(html).toContain('>src/App.tsx</h4>');
    expect(html).toContain('+new');
    expect(html).toContain('+line');
  });

  it('shows an unchanged repository as one muted line', () => {
    const html = renderToStaticMarkup(<ReadOnlyRepositoryChanges repository={{ ...repository, diff: '' }} />);
    expect(html).toBe('<p class="text-[11px] text-content-muted">No file changes in web.</p>');
  });
});
