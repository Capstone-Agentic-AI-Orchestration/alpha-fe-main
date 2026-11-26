import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

/** A changed file, with its line counts once the build's working copy has been read. */
export type ChangedFile = { path: string; additions?: number; deletions?: number };

/** How many files a changed-files table lists before "Show all". */
const FILES_SHOWN = 6;

/** "+51 −9", for one file or the total. */
function LineCounts({ added, removed }: { added: number; removed: number }) {
  return <span className="shrink-0 font-mono"><span className="text-status-success">+{added}</span> <span className="text-status-danger">−{removed}</span></span>;
}

/**
 * What a reply or a build changed, under it in the conversation: "3 files changed +84 −12",
 * a row per file with its line counts, and Review to open the diff on the right.
 */
export function ChangedFilesCard({ files, onView }: { files: ChangedFile[]; onView?: () => void }) {
  const [showAll, setShowAll] = useState(false);
  if (!files.length) return null;
  const counted = files.every(file => typeof file.additions === 'number' && typeof file.deletions === 'number');
  const added = files.reduce((sum, file) => sum + (file.additions ?? 0), 0);
  const removed = files.reduce((sum, file) => sum + (file.deletions ?? 0), 0);
  const shown = showAll ? files : files.slice(0, FILES_SHOWN);
  return <section aria-label="Changed files" className="mt-3 overflow-hidden rounded-xl border border-divider text-left text-[13px]">
    <div className="flex items-center gap-2 px-3.5 py-2.5">
      <span className="text-content">{files.length === 1 ? '1 file changed' : files.length + ' files changed'}</span>
      {counted && <LineCounts added={added} removed={removed} />}
      {onView && <button type="button" onClick={onView} className="ml-auto inline-flex items-center gap-0.5 rounded text-xs text-content-muted hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">Review<ChevronRight className="h-3 w-3" aria-hidden="true" /></button>}
    </div>
    <ul>
      {shown.map(file => <li key={file.path} className="flex items-center justify-between gap-3 border-t border-divider px-3.5 py-2">
        <code className="min-w-0 truncate font-mono text-[12px] text-content-secondary" title={file.path}>{file.path}</code>
        {counted && <LineCounts added={file.additions ?? 0} removed={file.deletions ?? 0} />}
      </li>)}
    </ul>
    {files.length > FILES_SHOWN && <button type="button" onClick={() => setShowAll(value => !value)} className="w-full border-t border-divider px-3.5 py-2 text-left text-xs text-content-muted hover:text-content">
      {showAll ? 'Show fewer' : `Show all ${files.length} files`}
    </button>}
  </section>;
}
