import { describe, expect, it } from 'vitest';

import { buildActivityAnchors } from './buildActivityAnchor';

describe('where a build shows its live progress in the conversation', () => {
  it('moves to the started-plan message, once per build', () => {
    const anchors = buildActivityAnchors([
      { id: 'm1-build', messageType: 'build', orchestrationRunId: 'run-1' },
      { id: 'm2', messageType: 'assistant' },
      { id: 'run-1-started-v1', messageType: 'build', orchestrationRunId: 'run-1' },
      { id: 'm3-build', messageType: 'build', orchestrationRunId: 'run-2' },
      { id: 'run-1-published', messageType: 'build_milestone', orchestrationRunId: 'run-1' }
    ]);
    expect([...anchors]).toEqual([['run-1', 'run-1-started-v1'], ['run-2', 'm3-build']]);
  });
});
