import { Link } from 'react-router';
import { X } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import SupporterIcon from './SupporterIcon';

interface CheckoutNudgeBannerProps {
  price: string;
  onDismiss: () => void;
  isMobile: boolean;
  raised: boolean;
}

export default function CheckoutNudgeBanner({
  price,
  onDismiss,
  isMobile,
  raised,
}: CheckoutNudgeBannerProps) {
  return (
    <TooltipProvider>
      <aside
        aria-label="Finish becoming a Supporter"
        className={cn(
          'fixed z-40 border border-amber-400/50 bg-amber-500/70 text-white backdrop-blur-lg transition-all duration-300',
          isMobile
            ? 'right-4 left-4 rounded-2xl px-3 py-2'
            : 'left-1/2 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full px-4 py-3',
          raised ? 'bottom-20' : 'bottom-4'
        )}
      >
        <div className="flex items-start gap-2">
          <SupporterIcon className="mt-px size-4" />
          <p className="flex-1 text-sm leading-tight font-medium">
            You didn't finish checking out. Supporter is just {price} a month
            and keeps PFControl running.{' '}
            <Link
              to="/pricing"
              onClick={onDismiss}
              className="cursor-pointer font-bold whitespace-nowrap underline underline-offset-2 hover:text-amber-100"
            >
              Become a Supporter
            </Link>
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss"
                className="ml-2 shrink-0 cursor-pointer rounded-full text-white transition-colors outline-none hover:text-gray-300 focus-visible:ring-2 focus-visible:ring-white"
              >
                <X className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="shadcn-scope">Dismiss</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
