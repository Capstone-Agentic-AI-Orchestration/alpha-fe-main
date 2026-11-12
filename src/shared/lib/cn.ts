import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional Tailwind classes without allowing conflicting utilities. */
export function cn(...values: ClassValue[]) {
  return twMerge(clsx(values));
}
