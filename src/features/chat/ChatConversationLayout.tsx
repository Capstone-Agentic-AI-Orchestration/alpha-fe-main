import React from 'react';

/**
 * The project summary floats over the top right of the conversation, so
 * opening or closing it never moves or narrows the transcript or composer.
 */
export function ChatConversationLayout({
  summaryOpen,
  summary,
  children,
}: {
  summaryOpen: boolean;
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <section aria-label="Conversation" className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </section>
      {summaryOpen && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <aside aria-label="Pinned project summary" className="pointer-events-auto absolute right-6 top-4 max-h-[min(70vh,36rem)] w-[min(22rem,calc(100%-2rem))] overflow-y-auto">
            {summary}
          </aside>
        </div>
      )}
    </div>
  );
}
