import { describe, expect, it } from 'vitest';
import { splitDiffByFile } from './OrchestrationWorkflowPanel';

describe('a diff split per file for the file tabs', () => {
  it('keys each file by its new path and keeps its lines together', () => {
    const indexDiff = ['diff --git a/index.html b/index.html', '@@ -1 +1 @@', '-old', '+new'];
    const appDiff = ['diff --git a/src/App.tsx b/src/App.tsx', '@@ -1 +1,2 @@', '+line'];
    const files = splitDiffByFile([...indexDiff, ...appDiff].join('\n'));
    expect([...files.keys()]).toEqual(['index.html', 'src/App.tsx']);
    expect(files.get('index.html')).toBe(indexDiff.join('\n'));
    expect(files.get('src/App.tsx')).toBe(appDiff.join('\n'));
  });

  it('is empty for a diff without file headers', () => {
    expect(splitDiffByFile('')).toEqual(new Map());
  });
});
