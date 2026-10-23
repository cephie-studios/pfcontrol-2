import { Link } from 'react-router';
import { Settings as SettingsIcon } from 'lucide-react';
import SupporterAvatar from './SupporterAvatar';
import SupporterIcon from './SupporterIcon';
import { useAuth } from '../../hooks/auth/useAuth';
import type { BillingCatalog } from '../../types/billing';
import { discordAvatarUrl, supporterRank } from '@/lib/plans';
import { WALL_TITLE, wallMembers } from '@/lib/supporterWall';
import { cn } from '@/lib/utils';

export default function SupporterWall({
  supporters,
  centered = false,
  showHeading = true,
  className,
}: {
  supporters: BillingCatalog['supporters'] | undefined;
  centered?: boolean;
  showHeading?: boolean;
  className?: string;
}) {
  const { user } = useAuth();
  const members = wallMembers(supporters);
  if (!members.length) return null;

  return (
    <section
      className={cn(
        'shadcn-scope flex flex-col gap-5 text-foreground',
        className
      )}
    >
      {showHeading && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-bold">{WALL_TITLE}</h2>
          {user && (
            <Link
              to="/settings#plan-settings"
              className="flex cursor-pointer items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200"
            >
              Visibility Settings
              <SettingsIcon className="size-4" />
            </Link>
          )}
        </div>
      )}
      <div
        className={cn(
          'flex flex-wrap gap-x-2 gap-y-6',
          centered && 'justify-center'
        )}
      >
        {members.map((m) => {
          const rank = m.months === null ? null : supporterRank(m.months);
          return (
            <Link
              key={m.id}
              to={`/user/${encodeURIComponent(m.username)}`}
              className="flex w-28 cursor-pointer flex-col items-center gap-2 rounded-2xl p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-32"
            >
              <SupporterAvatar
                src={discordAvatarUrl(m.id, m.avatar)}
                alt=""
                plan={m.plan}
                ring={m.ring}
                colors={m.colors}
                className="size-20 sm:size-24"
              />
              <span className="flex w-full flex-col items-center gap-0.5 leading-tight">
                <span className="w-full truncate text-center text-sm text-zinc-300">
                  {m.username}
                </span>
                {rank && (
                  <span
                    className={cn(
                      'flex items-center gap-1.5 text-base font-extrabold tracking-wide',
                      rank.text
                    )}
                  >
                    <SupporterIcon className="size-4" />
                    {rank.name}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
