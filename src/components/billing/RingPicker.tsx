import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SUPPORTER_RINGS, ringStyle, supporterRingClass } from '@/lib/plans';
import { cn } from '@/lib/utils';
import type { SupporterRing } from '../../types/billing';

export default function RingPicker({
  value,
  colors,
  onChange,
  className,
}: {
  value: SupporterRing;
  colors?: string[];
  onChange: (ring: SupporterRing) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Avatar ring"
      className={cn('flex items-center gap-2', className)}
    >
      {SUPPORTER_RINGS.map((ring) => (
        <Tooltip key={ring.value}>
          <TooltipTrigger asChild>
            <button
              type="button"
              role="radio"
              aria-checked={value === ring.value}
              aria-label={ring.label}
              onClick={() => onChange(ring.value)}
              className={cn(
                'supporter-ring size-8 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring',
                supporterRingClass('supporter', ring.value),
                value === ring.value
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900'
                  : 'opacity-70 hover:opacity-100'
              )}
              style={ringStyle(ring.value, colors)}
            >
              <span className="block size-full rounded-full bg-zinc-900" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="shadcn-scope" sideOffset={6}>
            {ring.label}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
