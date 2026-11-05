import type { AcarsSettings } from '../types/settings';

export const ACARS_LIMITS = {
  sidebar: { min: 15, max: 40 },
  terminal: { min: 30 },
  notes: { min: 15, max: 40 },
} as const;

export interface AcarsLayout {
  sidebar: number;
  terminal: number;
  notes: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const round = (value: number) => Math.round(value * 10) / 10;

export function resolveAcarsLayout(
  acars: Partial<AcarsSettings> | undefined
): AcarsLayout {
  const { sidebar: s, terminal: t, notes: n } = ACARS_LIMITS;
  const sidebar = clamp(acars?.sidebarWidth ?? 30, s.min, s.max);
  if (!(acars?.notesEnabled ?? true)) {
    return { sidebar, terminal: round(100 - sidebar), notes: 0 };
  }
  const notes = Math.min(
    clamp(acars?.notesWidth ?? 20, n.min, n.max),
    100 - sidebar - t.min
  );
  return { sidebar, terminal: round(100 - sidebar - notes), notes };
}

export function dragSidebarDivider(
  layout: AcarsLayout,
  positionPct: number,
  notesEnabled: boolean
): AcarsLayout {
  const { sidebar: s, terminal: t } = ACARS_LIMITS;
  const sidebar = Math.min(
    clamp(round(positionPct), s.min, s.max),
    100 - (notesEnabled ? layout.notes : 0) - t.min
  );
  return resolveAcarsLayout({
    notesEnabled,
    sidebarWidth: sidebar,
    notesWidth: layout.notes,
  });
}

export function dragNotesDivider(
  layout: AcarsLayout,
  positionPct: number
): AcarsLayout {
  const { notes: n, terminal: t } = ACARS_LIMITS;
  const notes = Math.min(
    clamp(round(100 - positionPct), n.min, n.max),
    100 - layout.sidebar - t.min
  );
  return resolveAcarsLayout({
    notesEnabled: true,
    sidebarWidth: layout.sidebar,
    notesWidth: notes,
  });
}
