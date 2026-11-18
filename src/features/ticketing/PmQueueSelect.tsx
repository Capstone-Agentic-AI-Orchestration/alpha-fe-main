import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

export function PmQueueSelect<T extends string>({ label, value, options, disabled, title, onChange }: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  disabled?: boolean;
  title?: string;
  onChange: (value: T) => void;
}) {
  const selected = options.find(option => option.value === value);
  return <DropdownMenu>
    <DropdownMenuTrigger type="button" aria-label={label} title={title} disabled={disabled}
      className="inline-flex h-8 max-w-48 items-center gap-2 rounded-md border border-control bg-well px-2.5 text-xs text-content hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50">
      <span className="truncate">{selected?.label ?? label}</span>
      <ChevronDown size={14} className="shrink-0 text-content-muted" aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={value} onValueChange={next => {
        const option = options.find(item => item.value === next);
        if (option) onChange(option.value);
      }}>
        {options.map(option => <DropdownMenuRadioItem key={option.value} value={option.value}>{option.label}</DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}
