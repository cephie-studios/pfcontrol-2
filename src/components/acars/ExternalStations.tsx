import { useMemo } from 'react';
import { Radio, TowerControl } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProviderAtis, ProviderDatalink } from '../../types/externalAcars';
import AcarsPanel from './AcarsPanel';

function groupByAirport(controllers: string[]) {
  const groups = new Map<string, string[]>();
  for (const name of controllers) {
    const split = name.indexOf('_');
    const airport = split > 0 ? name.slice(0, split) : name;
    groups.set(airport, [...(groups.get(airport) ?? []), name]);
  }
  return [...groups];
}

export default function ExternalStations({
  controllers,
  atis,
  datalink,
  onAtis,
  className,
}: {
  controllers: string[];
  atis: ProviderAtis[];
  datalink?: ProviderDatalink | null;
  onAtis: (atis: ProviderAtis) => void;
  className?: string;
}) {
  const groups = useMemo(() => groupByAirport(controllers), [controllers]);
  const withText = atis.filter((entry) => entry.text);

  return (
    <AcarsPanel
      icon={TowerControl}
      title="Online stations"
      className={className}
    >
      {groups.length === 0 ? (
        <p className="text-sm text-zinc-500">No active controllers.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map(([airport, names]) => (
            <li key={airport}>
              <p className="pb-1 text-xs font-bold text-blue-400">{airport}</p>
              <ul className="flex flex-col gap-1">
                {names.map((name) => (
                  <li
                    key={name}
                    className="flex items-center gap-2 text-sm text-zinc-300"
                  >
                    <TowerControl className="size-4 shrink-0 text-zinc-500" />
                    <span className="truncate font-mono">{name}</span>
                    {name === datalink?.controller && (
                      <span
                        className={
                          datalink?.suspended
                            ? 'ml-auto text-xs font-semibold text-red-400'
                            : 'ml-auto text-xs font-semibold text-emerald-400'
                        }
                      >
                        Datalink
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-6 mb-3 flex items-center gap-2 text-xs font-semibold tracking-widest text-zinc-400 uppercase">
        <Radio className="size-4 text-blue-400" />
        ATIS
      </h3>
      {withText.length === 0 ? (
        <p className="text-sm text-zinc-500">No ATIS available.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {withText.map((entry) => (
            <li key={entry.airport}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onAtis(entry)}
                className="h-auto w-full cursor-pointer flex-col items-start gap-1 rounded-2xl border-2 border-zinc-800 px-3 py-3 text-left hover:border-zinc-700 hover:bg-zinc-800/60"
              >
                <span className="font-mono text-sm text-blue-400">
                  {entry.airport} · {entry.letter}
                </span>
                <span className="line-clamp-2 text-xs font-normal whitespace-normal text-zinc-300">
                  {entry.text}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </AcarsPanel>
  );
}
