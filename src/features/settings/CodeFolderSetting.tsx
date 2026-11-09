import React, { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';

import { apiService, type CodeFolderSetting as CodeFolderValue } from '@/shared/services/apiService';
import { canCloneToComputer, pickFolder } from '@/features/projects/repository/CloneToComputerDialog';

/**
 * Where project folders go on this computer: <code folder>\<project name>,
 * one subfolder per repository. Desktop only; each computer has its own.
 */
export const CodeFolderSetting: React.FC<{ canChange: boolean }> = ({ canChange }) => {
  const [value, setValue] = useState<CodeFolderValue | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiService.getCodeFolder().then(setValue).catch(err => setError(err instanceof Error ? err.message : 'Could not read the code folder.'));
  }, []);

  const save = async (dir: string | null) => {
    setBusy(true);
    try {
      setValue(await apiService.setCodeFolder(dir));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the code folder.');
    } finally {
      setBusy(false);
    }
  };
  const browse = async () => {
    const picked = await pickFolder();
    if (picked) await save(picked);
  };

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-well p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-white">
        <FolderOpen className="h-3.5 w-3.5 text-amber-300" aria-hidden />Code folder
      </div>
      <p className="text-[11px] leading-relaxed text-gray-400">
        Each project gets a folder here, with one subfolder per repository. Agents read a project's code from its folder,
        and only that project's.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-[11px] text-gray-200" title={value?.codeFolder}>
          {value?.codeFolder ?? 'Reading…'}
        </span>
        {canChange && canCloneToComputer() && <button type="button" onClick={() => void browse()} disabled={busy}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15 disabled:opacity-50">Change…</button>}
        {canChange && value && value.codeFolder !== value.defaultCodeFolder && <button type="button" onClick={() => void save(null)} disabled={busy}
          className="rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-50">Use default</button>}
      </div>
      {error && <p role="alert" className="text-[11px] text-rose-300">{error}</p>}
    </div>
  );
};

