import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChangedFilesCard } from './ChangedFilesCard';

describe('the changed files under a reply or a build', () => {
  it('totals the lines, lists each file with its counts, and offers Review', () => {
    const html = renderToStaticMarkup(<ChangedFilesCard onView={() => undefined} files={[
      { path: 'src/App.tsx', additions: 51, deletions: 9 }, { path: 'src/App.css', additions: 27, deletions: 3 }
    ]} />);
    expect(html).toContain('2 files changed');
    expect(html).toContain('+78</span> <span class="text-status-danger">−12');
    expect(html).toContain('title="src/App.tsx">src/App.tsx</code>');
    expect(html).toMatch(/>Review<svg/);
  });

  it('lists paths alone before the counts are read, and folds a long list', () => {
    const files = Array.from({ length: 8 }, (_, index) => ({ path: `src/file${index}.ts` }));
    const html = renderToStaticMarkup(<ChangedFilesCard files={files} />);
    expect(html).not.toContain('+');
    expect(html).toContain('src/file5.ts');
    expect(html).not.toContain('src/file6.ts');
    expect(html).toContain('Show all 8 files');
    expect(renderToStaticMarkup(<ChangedFilesCard files={[]} />)).toBe('');
  });
});
