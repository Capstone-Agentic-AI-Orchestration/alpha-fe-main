import { useCallback, useRef, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './ui/button';

interface DialogRequest {
  kind: 'confirm' | 'prompt';
  title: string;
  message?: string;
  confirmLabel?: string;
  /** The starting text for a prompt. */
  initialValue?: string;
}

/**
 * In-app replacements for window.confirm and window.prompt.
 *
 * Native dialogs in the Windows desktop app leave text fields unable to take
 * typing until the window loses and regains focus, so the message box looked
 * frozen after "Stop the build". Render `dialog` once in the component.
 */
export function useInAppDialog() {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [value, setValue] = useState('');
  const resolver = useRef<((result: boolean | string | null) => void) | null>(null);

  const open = useCallback((next: DialogRequest) => new Promise<boolean | string | null>(resolve => {
    resolver.current?.(next.kind === 'confirm' ? false : null);
    resolver.current = resolve;
    setValue(next.initialValue ?? '');
    setRequest(next);
  }), []);
  const confirm = useCallback((title: string, message?: string, confirmLabel = 'Continue') =>
    open({ kind: 'confirm', title, message, confirmLabel }).then(Boolean), [open]);
  const prompt = useCallback((title: string, initialValue = '', confirmLabel = 'Send') =>
    open({ kind: 'prompt', title, initialValue, confirmLabel }).then(result => typeof result === 'string' ? result : null), [open]);

  const finish = (result: boolean | string | null) => {
    resolver.current?.(result);
    resolver.current = null;
    setRequest(null);
  };
  const cancel = () => finish(request?.kind === 'confirm' ? false : null);
  const accept = () => finish(request?.kind === 'confirm' ? true : value.trim() || null);

  const dialog = request ? <Modal isOpen onClose={cancel} title={request.title} maxWidth="max-w-md"
    footer={<div className="flex justify-end gap-2">
      <Button variant="ghost" size="sm" onClick={cancel}>Cancel</Button>
      <Button size="sm" onClick={accept} disabled={request.kind === 'prompt' && !value.trim()}>{request.confirmLabel}</Button>
    </div>}>
    {request.message && <p className="text-sm leading-6 text-content-secondary">{request.message}</p>}
    {request.kind === 'prompt' && <textarea autoFocus rows={3} value={value} onChange={event => setValue(event.target.value)}
      onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && value.trim()) { event.preventDefault(); accept(); } }}
      aria-label={request.title} className="w-full resize-none rounded-lg border border-control bg-well px-3 py-2 text-sm text-content outline-none focus:border-link" />}
  </Modal> : null;

  return { confirm, prompt, dialog };
}
