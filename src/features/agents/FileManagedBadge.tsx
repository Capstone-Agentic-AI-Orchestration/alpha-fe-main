import { FileText } from 'lucide-react';

import { Agent } from '@/shared/types';

/**
 * Marks a control whose value lives in the agent's persona file.
 *
 * The daemon merges the file over the database row before returning an agent,
 * so these controls show what the agent will actually run with rather than a
 * stale column, and an edit here writes back through to the file's frontmatter.
 *
 * The badge is therefore information, not a restriction: it says where the
 * value really lives, and offers a way to the file for anyone who would rather
 * edit it there. The one exception is the system prompt, which stays read-only
 * here — a seven-row box is the wrong editor for a persona, and saving from it
 * would discard the guidance comment the file carries.
 */

/** True when this field's value comes from the persona file. */
export function isManagedByFile(agent: Pick<Agent, 'managedByFile'>, field: string): boolean {
  return (agent.managedByFile ?? []).includes(field);
}

/** Styling for the few inputs that display a file-owned value read-only. */
export const MANAGED_INPUT_CLASS = 'opacity-60 cursor-not-allowed';

interface Props {
  /** Called to take the user to the Persona File tab. */
  onOpenFile: () => void;
}

export function FileManagedBadge({ onOpenFile }: Props) {
  return (
    <button
      onClick={onOpenFile}
      title="This value lives in the agent's persona file. Editing here updates that file — click to open it."
      className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
    >
      <FileText size={10} />
      <span className="underline underline-offset-2">in file</span>
    </button>
  );
}
