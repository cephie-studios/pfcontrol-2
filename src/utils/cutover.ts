export const AIRPORT_ROSTER_CUTOVER = new Date('2026-08-29T16:00:00Z');

export function isPastCutover(reference: Date | string | number): boolean {
  const d = reference instanceof Date ? reference : new Date(reference);
  return d.getTime() >= AIRPORT_ROSTER_CUTOVER.getTime();
}
