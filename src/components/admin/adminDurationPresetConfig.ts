export const ADMIN_DURATION_PRESETS = [
  { id: '24h', label: '24h', ms: 86400000 },
  { id: '7d', label: '7d', ms: 7 * 86400000 },
  { id: '30d', label: '30d', ms: 30 * 86400000 },
] as const;

export type AdminDurationPresetId =
  | (typeof ADMIN_DURATION_PRESETS)[number]['id']
  | 'permanent';
