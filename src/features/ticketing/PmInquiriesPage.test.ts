import { describe, expect, it } from 'vitest';
import { projectPrefill } from './PmInquiriesPage';

describe('starting a project from an inquiry', () => {
  it('fills the project form from what the client asked for, including their answers', () => {
    const prefill = projectPrefill({
      title: 'Informational Website', description: 'I want an informational website focused on animations',
      requestedDeadline: '2026-12-01',
      clarificationMessages: [
        { id: 'q', author: 'pm', body: 'What theme would you like', createdAt: '2026-11-19T09:44:00Z' },
        { id: 'a', author: 'client', body: 'I want to have a retro theme', createdAt: '2026-11-19T09:44:30Z' },
      ],
    });
    expect(prefill.name).toBe('Informational Website');
    expect(prefill.targetDate).toBe('2026-12-01');
    expect(prefill.description).toContain('focused on animations');
    expect(prefill.description).toContain('Q: What theme would you like');
    expect(prefill.description).toContain('A: I want to have a retro theme');
  });

  it('keeps within the form\'s limits and leaves the date empty when none was asked for', () => {
    const prefill = projectPrefill({ title: 'x'.repeat(200), description: 'y'.repeat(9000), requestedDeadline: null });
    expect(prefill.name).toHaveLength(120);
    expect(prefill.description).toHaveLength(8000);
    expect(prefill.targetDate).toBe('');
  });
});
