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
    selectedTicketId={null} onSelectRequest={() => undefined} view="conversation" onViewChange={() => undefined}
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

  it('offers the shared preview beside the conversation when the project has one', () => {
    expect(page()).not.toContain('aria-label="Project view"');
    const shared = { ...project, preview: { branch: 'uat' as const, url: 'https://resort-uat.vercel.app' } };
    const conversation = page({ project: shared });
    expect(conversation).toContain('aria-label="Project view"');
    expect(conversation).toMatch(/aria-selected="true"[^>]*>Conversation/);
    const preview = page({ project: shared, view: 'preview' });
    expect(preview).toMatch(/aria-selected="true"[^>]*>Preview/);
    expect(preview).toContain('cx-preview-frame');
    expect(preview).not.toContain('Message your project manager');
    // The requests panel stays beside the preview.
    expect(preview).toContain('aria-label="Requests and details for Resort Website"');
  });
});
