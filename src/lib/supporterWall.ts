import type { BillingCatalog } from '../types/billing';

export const WALL_TITLE = 'The pilots and controllers keeping us flying';

export function wallMembers(
  supporters: BillingCatalog['supporters'] | undefined
) {
  const wall = supporters?.wall ?? [];
  const admins = supporters?.admins ?? [];
  return [
    ...admins.map((a) => ({ ...a, plan: 'supporter' as const })),
    ...wall.filter((s) => !admins.some((a) => a.id === s.id)),
  ].sort(
    (a, b) =>
      (b.months ?? -1) - (a.months ?? -1) ||
      a.username.localeCompare(b.username)
  );
}
