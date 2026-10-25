export interface LocalPreview {
  browserDiagnostics?: Array<{ kind: 'console' | 'request' | 'blocked' | 'load'; message: string; timestamp: string }>;
  id: string; workspaceId: string; ownerId: string; threadId: string; projectId: string;
  repository: string; branch: string; commit: string; source: 'saved-build' | 'checkout';
  state: 'starting' | 'ready' | 'failed' | 'stopping' | 'stopped'; origin?: string;
  error?: string; logs: string; createdAt: string; updatedAt: string; messageId?: string; capability: string;
}
