import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, RefreshCw, Search, Sparkles, WandSparkles, X } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Textarea } from '@/shared/components/ui/textarea';
import type { Skill } from '@/shared/types';
import { MAX_SELECTED_SKILLS } from './ChatSkillCommand';

export interface ChatSkillToolsProps {
  skills: Skill[];
  selectedSkillIds: string[];
  onSkillIdsChange: (ids: string[]) => void;
  draft: string;
  onDraftChange: (draft: string) => void;
  onImprove: (draft: string, skillIds: string[]) => Promise<string>;
  onError: (message: string) => void;
  onScan?: () => Promise<void>;
  scanning?: boolean;
  disabled?: boolean;
  /** Render as a section inside the composer’s + menu instead of above the input. */
  inline?: boolean;
}

/** Optional, message-scoped skill guidance and a review-before-apply prompt suggestion. */
export function ChatSkillTools({
  skills, selectedSkillIds, onSkillIdsChange, draft, onDraftChange, onImprove, onError, onScan, scanning = false, disabled = false, inline = false
}: ChatSkillToolsProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [improving, setImproving] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const eligibleSkills = useMemo(() => skills.filter(skill => skill.enabled && skill.installed), [skills]);
  const selectedSkills = selectedSkillIds.map(id => eligibleSkills.find(skill => skill.id === id)
    ?? skills.find(skill => skill.id === id)).filter((skill): skill is Skill => Boolean(skill));
  const results = eligibleSkills.filter(skill =>
    `${skill.name} ${skill.description} ${skill.category}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!selectedSkillIds.length) setSuggestion(null);
  }, [selectedSkillIds.length]);

  const toggleSkill = (id: string) => {
    const selected = selectedSkillIds.includes(id);
    if (!selected && selectedSkillIds.length >= MAX_SELECTED_SKILLS) return;
    onSkillIdsChange(selected ? selectedSkillIds.filter(skillId => skillId !== id) : [...selectedSkillIds, id]);
  };

  const improveDraft = async () => {
    if (!draft.trim() || !selectedSkillIds.length || improving) return;
    setImproving(true);
    try {
      setSuggestion(await onImprove(draft, [...selectedSkillIds]));
    } catch (error) {
      onError(error instanceof Error ? error.message : 'The prompt could not be improved.');
    } finally {
      setImproving(false);
    }
  };

  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-1.5">
      <div ref={rootRef} className={inline ? 'w-full' : 'relative'}>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} aria-expanded={open} aria-haspopup="listbox"
          onClick={() => { setOpen(value => !value); setQuery(''); }} className={inline ? 'h-9 w-full justify-start rounded-xl px-3 text-left text-xs' : 'h-8 rounded-full px-2.5 text-[11px]'}>
          <Sparkles className="h-3.5 w-3.5" /> <span className={inline ? 'flex-1 text-left' : ''}>Skills <span className="text-content-muted">optional</span></span>
          {selectedSkillIds.length > 0 && <Badge className="ml-0.5 px-1.5 py-0 text-[10px]">{selectedSkillIds.length}</Badge>}
        </Button>
        {open && <Card className={inline ? 'mt-1 w-full overflow-hidden border-control bg-surface-high p-2 shadow-inner' : 'absolute bottom-full left-0 z-50 mb-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden border-control bg-surface-high p-2 shadow-2xl shadow-black/60'}>
          <label className="flex items-center gap-2 rounded-lg border border-control bg-well px-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-content-muted" aria-hidden="true" />
            <input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search installed skills"
              className="h-9 min-w-0 flex-1 bg-transparent text-xs text-content outline-none placeholder:text-content-muted" aria-label="Search installed skills" />
          </label>
          <div role="listbox" aria-label="Installed and enabled skills" aria-multiselectable="true" className="mt-1.5 max-h-56 overflow-y-auto">
            {results.map(skill => {
              const selected = selectedSkillIds.includes(skill.id);
              const atLimit = !selected && selectedSkillIds.length >= MAX_SELECTED_SKILLS;
              return <button key={skill.id} type="button" role="option" aria-selected={selected} disabled={atLimit}
                onClick={() => toggleSkill(skill.id)} className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40">
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? 'border-action bg-selected text-selected-content' : 'border-control text-transparent'}`}>
                  {selected && <Check className="h-3 w-3" aria-hidden="true" />}
                </span>
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-content">{skill.name}</span>
                  <span className="mt-0.5 block line-clamp-2 text-[10px] leading-4 text-content-muted">{skill.description || skill.category}</span></span>
              </button>;
            })}
            {!results.length && <div className="px-2.5 py-4 text-center">
              <p className="text-xs text-content-muted">
                {eligibleSkills.length ? 'No skills match that search.' : 'No installed and enabled skills are available.'}
              </p>
              {!eligibleSkills.length && onScan && <Button type="button" variant="ghost" size="sm" disabled={scanning} onClick={() => void onScan()} className="mt-2 h-7 text-[10px]">
                <RefreshCw className={`h-3 w-3 ${scanning ? 'animate-spin' : ''}`} /> {scanning ? 'Scanning…' : 'Scan installed skills'}
              </Button>}
            </div>}
          </div>
          <p className="border-t border-divider px-2.5 pt-2 text-[10px] text-content-muted">Type / in the composer to open this catalog quickly. Skills apply only to this message; up to {MAX_SELECTED_SKILLS}.</p>
        </Card>}
      </div>

      {selectedSkills.map(skill => <Badge key={skill.id} variant="secondary" className="max-w-56 gap-1.5 pr-1.5 text-[10px]">
        <span className="truncate">{skill.name}</span>
        <button type="button" disabled={disabled} aria-label={`Remove ${skill.name}`} onClick={() => toggleSkill(skill.id)} className="rounded-full p-0.5 text-content-muted hover:bg-surface-high hover:text-content disabled:opacity-50">
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      </Badge>)}

      {selectedSkillIds.length > 0 && draft.trim() && <Button type="button" variant="ghost" size="sm" disabled={disabled || improving}
        onClick={() => void improveDraft()} className="ml-auto h-8 rounded-full px-2.5 text-[11px]">
        <WandSparkles className={`h-3.5 w-3.5 ${improving ? 'animate-pulse' : ''}`} />
        {improving ? 'Improving…' : 'Improve prompt'}
      </Button>}
    </div>

    {suggestion !== null && <Card className="space-y-2 border-control bg-surface-raised/95 p-3 shadow-xl shadow-black/30">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-semibold text-content">Suggested prompt</p><p className="text-[10px] text-content-muted">Review it before applying. Nothing is sent yet.</p></div>
        <Button type="button" variant="ghost" size="icon" aria-label="Discard suggestion" onClick={() => setSuggestion(null)} className="h-7 w-7"><X className="h-3.5 w-3.5" /></Button>
      </div>
      <Textarea value={suggestion} onChange={event => setSuggestion(event.target.value)} rows={3} className="min-h-20 max-h-40 resize-y bg-well text-xs leading-5" aria-label="Suggested prompt draft" />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setSuggestion(null)}>Discard</Button>
        <Button type="button" size="sm" onClick={() => { onDraftChange(suggestion); setSuggestion(null); }}><Check className="h-3.5 w-3.5" /> Apply to draft</Button>
      </div>
    </Card>}
  </div>;
}
