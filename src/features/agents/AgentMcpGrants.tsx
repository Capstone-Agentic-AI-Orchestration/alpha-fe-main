import { useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';

import { apiService } from '@/shared/services/apiService';
import { Agent, McpServer } from '@/shared/types';
import { FileManagedBadge, isManagedByFile } from './FileManagedBadge';

/**
 * Which MCP servers this agent may use.
 *
 * This used to be a read-only div that fell back to the string
 * `'git, filesystem, browser'` when the agent had no grants — three servers
 * Alpha has never had. An agent granted nothing therefore appeared to have
 * three, which is the opposite of the truth and the only thing the panel said
 * about MCP at all.
 *
 * The options come from the active workspace catalog rather than a constant,
 * so a tool configured by an admin can be granted to this developer persona.
 */

interface Props {
  agent: Agent;
  onChange: (mcpServers: string[]) => void;
  /** Takes the user to the persona file, where a file-managed grant is edited. */
  onOpenFile: () => void;
  readOnly?: boolean;
}

export function AgentMcpGrants({ agent, onChange, onOpenFile, readOnly = false }: Readonly<Props>) {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiService
      .getMcpServers()
      .then(list => { if (!cancelled) setServers(list); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  const granted = agent.mcpServers ?? [];

  /**
   * Editable even when the persona file declares it. The badge is there to say
   * so, not to lock the control.
   *
   * The file does win over the database — but `syncAgentFile` writes a grant
   * change back into the frontmatter, so the two agree and the edit sticks.
   * Verified end to end: granting through this control leaves the file reading
   * `mcpServers: [alpha-github, my-postgres]`.
   *
   * This follows Specialization Description rather than System Prompt. The
   * prompt is read-only because its body is prose the persona editor owns; a
   * grant list is structured frontmatter, which the write-through handles. Every
   * seeded agent declares `mcpServers` in its file, so disabling on that flag
   * would have made this control read-only for all of them.
   */
  const alsoInFile = isManagedByFile(agent, 'mcpServers');

  const toggle = (name: string) => {
    if (readOnly) return;
    onChange(granted.includes(name) ? granted.filter(n => n !== name) : [...granted, name]);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-content-muted py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Reading catalog...
      </div>
    );
  }

  /**
   * A failed fetch must not render as "no servers exist" — that reads as a
   * fact about the catalog rather than about the request. Fall back to naming
   * what the agent already has, which is stored on the agent itself.
   */
  if (failed) {
    return (
      <div className="p-3 rounded-xl bg-well border border-divider space-y-1">
        <div className="font-mono text-xs text-content-secondary">
          {granted.length ? granted.join(', ') : 'None granted'}
        </div>
        <div className="text-[10px] text-status-warning">
          Could not load the workspace catalog. This is what the agent currently has stored.
        </div>
      </div>
    );
  }

  if (!servers.length) {
    return (
      <div className="p-3 rounded-xl bg-well border border-divider space-y-1">
        <div className="text-xs text-content-secondary">No MCP servers in this workspace catalog.</div>
        <div className="text-[10px] text-content-muted leading-snug">
          Ask a workspace admin to add one under Settings &rarr; Connected Accounts.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {alsoInFile && (
        <div className="flex justify-end">
          <FileManagedBadge onOpenFile={onOpenFile} />
        </div>
      )}

      {servers.map(server => {
        const isGranted = granted.includes(server.name);

        return (
          // A real button rather than a clickable div: this is a toggle, so it
          // should be reachable by keyboard and announced as one.
          <button
            key={server.name}
            type="button"
            role="switch"
            aria-checked={isGranted}
            disabled={readOnly}
            onClick={() => toggle(server.name)}
            className={`w-full text-left p-3 rounded-xl border flex items-start justify-between gap-3 transition-colors ${
              readOnly ? 'cursor-default opacity-80' : 'cursor-pointer'
            } ${
              isGranted
                ? 'bg-surface-raised border-divider text-content'
                : 'bg-transparent border-divider text-content-muted hover:text-content-secondary'
            }`}
          >
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-medium text-xs text-content">{server.name}</span>
                {server.builtin && (
                  <span className="flex items-center gap-1 text-[10px] text-content-muted font-mono">
                    <Lock className="w-2.5 h-2.5" />
                    built in
                  </span>
                )}
              </div>
              {/*
                A grant is permission to reach this, so say what it is: the
                command line for a spawned server, the endpoint for a hosted
                one. Joining [command, ...args] for both would print
                "undefined" for every http entry, which carries no command.
              */}
              <div className="font-mono text-[10px] text-content-muted break-all">
                {server.transport === 'stdio'
                  ? [server.command ?? '', ...(server.args ?? [])].filter(Boolean).join(' ')
                  : server.url}
              </div>
            </div>

            <div
              className={`shrink-0 mt-0.5 w-8 h-4 rounded-full transition-colors relative ${
                isGranted ? 'bg-status-success-subtle' : 'bg-surface-raised'
              }`}
            >
              <span
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-on-accent transition-all ${
                  isGranted ? 'left-4' : 'left-0.5'
                }`}
              />
            </div>
          </button>
        );
      })}

      <p className="text-[10px] text-content-muted leading-snug pt-1">
        Agents can only use servers from Alpha&apos;s own catalog. Nothing configured for
        your personal CLI is reachable from a run.
      </p>
    </div>
  );
}
