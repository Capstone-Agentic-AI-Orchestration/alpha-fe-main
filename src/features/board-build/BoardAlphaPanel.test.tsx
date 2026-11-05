import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Issue } from '@/shared/types';

vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });
vi.mock('@/app/AppContext', () => ({ useApp: () => ({ createIssue: vi.fn() }) }));
vi.mock('@/features/chat/ChatSidePanel', () => ({ ChatSidePanel: ({ children }: { children: React.ReactNode }) => <aside>{children}</aside> }));
vi.mock('@/features/chat/MessageMarkdown', () => ({ MessageMarkdown: ({ content }: { content: string }) => <p>{content}</p> }));

import { BoardAlphaPanel, askRequest, scopeLines, visibleText, SCOPE_MARKER } from './BoardAlphaPanel';

const issues = Array.from({ length: 21 }, (_, i) => ({ id: `i${i}`, identifier: `CAP-${i}`, title: `Task ${i}`, projectId: 'project', status: 'todo',
  subtasks: [{ id: 'open', title: 'Show an error.', completed: false }, { id: 'done', title: 'Already reviewed.', completed: true }]
})) as Issue[];

describe('board prompting scope', () => {
  it('includes only the supplied scope, bounded to 20 tasks and open checklist items', () => {
    const context = scopeLines(issues, () => 'Todo');
    expect(context.split('\n')).toHaveLength(20);
    expect(context).toContain('CAP-0 [Todo] Task 0 (checklist: Show an error.)');
    expect(context).not.toContain('CAP-20');
    expect(context).not.toContain('Already reviewed.');
    expect(visibleText('What is left?' + SCOPE_MARKER + context)).toBe('What is left?');
  });

  it('shows exactly the tasks actually included and keeps ask separate from builds', () => {
    const html = renderToStaticMarkup(<BoardAlphaPanel projectId="project" issues={issues} columns={[{ id: 'todo', title: 'Todo' }]}
      columnFor={() => 'todo'} canStartBuild={() => false} onStartBuild={vi.fn()} onOpenIssue={vi.fn()} onClose={vi.fn()} />);
    expect(html.match(/checked=""/g)).toHaveLength(20);
    expect(html).toMatch(/aria-label="Include CAP-20"[^>]*disabled=""/);
    expect(html).toContain('Suggest tasks');
    expect(html).toContain('Ask');
    expect(html).toContain('Alpha never changes code from here');
    expect(html).not.toContain('>Build</button>');
  });

  it('includes the saved description and explicitly marks shortened context', () => {
    expect(scopeLines([{ ...issues[0], description: 'Reject invalid email addresses.' }], () => 'Todo')).toContain('Details: Reject invalid email addresses.');
    const text = scopeLines([{ ...issues[0], description: 'x'.repeat(2_000) }], () => 'Todo');
    expect(text).toContain('[description shortened]');
    expect(text).not.toContain('x'.repeat(1_601));
  });

  it('sends the selected task ids so the Orchestrator can read their builds', () => {
    const scope = scopeLines(issues.slice(0, 2), () => 'Todo');
    expect(askRequest('task-ask-1', 'project', 'What is the update?', issues.slice(0, 2), scope)).toEqual({
      threadId: 'task-ask-1', projectId: 'project', intent: 'ask',
      content: 'What is the update?' + SCOPE_MARKER + scope,
      scopeIssueIds: ['i0', 'i1']
    });
    expect(askRequest('task-ask-1', 'project', 'How is the board?', [], '')).toMatchObject({ content: 'How is the board?', scopeIssueIds: [] });
  });
});
