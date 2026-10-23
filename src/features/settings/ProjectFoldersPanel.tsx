import React, { useEffect, useState } from 'react';
import { FolderOpen, RotateCcw } from 'lucide-react';

import { apiService, type CodeFolderSetting } from '@/shared/services/apiService';

interface FolderPicker { selectFolder?: () => Promise<string | null> }
const folderPicker = (): FolderPicker | undefined => {
  const bridges = window as unknown as { alphaDesktop?: FolderPicker; alphaAPI?: FolderPicker };
  return bridges.alphaDesktop?.selectFolder ? bridges.alphaDesktop : bridges.alphaAPI;
};

/**
 * Where this computer keeps project code: one folder per project inside it,
 * created automatically, and where Alpha and the Orchestrator clone a
 * project's repositories.
 */
export const ProjectFoldersPanel: React.FC = () => {
  const [setting, setSetting] = useState<CodeFolderSetting | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiService.getCodeFolder().then(setSetting).catch(err => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const save = async (dir: string | null) => {
    setBusy(true);
    setError(null);
    try {
      setSetting(await apiService.setCodeFolder(dir));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The projects folder could not be changed.');
    } finally {
      setBusy(false);
    }
  };

  const change = async () => {
    try {
      const picked = await folderPicker()?.selectFolder?.();
      if (picked) await save(picked);
    } catch {
      setError('Could not open the folder picker. Please try again.');
    }
  };

  const isDefault = setting ? setting.codeFolder === setting.defaultCodeFolder : true;
  const sample = setting ? setting.codeFolder.replace(/[\\/]+$/, '') + '\\<project>\\<repository>' : '';

  return (
    <div className="p-4 rounded-xl bg-well border border-white/10 space-y-3">
      <div>
        <div className="text-xs font-semibold text-white flex items-center gap-2">
          <FolderOpen className="h-3.5 w-3.5 text-amber-300" aria-hidden />
          Projects folder
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed mt-1">
          Each project gets its own folder here. Alpha and the Orchestrator clone a project&apos;s repositories into it, and
          chats on that project read the code from it.
        </p>
      </div>
      <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-[11px] text-gray-100 break-all" title={setting?.codeFolder}>
        {setting ? setting.codeFolder : 'Reading…'}
      </div>
      {setting && <p className="text-[10px] text-gray-500 font-mono break-all">{sample}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void change()} disabled={busy || !setting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white font-medium transition-colors disabled:opacity-50">
          <FolderOpen className="h-3.5 w-3.5" aria-hidden />
          {busy ? 'Saving…' : 'Change folder…'}
        </button>
        {!isDefault && (
          <button type="button" onClick={() => void save(null)} disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-300 hover:bg-white/5 disabled:opacity-50">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Use the default
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-[11px] text-rose-300">{error}</p>}
    </div>
  );
};
