import React, { useEffect, useRef, useState } from 'react';
import { CornerDownLeft, LoaderCircle, MessageCircleQuestion, X } from 'lucide-react';
import type { ChatDecision } from '@/shared/types';

interface Props {
  decision: ChatDecision;
  busy: boolean;
  /** The answer the person chose or wrote. */
  onAnswer: (answer: string) => void;
  /** Hide the card; the question stays in the conversation and typing still answers it. */
  onClose: () => void;
}

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * The Orchestrator's question, docked above the message box: one click per
 * answer, or "Something else" for the person's own words. Number keys pick an
 * answer while focus is not in a text field.
 */
export const ChatDecisionCard: React.FC<Props> = ({ decision, busy, onAnswer, onClose }) => {
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  const otherRef = useRef<HTMLInputElement>(null);
  const options = decision.options.slice(0, 4);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (busy || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && options[index]) { event.preventDefault(); onAnswer(options[index].label); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onAnswer, options]);

  useEffect(() => { if (writing) otherRef.current?.focus(); }, [writing]);

  const sendOther = () => { if (text.trim() && !busy) onAnswer(text.trim()); };

  return <section aria-label="The Orchestrator needs a decision" className="overflow-hidden rounded-2xl border border-status-warning-border bg-surface-raised/95 shadow-xl shadow-black/50 backdrop-blur">
    <div className="flex items-start gap-3 px-4 pb-2 pt-3">
      <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-content-secondary">The Orchestrator needs a decision before it plans</div>
        <p className="mt-0.5 text-sm leading-5 text-content">{decision.question}</p>
      </div>
      <button type="button" onClick={onClose} aria-label="Hide question" title="Hide. You can still answer by typing below." className="rounded-lg p-1 text-content-secondary hover:bg-surface-high hover:text-content"><X className="h-3.5 w-3.5" /></button>
    </div>
    {busy
      ? <div role="status" className="flex items-center gap-2 border-t border-divider px-4 py-3 text-xs text-content-secondary"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Planning with your answer…</div>
      : <div className="space-y-1.5 border-t border-divider px-3 py-2.5">
        {options.map((option, index) => <button key={option.label} type="button" onClick={() => onAnswer(option.label)}
          className="flex w-full items-start gap-3 rounded-xl border border-divider bg-surface-raised px-3 py-2 text-left transition-colors hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <kbd className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-divider text-[10px] text-content-muted">{index + 1}</kbd>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-content">{option.label}</span>
            {option.description && <span className="block text-[11px] leading-4 text-content-secondary">{option.description}</span>}
          </span>
        </button>)}
        {writing
          ? <form onSubmit={event => { event.preventDefault(); sendOther(); }} className="flex items-center gap-2 rounded-xl border border-control bg-well px-3 py-1.5">
            <input ref={otherRef} value={text} onChange={event => setText(event.target.value)} maxLength={2000}
              onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setWriting(false); } }}
              aria-label="Your answer" placeholder="Type your answer" className="min-w-0 flex-1 bg-transparent py-1 text-xs text-content placeholder-content-muted outline-none" />
            <button type="submit" disabled={!text.trim()} aria-label="Send answer" className="rounded-lg p-1 text-content-secondary hover:bg-surface-high hover:text-content disabled:opacity-40"><CornerDownLeft className="h-3.5 w-3.5" /></button>
          </form>
          : <button type="button" onClick={() => setWriting(true)} className="w-full rounded-xl border border-dashed border-divider px-3 py-2 text-left text-xs text-content-secondary transition-colors hover:bg-surface-high hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">Something else…</button>}
      </div>}
  </section>;
};
