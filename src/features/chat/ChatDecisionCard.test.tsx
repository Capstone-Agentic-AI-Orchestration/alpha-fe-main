import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatDecisionCard } from './ChatDecisionCard';

const decision = {
  question: 'Keep expenses in the browser, or add a backend API?',
  options: [{ label: 'Keep expenses in browser storage', description: 'Matches the PRO-103 checklist.' }, { label: 'Add backend storage and API' }],
  status: 'open' as const
};
const noop = () => undefined;

describe('the Orchestrator question card', () => {
  it('shows the question, numbered answers with their descriptions, and a free-text choice', () => {
    const html = renderToStaticMarkup(<ChatDecisionCard decision={decision} busy={false} onAnswer={noop} onClose={noop} />);
    expect(html).toContain('Keep expenses in the browser, or add a backend API?');
    expect(html).toContain('>1</kbd>');
    expect(html).toContain('Keep expenses in browser storage');
    expect(html).toContain('Matches the PRO-103 checklist.');
    expect(html).toContain('>2</kbd>');
    expect(html).toContain('Something else…');
  });

  it('replaces the answers with progress while Alpha plans with the answer', () => {
    const html = renderToStaticMarkup(<ChatDecisionCard decision={decision} busy onAnswer={noop} onClose={noop} />);
    expect(html).toContain('Planning with your answer…');
    expect(html).not.toContain('Something else…');
  });
});
