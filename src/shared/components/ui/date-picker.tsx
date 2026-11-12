import * as React from 'react';
import { format } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Calendar } from '@/shared/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/cn';

function parseDateValue(value?: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day, 12);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
    ? parsed
    : undefined;
}

function dateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export interface DatePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  autoFocus?: boolean;
}

/** A shadcn-style Popover + Calendar date control that preserves YYYY-MM-DD values. */
export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  required = false,
  disabled = false,
  placeholder = 'Pick a date',
  className,
  buttonClassName,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  autoFocus,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const selected = parseDateValue(value);
  const from = parseDateValue(min);
  const to = parseDateValue(max);
  const disabledDays = [
    from ? { before: from } : undefined,
    to ? { after: to } : undefined,
  ].filter(Boolean) as Array<{ before: Date } | { after: Date }>;
  const label = ariaLabel ?? placeholder;

  React.useEffect(() => {
    if (autoFocus) triggerRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className={cn('inline-flex min-w-0', className)}>
      {required && (
        <input
          type="text"
          value={value}
          required
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={() => undefined}
          onInvalid={event => {
            event.preventDefault();
            setOpen(true);
            triggerRef.current?.focus();
          }}
        />
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            id={id}
            type="button"
            variant="outline"
            size="sm"
            aria-label={ariaLabel ? (selected ? `${label}: ${format(selected, 'PPP')}` : label) : undefined}
            aria-describedby={ariaDescribedBy}
            aria-required={required || undefined}
            aria-invalid={required && !value ? true : undefined}
            disabled={disabled}
            className={cn('h-9 min-w-0 justify-start gap-2 px-2.5 text-left font-normal', !selected && 'text-content-muted', buttonClassName)}
          >
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-content-muted" aria-hidden="true" />
            <span className="truncate">{selected ? format(selected, 'PPP') : placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0" onOpenAutoFocus={event => event.preventDefault()}>
          <Calendar
            mode="single"
            selected={selected}
            onSelect={date => {
              if (!date) return;
              onChange(dateValue(date));
              setOpen(false);
              requestAnimationFrame(() => triggerRef.current?.focus());
            }}
            disabled={disabledDays.length ? disabledDays : undefined}
            startMonth={from}
            endMonth={to}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
