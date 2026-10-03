export const SIGNATURE_TONES = {
  blue: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white focus-visible:bg-blue-600 focus-visible:text-white focus-visible:ring-0 dark:hover:bg-blue-600',
  green:
    'border-2 border-green-600 text-green-600 hover:bg-green-600 hover:text-white focus-visible:bg-green-600 focus-visible:text-white focus-visible:ring-0 dark:hover:bg-green-600',
  red: 'border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white focus-visible:bg-red-600 focus-visible:text-white focus-visible:ring-0 dark:hover:bg-red-600',
  amber:
    'border-2 border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-white focus-visible:bg-amber-500 focus-visible:text-white focus-visible:ring-0 dark:hover:bg-amber-500',
  orange:
    'border-2 border-orange-600 text-orange-600 hover:bg-orange-600 hover:text-white focus-visible:bg-orange-600 focus-visible:text-white focus-visible:ring-0 dark:hover:bg-orange-600',
} as const;

export type SignatureTone = keyof typeof SIGNATURE_TONES;
