import React, { useEffect, useRef, useState } from 'react';
import { CHAT_TITLE_MAX_LENGTH } from './ChatThreadDialogs';

/**
 * The name to save from an edit, or null when there is nothing to save:
 * blank, unchanged, or too long. Spaces are tidied the way the engine tidies them.
 */
export function chatTitleToSave(draft: string, current: string): string | null {
  const name = draft.replace(/\s+/g, ' ').trim();
  if (!name || name === current || name.length > CHAT_TITLE_MAX_LENGTH) return null;
  return name;
}

/**
 * The conversation's name in the chat header. Click it to rename in place:
 * Enter or clicking away saves, Esc puts the old name back. Without
 * `onRename` (on the web, or for clients) it is plain text.
 */
export const ChatTitleEditor: React.FC<{
  title: string;
  onRename?: (title: string) => void;
}> = ({ title, onRename }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  // Another view may rename the chat while this one is open.
  useEffect(() => { if (!editing) setDraft(title); }, [title, editing]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  if (!onRename) return <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-content">{title}</h1>;

  const finish = (save: boolean) => {
    const name = save ? chatTitleToSave(draft, title) : null;
    setEditing(false);
    if (name) onRename(name);
    else setDraft(title);
  };

  return editing ? (
    <input
      ref={inputRef}
      aria-label="Chat name"
      value={draft}
      maxLength={CHAT_TITLE_MAX_LENGTH}
      onChange={event => setDraft(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); finish(true); }
        if (event.key === 'Escape') { event.preventDefault(); finish(false); }
      }}
      className="min-w-0 flex-1 rounded-md border border-control bg-well px-2 py-1 text-sm font-semibold text-content outline-none focus:border-link"
    />
  ) : (
    <h1 className="min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Rename chat"
        className="max-w-full truncate rounded-md px-1 py-0.5 text-left text-sm font-semibold text-content hover:bg-surface-high focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {title}
      </button>
    </h1>
  );
};
