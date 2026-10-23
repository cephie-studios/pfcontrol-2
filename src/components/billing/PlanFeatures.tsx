import {
  Award,
  Camera,
  FlaskConical,
  Image as ImageIcon,
  LayoutGrid,
  Map as MapIcon,
  Palette,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { PLAN_TEXT } from '@/lib/plans';
import { cn } from '@/lib/utils';
import type { PlanLimits } from '../../types/billing';

interface Feature {
  icon: LucideIcon;
  title: string;
  detail: string;
}

const SUPPORTER_LIMITS: PlanLimits = {
  maxSessions: 100,
  featuredFlights: 10,
  snapsPerFlight: 30,
  animatedBackgrounds: true,
};

function planFeatures(limits: PlanLimits = SUPPORTER_LIMITS): Feature[] {
  return [
    {
      icon: MapIcon,
      title: 'Cephie Charts',
      detail: 'SIDs, STARs, approaches',
    },
    {
      icon: Palette,
      title: 'Animated ring',
      detail: 'And a gradient name',
    },
    {
      icon: Award,
      title: 'Badge and rank',
      detail: 'Grows every month',
    },
    {
      icon: LayoutGrid,
      title: `${limits.maxSessions} sessions`,
      detail: 'Twice the room',
    },
    {
      icon: Star,
      title: `${limits.featuredFlights} featured flights`,
      detail: 'On your profile',
    },
    {
      icon: Camera,
      title: `${limits.snapsPerFlight} photos`,
      detail: 'Per flight',
    },
    { icon: ImageIcon, title: 'GIF backgrounds', detail: 'Animated' },
    { icon: FlaskConical, title: 'Early access', detail: 'New features first' },
  ];
}

export default function PlanFeatures({
  limits,
  columns = 1,
  showDetail = true,
  tiles = false,
  className,
}: {
  limits?: PlanLimits;
  columns?: 1 | 2 | 4;
  showDetail?: boolean;
  tiles?: boolean;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        'grid text-left',
        tiles ? 'gap-3' : 'gap-x-4 gap-y-3',
        columns >= 2 && 'sm:grid-cols-2',
        columns === 4 && 'lg:grid-cols-4',
        className
      )}
    >
      {planFeatures(limits).map(({ icon: Icon, title, detail }) => (
        <li
          key={title}
          className={cn(
            'flex items-center gap-3',
            tiles &&
              'flex-row-reverse justify-between rounded-2xl bg-zinc-900 px-5 py-4'
          )}
        >
          <Icon
            className={cn(
              'shrink-0',
              tiles ? 'size-7' : 'size-5',
              PLAN_TEXT.supporter
            )}
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <span
              className={cn(
                'text-white',
                tiles ? 'text-lg font-semibold' : 'font-medium'
              )}
            >
              {title}
            </span>
            {showDetail && (
              <span className="text-sm text-zinc-500">{detail}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
