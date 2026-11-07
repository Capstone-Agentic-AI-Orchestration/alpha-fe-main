import type { Issue } from '@/shared/types';

/** The developer's private instructions accompany, rather than replace, the saved task. */
export function issueBuildPrompt(issue: Pick<Issue, 'identifier' | 'title' | 'description' | 'subtasks'>, instructions?: string): string {
  const guidance = instructions?.trim() ? `\n\nDeveloper instructions for this plan:\n${instructions.trim().slice(0, 1_500)}` : '';
  const open = (issue.subtasks ?? []).filter(item => !item.completed).map(item => `- ${item.title}`);
  // The daemon reads the full saved checklist and fixes its requirement IDs.
  // This bounded copy only makes the conversation readable.
  const checklist = open.length ? `\n\nChecklist the build must meet:\n${open.join('\n')}`.slice(0, 1_200) : '';
  const details = issue.description?.trim() ? `\n\n${issue.description.trim().slice(0, Math.max(0, 3_500 - guidance.length - checklist.length))}` : '';
  return `/build ${issue.identifier}: ${issue.title}${details}${checklist}${guidance}`;
}
