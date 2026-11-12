import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { cn } from '@/shared/lib/cn';

const calendarClasses = {
  root: 'w-fit p-3',
  months: 'flex flex-col gap-4',
  month: 'space-y-3',
  month_caption: 'relative flex h-8 items-center justify-center px-8',
  caption_label: 'text-sm font-medium text-content',
  nav: 'absolute inset-x-1 top-0 flex h-8 items-center justify-between',
  button_previous: 'inline-flex h-7 w-7 items-center justify-center rounded-md text-content-secondary transition-colors hover:bg-surface-high hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-40',
  button_next: 'inline-flex h-7 w-7 items-center justify-center rounded-md text-content-secondary transition-colors hover:bg-surface-high hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-40',
  month_grid: 'w-full border-collapse',
  weekdays: 'flex',
  weekday: 'w-9 rounded-md text-center text-[10px] font-medium text-content-muted',
  week: 'mt-1 flex w-full',
  day: 'relative h-9 w-9 p-0 text-center text-xs',
  day_button: 'inline-flex h-8 w-8 items-center justify-center rounded-md text-xs text-content-secondary transition-colors hover:bg-surface-high hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus aria-selected:bg-action aria-selected:text-on-action aria-selected:hover:bg-action aria-selected:hover:text-on-action disabled:pointer-events-none disabled:opacity-35',
  today: 'font-semibold text-link',
  outside: 'text-content-muted opacity-45',
  disabled: 'pointer-events-none text-content-muted opacity-35',
  selected: 'bg-selected text-selected-content',
  hidden: 'invisible',
} satisfies Partial<NonNullable<DayPickerProps['classNames']>>;

export function Calendar({ className, classNames, ...props }: DayPickerProps) {
  return (
    <DayPicker
      className={cn('w-fit', className)}
      classNames={{ ...calendarClasses, ...classNames }}
      showOutsideDays
      {...props}
    />
  );
}
