export const SIGNATURE_TONES = {
  blue: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white focus-visible:bg-blue-600 focus-visible:text-white focus-visible:ring-0 dark:hover:bg-blue-600',
  emerald:
    'border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white focus-visible:bg-emerald-600 focus-visible:text-white focus-visible:ring-0 dark:hover:bg-emerald-600',
  amber:
    'border-2 border-amber-600 text-amber-600 hover:bg-amber-600 hover:text-white focus-visible:bg-amber-600 focus-visible:text-white focus-visible:ring-0 dark:hover:bg-amber-600',
  red: 'border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white focus-visible:bg-red-600 focus-visible:text-white focus-visible:ring-0 dark:hover:bg-red-600',
} as const;

export type SignatureTone = keyof typeof SIGNATURE_TONES;
