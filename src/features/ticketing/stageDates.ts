/** A stage date as both sides read it, e.g. "Nov 26, 2026"; empty when there is none. */
export function stageDay(value: string | null): string {
  return value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}
