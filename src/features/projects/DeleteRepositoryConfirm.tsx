import React, { useId, useState } from 'react';
import { apiService, parseApiError } from '@/shared/services/apiService';
import type { RepoDeletionResult } from '@/shared/types';

/**
 * `owner/name` from what a repository resource stores -- a GitHub URL, with
 * or without the scheme or `.git`, or the bare pair. Null for anything else,
 * which then gets no delete control at all.
 */
export function repoNameWithOwner(pathOrUrl: string): string | null {
  const trimmed = pathOrUrl.trim().replace(/\.git$/i, '').replace(/\/+$/, '');
  const match = /^(?:https?:\/\/)?(?:www\.)?(?:github\.com\/)?([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/i.exec(trimmed);
  return match ? `${match[1]}/${match[2]}` : null;
}

interface DeleteRepositoryConfirmProps {
  projectId: string;
  repo: string;
  onDeleted: (result: RepoDeletionResult) => void;
  onCancel: () => void;
}

/**
 * The confirmation for deleting a repository and its hosting.
 *
 * Inline under the repository's row rather than a dialog of its own: it
 * opens inside the resources dialog, and a second modal on top of that one
 * would share its Escape key. The name is typed out, as GitHub asks for it,
 * because nothing this removes can be brought back.
 */
export const DeleteRepositoryConfirm: React.FC<DeleteRepositoryConfirmProps> = ({ projectId, repo, onDeleted, onCancel }) => {
  const inputId = useId();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmed = typed.trim().toLowerCase() === repo.toLowerCase();

  const handleDelete = async () => {
    if (!confirmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      onDeleted(await apiService.deleteProjectRepository(projectId, repo));
    } catch (err) {
      setError(parseApiError(err).message);
      setBusy(false);
    }
  };

  return (
    <div role="group" aria-label={`Delete ${repo}`} className="mt-2 space-y-2 rounded-xl border border-rose-400/25 bg-rose-500/[0.06] p-3 font-sans">
      <p className="text-[11px] leading-relaxed text-gray-300">
        This deletes <code className="font-mono text-white">{repo}</code> on GitHub, with its code, issues and pull
        requests, and removes its hosting: the Render services and Render project, or the Vercel project. Alpha&apos;s
        working copy on this machine goes too. This cannot be undone.
      </p>
      <label htmlFor={inputId} className="block text-[11px] text-gray-400">
        Type <code className="font-mono text-gray-200">{repo}</code> to confirm
      </label>
      <input
        id={inputId}
        type="text"
        value={typed}
        onChange={e => setTyped(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void handleDelete();
          }
        }}
        disabled={busy}
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-xl border border-white/10 bg-surface px-3 py-1.5 font-mono text-xs text-white placeholder-gray-500 focus:border-rose-400 focus:outline-none disabled:opacity-50"
      />
      {error && (
        <p role="alert" className="break-words font-mono text-[11px] text-rose-300">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-xl px-3 py-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={!confirmed || busy}
          className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-rose-500 disabled:opacity-40"
        >
          {busy ? 'Deleting… hosting first' : 'Delete repository'}
        </button>
      </div>
    </div>
  );
};
