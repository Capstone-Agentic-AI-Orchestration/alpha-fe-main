import type { ChatMessage } from '@/shared/types';

/**
 * Where each build's live progress shows in a conversation: under its latest build message.
 * A started plan posts its own message, so the progress follows the conversation down to it
 * instead of staying at the plan, and a build never shows two live progress rows.
 */
export function buildActivityAnchors(messages: Pick<ChatMessage, 'id' | 'messageType' | 'orchestrationRunId'>[]): Map<string, string> {
  const anchors = new Map<string, string>();
  for (const message of messages) {
    if (message.messageType === 'build' && message.orchestrationRunId) anchors.set(message.orchestrationRunId, message.id);
  }
  return anchors;
}
