import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { LiveBuildRecoveryProjection, LiveBuildRecoveryState } from '@/shared/types';
import { ChatQueuedMessage } from './ChatQueuedMessage';
import { composerSendMode, composerSubmitState, queueChatMessage, selectRecovery } from './chatComposer';

const file = (name: string) => ({ name, size: 1, lastModified: 1 }) as unknown as File;

/** Nothing typed in the project chat is dropped: a busy reply queues it, a live turn takes it as a direction. */
describe('what pressing send does', () => {
  it('queues a message while a reply with no live turn (a /build turn) is running, instead of dropping it', () => {
    expect(composerSendMode({ isAgentTyping: true })).toBe('queue');
    expect(composerSendMode({ isAgentTyping: true, activeTurnMessageId: 'm1' })).toBe('steer');
    expect(composerSendMode({ isAgentTyping: false })).toBe('send');
  });

  it('keeps every queued send, in order, with its files and skills', () => {
    const first = queueChatMessage(undefined, { threadId: 't', text: 'Use the blue theme', files: [file('a.png')], skillIds: ['s1'] });
    const both = queueChatMessage(first, { threadId: 't', text: 'and add a footer', files: [file('b.png')], skillIds: ['s1', 's2'] });
    expect(both.text).toBe('Use the blue theme\n\nand add a footer');
    expect(both.files.map(item => item.name)).toEqual(['a.png', 'b.png']);
    expect(both.skillIds).toEqual(['s1', 's2']);
  });

  it('shows a queued message with Edit and Cancel', () => {
    const html = renderToStaticMarkup(<ChatQueuedMessage message={{ threadId: 't', text: 'Add a footer', files: [file('a.png')], skillIds: [] }} onEdit={() => undefined} onCancel={() => undefined} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('Queued · sends when this reply finishes');
    expect(html).toContain('Add a footer · 1 file');
    expect(html).toContain('Edit</button>');
    expect(html).toContain('aria-label="Cancel queued message"');
  });
});

describe('the send button', () => {
  const state = (over: Partial<Parameters<typeof composerSubmitState>[0]> = {}) => composerSubmitState({ hasText: true, hasFiles: false, steering: false, forcedBuild: false, busy: false, queues: false, ...over });

  it('stays usable while a reply runs, and says the message will wait', () => {
    expect(state({ queues: true })).toMatchObject({ disabled: false, label: 'Send when this reply finishes' });
  });

  it('never refuses a /build here: the Orchestrator answers why it cannot start in the chat', () => {
    // No role, no codebase or a build already open used to disable the button; none is an input to it now.
    expect(state({ forcedBuild: true })).toEqual({ disabled: false, label: 'Start Orchestrator build' });
    expect(state({ forcedBuild: true, queues: true }).disabled).toBe(false);
  });

  it('only waits for something to send', () => {
    expect(state({ hasText: false }).disabled).toBe(true);
    expect(state({ hasText: false, hasFiles: true }).disabled).toBe(false);
    expect(state({ hasText: false, hasFiles: true, forcedBuild: true }).disabled).toBe(true);
    expect(state({ steering: true })).toMatchObject({ disabled: false, label: 'Queue direction for current agent' });
  });
});

/** A recovery the message box cannot take safely goes to the chat for the Orchestrator to answer. */
describe('choosing the recovery a message acts on', () => {
  const recovery = (over: Partial<LiveBuildRecoveryProjection> = {}) => ({
    id: 'rec-1', revision: 2, taskRevision: 3, category: 'project_code', availableActions: ['repair_and_continue', 'provide_guidance'], actionReasons: {}, ...over
  }) as unknown as LiveBuildRecoveryProjection;
  const state = (runId: string, open?: LiveBuildRecoveryProjection, history: LiveBuildRecoveryProjection[] = []): LiveBuildRecoveryState => ({ runId, runRevision: 9, recovery: open, history });
  const select = (over: Partial<Parameters<typeof selectRecovery>[0]>) => selectRecovery({ runIds: ['r1'], states: [], requestedAction: 'repair_and_continue', explicitBuildRetry: false, optional: false, ...over });

  it('acts on the one open recovery with the action it allows', () => {
    expect(select({ states: [{ runId: 'r1', state: state('r1', recovery()) }] })).toMatchObject({ kind: 'act', runId: 'r1', action: 'repair_and_continue' });
  });

  it('sends the message to the chat, with the reason, when there is no build to retry', () => {
    expect(select({ runIds: [], explicitBuildRetry: true })).toEqual({ kind: 'chat', reason: 'This conversation has no build to continue.' });
  });

  it('sends it to the chat when more than one build is waiting', () => {
    const states = [{ runId: 'r1', state: state('r1', recovery()) }, { runId: 'r2', state: state('r2', recovery()) }];
    expect(select({ runIds: ['r1', 'r2'], states })).toMatchObject({ kind: 'chat', reason: expect.stringContaining('More than one build') });
  });

  it('sends it to the chat when recovery details could not be loaded', () => {
    expect(select({ states: [{ runId: 'r1', state: undefined }] })).toMatchObject({ kind: 'chat', reason: expect.stringContaining('could not be loaded') });
  });

  it('sends it to the chat when there is no open recovery', () => {
    const done = recovery({ phase: 'resolved' } as Partial<LiveBuildRecoveryProjection>);
    expect(select({ states: [{ runId: 'r1', state: state('r1', undefined, [done]) }] })).toEqual({ kind: 'chat', reason: 'This build has no saved recovery waiting for an action.' });
  });

  it('sends it to the chat, with the server’s reason, when the action is unavailable', () => {
    const blocked = recovery({ availableActions: ['explain_failure'], actionReasons: { repair_and_continue: 'Tell the agent where the API contract is.' } } as Partial<LiveBuildRecoveryProjection>);
    expect(select({ states: [{ runId: 'r1', state: state('r1', blocked) }] })).toEqual({ kind: 'chat', reason: 'Tell the agent where the API contract is.' });
    // A message that only might be a recovery answer goes to the chat without a reason.
    expect(select({ states: [{ runId: 'r1', state: state('r1', blocked) }], optional: true })).toEqual({ kind: 'chat', reason: undefined });
  });
});
