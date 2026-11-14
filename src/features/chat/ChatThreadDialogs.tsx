import { useEffect, useState } from 'react';
import { useApp } from '@/app/AppContext';
import { apiService } from '@/shared/services/apiService';
import { Modal } from '@/shared/components/Modal';

export function ChatThreadDialogs({ threadPendingDelete, setThreadPendingDelete, memoryThreadId, setMemoryThreadId }: {
  threadPendingDelete: { id: string; title: string } | null;
  setThreadPendingDelete: (thread: { id: string; title: string } | null) => void;
  memoryThreadId: string | null;
  setMemoryThreadId: (id: string | null) => void;
}) {
  const { deleteThread, showToast } = useApp();
  const [memoryContent, setMemoryContent] = useState('');
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!memoryThreadId) {
      setMemoryContent('');
      setMemoryError(null);
      setMemoryLoading(false);
      return undefined;
    }
    let cancelled = false;
    setMemoryLoading(true);
    setMemoryError(null);
    apiService.getChatThreadMemory(memoryThreadId).then(memory => {
      if (!cancelled) setMemoryContent(memory.content);
    }).catch((error: any) => {
      if (!cancelled) setMemoryError(error?.message ?? 'Could not load this chat\'s memory.');
    }).finally(() => {
      if (!cancelled) setMemoryLoading(false);
    });
    return () => { cancelled = true; };
  }, [memoryThreadId]);

  const saveSessionMemory = async () => {
    if (!memoryThreadId) return;
    setMemoryBusy(true);
    setMemoryError(null);
    try {
      const saved = await apiService.saveChatThreadMemory(memoryThreadId, memoryContent);
      setMemoryContent(saved.content);
      showToast('Session memory saved', 'These notes will be used only in this conversation.', 'success');
    } catch (error: any) {
      setMemoryError(error?.message ?? 'Could not save this chat\'s memory.');
    } finally {
      setMemoryBusy(false);
    }
  };

  const clearSessionMemory = async () => {
    if (!memoryThreadId) return;
    setMemoryBusy(true);
    setMemoryError(null);
    try {
      await apiService.clearChatThreadMemory(memoryThreadId);
      setMemoryContent('');
      showToast('Session memory cleared', 'This conversation will start with no saved notes.', 'success');
    } catch (error: any) {
      setMemoryError(error?.message ?? 'Could not clear this chat\'s memory.');
    } finally {
      setMemoryBusy(false);
    }
  };

  return <>
      <Modal
        isOpen={Boolean(threadPendingDelete)}
        onClose={() => setThreadPendingDelete(null)}
        title="Delete chat?"
        subtitle="This permanently removes the conversation and its messages."
        maxWidth="max-w-md"
        footer={<div className="flex justify-end gap-2"><button type="button" onClick={() => setThreadPendingDelete(null)} className="rounded-lg px-3 py-2 text-xs text-content-secondary hover:bg-surface-high">Cancel</button><button type="button" onClick={() => { if (threadPendingDelete) deleteThread(threadPendingDelete.id); setThreadPendingDelete(null); }} className="rounded-lg bg-status-danger-subtle px-3 py-2 text-xs font-semibold text-status-danger hover:bg-status-danger-subtle">Delete chat</button></div>}
      >
        <p className="text-sm text-content-secondary">Are you sure you want to delete <span className="font-semibold text-content">{threadPendingDelete?.title}</span>?</p>
      </Modal>
      <Modal
        isOpen={Boolean(memoryThreadId)}
        onClose={() => setMemoryThreadId(null)}
        title="Session memory"
        subtitle="Private notes used only in this chat. Add durable facts or decisions you want Alpha to remember."
        maxWidth="max-w-2xl"
        closeDisabled={memoryBusy}
        footer={<div className="flex items-center justify-between gap-3"><button type="button" onClick={() => void clearSessionMemory()} disabled={memoryBusy || memoryLoading} className="rounded-lg px-3 py-2 text-xs text-status-danger hover:bg-status-danger-subtle disabled:opacity-50">Clear notes</button><div className="flex gap-2"><button type="button" onClick={() => setMemoryThreadId(null)} disabled={memoryBusy} className="rounded-lg px-3 py-2 text-xs text-content-secondary hover:bg-surface-high">Close</button><button type="button" onClick={() => void saveSessionMemory()} disabled={memoryBusy || memoryLoading || memoryContent.length > 6000} className="rounded-lg bg-action px-3 py-2 text-xs font-semibold text-on-action hover:bg-action-hover disabled:opacity-50">{memoryBusy ? 'Saving…' : 'Save notes'}</button></div></div>}
      >
        <div className="space-y-3">
          <p className="text-xs leading-5 text-content-secondary">These notes stay in this conversation’s local session memory. They are not copied to project, agent, or global memory. Keep secrets and credentials out of notes.</p>
          <textarea value={memoryContent} onChange={event => setMemoryContent(event.target.value)} maxLength={6000} rows={12} disabled={memoryLoading || memoryBusy} aria-label="Session memory notes" placeholder="Example: We chose PostgreSQL, the API must remain backward compatible, and the next step is to add migration tests." className="w-full resize-y rounded-xl border border-control bg-well p-3 text-sm leading-6 text-content outline-none placeholder:text-content-muted focus:border-control disabled:opacity-60" />
          <div className="flex items-center justify-between text-[10px] text-content-muted"><span>{memoryLoading ? 'Loading saved notes…' : 'Notes are added to future turns in this chat.'}</span><span>{memoryContent.length}/6000</span></div>
          {memoryError && <p role="alert" className="rounded-lg border border-status-danger-border bg-status-danger-subtle p-2.5 text-xs text-status-danger">{memoryError}</p>}
        </div>
      </Modal>
  </>;
}
