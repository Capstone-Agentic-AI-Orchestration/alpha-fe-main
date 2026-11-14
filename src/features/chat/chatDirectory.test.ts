import { describe, expect, it } from 'vitest';
import { chatMatches, projectChatShortlist } from './chatDirectory';
import type { ChatThread, Project } from '@/shared/types';

const project = (id: number, assigned = true) => ({ id: String(id), assigned, name: 'Project ' + id, key: 'P' + id } as Project);
const thread = (index: number, projectId: string): ChatThread => ({
  id: String(index), projectId, title: index ? 'Earlier chat ' + index : 'Legacy webhooks', agentIds: [], pinned: false,
  lastMessageAt: new Date(index * 60_000).toISOString(),
});

describe('project chat navigation', () => {
  it('keeps the shortlist bounded and surfaces the active project without including unassigned projects', () => {
    const projects = Array.from({ length: 100 }, (_, index) => project(index, index !== 98));
    const threads = Array.from({ length: 82 }, (_, index) => thread(index, '0'));
    const pins = ['1', '2', '3', '4', '5', '6', '98'];
    const result = projectChatShortlist(projects, threads, pins, '99');
    expect(result.visible).toHaveLength(11);
    expect(result.overflowPinned).toBe(true);
    expect(result.visible.at(-1)?.project.id).toBe('99');
    expect(result.visible.some(group => group.project.id === '98')).toBe(false);
    expect(result.visible.find(group => group.project.id === '0')?.threads).toHaveLength(82);
    expect(result.recent.map(chat => chat.id)).toEqual(['81', '80', '79', '78']);
    expect(chatMatches(threads[0], projects[0], 'p0 legacy webhooks')).toBe(true);
    expect(chatMatches(threads[0], projects[0], 'p99 legacy')).toBe(false);
  });
});
