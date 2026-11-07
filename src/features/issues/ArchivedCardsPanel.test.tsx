import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Issue } from '@/shared/types';
import { ArchivedCardsList } from './ArchivedCardsPanel';

vi.mock('@/shared/services/apiService', () => ({ apiService: {} }));

const archived = [{ id: 'i1', identifier: 'CAP-7', title: 'Old idea', projectId: 'p', status: 'todo',
  archivedAt: '2026-11-07T08:00:00.000Z', archivedBy: 'Manager Agent for lloyd' }] as Issue[];
const handlers = { onRestore: vi.fn(), onAskDelete: vi.fn(), onDelete: vi.fn() };

describe('ArchivedCardsList', () => {
  it('shows who archived a task and offers restore and permanent delete to people who manage tasks', () => {
    const html = renderToStaticMarkup(<ArchivedCardsList issues={archived} canManageIssues {...handlers} />);
    expect(html).toContain('CAP-7');
    expect(html).toContain('Archived by Manager Agent for lloyd');
    expect(html).toContain('Restore');
    expect(html).toContain('Delete permanently');
  });

  it('asks before deleting permanently', () => {
    const html = renderToStaticMarkup(<ArchivedCardsList issues={archived} canManageIssues confirmingDeleteId="i1" {...handlers} />);
    expect(html).toContain('This cannot be undone.');
    expect(html).toContain('Keep');
  });

  it('is read-only for people who do not manage tasks', () => {
    const html = renderToStaticMarkup(<ArchivedCardsList issues={archived} canManageIssues={false} {...handlers} />);
    expect(html).not.toContain('<button');
  });

  it('says when nothing is archived', () => {
    expect(renderToStaticMarkup(<ArchivedCardsList issues={[]} canManageIssues {...handlers} />)).toContain('No archived tasks');
  });
});

