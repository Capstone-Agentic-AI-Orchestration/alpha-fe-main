import React, { useCallback, useEffect, useState } from 'react';
import { Download, FolderOpen, Loader2 } from 'lucide-react';

import { apiService, type ProjectFolderReport, type RepositoryLocation } from '@/shared/services/apiService';
import { pickFolder } from './CloneToComputerDialog';

/**
 * The project's folder on this computer and each repository's state there;
 * null until loaded, or when not on the desktop. Looked up again when
 * `refreshKey` changes, e.g. when a repository is attached.
 */
export function useProjectFolder(projectId: string, enabled: boolean, refreshKey = '') {
  const [report, setReport] = useState<ProjectFolderReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!enabled) return;
    try {
      setReport(await apiService.getProjectFolder(projectId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check this computer for the project.');
    }
  }, [projectId, enabled]);
  useEffect(() => {
    setReport(null);
    void reload();
  }, [reload, refreshKey]);
  return { report, error, reload, setReport, setError };
}

export type ProjectFolderState = ReturnType<typeof useProjectFolder>;

const STATE_LABEL: Record<RepositoryLocation['state'], string> = {
  registered: 'On this computer',
  found: 'Found in the project folder',
  moved: 'Folder moved or deleted',
  missing: 'Not on this computer yet'
};
const STATE_TONE: Record<RepositoryLocation['state'], string> = {
  registered: 'bg-emerald-400',
  found: 'bg-sky-400',
  moved: 'bg-amber-400',
  missing: 'bg-gray-500'
};

/** "2 of 2 repositories on this computer", for headers. Found copies count: agents can read them. */
export function localCodeSummary(report: ProjectFolderReport | null): string | null {
  if (!report || !report.repositories.length) return null;
  const here = report.repositories.filter(item => item.state === 'registered' || item.state === 'found').length;
  const total = report.repositories.length;
  if (here === 0) return 'Not on this computer yet';
  return here + ' of ' + total + (total === 1 ? ' repository' : ' repositories') + ' on this computer';
}

/**
 * Where this project lives on this computer, on the Code tab: the project
 * folder, and per repository whether Alpha uses a copy, found one in the
 * project folder, lost it, or has none.
 */
export const ProjectFolderStrip: React.FC<{
  projectId: string;
  folder: ProjectFolderState;
  onClone: () => void;
}> = ({ projectId, folder, onClone }) => {
  const { report, error, setReport, setError } = folder;
  const [busy, setBusy] = useState<string | null>(null);
  if (!report) return error ? <p role="alert" className="text-xs text-rose-300">{error}</p> : null;

  const act = async (key: string, call: () => Promise<ProjectFolderReport>) => {
    setBusy(key);
    try {
      setReport(await call());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work. Please try again.');
    } finally {
      setBusy(null);
    }
  };
  const changeFolder = async () => {
    const picked = await pickFolder();
    if (picked) await act('folder', () => apiService.setProjectFolder(projectId, picked));
  };

  return (
    <section aria-label="This project on your computer" className="rounded-xl border border-white/[0.06] bg-surface-200/50 p-3.5 text-xs">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
        <span className="font-medium text-gray-200">Project folder</span>
        <span className="min-w-0 max-w-full truncate font-mono text-[11px] text-gray-400" title={report.folder}>{report.folder}</span>
        <button type="button" onClick={() => void changeFolder()} disabled={busy !== null}
          className="rounded-md px-2 py-0.5 text-[11px] text-brand-300 hover:bg-white/5 disabled:opacity-50">Change</button>
        {!report.isDefault && <button type="button" disabled={busy !== null}
          onClick={() => void act('folder', () => apiService.setProjectFolder(projectId, null))}
          className="rounded-md px-2 py-0.5 text-[11px] text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-50">Use default</button>}
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {report.repositories.map(item => (
          <li key={item.repo} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className={'h-1.5 w-1.5 shrink-0 rounded-full ' + STATE_TONE[item.state]} aria-hidden />
            <span className="font-mono text-gray-100">{item.name}</span>
            <span className="text-gray-400">{STATE_LABEL[item.state]}{item.state === 'registered' && item.managed ? ' (Alpha’s copy)' : ''}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-gray-500" title={item.dir ?? item.expectedDir}>
              {item.state === 'missing' ? 'will go to ' + item.expectedDir : item.dir}
            </span>
            {item.state === 'found' && <button type="button" disabled={busy !== null}
              onClick={() => void act(item.repo, () => apiService.useFoundRepositoryCopy(projectId, item.repo))}
              title="Builds branch from this copy too"
              className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-gray-100 hover:bg-white/5 disabled:opacity-50">
              {busy === item.repo && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}Use this copy
            </button>}
            {(item.state === 'missing' || item.state === 'moved') && <button type="button" onClick={onClone} disabled={busy !== null}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-gray-100 hover:bg-white/5 disabled:opacity-50">
              <Download className="h-3 w-3" aria-hidden />Clone
            </button>}
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-2 text-[11px] text-rose-300">{error}</p>}
    </section>
  );
};

