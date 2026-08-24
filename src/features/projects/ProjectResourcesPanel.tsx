import React, { useState, useRef, useEffect } from 'react';
import { apiService } from '@/shared/services/apiService';
import { ProjectResource } from '@/shared/types';
import { GitBranch, Folder, FolderOpen, Plus, Trash2 } from 'lucide-react';

interface ProjectResourcesPanelProps {
  resources: ProjectResource[];
  onChange: (next: ProjectResource[]) => void;
  /** Seeds the description of any GitHub repo created from here. */
  description?: string;
  /**
   * `full` shows the create-repo and attach forms; `inline` renders only the
   * list of what is already attached, for places too narrow to hold a form.
   */
  variant?: 'full' | 'inline';
}

/**
 * Attach repositories and local directories to a project.
 *
 * This lived inside the create-project wizard, which meant the only moment you
 * could attach a repo was before the project existed — and the "Create" button
 * below calls GitHub for real, so abandoning that dialog left a live repository
 * with nothing pointing at it. It belongs on the project instead.
 */
export const ProjectResourcesPanel: React.FC<ProjectResourcesPanelProps> = ({
  resources,
  onChange,
  description,
  variant = 'full'
}) => {
  const isFull = variant === 'full';

  /* -------------------------------------------------------------------------
   * Create a GitHub repository for this project.
   *
   * Runs through the daemon, which shells out to `gh` as whoever is signed in
   * on this machine. Alpha never handles a GitHub token — same ambient-auth
   * model as the agent CLIs.
   * ---------------------------------------------------------------------- */
  const [ghAuth, setGhAuth] = useState<{ authenticated: boolean; username?: string } | null>(null);
  const [ghRepoName, setGhRepoName] = useState('');
  const [ghVisibility, setGhVisibility] = useState<'private' | 'public'>('private');
  const [ghBusy, setGhBusy] = useState(false);
  const [ghError, setGhError] = useState<string | null>(null);

  // Repository owner: '' means the personal account, anything else is an org login.
  const [ghOrgs, setGhOrgs] = useState<Array<{ login: string; role: string }>>([]);
  const [ghOwner, setGhOwner] = useState('');

  useEffect(() => {
    // The inline variant has no create form, so it also skips the two auth
    // round-trips — those used to fire on every project you opened.
    if (!isFull) return;
    apiService.checkGitHubAuth().then(setGhAuth).catch(() => setGhAuth({ authenticated: false }));
    // Orgs are a separate call so a missing read:org scope degrades to
    // "personal only" instead of breaking the whole panel.
    apiService.listGitHubOrgs().then(setGhOrgs).catch(() => setGhOrgs([]));
  }, [isFull]);

  const handleCreateRepo = async () => {
    const repoName = ghRepoName.trim();
    if (!repoName) return;

    setGhBusy(true);
    setGhError(null);
    try {
      const repo = await apiService.createGitHubRepo({
        name: repoName,
        visibility: ghVisibility,
        description: description?.trim() || undefined,
        org: ghOwner || undefined,
        initReadme: true
      });

      onChange([
        ...resources,
        {
          id: `res-${Date.now()}`,
          type: 'github_repo',
          name: repo.nameWithOwner,
          pathOrUrl: repo.url,
          branchOrMachine: 'main'
        }
      ]);
      setGhRepoName('');
    } catch (err) {
      // Surface the real reason — a name collision is the common case and the
      // user can fix it immediately.
      setGhError(err instanceof Error ? err.message : String(err));
    } finally {
      setGhBusy(false);
    }
  };

  const [newResType, setNewResType] = useState<'github_repo' | 'local_dir'>('local_dir');
  const [newResPath, setNewResPath] = useState('');
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleOpenFolderPicker = async () => {
    if ((window as any).alphaAPI?.selectFolder) {
      const picked = await (window as any).alphaAPI.selectFolder();
      if (picked) {
        setNewResPath(picked);
        const folderName = picked.replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'local-project';
        onChange([
          ...resources,
          {
            id: `res-${Date.now()}`,
            type: 'local_dir',
            name: folderName,
            pathOrUrl: picked,
            branchOrMachine: 'Local Machine'
          }
        ]);
      }
    } else if (folderInputRef.current) {
      folderInputRef.current.click();
    }
  };

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const firstFile = files[0] as any;
      const fullPath = firstFile.path || (firstFile.webkitRelativePath ? firstFile.webkitRelativePath.split('/')[0] : firstFile.name);
      const folderName = firstFile.webkitRelativePath ? firstFile.webkitRelativePath.split('/')[0] : (firstFile.name || 'local-project');

      setNewResPath(fullPath);
      onChange([
        ...resources,
        {
          id: `res-${Date.now()}`,
          type: 'local_dir',
          name: folderName,
          pathOrUrl: fullPath,
          branchOrMachine: 'Local Machine'
        }
      ]);
    }
    if (e.target) e.target.value = '';
  };

  const handleAddResource = () => {
    if (!newResPath.trim()) {
      if (newResType === 'local_dir') {
        handleOpenFolderPicker();
      }
      return;
    }
    const nameToUse = newResType === 'github_repo'
      ? newResPath.split('/').pop() || 'repo'
      : 'local-workspace';
    onChange([
      ...resources,
      {
        id: `res-${Date.now()}`,
        type: newResType,
        name: nameToUse,
        pathOrUrl: newResPath.trim(),
        branchOrMachine: newResType === 'github_repo' ? 'main' : 'Local Machine'
      }
    ]);
    setNewResPath('');
  };

  const handleRemoveResource = (id: string) => {
    onChange(resources.filter(r => r.id !== id));
  };

  const hasLocalDir = resources.some(r => r.type === 'local_dir');

  return (
    <div className="space-y-3 text-xs">
      {/* Create a GitHub repository for this project */}
      {isFull && (
        <div className="p-3 rounded-xl bg-[#0A0B0E] border border-white/5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-300 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-brand-400" />
              Create a GitHub repository
            </span>
            {ghAuth && (
              <span className="text-[10px] font-mono flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${ghAuth.authenticated ? 'bg-emerald-400' : 'bg-rose-400'}`}
                />
                <span className={ghAuth.authenticated ? 'text-gray-400' : 'text-rose-300'}>
                  {ghAuth.authenticated ? `gh: ${ghAuth.username ?? 'signed in'}` : 'gh not signed in'}
                </span>
              </span>
            )}
          </div>

          {ghAuth && !ghAuth.authenticated ? (
            <p className="text-[11px] text-gray-500">
              Run <code className="text-gray-300">gh auth login</code> in a terminal, then reopen this
              project. Alpha uses your own GitHub session and never stores a token.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <select
                  value={ghOwner}
                  onChange={(e) => setGhOwner(e.target.value)}
                  disabled={ghBusy}
                  title="Repository owner"
                  className="bg-[#14151B] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-brand-500 disabled:opacity-50 max-w-[11rem]"
                >
                  <option value="">{ghAuth?.username ?? 'Personal'}</option>
                  {ghOrgs.length > 0 && (
                    <optgroup label="Organizations">
                      {ghOrgs.map(o => (
                        <option key={o.login} value={o.login}>{o.login}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <span className="text-xs text-gray-500 flex-shrink-0">/</span>
                <input
                  type="text"
                  value={ghRepoName}
                  onChange={(e) => setGhRepoName(e.target.value)}
                  placeholder="repository-name"
                  disabled={ghBusy}
                  className="flex-1 min-w-0 bg-[#14151B] border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 disabled:opacity-50"
                />
                <select
                  value={ghVisibility}
                  onChange={(e) => setGhVisibility(e.target.value as 'private' | 'public')}
                  disabled={ghBusy}
                  className="bg-[#14151B] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 disabled:opacity-50"
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
                <button
                  type="button"
                  onClick={handleCreateRepo}
                  disabled={ghBusy || !ghRepoName.trim()}
                  className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-xs font-medium text-white disabled:opacity-40 transition-colors flex-shrink-0"
                >
                  {ghBusy ? 'Creating…' : 'Create'}
                </button>
              </div>

              {/* Plain members may be blocked by org policy, which is not
                  visible from the API — warn rather than fail at submit. */}
              {ghOwner && ghOrgs.find(o => o.login === ghOwner)?.role !== 'admin' && (
                <p className="text-[11px] text-amber-300">
                  You are a member of {ghOwner}, not an owner. Some organizations
                  only let owners create repositories.
                </p>
              )}

              {ghError && (
                <p className="text-[11px] text-rose-300 font-mono break-words">{ghError}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Attached resources */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {resources.length === 0 ? (
          <p className="p-3 text-gray-500 italic bg-[#0A0B0E] rounded-xl border border-white/5">
            No resources attached yet. Agents will work in the default workspace.
          </p>
        ) : (
          resources.map((res) => (
            <div
              key={res.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-[#14151B] border border-white/5 font-mono text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {res.type === 'github_repo' ? (
                  <div className="flex items-center gap-1.5 text-brand-300 min-w-0">
                    <GitBranch className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="font-medium truncate">{res.pathOrUrl}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-amber-300 min-w-0">
                    <Folder className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="font-medium truncate">{res.pathOrUrl}</span>
                  </div>
                )}
                <span className="text-[10px] text-gray-500 font-sans flex-shrink-0">({res.branchOrMachine})</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(res.pathOrUrl)}
                  className="text-gray-400 hover:text-white px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors text-[10px]"
                  title="Copy path"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveResource(res.id)}
                  className="p-1 text-gray-500 hover:text-rose-400 transition-colors"
                  title="Detach"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* A local path only resolves on the machine holding it. Say so where it
          is chosen — an agent scheduled elsewhere fails at checkout, and
          nothing else in the UI explains why. */}
      {hasLocalDir && (
        <p className="text-[11px] text-amber-300/90">
          Agents on other machines cannot see a local path — they will fail to start.
          Use a repository for shared work.
        </p>
      )}

      {isFull && (
        <>
          {/* Hidden native OS folder picker input */}
          <input
            ref={folderInputRef}
            type="file"
            {...({ webkitdirectory: '', directory: '' } as any)}
            className="hidden"
            onChange={handleFolderInputChange}
          />

          {/* Attach an existing repository or directory */}
          <div className="p-3.5 rounded-xl bg-[#0A0B0E] border border-white/5 space-y-2.5">
            <span className="text-[11px] font-medium text-gray-300">Attach Resource</span>
            <div className="flex items-center gap-2">
              <select
                value={newResType}
                onChange={(e) => {
                  setNewResType(e.target.value as 'github_repo' | 'local_dir');
                  setNewResPath('');
                }}
                className="bg-[#14151B] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 w-32 flex-shrink-0"
              >
                <option value="local_dir">Local Folder</option>
                <option value="github_repo">GitHub Repo</option>
              </select>

              <input
                type="text"
                value={newResPath}
                onChange={(e) => setNewResPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddResource();
                  }
                }}
                placeholder={newResType === 'local_dir' ? 'C:/path/to/local/project or Browse...' : 'github.com/owner/repo'}
                className="flex-1 min-w-0 bg-[#14151B] border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
              />

              {newResType === 'local_dir' && (
                <button
                  type="button"
                  onClick={handleOpenFolderPicker}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-gray-200 hover:text-white transition-colors flex-shrink-0 flex items-center gap-1.5"
                  title="Open OS file dialog to pick a folder"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span>Browse...</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleAddResource}
                className="px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-xs font-semibold text-white transition-colors flex-shrink-0 flex items-center gap-1 shadow-sm"
                title="Add resource"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
