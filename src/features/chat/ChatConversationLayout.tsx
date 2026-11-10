import React from 'react';

/**
 * Reserves a content-sized column for the pinned summary while Open Tabs is
 * closed. When Open Tabs is visible, the summary becomes an optional overlay
 * inside the conversation and does not affect the transcript/composer width.
 */
export function ChatConversationLayout({
  summaryOpen,
  sidePanelOpen,
  summary,
  children,
}: {
  summaryOpen: boolean;
  sidePanelOpen: boolean;
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <section aria-label="Conversation" className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </section>
      {summaryOpen && !sidePanelOpen && (
        <aside
          aria-label="Pinned project summary"
          className="relative z-10 w-[clamp(17rem,24vw,23rem)] shrink-0 self-start overflow-y-auto px-4 pb-4 pt-4 pr-6"
        >
          {summary}
        </aside>
      )}
      {summaryOpen && sidePanelOpen && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <aside aria-label="Pinned project summary" className="pointer-events-auto absolute right-6 top-4 max-h-[min(70vh,36rem)] w-[min(22rem,calc(100%-2rem))] overflow-y-auto">
            {summary}
          </aside>
        </div>
      )}
    </div>
  );
}
