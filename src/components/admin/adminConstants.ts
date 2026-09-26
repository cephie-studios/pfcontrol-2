export type AdminTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
  | 'orange'
  | 'neutral';

export const ADMIN_TONE_TEXT: Record<AdminTone, string> = {
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  danger: 'text-red-400',
  info: 'text-blue-400',
  purple: 'text-purple-400',
  orange: 'text-orange-400',
  neutral: 'text-muted-foreground',
};

export function statusTone(status: string): AdminTone {
  const s = status.toLowerCase();
  if (['active', 'approved', 'success', 'resolved', 'online'].includes(s)) {
    return 'success';
  }
  if (['pending', 'review', 'warning', 'expiring'].includes(s)) {
    return 'warning';
  }
  if (
    ['revoked', 'rejected', 'suspended', 'banned', 'error', 'failed'].includes(
      s
    )
  ) {
    return 'danger';
  }
  return 'neutral';
}

export function httpStatusTone(code: number): AdminTone {
  if (code >= 500) return 'danger';
  if (code >= 400) return 'warning';
  if (code >= 300) return 'info';
  if (code >= 200) return 'success';
  return 'neutral';
}

export const ADMIN_NATIVE_THEAD = '[&_tr]:border-b';
export const ADMIN_NATIVE_TBODY = '[&_tr:last-child]:border-0';
export const ADMIN_NATIVE_TR = 'border-b transition-colors hover:bg-muted/50';
export const ADMIN_NATIVE_TH =
  'h-10 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground';
export const ADMIN_NATIVE_TD = 'px-3 py-2.5 align-middle text-sm';

export const ADMIN_CHART_COLORS = {
  blue: '#60a5fa',
  green: '#34d399',
  amber: '#fbbf24',
  purple: '#a78bfa',
  red: '#f87171',
  pink: '#f472b6',
  teal: '#2dd4bf',
  slate: '#94a3b8',
} as const;

export const ADMIN_TABLE_FRAME = [
  'overflow-hidden rounded-2xl border bg-card',
  '[&_thead_tr]:bg-muted/40 [&_thead_tr:hover]:bg-muted/40',
  '[&_th]:h-11 [&_th]:px-4 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground',
  '[&_td]:px-4 [&_td]:py-3 [&_tbody_tr:hover]:bg-muted/30',
].join(' ');
