import { describe, expect, it } from 'vitest';
import { roleCapabilities, type Capability } from './AppContext';

/** Everything that exists only to work with agents. */
const AI: Capability[] = [
  'view_agents', 'manage_agents', 'run_agents', 'run_builds', 'manage_chat',
  'view_skills', 'manage_skills', 'view_runtimes', 'manage_runtimes', 'manage_mcp', 'approve_runs'
];

describe('what each role may do, per runtime', () => {
  it.each(['pm', 'admin'] as const)('gives a %s chat, builds and agent configuration in the desktop app', role => {
    const desktop = roleCapabilities(role, true);
    for (const capability of ['manage_chat', 'run_builds', 'run_agents', 'manage_agents', 'manage_runtimes'] as const) {
      expect(desktop).toContain(capability);
    }
  });

  it('gives a desktop PM exactly the AI capabilities a developer has', () => {
    // Skills and the workspace MCP catalog are admin-only: an MCP server is a command every member's desktop launches.
    expect(roleCapabilities('pm', true).filter(capability => AI.includes(capability)).sort())
      .toEqual(roleCapabilities('dev', true).filter(capability => AI.includes(capability)).sort());
    for (const role of ['dev', 'pm'] as const) {
      expect(roleCapabilities(role, true)).not.toContain('manage_mcp');
      expect(roleCapabilities(role, true)).not.toContain('manage_skills');
    }
  });

  it.each(['pm', 'admin'] as const)('gives a %s no AI capability at all on the hosted web app', role => {
    const web = roleCapabilities(role, false);
    expect(web.filter(capability => AI.includes(capability))).toEqual([]);
    // Delivery work stays: GitHub Connected Accounts and publishing a reviewed build to UAT.
    for (const capability of ['view_integrations', 'manage_integrations', 'publish_build', 'control_uat_delivery'] as const) {
      expect(web).toContain(capability);
    }
  });

  it('leaves developers and clients the same in both runtimes', () => {
    for (const role of ['dev', 'client'] as const) expect(roleCapabilities(role, false)).toEqual(roleCapabilities(role, true));
    expect(roleCapabilities('client', true).filter(capability => AI.includes(capability))).toEqual([]);
  });
});
