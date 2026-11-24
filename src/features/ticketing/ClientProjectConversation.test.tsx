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
    expect(html.slice(rail)).toContain('class="cx-project-ticket-list" aria-label="Requests"');
    expect(html).toContain('Pick a request to see its progress');
    // The project header owns the New request action when it is provided.
    expect(html).not.toContain('New request');
    expect(html).toContain('Project conversation');
    expect(html).not.toContain('Open details');
  });

  it('shows progress above the picked request and keeps files and request details folded', () => {
    const html = page({ selectedTicketId: 't-1', request: { ticket, loading: false, error: '' } });
    const side = html.slice(html.indexOf('aria-label="Requests and details for Resort Website"'));
    const progress = side.indexOf('class="cx-project-request-progress" aria-label="Request progress"');
    expect(progress).toBeGreaterThan(-1);
    expect(side.indexOf('id="client-request-title"')).toBeGreaterThan(progress);
    expect(side).toContain('What happens next</h3>');
    expect(side).toContain('class="cx-reqcard-title">Files');
    expect(side).toContain('class="cx-reqcard-title">Request details');
    expect(side).toContain('hidden="" class="cx-reqcard-body cx-request-files"');
    expect(side).toContain('hidden="" class="cx-reqcard-body "><p class="cx-request-copy cx-project-request-description">example 2');
  });

  it('waits for the picked request inside the panel instead of reloading the page', () => {
    const html = page({ selectedTicketId: 't-1', request: { ticket: null, loading: true, error: '' } });
    expect(html).toContain('class="cx-reqchat"');
    expect(html).toContain('Loading request');
  });

  const shared = { ...project, preview: { branch: 'uat' as const, url: 'https://resort-uat.vercel.app' } };
  const switchable = { onProjectViewChange: () => undefined };
  /** The part of the page between two markers. */
  const between = (html: string, from: string, to?: string) => html.slice(html.indexOf(from), to ? html.indexOf(to) : undefined);

  it('keeps the conversation view by default for a project without a preview', () => {
    for (const html of [page(), page({ projectView: 'auto', ...switchable })]) {
      expect(html).toContain('class="cx-reqsplit"');
      expect(html).not.toContain('cx-preview-frame');
    }
  });

  it('puts a Conversation | Preview switch in the project header, in the same place in both views', () => {
    const head = (html: string) => between(html, 'class="cx-reqchat-head"', '</header>');
    const conversation = head(page(switchable));
    expect(conversation).toContain('aria-label="Project view"');
    expect(conversation).toMatch(/aria-pressed="true"[^>]*>.*?Conversation<\/button>/);
    const preview = head(page({ projectView: 'preview', ...switchable }));
    expect(preview).toMatch(/aria-pressed="true"[^>]*>.*?Preview<\/button>/);
    // Both views keep the header at the top of the main area, with the rail beside it.
    for (const html of [page(switchable), page({ projectView: 'preview', ...switchable })]) {
      expect(html.indexOf('class="cx-reqchat-head"')).toBeLessThan(html.indexOf('<aside class="cx-reqrail'));
    }
    // Without a way to change the view there is no switch.
    expect(head(page())).not.toContain('aria-label="Project view"');
  });

  it('puts availability and the option to ask in a collapsed Preview section below Requests', () => {
    const html = page(switchable);
    const rail = between(html, 'aria-label="Requests and details for Resort Website"');
    const requests = rail.indexOf('class="cx-project-ticket-list"');
    expect(requests).toBeGreaterThan(-1);
    expect(rail.indexOf('class="cx-reqcard-title">Preview')).toBeGreaterThan(requests);
    const toggle = between(between(rail, 'class="cx-project-rail-context"'), 'class="cx-reqcard-toggle"', '</button>');
    expect(toggle).toContain('aria-expanded="false"');
    expect(rail).toContain('Not shared yet.');
    expect(rail).toContain('Ask about a preview');
    // A read-only inspection still says so, but cannot write to the project manager.
    const readOnly = page({ readOnly: true, ...switchable });
    expect(readOnly).toContain('Not shared yet.');
    expect(readOnly).not.toContain('Ask about a preview');
  });

  it('opens the preview view before anything is shared: it says so, with the same conversation in the rail', () => {
    const html = page({ projectView: 'preview', ...switchable });
    expect(html).toContain('class="cx-reqsplit is-preview is-empty"');
    const main = between(html, 'class="cx-reqchat cx-reqpreview"', '<aside');
    expect(main).toContain('cx-preview-frame is-empty');
    expect(main).toContain('No preview shared yet');
    expect(main).toContain('Ask about a preview');
    // Nothing to fold away or show full screen yet.
    expect(html).not.toContain('Hide conversation');
    expect(html).not.toContain('Full screen');
    const rail = between(html, '<aside');
    const chatPanel = between(rail, 'class="cx-railchat"', 'class="cx-railrequests"');
    expect(chatPanel).not.toContain('Not shared yet.');
    expect(rail).toContain('hidden="" class="cx-railrequests"');
    expect(rail).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*>.*?Conversation<\/button>/);
    expect(rail).toContain('Requests');
    // One conversation, now in the rail, with its composer.
    expect(html.match(/Message the project manager/g)).toHaveLength(1);
    expect(between(rail, 'class="cx-railchat"')).toContain('Message the project manager');
    expect(page({ projectView: 'preview', readOnly: true, ...switchable })).not.toContain('Ask about a preview');
  });

  it('opens a project with a shared preview on the preview view, with the requests and picked request under Requests', () => {
    const html = page({ project: shared, selectedTicketId: 't-1', request: { ticket, loading: false, error: '' }, ...switchable });
    expect(html).toContain('class="cx-reqsplit is-preview"');
    expect(html).not.toContain('Not shared yet.');
    expect(html).toContain('class="cx-preview-frame"');
    const requests = between(html, 'class="cx-railrequests"');
    expect(requests).toContain('Resort Website');
    expect(requests).toContain('id="client-request-title"');
    // Hide conversation sits in the header beside the switch.
    expect(between(html, 'class="cx-reqchat-head"', '</header>')).toContain('Hide conversation');
  });

  it('can still show the conversation view for a project with a shared preview', () => {
    const html = page({ project: shared, projectView: 'conversation', ...switchable });
    expect(html).toContain('class="cx-reqsplit"');
    expect(html).not.toContain('cx-preview-frame');
    expect(html).not.toContain('Not shared yet.');
  });

  it('shows the shared preview alone when focused, with the conversation one click away', () => {
    const html = page({ project: shared, projectView: 'focus', ...switchable });
    expect(html).toContain('class="cx-reqsplit is-preview is-focus"');
    expect(html).not.toContain('<aside');
    expect(html).not.toContain('Message the project manager');
    expect(between(html, 'class="cx-reqchat-head"', '</header>')).toContain('Show conversation');
    expect(html.match(/Show conversation|Hide conversation/g)).toHaveLength(1);
    // Nothing shared means nothing to look at alone: the preview view keeps the conversation beside it.
    expect(page({ projectView: 'focus', ...switchable })).toContain('class="cx-reqsplit is-preview is-empty"');
  });
});
