import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Who may chat, build or configure agents is a capability (`can('manage_chat')`,
 * `can('run_builds')`, `can('run_agents')`, …), and those capabilities already
 * know whether this is the desktop app or the hosted web app (AppContext,
 * config/features.ts).
 *
 * `role === 'dev'` used to stand in for them in a dozen places. Each one kept
 * project managers and admins out of chat and builds after their capabilities
 * allowed them in, and nothing said why. This fails on any new role-name check
 * against `'dev'`; the few below choose layout or wording, not access.
 */
const ROOT = path.resolve(__dirname, '../..');
const ROLE_NAME_CHECK = /role\s*[!=]==\s*'dev'/;

/** [file, the exact code on the line]: each is about something other than agent access. */
const ALLOWED: Array<[string, string]> = [
  // On the web a developer is sent to the desktop download: their tools need a checkout.
  ['src/app/App.tsx', "role === 'dev' && !isDesktop"],
  // Architecture diagrams are a developer view; the server answers 403 to anyone else.
  ['src/features/projects/ProjectResourcesPanel.tsx', "variant === 'inline' && role === 'dev'"],
  // Layout and wording only.
  ['src/features/issues/IssuesView.tsx', "const developerScope = role === 'dev'"],
  ['src/features/delivery/WorkspaceOverview.tsx', "role === 'dev' ? 'Open assigned work'"],
  ['src/features/delivery/WorkspaceOverview.tsx', "role === 'dev' ? 'Assigned tasks'"],
  ['src/features/delivery/DocumentsView.tsx', "{role !== 'dev' && ("],
  // UAT promotion lists every internal role; the developer roster lists members, not the viewer.
  ['src/features/projects/repository/ProjectRepositoryView.tsx', "canPromoteUat={role === 'dev' || role === 'pm' || role === 'admin'}"],
  ['src/features/settings/WorkspaceAccessPanel.tsx', "member.role === 'dev' && member.status === 'active'"],
];

function sources(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(entry => {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return sources(relative);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [relative] : [];
  });
}

describe('agent access', () => {
  it('is decided by capabilities, never by checking for the developer role by name', () => {
    const offenders = sources('src').flatMap(file =>
      fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/).flatMap((line, index) =>
        ROLE_NAME_CHECK.test(line) && !ALLOWED.some(([allowedFile, code]) => file === allowedFile && line.includes(code))
          ? [`${file}:${index + 1}  use can('manage_chat' | 'run_builds' | 'run_agents') instead`]
          : []));
    expect(offenders).toEqual([]);
  });

  it('keeps its allow-list honest: every entry still matches a line', () => {
    const stale = ALLOWED.filter(([file, code]) =>
      !fs.existsSync(path.join(ROOT, file)) || !fs.readFileSync(path.join(ROOT, file), 'utf8').includes(code));
    expect(stale).toEqual([]);
  });
});
