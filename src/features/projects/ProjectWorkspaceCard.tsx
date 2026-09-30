import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Download, FolderInput, FolderMinus, GitBranch, Loader2, Monitor, RefreshCw } from 'lucide-react';

import { apiService, parseApiError } from '@/shared/services/apiService';
import type { RepositoryCheckout } from '@/shared/types';
import { summarizeCheckouts } from './checkoutSummary';

/**
 * Where each of a project's repositories is, on this machine.
 *
 * The project is the team's; a checkout is one developer's, anywhere on their
 * disk -- so a repository's row in the project says whether this machine has
 * it, and offers to clone it or link the folder it is already in. A paired
 * project's -be and -fe answer separately: having one half is not having the
 * other, and an agent working the frontend needs the frontend's checkout.
 *
 * Only on a desktop. The web keeps no checkouts, so it shows none of this
 * rather than buttons that cannot work there.
 */

export const isDesktop = Boolean(
  (window as unknown as { alphaDesktop?: { isDesktop?: boolean } }).alphaDesktop?.isDesktop
);

const key = (repo: string) => repo.toLowerCase();

export interface RepositoryCheckouts {
  /** By `owner/name`, lower-cased. Empty on the web. */
  byRepo: ReadonlyMap<string, RepositoryCheckout>;
  list: RepositoryCheckout[];
  loading: boolean;
  reload: () => Promise<void>;
}

/** This machine's checkouts of the project's repositories, re-read when `resourcesKey` changes. */
export function useRepositoryCheckouts(projectId: string, resourcesKey: string): RepositoryCheckouts {
  const [list, setList] = useState<RepositoryCheckout[]>([]);
  const [loading, setLoading] = useState(isDesktop);

  const reload = useCallback(async () => {
    if (!isDesktop) return;
    setLoading(true);
    try {
      setList((await apiService.getRepositoryCheckouts(projectId)).checkouts);
    } catch {
      // A daemon that cannot answer leaves the rows as they were; each
      // action below reports its own failure.
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload, resourcesKey]);

  return { byRepo: new Map(list.map(c => [key(c.repo), c])), list, loading, reload };
}

/** "1 of 2 on this machine", with one press for every repository still missing. */
export const CheckoutSummary: React.FC<{
  projectId: string;
  checkouts: RepositoryCheckouts;
  canBind: boolean;
}> = ({ projectId, checkouts, canBind }) => {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!isDesktop || checkouts.list.length === 0) return null;
  const { total, onMachine, missing } = summarizeCheckouts(checkouts.list);

  const cloneMissing = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await apiService.cloneProject(projectId);
      await checkouts.reload();
    } catch (err) {
      setProblem(parseApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className={`inline-flex items-center gap-1.5 ${missing.length ? 'text-amber-300' : 'text-emerald-300'}`}>
          <Monitor className="h-3.5 w-3.5" aria-hidden />
          {onMachine} of {total} on this machine
        </span>
        <div className="flex items-center gap-1">
          {canBind && missing.length > 1 && (
            <button
              type="button"
              onClick={() => void cloneMissing()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-2.5 py-1 text-[11px] font-medium text-on-accent transition-colors hover:bg-brand-600 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Download className="h-3 w-3" aria-hidden />}
              {busy ? 'Cloning…' : `Clone all ${missing.length}`}
            </button>
          )}
          <button
            type="button"
            onClick={() => void checkouts.reload()}
            className="rounded-lg p-1 text-gray-500 hover:bg-white/[0.05] hover:text-gray-200"
            title="Check again"
            aria-label="Check this machine's checkouts again"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checkouts.loading ? 'animate-spin' : ''}`} aria-hidden />
          </button>
        </div>
      </div>
      {problem && (
        <p role="alert" className="flex items-start gap-1.5 text-[11px] text-amber-300">
          <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden /> {problem}
        </p>
      )}
    </div>
  );
};

/** One repository's state on this machine, under its row: its checkout, or how to get one. */
export const RepoCheckoutLine: React.FC<{
  projectId: string;
  repo: string;
  checkouts: RepositoryCheckouts;
  canBind: boolean;
}> = ({ projectId, repo, checkouts, canBind }) => {
  const [busy, setBusy] = useState<'clone' | 'link' | 'forget' | null>(null);
  const [linking, setLinking] = useState(false);
  const [folder, setFolder] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  if (!isDesktop) return null;

  const checkout = checkouts.byRepo.get(key(repo));
  const run = async (what: 'clone' | 'link' | 'forget', action: () => Promise<unknown>) => {
    setBusy(what);
    setProblem(null);
    try {
      await action();
      await checkouts.reload();
      if (what === 'link') {
        setFolder('');
        setLinking(false);
      }
    } catch (err) {
      setProblem(parseApiError(err).message);
    } finally {
      setBusy(null);
    }
  };

  const status = checkout?.status;
  const here = Boolean(checkout?.localDir);

  return (
    <div className="space-y-1.5 border-t border-white/[0.04] px-2.5 pb-2 pt-1.5 font-sans text-[11px]">
      {checkouts.loading && !checkout ? (
        <span className="text-gray-500">Checking this machine…</span>
      ) : here && checkout ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {status?.exists === false ? (
            <span className="inline-flex items-center gap-1 text-amber-300">
              <AlertTriangle className="h-3 w-3" aria-hidden /> The folder is not there any more
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <Check className="h-3 w-3" aria-hidden /> On this machine
              </span>
              {status?.branch && (
                <span className="inline-flex items-center gap-1 text-gray-400">
                  <GitBranch className="h-3 w-3" aria-hidden /> {status.branch}
                </span>
              )}
              {status && !status.clean && <span className="text-amber-300">uncommitted changes</span>}
              {(status?.ahead ?? 0) > 0 && <span className="text-gray-400">{status?.ahead} not pushed</span>}
              {(status?.behind ?? 0) > 0 && <span className="text-gray-400">{status?.behind} behind</span>}
            </>
          )}
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-gray-500" title={checkout.localDir ?? undefined}>
            {checkout.localDir}
          </span>
          {canBind && (
            <button
              type="button"
              onClick={() => void run('forget', () => apiService.unbindProject(projectId, repo))}
              disabled={busy !== null}
              className="p-0.5 text-gray-500 transition-colors hover:text-gray-200 disabled:opacity-40"
              title="Forget this folder (nothing is deleted)"
              aria-label={`Forget the folder of ${repo} on this machine`}
            >
              <FolderMinus className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-amber-300">Not on this machine</span>
          {canBind && (
            <>
              <button
                type="button"
                onClick={() => void run('clone', () => apiService.cloneProject(projectId, repo))}
                disabled={busy !== null}
                className="inline-flex items-center gap-1 rounded-md bg-brand-500/15 px-2 py-0.5 font-medium text-brand-200 transition-colors hover:bg-brand-500/25 disabled:opacity-40"
              >
                {busy === 'clone' ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Download className="h-3 w-3" aria-hidden />}
                {busy === 'clone' ? 'Cloning…' : 'Clone'}
              </button>
              <button
                type="button"
                onClick={() => setLinking(open => !open)}
                disabled={busy !== null}
                aria-expanded={linking}
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-gray-300 transition-colors hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
              >
                <FolderInput className="h-3 w-3" aria-hidden /> Link a folder
              </button>
            </>
          )}
        </div>
      )}

      {linking && !here && (
        <form
          className="flex gap-1.5"
          onSubmit={event => {
            event.preventDefault();
            if (folder.trim()) void run('link', () => apiService.bindProject(projectId, folder.trim(), repo));
          }}
        >
          <input
            value={folder}
            onChange={event => setFolder(event.target.value)}
            placeholder={`Where you cloned ${repo.split('/')[1]}`}
            aria-label={`Folder that holds ${repo}`}
            autoFocus
            className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-well px-2.5 py-1 font-mono text-[11px] text-white outline-none placeholder:font-sans placeholder:text-gray-600 focus:border-brand-400/50"
          />
          <button
            type="submit"
            disabled={busy !== null || !folder.trim()}
            className="rounded-lg border border-white/[0.10] px-2.5 py-1 text-gray-200 hover:bg-white/[0.05] disabled:opacity-40"
          >
            {busy === 'link' ? 'Linking…' : 'Link'}
          </button>
        </form>
      )}

      {problem && (
        <p role="alert" className="flex items-start gap-1.5 text-amber-300">
          <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden /> {problem}
        </p>
      )}
    </div>
  );
};
