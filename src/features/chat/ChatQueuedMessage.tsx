import React from 'react';
import { Clock, Pencil, X } from 'lucide-react';

import type { QueuedChatMessage } from './chatComposer';

/**
 * A message waiting for the running reply to end, above the message box: what will be
 * sent, and ways to take it back to edit or to cancel it before it goes.
 */
export const ChatQueuedMessage: React.FC<{ message: QueuedChatMessage; onEdit: () => void; onCancel: () => void }> = ({ message, onEdit, onCancel }) => {
  const count = message.files.length;
  let files = '';
  if (count) files = count === 1 ? '1 file' : `${count} files`;
  return <div role="status" aria-label="Queued message" className="px-2">
    <div className="flex max-w-full items-center gap-2.5 rounded-lg border border-divider bg-surface-raised px-2.5 py-1.5 text-xs">
      <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-selected text-link"><Clock className="h-3.5 w-3.5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] text-content-muted">Queued · sends when this reply finishes</span>
        <span className="block truncate text-content">{[message.text, files].filter(Boolean).join(' · ')}</span>
      </span>
      <button type="button" onClick={onEdit} className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-content-secondary hover:bg-surface-high hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><Pencil className="h-3 w-3" aria-hidden="true" />Edit</button>
      <button type="button" onClick={onCancel} aria-label="Cancel queued message" title="Cancel queued message" className="shrink-0 rounded-md p-1 text-content-muted hover:bg-surface-high hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><X className="h-3.5 w-3.5" /></button>
    </div>
  </div>;
};
