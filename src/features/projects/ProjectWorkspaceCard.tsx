import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  ExternalLink,
  Folder,
  GitBranch,
  Loader2,
  Monitor,
  RefreshCw,
  Unlink
} from 'lucide-react';

import { apiService } from '@/shared/services/apiService';
import { CheckoutStatus, Project, ProjectBinding } from '@/shared/types';
import { useApp } from '@/app/AppContext';

/**
 * Where this project's code is, on this machine.
 *
 * The panel this replaces wrote a folder into the project itself, which worked
 * while a board belonged to one person. On a shared board the project is the
 * team's -- the cloud drops local paths from it on write -- so the folder now
 * belongs to the machine, and this is where a developer sets it.
 *
 * Two audiences, one card. On a desktop it is the thing you act on: clone the
 * repository or point at a checkout you already have, then see the branch and
 * whether there is uncommitted work. On the web there is no folder to talk
 * about, so it says where the code lives instead of offering buttons that
 * cannot work there.
 */

const isDesktop = Boolean(
  (window as unknown as { alphaDesktop?: { isDesktop?: boolean } }).alphaDesktop?.isDesktop
);

interface Props {
  project: Pick<Project, 'id' | 'name' | 'resources'>;
}

function repoUrl(project: Pick<Project, 'resources'>): string | null {
  const repo = (project.resources ?? []).find(resource => resource.type === 'github_repo');
  return repo?.pathOrUrl ?? null;
}

export const ProjectWorkspaceCard: React.FC<Props> = ({ project }) => {
  const { can } = useApp();
  const canBind = can('bind_workspace');
  const [binding, setBinding] = useState<ProjectBinding | null>(null);
  const [status, setStatus] = useState<CheckoutStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'clone' | 'link' | 'unlink' | null>(null);
  const [folder, setFolder] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const url = repoUrl(project);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const current = await apiService.getProjectBinding(project.id);
      setBinding(current);
      // Only where there is a checkout to look at: the web has none.
      setStatus(current && isDesktop ? await apiService.getProjectCheckoutStatus(project.id) : null);
    } catch {
      // A daemon that cannot answer is not a reason to hide the card; the
      // actions below report their own failures.
      setBinding(null);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (what: 'clone' | 'link' | 'unlink', action: () => Promise<unknown>) => {
    setBusy(what);
    setProblem(null);
    try {
      await action();
      await load();
      if (what === 'link') setFolder('');
    } catch (err) {
      setProblem(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  if (!isDesktop) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-surface-200/50 p-4">
        <div className="flex items-center gap-2 text-gray-400">
          <Monitor className="h-4 w-4 text-brand-300" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">Where the code is</span>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          The code lives on each developer's machine. Open this project in the Alpha desktop app to clone it or
          point at a checkout you already have.
        </p>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-brand-300 hover:text-brand-200"
          >
            <ExternalLink className="h-3.5 w-3.5" /> {url.replace('https://github.com/', '')}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-surface-200/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-400">
          <Folder className="h-4 w-4 text-brand-300" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">This machine</span>
        </div>
        {binding && (
          <button
            onClick={() => void load()}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-white/[0.05] hover:text-gray-200"
            title="Check again"
            aria-label="Check the checkout again"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {loading && !binding ? (
        <p className="mt-3 text-xs text-gray-500">Looking…</p>
      ) : binding ? (
        <div className="mt-3 space-y-2">
          <p className="break-all font-mono text-[11px] text-gray-300">{binding.localDir}</p>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {status?.exists === false ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-1 text-amber-300">
                <AlertTriangle className="h-3 w-3" /> The folder is not there any more
              </span>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-gray-300">
                  <GitBranch className="h-3 w-3" /> {status?.branch ?? binding.activeBranch ?? 'unknown branch'}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                    status?.clean ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'
                  }`}
                >
                  {status?.clean ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {status?.clean ? 'Nothing uncommitted' : 'Uncommitted changes'}
                </span>
                {(status?.ahead ?? 0) > 0 && (
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-gray-300">
                    {status?.ahead} not pushed
                  </span>
                )}
                {(status?.behind ?? 0) > 0 && (
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-gray-300">
                    {status?.behind} behind
                  </span>
                )}
              </>
            )}
            {binding.isManaged && (
              <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-gray-500">cloned by Alpha</span>
            )}
          </div>
          {canBind && (
            <button
              onClick={() => void run('unlink', () => apiService.unbindProject(project.id))}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 disabled:opacity-40"
            >
              <Unlink className="h-3 w-3" /> {busy === 'unlink' ? 'Forgetting…' : 'Forget this folder'}
            </button>
          )}
        </div>
      ) : !canBind ? (
        <p className="mt-3 text-xs text-gray-500">No folder is set for this project on this machine.</p>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-gray-400">
            Alpha needs a checkout of this project to run an agent in it.
          </p>
          {url && (
            <button
              onClick={() => void run('clone', () => apiService.cloneProject(project.id))}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-medium text-on-accent disabled:opacity-40"
            >
              {busy === 'clone' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {busy === 'clone' ? 'Setting up…' : 'Clone and set up'}
            </button>
          )}
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={event => {
              event.preventDefault();
              if (folder.trim()) void run('link', () => apiService.bindProject(project.id, folder.trim()));
            }}
          >
            <input
              value={folder}
              onChange={event => setFolder(event.target.value)}
              placeholder="…or the folder you already cloned it into"
              className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-well px-3 py-2 font-mono text-[11px] text-white outline-none placeholder:font-sans placeholder:text-gray-600 focus:border-brand-400/50"
            />
            <button
              type="submit"
              disabled={busy !== null || !folder.trim()}
              className="rounded-xl border border-white/[0.10] px-3.5 py-2 text-xs text-gray-200 hover:bg-white/[0.05] disabled:opacity-40"
            >
              {busy === 'link' ? 'Linking…' : 'Link folder'}
            </button>
          </form>
        </div>
      )}

      {problem && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-amber-300">
          <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" /> {problem}
        </p>
      )}
    </div>
  );
};
