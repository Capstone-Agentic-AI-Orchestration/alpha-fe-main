import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  FileText,
  Loader2,
  RotateCcw,
  Save
} from 'lucide-react';

import { apiService } from '@/shared/services/apiService';
import { AgentPersonaFile } from '@/shared/types';

/**
 * Edit an agent's persona file without leaving the app.
 *
 * The file at `~/.alpha/agents/{id}.md` is the system prompt, and its
 * frontmatter overrides the agent's database columns. Until now it could only
 * be edited in a text editor on whichever machine runs the daemon, which makes
 * it useless to anyone else on the team.
 *
 * Saving is explicit rather than auto-saved like the fields on the Instructions
 * tab. Half-typed frontmatter is a broken persona, and a debounce would happily
 * write it after every keystroke.
 */

interface Props {
  agentId: string;
  /** Bumped by the parent when the agent record changes, to force a reload. */
  refreshKey?: number;
}

const PLACEHOLDER = `---
name: Ada Lovelace
role: Architect
provider: Anthropic
model: claude-opus-5
---

You are Ada. Lead with the interface, then the implementation.`;

export function PersonaFileEditor({ agentId, refreshKey }: Props) {
  const [file, setFile] = useState<AgentPersonaFile | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  /** The text last known to be on disk — what "unsaved changes" compares to. */
  const onDisk = useRef('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await apiService.getAgentPersona(agentId);
      setFile(next);
      setDraft(next.content);
      onDisk.current = next.content;
    } catch (err: any) {
      setError(err?.message ?? 'Could not load the persona file');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const dirty = draft !== onDisk.current;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const next = await apiService.saveAgentPersona(agentId, draft);
      setFile(next);
      // Take the server's copy, not the draft: it normalises trailing
      // whitespace, so keeping the draft would leave the editor looking dirty
      // immediately after a successful save.
      setDraft(next.content);
      onDisk.current = next.content;
      setSavedAt(Date.now());
    } catch (err: any) {
      setError(err?.message ?? 'Could not save the persona file');
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/Cmd+S saves, because a monospace box that big invites the reflex.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (dirty && !saving) void save();
    }
  };

  /**
   * Download the persona file so it can be handed to someone else.
   *
   * The file carries the whole definition — name, role, provider, model,
   * autonomy, skills, appearance and the persona itself — so a teammate can
   * import it and run the agent on their own CLI. It deliberately carries no
   * environment variables, so it is safe to send.
   *
   * Exports what is on disk rather than the draft: sending an unsaved edit
   * would hand over something that does not exist on the sender's machine.
   */
  const exportFile = () => {
    const blob = new Blob([onDisk.current], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${agentId}.md`;
    link.click();

    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-xs py-8 justify-center">
        <Loader2 size={14} className="animate-spin" />
        Loading persona file...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
            <FileText size={12} />
            Persona File
          </div>
          <div
            className="text-[10px] text-gray-600 font-mono truncate"
            title={file?.path}
          >
            {file?.path}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {dirty && <span className="text-[10px] text-amber-300 font-mono">unsaved</span>}
          {!dirty && savedAt && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
              <Check size={11} /> saved
            </span>
          )}

          <button
            onClick={exportFile}
            disabled={!file?.exists}
            title="Download this persona file to share with a teammate"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] border border-white/10 text-gray-400 hover:text-white hover:border-white/30 disabled:opacity-30 transition-colors"
          >
            <Download size={11} /> Export
          </button>

          <button
            onClick={() => {
              setDraft(onDisk.current);
              setError(null);
            }}
            disabled={!dirty || saving}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] border border-white/10 text-gray-400 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:border-white/10 transition-colors"
          >
            <RotateCcw size={11} /> Revert
          </button>

          <button
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white text-canvas hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-white transition-colors"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            Save
          </button>
        </div>
      </div>

      {!file?.exists && (
        <div className="text-[11px] text-gray-500 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
          No file yet. Saving creates one — the daemon also writes it on startup.
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!!file?.warnings.length && (
        <div className="space-y-1 text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 font-medium">
            <AlertTriangle size={12} />
            Saved, but some values were ignored
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-amber-200/80">
            {file.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <textarea
        rows={20}
        spellCheck={false}
        value={draft}
        placeholder={PLACEHOLDER}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        className="w-full bg-well border border-white/10 rounded-xl p-3 text-white text-xs leading-relaxed font-mono focus:outline-none focus:border-white/30 resize-y"
      />

      {file && (
        <div className="space-y-1.5 border border-white/10 rounded-xl p-3 bg-well">
          <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">
            Effective on next run
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-[11px]">
            <Field label="Model" value={`${file.effective.modelProvider} / ${file.effective.modelName}`} />
            <Field label="Reasoning" value={file.effective.reasoningEffort || 'Auto (runtime default)'} />
            <Field label="Role" value={file.effective.role} />
            <Field label="Autonomy" value={file.effective.autonomyLevel} />
            <Field label="Prompt source" value={file.effective.promptSource} />
            <Field label="Prompt size" value={`${file.effective.systemPromptChars} chars`} />
            <Field label="MCP" value={file.effective.mcpServers.join(', ') || 'none'} />
          </div>
          <p className="text-[10px] text-gray-600 pt-1">
            Frontmatter here overrides the Instructions tab. Delete a key to fall back to it.
          </p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-gray-600">{label}</div>
      <div className="text-gray-300 font-mono truncate" title={value}>
        {value}
      </div>
    </div>
  );
}
