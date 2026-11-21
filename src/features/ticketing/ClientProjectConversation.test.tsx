import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });

import { ClientProjectConversation, type ClientProjectConversationProps } from './ClientProjectConversation';
import type { ClientProject, ClientTicketDetail } from './clientApi';

const project: ClientProject = { workspaceId: 'w1', projectId: 'p1', name: 'Resort Website', updatedAt: '2026-11-20T00:00:00Z',
  intakeOptionId: 'o1', preview: null };
const ticket: ClientTicketDetail = { id: 't-1', reference: 'TKT-1', title: 'Sample 2', status: 'received',
  createdAt: '2026-11-21T00:00:00Z', updatedAt: '2026-11-21T00:00:00Z', closedAt: null, readOnly: false, writesAvailable: true,
  requestedAction: null, description: 'example 2', companyLabel: 'Resort Co.', version: 1, sharedProjectName: 'Resort Website',
  relatedTicket: null, scope: null, delivery: null, request: null };

function page(props: Partial<ClientProjectConversationProps> = {}) {
  return renderToStaticMarkup(<ClientProjectConversation project={project} clientName="Zane" onBack={() => undefined}
    selectedTicketId={null} onSelectRequest={() => undefined}
    request={{ ticket: null, loading: false, error: '' }} onReplyAbout={async () => undefined}
    rail={{ workspaceId: 'w1', busy: false, communicationEnabled: true, onReply: async () => undefined, onDecision: () => undefined,
      onCorrection: async () => undefined, onAdditionalWork: () => undefined }} {...props} />);
}

describe('client project page', () => {
  it('is one page: the conversation on the left, the requests panel on the right, with no second New request', () => {
    const html = page();
    const chat = html.indexOf('class="cx-reqchat"');
    const rail = html.indexOf('aria-label="Requests and details for Resort Website"');
    expect(chat).toBeGreaterThan(-1);
    expect(rail).toBeGreaterThan(chat);
    expect(html).toContain('All projects');
    expect(html).toMatch(/aria-expanded="true"[^>]*>.*?Requests/);
    expect(html).toContain('Pick a request to see its progress');
    // New request lives in the top bar only; the old badge and per-request "Open details" are gone.
    expect(html).not.toContain('New request');
    expect(html).not.toContain('Project conversation');
    expect(html).not.toContain('Open details');
  });

  it('shows the picked request in the panel with its four open sections and folding files and details', () => {
    const html = page({ selectedTicketId: 't-1', request: { ticket, loading: false, error: '' } });
    const side = html.slice(html.indexOf('aria-label="Requests and details for Resort Website"'));
    for (const shown of ['id="client-request-title"', 'Request progress', 'What happens next', 'What you asked for', 'example 2']) {
      expect(side).toContain(shown);
    }
    // Requests, Files and Request details fold; the request's four core sections are always open.
    for (const folding of ['Requests', 'Files', 'Request details']) expect(side).toMatch(new RegExp('class="cx-reqcard-title">' + folding));
    for (const open of ['Request progress', 'What happens next', 'What you asked for']) {
      expect(side).toContain('</span>' + open + '</h2>');
      expect(side).not.toContain('class="cx-reqcard-title">' + open);
    }
  });

  it('waits for the picked request inside the panel instead of reloading the page', () => {
    const html = page({ selectedTicketId: 't-1', request: { ticket: null, loading: true, error: '' } });
    expect(html).toContain('class="cx-reqchat"');
    expect(html).toContain('Loading request');
  });

  it('opens a project with a shared preview as a split page: the preview on the left, everything else beside it', () => {
    const shared = { ...project, preview: { branch: 'uat' as const, url: 'https://resort-uat.vercel.app' } };
    const html = page({ project: shared, selectedTicketId: 't-1', request: { ticket, loading: false, error: '' } });
    expect(html).toMatch(/^<section class="cx-split"/);
    const preview = html.indexOf('class="cx-split-preview"');
    const side = html.indexOf('class="cx-split-side"');
    expect(preview).toBeGreaterThan(-1);
    expect(side).toBeGreaterThan(preview);
    expect(html.slice(preview, side)).toContain('cx-preview-frame');
    // The side scrolls: the project, its requests and the picked request, then the conversation with its composer.
    const rest = html.slice(side);
    const order = ['All projects', 'id="client-conversation-project-title"', 'class="cx-reqcard-title">Requests',
      'id="client-request-title"', 'class="cx-split-chat"', 'Message your project manager'].map(part => rest.indexOf(part));
    expect(order.every(index => index > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // One chat, no view switch and no second layout.
    expect(html.match(/Message your project manager/g)).toHaveLength(1);
    expect(html).not.toContain('aria-label="Project view"');
    expect(html).not.toContain('class="cx-reqsplit"');
  });

  it('keeps the conversation page for a project without a preview', () => {
    const html = page();
    expect(html).toContain('class="cx-reqsplit"');
    expect(html).not.toContain('cx-split-preview');
  });

  it('says in the panel that no preview is shared yet, above the requests, with ways to open the preview page and ask about one', () => {
    const html = page({ onProjectViewChange: () => undefined });
    const rail = html.slice(html.indexOf('aria-label="Requests and details for Resort Website"'));
    const preview = rail.indexOf('</span>Preview</h2>');
    expect(preview).toBeGreaterThan(-1);
    expect(rail.indexOf('class="cx-reqcard-title">Requests')).toBeGreaterThan(preview);
    expect(rail).toContain('Not shared yet.');
    expect(rail).toContain('Open preview page');
    expect(rail).toContain('Ask about a preview');
    // A read-only inspection still says so and can look at the preview page, but cannot write to the project manager.
    const readOnly = page({ readOnly: true, onProjectViewChange: () => undefined });
    expect(readOnly).toContain('Not shared yet.');
    expect(readOnly).toContain('Open preview page');
    expect(readOnly).not.toContain('Ask about a preview');
  });

  it('always offers a Preview button in the project header while the conversation page shows', () => {
    const head = (html: string) => html.slice(html.indexOf('class="cx-reqchat-head"'), html.indexOf('</header>'));
    expect(head(page({ onProjectViewChange: () => undefined }))).toMatch(/cx-preview-open[^>]*>.*Preview<\/button>/);
    // Without a way to change the view there is nothing to open.
    expect(head(page())).not.toContain('cx-preview-open');
  });

  it('opens the preview page before anything is shared: it says so, beside the conversation, with a way to ask and to close it', () => {
    const html = page({ projectView: 'preview', onProjectViewChange: () => undefined });
    expect(html).toMatch(/^<section class="cx-split is-empty"/);
    const preview = html.slice(html.indexOf('class="cx-split-preview"'), html.indexOf('class="cx-split-side"'));
    expect(preview).toContain('cx-preview-frame is-empty');
    expect(preview).toContain('No preview shared yet');
    expect(preview).toContain('Ask about a preview');
    expect(preview).toContain('Close preview');
    // Nothing to fold away or show full screen yet, and the side no longer repeats that nothing is shared.
    expect(preview).not.toContain('Hide conversation');
    expect(preview).not.toContain('Full screen');
    const side = html.slice(html.indexOf('class="cx-split-side"'));
    expect(side).not.toContain('Not shared yet.');
    expect(side).toContain('Message your project manager');
    expect(page({ projectView: 'preview', readOnly: true, onProjectViewChange: () => undefined })).not.toContain('Ask about a preview');
  });

  it('keeps the conversation page by default for a project without a preview', () => {
    const html = page({ projectView: 'auto', onProjectViewChange: () => undefined });
    expect(html).toContain('class="cx-reqsplit"');
    expect(html).not.toContain('cx-split-preview');
  });

  const shared = { ...project, preview: { branch: 'uat' as const, url: 'https://resort-uat.vercel.app' } };

  it('drops the not-shared card once a preview is shared, and offers to hide the conversation beside it', () => {
    const html = page({ project: shared, projectView: 'auto', onProjectViewChange: () => undefined });
    expect(html).not.toContain('is-empty');
    expect(html).not.toContain('cx-preview-open');
    expect(html).not.toContain('Not shared yet.');
    const preview = html.slice(html.indexOf('class="cx-split-preview"'), html.indexOf('class="cx-split-side"'));
    expect(preview).toContain('Hide conversation');
    expect(html).not.toContain('cx-focusbar');
  });

  it('opens on the preview alone when focused, with the way back and the conversation one click away', () => {
    const html = page({ project: shared, projectView: 'focus', onProjectViewChange: () => undefined });
    expect(html).toMatch(/^<section class="cx-split is-focus"/);
    expect(html).not.toContain('cx-split-side');
    expect(html).not.toContain('Message your project manager');
    const bar = html.slice(html.indexOf('class="cx-focusbar"'), html.indexOf('cx-preview-frame'));
    for (const part of ['All projects', 'id="client-conversation-project-title"', 'Resort Website', 'Show conversation']) expect(bar).toContain(part);
    expect(html.match(/Show conversation|Hide conversation/g)).toHaveLength(1);
  });
});
