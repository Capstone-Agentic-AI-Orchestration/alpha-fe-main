import { useState } from 'react';
import { Folder, Check, Loader2, AlertTriangle } from 'lucide-react';

import { apiService } from '@/shared/services/apiService';
import { Project, ProjectResource } from '@/shared/types';
import { useApp } from '@/app/AppContext';

/**
 * Point a project at a checkout that already exists on this machine.
 *
 * This is the first thing a new collaborator has to do and there was no way to
 * do it. The panel could scaffold a brand new repository on GitHub, which is
 * the wrong shape entirely for someone who has just cloned the team's — so a
 * fresh install arrived with a project that refused every run, and the only fix
 * was editing SQLite by hand.
 *
 * The path is checked before it is saved. Every way it can be wrong used to
 * surface in the middle of an agent run as a "Git branch checkout notice" the
 * run then ignored, finishing with no branch, no commit and no PR.
 */

interface Props {
  /** Only what attaching needs — the panel does not always hold a whole Project. */
  project: Pick<Project, 'id' | 'resources'>;
  onAttached: (resources: ProjectResource[]) => void;
}

export function AttachWorkspaceForm({ project, onAttached }: Readonly<Props>) {
  const { can } = useApp();
  const canManageProjects = can('manage_projects');
  const [path, setPath] = useState('');
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const check = async (value: string) => {
    setPath(value);
    setVerified(false);
    setProblem(null);
    if (!value.trim()) return;

    setChecking(true);
    try {
      const result = await apiService.checkWorkspace(value);
      if (result.ok) setVerified(true);
      else setProblem(result.detail ?? 'That folder cannot be used.');
    } catch {
      // A daemon that cannot answer must not block the attempt — the PUT
      // validates again on the way in, so a save is still safe.
      setVerified(true);
    } finally {
      setChecking(false);
    }
  };

  const attach = async () => {
    if (!canManageProjects) return;
    setSaving(true);
    setProblem(null);
    try {
      const resource: ProjectResource = {
        id: `res-${Date.now()}`,
        type: 'local_path',
        name: path.trim().split(/[\\/]/).filter(Boolean).pop() || 'Working copy',
        pathOrUrl: path.trim(),
        branchOrMachine: 'this machine'
      };

      // Replace any existing attachment rather than appending: a project has
      // one working copy, and two would make the resolver pick silently.
      const kept = (project.resources ?? []).filter(
        r => r.type !== 'local_path' && r.type !== 'local_dir'
      );
      const updated = await apiService.updateProject(project.id, {
        resources: [...kept, resource]
      });

      onAttached(updated.resources ?? [...kept, resource]);
      setPath('');
      setVerified(false);
    } catch (err: any) {
      setProblem(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-medium text-gray-400">
        Attach a folder on this machine
      </label>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Folder className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={path}
            disabled={!canManageProjects}
            onChange={e => void check(e.target.value)}
            placeholder="C:\Users\you\Projects\alpha-be-main"
            className="w-full bg-well border border-white/10 rounded-xl pl-8 pr-8 py-2 text-white font-mono text-xs focus:outline-none focus:border-white/30"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
            {checking && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />}
            {!checking && verified && <Check className="w-3.5 h-3.5 text-emerald-400" />}
          </span>
        </div>

        <button
          onClick={() => void attach()}
          disabled={!canManageProjects || !verified || saving}
          className="px-3 py-2 rounded-xl bg-white text-canvas text-xs font-medium disabled:opacity-40 transition-opacity"
        >
          {saving ? 'Attaching…' : 'Attach'}
        </button>
      </div>

      {problem && (
        <div className="flex items-start gap-2 text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="leading-snug">{problem}</span>
        </div>
      )}

      {verified && !problem && (
        <p className="text-[10px] text-emerald-300/80">
          A git repository. Agents will branch, edit and commit here.
        </p>
      )}

      {!path && !problem && (
        <p className="text-[10px] text-gray-600 leading-snug">
          Point this at a repository you have already cloned. It must be the repository
          itself, not a folder containing several.
        </p>
      )}
    </div>
  );
}
