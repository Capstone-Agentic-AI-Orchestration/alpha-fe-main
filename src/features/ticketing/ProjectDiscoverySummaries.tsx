import type { ProjectDiscoverySummary } from './projectConversation';

export function ProjectDiscoverySummaries({ summaries }: Readonly<{ summaries?: readonly ProjectDiscoverySummary[] }>) {
  if (!summaries?.length) return null;
  return <div className="grid gap-2 border-b border-divider px-4 py-3 sm:px-6">
    {summaries.map(({ ticketId, title, body }) => <details key={ticketId} open={summaries.length === 1}
      className="rounded-lg border border-divider bg-surface px-3 py-2 text-sm text-content">
      <summary className="cursor-pointer text-xs font-semibold">
        Discovery summary{summaries.length > 1 && <span className="font-normal text-content-muted"> · {title}</span>}
      </summary>
      <p className="mb-0 mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-content-secondary">{body}</p>
    </details>)}
  </div>;
}
