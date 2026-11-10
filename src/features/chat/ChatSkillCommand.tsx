import { Sparkles } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import type { Skill } from '@/shared/types';

export const MAX_SELECTED_SKILLS = 5;

export interface ChatSkillCommandQuery {
  start: number;
  end: number;
  query: string;
}

/** A slash at a word boundary opens the installed skill catalog; `/skill x` filters by x. */
export function getChatSkillCommandAtCursor(value: string, cursor: number): ChatSkillCommandQuery | null {
  const match = /(?:^|[\s(\[{])\/(?:(?:skills?)(?:\s+([^\s]*)?)|([^\s]*))$/i.exec(value.slice(0, cursor));
  if (!match) return null;
  // `/build` is already a chat-level command for starting a project build.
  if (!match[1] && match[2]?.toLowerCase() === 'build') return null;
  const start = cursor - match[0].length + (match[0][0] === '/' ? 0 : 1);
  return { start, end: cursor, query: match[1] ?? match[2] ?? '' };
}

export function matchChatSkills(skills: Skill[], query: string): Skill[] {
  const normalized = query.trim().toLowerCase();
  return skills
    .filter(skill => skill.enabled && skill.installed)
    .filter(skill => !normalized || `${skill.name} ${skill.description} ${skill.category}`.toLowerCase().includes(normalized))
    .slice(0, 8);
}

export function ChatSkillCommandSuggestions({
  id,
  query,
  skills,
  selectedSkillIds,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  onScan,
  scanning = false,
  className = ''
}: {
  id: string;
  query: ChatSkillCommandQuery | null;
  skills: Skill[];
  selectedSkillIds: string[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelect: (skill: Skill) => void;
  onScan?: () => Promise<void>;
  scanning?: boolean;
  className?: string;
}) {
  if (!query) return null;
  const installed = skills.filter(skill => skill.enabled && skill.installed);
  const results = matchChatSkills(skills, query.query);
  const atLimit = selectedSkillIds.length >= MAX_SELECTED_SKILLS;

  return <Card id={id} className={`absolute bottom-full z-50 mb-3 w-[min(22rem,calc(100vw-5rem))] overflow-hidden border-divider bg-surface-high p-1.5 shadow-2xl shadow-black/60 ${className}`}>
    <div className="flex items-center justify-between gap-3 px-2.5 py-2">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-content-muted">
        <Sparkles className="h-3.5 w-3.5 text-link" /> Call a skill
      </div>
      <kbd className="rounded border border-divider px-1.5 py-0.5 font-mono text-[9px] text-content-muted">/skill</kbd>
    </div>
    {results.length ? <div role="listbox" aria-label="Skill command suggestions" aria-multiselectable="true" className="max-h-64 overflow-y-auto">
      {results.map((skill, index) => {
        const selected = selectedSkillIds.includes(skill.id);
        const disabled = !selected && atLimit;
        return <button key={skill.id} type="button" role="option" aria-selected={selected} disabled={disabled}
          onMouseDown={event => event.preventDefault()}
          onMouseEnter={() => onActiveIndexChange(index)} onClick={() => onSelect(skill)}
          className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${index === activeIndex ? 'bg-selected text-selected-content' : 'text-content-secondary hover:bg-surface-raised'}`}>
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-link" />
          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-content">{skill.name}</span>
            <span className="mt-0.5 block line-clamp-2 text-[10px] leading-4 text-content-muted">{skill.description || skill.category}</span></span>
          {selected && <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[9px]">Added</Badge>}
        </button>;
      })}
    </div> : <div className="px-2.5 py-4 text-center">
      <p className="text-xs text-content-muted">{installed.length ? 'No installed skills match that shortcut.' : 'No installed and enabled skills are available.'}</p>
      {!installed.length && onScan && <Button type="button" variant="ghost" size="sm" disabled={scanning} onMouseDown={event => event.preventDefault()} onClick={() => void onScan()} className="mt-2 h-7 text-[10px]">{scanning ? 'Scanning…' : 'Scan installed skills'}</Button>}
    </div>}
    <p className="border-t border-divider px-2.5 pt-2 text-[10px] text-content-muted">Use ↑ ↓ to choose, Enter to add, Esc to close. Skills apply only to this message{atLimit ? ' · remove a skill in + to add another' : ''}.</p>
  </Card>;
}
