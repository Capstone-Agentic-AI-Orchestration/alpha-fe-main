import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, FolderOpen, Loader2, XCircle } from 'lucide-react';

import { Modal } from '@/shared/components/Modal';
import { apiService, type FolderCloneResult } from '@/shared/services/apiService';

const shortName = (repo: string) => repo.split('/').pop() ?? repo;

interface DesktopBridge { selectFolder?: () => Promise<string | null> }
/** The desktop app's native folder picker (alphaDesktop.selectFolder), or the older alphaAPI one. */
const desktopBridge = (): DesktopBridge | undefined => {
  if (typeof window === 'undefined') return undefined;
  const bridges = window as unknown as { alphaDesktop?: DesktopBridge; alphaAPI?: DesktopBridge };
  return bridges.alphaDesktop?.selectFolder ? bridges.alphaDesktop : bridges.alphaAPI;
};

/** Cloning needs a disk and a folder picker, which only the desktop app has. */
export const canCloneToComputer = (): boolean => Boolean(desktopBridge()?.selectFolder);

/**
 * Clone a project's repositories into a folder the developer chooses, one
 * subfolder per repository, and optionally let Alpha's builds use those copies.
 */
export const CloneToComputerDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  repositories: string[];
}> = ({ isOpen, onClose, projectId, repositories }) => {
  const [selected, setSelected] = useState<string[]>(repositories);
  const [folder, setFolder] = useState('');
  const [bind, setBind] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<FolderCloneResult[] | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelected(repositories); setBind(false); setBusy(false); setError(null); setResults(null);
    // Start in the project's own folder on this computer, which Alpha creates.
    let current = true;
    void apiService.getProjectFolder(projectId)
      .then(location => { if (current) setFolder(previous => previous || location.folder); })
      .catch(() => undefined);
    return () => { current = false; };
  }, [isOpen, repositories, projectId]);

  const browse = async () => {
    try {
      const picked = await desktopBridge()?.selectFolder?.();
      if (picked) { setFolder(picked); setError(null); }
    } catch {
      setError('Could not open the folder picker. Please try again.');
    }
  };
  const toggle = (repo: string) => setSelected(current => current.includes(repo) ? current.filter(item => item !== repo) : [...current, repo]);
  const clone = async () => {
    if (!folder || !selected.length || busy) return;
    setBusy(true); setError(null);
    try {
      setResults((await apiService.cloneProjectTo(projectId, { repos: selected, intoDir: folder, bind })).results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The repositories could not be cloned.');
    } finally {
      setBusy(false);
    }
  };

  const footer = results
    ? <div className="flex justify-end"><button type="button" onClick={onClose} className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-on-accent hover:bg-brand-400">Done</button></div>
    : <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-lg px-4 py-2.5 text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-50">Cancel</button>
        <button type="button" onClick={() => void clone()} disabled={busy || !folder || !selected.length}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-on-accent hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {busy ? 'Cloning…' : selected.length > 1 ? 'Clone ' + selected.length + ' repositories' : 'Clone repository'}
        </button>
      </div>;

  return <Modal isOpen={isOpen} onClose={() => { if (!busy) onClose(); }} title="Clone to your computer"
    subtitle="Choose the repositories and the folder to save them in. Each one gets its own subfolder." maxWidth="max-w-xl" footer={footer}>
    {results ? <ul className="space-y-2">
      {results.map(result => <li key={result.repo} className="flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        {result.error ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />}
        <div className="min-w-0 flex-1 text-xs">
          <div className="font-mono text-gray-100">{result.repo}</div>
          {result.error
            ? <div className="mt-0.5 text-rose-200">{result.error}</div>
            : <div className="mt-0.5 text-gray-400">{(result.cloned ? 'Cloned to ' : 'Already cloned at ') + result.path}{result.bound ? ' · Alpha uses this copy for builds on this computer' : ''}</div>}
        </div>
      </li>)}
    </ul> : <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-medium text-gray-300">Repositories</legend>
        {repositories.map(repo => <label key={repo} className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-gray-200">
          <input type="checkbox" checked={selected.includes(repo)} onChange={() => toggle(repo)} className="accent-brand-500" />
          <span className="font-mono">{shortName(repo)}</span>
          <span className="ml-auto truncate text-[10px] text-gray-500">{repo}</span>
        </label>)}
      </fieldset>
      <div className="space-y-2">
        <span className="block text-xs font-medium text-gray-300">Save in</span>
        <div className="flex items-center gap-2">
          <div className={'min-w-0 flex-1 truncate rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-xs ' + (folder ? 'text-gray-100' : 'text-gray-500')} title={folder || undefined}>{folder || 'No folder chosen'}</div>
          <button type="button" onClick={() => void browse()} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2.5 text-xs text-gray-200 hover:bg-white/5">
            <FolderOpen className="h-3.5 w-3.5 text-amber-300" />Browse…
          </button>
        </div>
        {folder && selected.length > 0 && <p className="text-[11px] text-gray-500">{selected.map(repo => folder.replace(/[\\/]+$/, '') + (folder.includes('\\') ? '\\' : '/') + shortName(repo)).join(' · ')}</p>}
      </div>
      <label className="flex items-start gap-2.5 text-xs text-gray-300">
        <input type="checkbox" checked={bind} onChange={event => setBind(event.target.checked)} className="mt-0.5 accent-brand-500" />
        <span>Use these copies for Alpha’s builds on this computer<span className="mt-0.5 block text-[11px] text-gray-500">Builds then branch from these folders instead of Alpha’s own copies. Leave off to keep them only for yourself.</span></span>
      </label>
      {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
    </div>}
  </Modal>;
};

