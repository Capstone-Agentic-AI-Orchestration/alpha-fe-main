import React, { useMemo, useState } from 'react';
import { ChevronRight, ExternalLink, FileText, Folder, FolderOpen, FolderTree } from 'lucide-react';

import { apiService } from '@/shared/services/apiService';
import { RepoFile, RepoTree } from '@/shared/types';
import { CopyButton } from '@/shared/components/CopyButton';
import { buildFileTree, FileTreeNode, formatBytes } from './repoFormat';
import { RefreshButton, RepoSection, SectionEmpty, SectionError, SectionLoading } from './SectionState';
import { useRepoResource } from './useRepoResource';

interface RepoFileBrowserProps {
  projectId: string;
  repo: string;
  branch: string;
}

/** `https://github.com/owner/name/blob/<branch>/<path>`, each path segment encoded. */
function githubBlobUrl(repo: string, branch: string, path: string): string {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const encodedBranch = branch.split('/').map(encodeURIComponent).join('/');
  return `https://github.com/${repo}/blob/${encodedBranch}/${encodedPath}`;
}

/**
 * Read-only browsing of one branch: a folder tree on the left, the chosen
 * file on the right. Nothing here writes — changes reach the repository
 * through agents and pull requests, not an editor in the page.
 */
export const RepoFileBrowser: React.FC<RepoFileBrowserProps> = ({ projectId, repo, branch }) => {
  const tree = useRepoResource<RepoTree>(
    () => apiService.getRepoTree(projectId, repo, branch),
    `${projectId}|${repo}|${branch}|tree`
  );
  const nodes = useMemo(() => buildFileTree(tree.data?.entries ?? []), [tree.data]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const toggle = (path: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <RepoSection
      id={`repo-files-${repo}`}
      title="Files"
      icon={<FolderTree className="h-3.5 w-3.5 text-brand-400" aria-hidden />}
      actions={<RefreshButton onClick={tree.reload} loading={tree.loading} label="Reload the file tree" />}
    >
      {tree.loading && !tree.data ? (
        <SectionLoading label={`Loading ${branch}…`} />
      ) : tree.error ? (
        <SectionError message={tree.error} onRetry={tree.reload} />
      ) : nodes.length === 0 ? (
        <SectionEmpty>This branch has no files yet.</SectionEmpty>
      ) : (
        <>
          {tree.data?.truncated && (
            <p className="border-b border-white/[0.06] px-3.5 py-2 text-[11px] text-amber-300">
              This repository is too large to list in full — some files are missing from the tree.
            </p>
          )}
          <div className="grid md:grid-cols-[minmax(12rem,17rem)_minmax(0,1fr)]">
            <nav
              aria-label={`Files on ${branch}`}
              className="max-h-[30rem] overflow-auto border-b border-white/[0.06] py-1.5 md:border-b-0 md:border-r"
            >
              <TreeList
                nodes={nodes}
                depth={0}
                expanded={expanded}
                selectedPath={selectedPath}
                onToggle={toggle}
                onSelect={setSelectedPath}
              />
            </nav>
            <div className="min-w-0">
              {selectedPath ? (
                <FileViewer projectId={projectId} repo={repo} branch={branch} path={selectedPath} />
              ) : (
                <SectionEmpty>Choose a file to read it.</SectionEmpty>
              )}
            </div>
          </div>
        </>
      )}
    </RepoSection>
  );
};

const TreeList: React.FC<{
  nodes: FileTreeNode[];
  depth: number;
  expanded: Set<string>;
  selectedPath: string | null;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}> = ({ nodes, depth, expanded, selectedPath, onToggle, onSelect }) => (
  <ul role={depth === 0 ? undefined : 'group'}>
    {nodes.map(node => {
      const indent = { paddingLeft: `${0.75 + depth * 0.85}rem` };
      if (node.type === 'dir') {
        const open = expanded.has(node.path);
        return (
          <li key={node.path}>
            <button
              type="button"
              onClick={() => onToggle(node.path)}
              aria-expanded={open}
              style={indent}
              className="flex w-full items-center gap-1.5 py-1 pr-3 text-left font-mono text-[11px] text-gray-300 transition-colors hover:bg-white/[0.04] hover:text-white"
            >
              <ChevronRight
                className={`h-3 w-3 flex-shrink-0 text-gray-500 transition-transform ${open ? 'rotate-90' : ''}`}
                aria-hidden
              />
              {open ? (
                <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-amber-300/80" aria-hidden />
              ) : (
                <Folder className="h-3.5 w-3.5 flex-shrink-0 text-amber-300/80" aria-hidden />
              )}
              <span className="truncate">{node.name}</span>
            </button>
            {open && (
              node.children.length > 0 ? (
                <TreeList
                  nodes={node.children}
                  depth={depth + 1}
                  expanded={expanded}
                  selectedPath={selectedPath}
                  onToggle={onToggle}
                  onSelect={onSelect}
                />
              ) : (
                <p
                  style={{ paddingLeft: `${0.75 + (depth + 1) * 0.85 + 1}rem` }}
                  className="py-1 text-[11px] italic text-gray-600"
                >
                  empty
                </p>
              )
            )}
          </li>
        );
      }
      const selected = selectedPath === node.path;
      return (
        <li key={node.path}>
          <button
            type="button"
            onClick={() => onSelect(node.path)}
            aria-current={selected ? 'true' : undefined}
            style={indent}
            className={`flex w-full items-center gap-1.5 py-1 pr-3 text-left font-mono text-[11px] transition-colors ${
              selected ? 'bg-brand-500/15 text-white' : 'text-gray-400 hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            {/* Lines up with the folder names, which carry a chevron. */}
            <span className="w-3 flex-shrink-0" aria-hidden />
            <FileText className="h-3.5 w-3.5 flex-shrink-0 text-gray-500" aria-hidden />
            <span className="truncate">{node.name}</span>
          </button>
        </li>
      );
    })}
  </ul>
);

const FileViewer: React.FC<{ projectId: string; repo: string; branch: string; path: string }> = ({
  projectId,
  repo,
  branch,
  path
}) => {
  const file = useRepoResource<RepoFile>(
    () => apiService.getRepoFile(projectId, repo, path, branch),
    `${projectId}|${repo}|${branch}|${path}`
  );
  const lines = useMemo(() => {
    const content = file.data?.content;
    if (content === null || content === undefined) return null;
    const split = content.replace(/\r\n/g, '\n').split('\n');
    // A trailing newline is the end of the last line, not an empty line after it.
    if (split.length > 1 && split[split.length - 1] === '') split.pop();
    return split;
  }, [file.data]);

  return (
    <div className="flex min-w-0 flex-col" aria-busy={file.loading}>
      <div className="flex min-w-0 items-center justify-between gap-2 border-b border-white/[0.06] px-3.5 py-2">
        <p className="min-w-0 truncate font-mono text-[11px] text-gray-200" title={path}>{path}</p>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {file.data && <span className="text-[10px] tabular-nums text-gray-500">{formatBytes(file.data.size)}</span>}
          <CopyButton value={path} label="file path" />
          <a
            href={githubBlobUrl(repo, branch, path)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${path} on GitHub`}
            title="Open on GitHub"
            className="rounded-md p-1 text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      </div>

      {file.loading && !file.data ? (
        <SectionLoading label="Opening file…" />
      ) : file.error ? (
        <SectionError message={file.error} onRetry={file.reload} />
      ) : !file.data ? null : lines === null ? (
        <SectionEmpty>
          This file is too large to preview ({formatBytes(file.data.size)}). Open it on GitHub instead.
        </SectionEmpty>
      ) : (
        <>
          {file.data.truncated && (
            <p className="border-b border-white/[0.06] px-3.5 py-1.5 text-[11px] text-amber-300">
              Showing the start of the file only.
            </p>
          )}
          {/* Two columns rather than a row per line: a long file stays one
              text node per column, which the browser lays out cheaply. */}
          <div
            className="flex max-h-[30rem] overflow-auto bg-well font-mono text-[11px] leading-5"
            tabIndex={0}
            role="region"
            aria-label={`Contents of ${path}`}
          >
            <pre
              aria-hidden
              className="sticky left-0 select-none border-r border-white/[0.06] bg-well px-3 py-2 text-right tabular-nums text-gray-600"
            >
              {lines.map((_, index) => index + 1).join('\n')}
            </pre>
            <pre className="flex-1 whitespace-pre px-3 py-2 text-gray-200">
              <code>{lines.join('\n')}</code>
            </pre>
          </div>
        </>
      )}
    </div>
  );
};
