import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  Info,
  Sparkles,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  ADMIN_TONE_TEXT as TONE_TEXT,
  statusTone,
  type AdminTone,
} from './adminConstants';

const TONE_ICON: Record<AdminTone, LucideIcon> = {
  success: CheckCircle2,
  warning: Clock,
  danger: XCircle,
  info: Info,
  purple: Sparkles,
  orange: AlertTriangle,
  neutral: CircleDashed,
};

type AdminStatusBadgeProps = {
  children: ReactNode;
  tone?: AdminTone;
  status?: string;
  icon?: LucideIcon;
  showLabel?: boolean;
  /** @deprecated No longer rendered. */
  dot?: boolean;
  className?: string;
};

export default function AdminStatusBadge({
  children,
  tone,
  status,
  icon,
  showLabel = false,
  className,
}: AdminStatusBadgeProps) {
  const text = typeof children === 'string' ? children : undefined;
  const resolved = tone ?? statusTone(status ?? text ?? '');
  const Icon = icon ?? TONE_ICON[resolved];

  if (showLabel) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-sm',
          TONE_TEXT[resolved],
          className
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        {children}
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex cursor-default items-center',
            TONE_TEXT[resolved],
            className
          )}
          role="img"
          aria-label={text}
          tabIndex={0}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          {text ? null : <span className="sr-only">{children}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}
