import SupporterIcon from './SupporterIcon';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { monthsLabel, supporterRank } from '@/lib/plans';
import type { SupporterBadge as Badge } from '../../types/billing';

export default function SupporterBadge({
  badge,
  className,
}: {
  badge: Badge;
  className?: string;
}) {
  const rank = supporterRank(badge.months);
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href="/pricing"
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 font-semibold',
              rank.text,
              className
            )}
          >
            <SupporterIcon className="size-5" />
            {rank.name}
          </a>
        </TooltipTrigger>
        <TooltipContent className="shadcn-scope" sideOffset={6}>
          Supporter
          {badge.months > 0 ? ` · ${monthsLabel(badge.months)}` : ''}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
