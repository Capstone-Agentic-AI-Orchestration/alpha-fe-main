import { describe, expect, it } from 'vitest';
import { issueBuildPrompt } from './issueBuildPrompt';

const issue = { identifier: 'CAP-9', title: 'Login', description: 'Support developer sign-in.', subtasks: [
  { id: 'one', title: 'Invalid credentials show an error.', completed: false },
  { id: 'two', title: 'Design approved.', completed: true }
] };

describe('task build prompt', () => {
  it('preserves the saved task and open checklist while adding developer guidance', () => {
    const prompt = issueBuildPrompt(issue, ' Use the existing auth service. ');
    for (const text of ['/build CAP-9: Login', issue.description, issue.subtasks[0].title, 'Developer instructions for this plan:\nUse the existing auth service.']) {
      expect(prompt).toContain(text);
    }
    expect(prompt).not.toContain('Design approved.');
  });

  it('keeps guidance available even with a long description and checklist', () => {
    const prompt = issueBuildPrompt({ ...issue, description: 'x'.repeat(5_000), subtasks: [{ ...issue.subtasks[0], title: 'y'.repeat(2_000) }] }, 'z'.repeat(1_500));
    expect(prompt).toContain('z'.repeat(1_500));
    expect(prompt.length).toBeLessThan(4_000);
  });

  it('handles older tasks without checklist data', () => {
    expect(issueBuildPrompt({ ...issue, subtasks: undefined as never }, '   ')).toBe('/build CAP-9: Login\n\nSupport developer sign-in.');
  });
});
