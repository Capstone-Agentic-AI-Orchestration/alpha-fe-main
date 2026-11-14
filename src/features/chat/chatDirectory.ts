import type { ChatThread, Project } from '@/shared/types';

export const byChatActivity = (a: ChatThread, b: ChatThread) => b.lastMessageAt.localeCompare(a.lastMessageAt);

export function chatMatches(thread: ChatThread, project: Project | undefined, query: string) {
  const text = [thread.title, project?.name, project?.key].filter(Boolean).join(' ').toLowerCase();
  return query.toLowerCase().trim().split(/\s+/).every(word => text.includes(word));
}

export function projectChatShortlist(projects: Project[], threads: ChatThread[], pinned: string[], activeProject?: string) {
  const grouped = new Map<string, ChatThread[]>();
  const recent = [...threads].sort(byChatActivity);
  for (const thread of recent) {
    if (!thread.projectId) continue;
    const group = grouped.get(thread.projectId);
    if (group) group.push(thread);
    else grouped.set(thread.projectId, [thread]);
  }
  const groups = projects.filter(project => project.assigned !== false)
    .map(project => ({ project, threads: grouped.get(project.id) ?? [] }))
    .sort((a, b) => (b.threads[0]?.lastMessageAt ?? '').localeCompare(a.threads[0]?.lastMessageAt ?? '')
      || a.project.name.localeCompare(b.project.name));
  const pinnedSet = new Set(pinned);
  const pinnedGroups = groups.filter(({ project }) => pinnedSet.has(project.id));
  const visible = [...pinnedGroups.slice(0, 5), ...groups.filter(({ project }) => !pinnedSet.has(project.id)).slice(0, 5)];
  const active = groups.find(({ project }) => project.id === activeProject);
  if (active && !visible.includes(active)) visible.push(active);
  return { visible, overflowPinned: pinnedGroups.length > 5, recent: recent.slice(0, 4) };
}
