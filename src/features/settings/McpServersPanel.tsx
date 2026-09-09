import { useCallback, useEffect, useState } from 'react';
import {
  Database, Plus, Trash2, Loader2, AlertTriangle, Lock, X, Save
} from 'lucide-react';

import { apiService } from '@/shared/services/apiService';
import { McpServer, McpServerInput, McpTransport } from '@/shared/types';
import { useApp } from '@/app/AppContext';

/**
 * Alpha's MCP catalog.
 *
 * This is the complete set of MCP servers an agent can be granted — not a view
 * onto a larger one. The runner passes `--strict-mcp-config` on every turn, so
 * whatever the machine owner has configured for their own `claude` install is
 * unreachable from an Alpha agent. Anything an agent should be able to use has
 * to be here.
 *
 * Backed by `~/.alpha/mcp.json`, which stays hand-editable: this panel reads and
 * writes the same file, keeping the comment the seed puts in it.
 */

/**
 * The one line that says what this server actually is.
 *
 * A stdio entry is a command Alpha will spawn, so show the command line it will
 * run. An http entry is an endpoint, so show the URL. Falling back to a joined
 * `[command, ...args]` for both would print "undefined" for every hosted
 * server, since those carry no command at all.
 */
function describeServer(server: Pick<McpServer, 'transport' | 'command' | 'args' | 'url'>): string {
  if (server.transport === 'http' || server.transport === 'sse') {
    return server.url ?? '';
  }
  return [server.command ?? '', ...(server.args ?? [])].filter(Boolean).join(' ');
}

interface DraftState {
  /** Null when adding; the existing name when editing, which then locks the field. */
  editing: string | null;
  name: string;
  transport: McpTransport;

  /** stdio */
  command: string;
  /** One argument per line — args are frequently paths, which may contain spaces. */
  argsText: string;

  /** http/sse */
  url: string;

  /**
   * KEY=value per line — the environment for stdio, the headers for http.
   * Never pre-filled: the daemon returns key names, never values.
   */
  secretsText: string;
}

const EMPTY_DRAFT: DraftState = {
  editing: null,
  name: '',
  transport: 'http',
  command: '',
  argsText: '',
  url: '',
  secretsText: ''
};

function parseArgs(text: string): string[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean);
}

function parseKeyValues(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Split on the FIRST '=' only: values routinely contain more of them, and a
    // bearer token or connection string almost always does.
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1);
  }
  return out;
}

export function McpServersPanel() {
  const { agents, showToast } = useApp();

  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<McpServer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setServers(await apiService.getMcpServers());
    } catch (err: any) {
      showToast('Could not read the MCP catalog', err?.message ?? String(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { void load(); }, [load]);

  /** Agent names rather than ids — an id means nothing to the person deleting. */
  const grantedNames = (server: McpServer) =>
    server.grantedTo.map(id => agents.find(a => a.id === id)?.name ?? id);

  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    const secrets = parseKeyValues(draft.secretsText);
    const hasSecrets = Object.keys(secrets).length > 0;

    // The daemon rejects a payload mixing the two shapes, so build exactly one.
    const payload: McpServerInput =
      draft.transport === 'stdio'
        ? {
            command: draft.command.trim(),
            ...(parseArgs(draft.argsText).length ? { args: parseArgs(draft.argsText) } : {}),
            ...(hasSecrets ? { env: secrets } : {})
          }
        : {
            type: draft.transport,
            url: draft.url.trim(),
            ...(hasSecrets ? { headers: secrets } : {})
          };

    setBusy(true);
    try {
      setServers(await apiService.saveMcpServer(name, payload));
      setDraft(null);
      showToast('MCP server saved', `"${name}" is now grantable to agents.`, 'success');
    } catch (err: any) {
      // The daemon owns validation — name shape, spec shape, size. Repeating
      // those rules here would let the two drift.
      showToast('Not saved', err?.message ?? String(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (server: McpServer) => {
    setBusy(true);
    try {
      setServers(await apiService.deleteMcpServer(server.name));
      setConfirmDelete(null);
      showToast('MCP server removed', `"${server.name}" is no longer in the catalog.`, 'success');
    } catch (err: any) {
      showToast('Not removed', err?.message ?? String(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-pink-400" />
            MCP Servers
          </h3>
          <p className="text-[11px] text-gray-500 leading-snug max-w-xl">
            Tools your agents can be granted. Agents can only use servers listed here —
            nothing configured for your personal CLI is reachable from a run. Stored in{' '}
            <span className="font-mono text-gray-400">~/.alpha/mcp.json</span>.
          </p>
        </div>

        <button
          onClick={() => setDraft(EMPTY_DRAFT)}
          disabled={busy || !!draft}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-40 border border-white/10 text-xs font-medium text-white transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add server
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[11px] text-gray-500 py-6">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Reading catalog...
        </div>
      ) : (
        <div className="space-y-2">
          {servers.map(server => {
            const granted = grantedNames(server);
            const protectedBuiltin = server.builtin && !server.overridden;

            return (
              <div
                key={server.name}
                className="p-3 rounded-xl bg-well border border-white/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-xs text-white">{server.name}</span>
                      {server.builtin && (
                        <span className="flex items-center gap-1 text-[10px] text-gray-500 font-mono">
                          <Lock className="w-2.5 h-2.5" />
                          built in
                        </span>
                      )}
                      {server.overridden && (
                        <span className="text-[10px] text-amber-300 font-mono">overridden</span>
                      )}
                      <span className="text-[10px] text-gray-600 font-mono">
                        {server.transport}
                      </span>
                    </div>

                    {/* What Alpha will spawn, or the endpoint it will connect to. */}
                    <div className="font-mono text-[10px] text-gray-500 break-all">
                      {describeServer(server)}
                    </div>

                    {(server.envKeys?.length ?? 0) > 0 && (
                      <div className="font-mono text-[10px] text-gray-600">
                        env: {server.envKeys!.join(', ')}
                      </div>
                    )}

                    {(server.headerKeys?.length ?? 0) > 0 && (
                      <div className="font-mono text-[10px] text-gray-600">
                        headers: {server.headerKeys!.join(', ')}
                      </div>
                    )}

                    <div className="text-[10px] text-gray-600">
                      {granted.length
                        ? `Granted to ${granted.join(', ')}`
                        : 'Not granted to any agent'}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1">
                    <button
                      onClick={() =>
                        setDraft({
                          editing: server.name,
                          name: server.name,
                          transport: server.transport,
                          command: server.command ?? '',
                          argsText: (server.args ?? []).join('\n'),
                          url: server.url ?? '',
                          // Values are never returned, so an edit re-enters them.
                          secretsText: ''
                        })
                      }
                      disabled={busy || !!draft}
                      className="px-2 py-1 rounded-lg text-[10px] text-gray-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-40 transition-colors"
                    >
                      {protectedBuiltin ? 'Override' : 'Edit'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(server)}
                      disabled={busy || !!draft || protectedBuiltin}
                      title={
                        protectedBuiltin
                          ? 'Ships with Alpha — cannot be removed'
                          : 'Remove from catalog'
                      }
                      className="p-1.5 rounded-lg text-gray-500 hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {draft && (
        <div className="p-3 rounded-xl bg-well border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-300">
              {draft.editing ? `Edit ${draft.editing}` : 'New MCP server'}
            </span>
            <button
              onClick={() => setDraft(null)}
              className="p-1 rounded text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
              Name
            </label>
            <input
              value={draft.name}
              // Renaming would be an add plus a delete, and would strand every
              // grant still pointing at the old name.
              disabled={!!draft.editing}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder="my-postgres"
              className="w-full bg-surface border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs disabled:opacity-50 focus:outline-none focus:border-white/30"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
              Transport
            </label>
            <div className="flex gap-1.5">
              {(['http', 'stdio'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setDraft({ ...draft, transport: t })}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-colors ${
                    draft.transport === t || (t === 'http' && draft.transport === 'sse')
                      ? 'bg-white/[0.08] border-white/20 text-white'
                      : 'bg-transparent border-white/5 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 leading-snug">
              {draft.transport === 'stdio'
                ? 'Alpha spawns this as a child process on every turn the server is used.'
                : 'Alpha connects to a URL. Nothing is installed, and it cannot fail offline mid-run.'}
            </p>
          </div>

          {draft.transport === 'stdio' ? (
            <>
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Command
                </label>
                <input
                  value={draft.command}
                  onChange={e => setDraft({ ...draft, command: e.target.value })}
                  placeholder="npx"
                  className="w-full bg-surface border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Arguments — one per line
                </label>
                <textarea
                  value={draft.argsText}
                  onChange={e => setDraft({ ...draft, argsText: e.target.value })}
                  rows={3}
                  placeholder={'-y\n@modelcontextprotocol/server-memory'}
                  className="w-full bg-surface border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs resize-y focus:outline-none focus:border-white/30"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                URL
              </label>
              <input
                value={draft.url}
                onChange={e => setDraft({ ...draft, url: e.target.value })}
                placeholder="https://mcp.context7.com/mcp"
                className="w-full bg-surface border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-white/30"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
              {draft.transport === 'stdio' ? 'Environment' : 'Headers'} — KEY=value per line
            </label>
            <textarea
              value={draft.secretsText}
              onChange={e => setDraft({ ...draft, secretsText: e.target.value })}
              rows={2}
              placeholder={
                draft.transport === 'stdio'
                  ? 'DATABASE_URL=postgres://...'
                  : 'Authorization=Bearer ...'
              }
              className="w-full bg-surface border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs resize-y focus:outline-none focus:border-white/30"
            />
            <p className="text-[10px] text-gray-600 leading-snug">
              {draft.editing
                ? 'Values are never read back, so leaving this empty clears what is stored. Re-enter anything you want to keep.'
                : 'Stored in ~/.alpha/mcp.json as plain text, and never returned to this page once saved.'}
            </p>
          </div>

          {/* What will actually happen, assembled from the fields above. */}
          {(draft.transport === 'stdio' ? draft.command.trim() : draft.url.trim()) && (
            <div className="p-2 rounded-lg bg-black/40 border border-white/5">
              <div className="text-[10px] text-gray-600 mb-1">
                {draft.transport === 'stdio' ? 'Alpha will run:' : 'Alpha will connect to:'}
              </div>
              <div className="font-mono text-[10px] text-gray-300 break-all">
                {describeServer({
                  transport: draft.transport,
                  command: draft.command.trim(),
                  args: parseArgs(draft.argsText),
                  url: draft.url.trim()
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => void save()}
              disabled={
                busy ||
                !draft.name.trim() ||
                (draft.transport === 'stdio' ? !draft.command.trim() : !draft.url.trim())
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-canvas text-xs font-medium disabled:opacity-40 transition-opacity"
            >
              {busy
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Save className="w-3.5 h-3.5" />}
              Save
            </button>
            <button
              onClick={() => setDraft(null)}
              className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-300 mt-0.5 shrink-0" />
            <div className="space-y-1 text-[11px] text-rose-100">
              <div>
                Remove <span className="font-mono">{confirmDelete.name}</span> from the catalog?
              </div>
              {grantedNames(confirmDelete).length > 0 && (
                <div className="text-rose-200/80 leading-snug">
                  {grantedNames(confirmDelete).join(', ')}{' '}
                  {grantedNames(confirmDelete).length === 1 ? 'is' : 'are'} granted this server
                  and will lose the tool on the next turn. The grant itself is left in place,
                  so re-adding the server restores it.
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 pl-5">
            <button
              onClick={() => void remove(confirmDelete)}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-xs font-medium text-rose-100 disabled:opacity-40 transition-colors"
            >
              {busy ? 'Removing...' : 'Remove'}
            </button>
            <button
              onClick={() => setConfirmDelete(null)}
              className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
