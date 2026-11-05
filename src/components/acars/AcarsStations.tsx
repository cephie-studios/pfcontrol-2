import { useMemo } from 'react';
import { Radio, TowerControl, Users } from 'lucide-react';
import type { OverviewSession } from '../../sockets/overviewSocket';
import AcarsPanel from './AcarsPanel';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const DEFAULT_AVATAR = '/assets/app/default/avatar.webp';

type Controller = NonNullable<OverviewSession['controllers']>[number];

function Badge({ src, label }: { src: string; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <img
          src={src}
          alt={label}
          tabIndex={0}
          className="size-5 shrink-0 rounded-full bg-white outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </TooltipTrigger>
      <TooltipContent className="shadcn-scope" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function ControllerRow({ controller }: { controller: Controller }) {
  const role =
    controller.role === 'ALL' || !controller.role ? 'APP' : controller.role;

  return (
    <li className="flex min-w-0 items-center gap-2.5">
      <img
        src={controller.avatar || DEFAULT_AVATAR}
        alt=""
        className="size-7 shrink-0 rounded-full"
      />
      <a
        href={`/user/${controller.username}`}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 truncate text-sm text-zinc-300 underline-offset-4 hover:text-foreground hover:underline"
      >
        {controller.username}
      </a>
      <span className="text-xs text-zinc-500">{role}</span>
      <span className="ml-auto flex shrink-0 items-center gap-1">
        {controller.hasVatsimRating && (
          <Badge src="/assets/images/vatsim.webp" label="VATSIM rating" />
        )}
        {controller.isPFATCSectorController && (
          <Badge
            src="/assets/images/pfatc.webp"
            label="PFATC sector controller"
          />
        )}
      </span>
    </li>
  );
}

export default function AcarsStations({
  sessions,
  departure,
  arrival,
  onShowAtis,
  className,
}: {
  sessions: OverviewSession[];
  departure?: string;
  arrival?: string;
  onShowAtis: (session: OverviewSession) => void;
  className?: string;
}) {
  const sorted = useMemo(() => {
    const rank = (icao: string) =>
      icao === departure ? 0 : icao === arrival ? 1 : 2;
    return [...sessions].sort(
      (a, b) =>
        rank(a.airportIcao) - rank(b.airportIcao) ||
        a.airportIcao.localeCompare(b.airportIcao)
    );
  }, [sessions, departure, arrival]);

  return (
    <AcarsPanel
      icon={TowerControl}
      title="Online stations"
      className={className}
    >
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 pt-2 pb-3 text-center">
          <TowerControl className="size-8 text-zinc-600" />
          <p className="text-sm text-zinc-400">No controllers online</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-800">
          {sorted.map((session) => {
            const label =
              session.airportIcao === departure
                ? 'Departure'
                : session.airportIcao === arrival
                  ? 'Arrival'
                  : null;
            return (
              <li
                key={session.sessionId}
                className="flex flex-col gap-2.5 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-h-8 items-center gap-2">
                  <span className="font-semibold">{session.airportIcao}</span>
                  {label && (
                    <span className="text-xs text-zinc-500">{label}</span>
                  )}
                  {session.atis?.text && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="ml-auto h-6 gap-1 px-1.5 text-xs font-medium text-blue-400 hover:bg-transparent hover:text-blue-300 dark:hover:bg-transparent"
                          onClick={() => onShowAtis(session)}
                        >
                          <Radio />
                          ATIS {session.atis.letter}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="shadcn-scope" sideOffset={6}>
                        Show ATIS in messages
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {session.controllers && session.controllers.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {session.controllers.map((controller) => (
                      <ControllerRow
                        key={`${controller.username}-${controller.role}`}
                        controller={controller}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-zinc-300">
                    <Users className="size-4 text-zinc-500" />
                    {session.activeUsers}{' '}
                    {session.activeUsers === 1 ? 'controller' : 'controllers'}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AcarsPanel>
  );
}
