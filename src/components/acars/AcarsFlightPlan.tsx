import { useState } from 'react';
import {
  ArrowUpToLine,
  ClipboardList,
  Compass,
  DoorOpen,
  EyeOff,
  Hash,
  MapPin,
  Milestone,
  Mic,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Signpost,
  SlidersHorizontal,
  Split,
  SquareParking,
  TrendingUp,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import type { Flight } from '../../types/flight';
import AcarsPanel from './AcarsPanel';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const HIDDEN_KEY = 'acarsHiddenFields';

const flightLevel = (value?: string) =>
  value && /^\d+$/.test(value) ? `FL${value.padStart(3, '0')}` : value;

interface FieldDef {
  key: string;
  icon: LucideIcon;
  label: string;
  value?: string;
  detail?: string;
  wide?: boolean;
}

type VisibleField = FieldDef & { value: string };

function readHidden(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function FieldValue({ value, detail }: { value: string; detail?: string }) {
  if (!detail) return <>{value}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="cursor-help rounded-sm underline decoration-zinc-600 decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {value}
        </span>
      </TooltipTrigger>
      <TooltipContent className="shadcn-scope" sideOffset={6}>
        {detail}
      </TooltipContent>
    </Tooltip>
  );
}

function FieldIcon({
  field,
  onHide,
}: {
  field: VisibleField;
  onHide: () => void;
}) {
  const Icon = field.icon;
  return (
    <span className="relative flex size-4 shrink-0 items-center justify-center">
      <Icon className="size-4 text-zinc-500 transition-opacity group-focus-within/row:opacity-0 group-hover/row:opacity-0" />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onHide}
            aria-label={`Hide ${field.label}`}
            className="absolute -inset-1 flex items-center justify-center rounded-md text-zinc-400 opacity-0 transition-opacity outline-none group-hover/row:opacity-100 hover:text-white focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <EyeOff className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="shadcn-scope" sideOffset={6}>
          Hide {field.label.toLowerCase()}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

function FieldRow({
  field,
  onHide,
}: {
  field: VisibleField;
  onHide: () => void;
}) {
  if (field.wide) {
    return (
      <div className="group/row flex flex-col gap-1.5 py-2 text-sm first:pt-0 last:pb-0">
        <div className="flex items-center gap-2.5">
          <FieldIcon field={field} onHide={onHide} />
          <dt className="text-zinc-400">{field.label}</dt>
        </div>
        <dd className="pl-6.5 break-words text-zinc-100">{field.value}</dd>
      </div>
    );
  }

  return (
    <div className="group/row flex min-w-0 items-center gap-2.5 py-2 text-sm first:pt-0 last:pb-0">
      <FieldIcon field={field} onHide={onHide} />
      <dt className="shrink-0 text-zinc-400">{field.label}</dt>
      <dd className="ml-auto min-w-0 truncate text-right font-medium text-zinc-100">
        <FieldValue value={field.value} detail={field.detail} />
      </dd>
    </div>
  );
}

export default function AcarsFlightPlan({
  flight,
  spokenCallsign,
  departureName,
  arrivalName,
  className,
}: {
  flight: Flight;
  spokenCallsign?: string;
  departureName?: string;
  arrivalName?: string;
  className?: string;
}) {
  const [hidden, setHidden] = useState<string[]>(readHidden);

  const updateHidden = (next: string[]) => {
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable; the choice still applies for this visit
    }
  };

  const setVisible = (key: string, visible: boolean) =>
    updateHidden(
      visible
        ? hidden.filter((k) => k !== key)
        : [...hidden.filter((k) => k !== key), key]
    );

  const fields: FieldDef[] = [
    { key: 'radio', icon: Mic, label: 'Radio callsign', value: spokenCallsign },
    { key: 'aircraft', icon: Plane, label: 'Aircraft', value: flight.aircraft },
    {
      key: 'departure',
      icon: PlaneTakeoff,
      label: 'Departure',
      value: flight.departure,
      detail: departureName,
    },
    {
      key: 'arrival',
      icon: PlaneLanding,
      label: 'Arrival',
      value: flight.arrival,
      detail: arrivalName,
    },
    {
      key: 'alternate',
      icon: Split,
      label: 'Alternate',
      value: flight.alternate,
    },
    {
      key: 'rules',
      icon: Compass,
      label: 'Flight rules',
      value: flight.flight_type,
    },
    { key: 'squawk', icon: Hash, label: 'Squawk', value: flight.squawk },
    { key: 'stand', icon: SquareParking, label: 'Stand', value: flight.stand },
    { key: 'gate', icon: DoorOpen, label: 'Gate', value: flight.gate },
    { key: 'runway', icon: MapPin, label: 'Runway', value: flight.runway },
    { key: 'sid', icon: Signpost, label: 'SID', value: flight.sid },
    {
      key: 'climb',
      icon: TrendingUp,
      label: 'Initial climb',
      value: flightLevel(flight.clearedFL),
    },
    {
      key: 'cruise',
      icon: ArrowUpToLine,
      label: 'Cruise',
      value: flightLevel(flight.cruisingFL),
    },
    { key: 'star', icon: Milestone, label: 'STAR', value: flight.star },
    {
      key: 'route',
      icon: Waypoints,
      label: 'Route',
      value: flight.route,
      wide: true,
    },
  ];

  const available = fields.filter((f): f is VisibleField => !!f.value);
  const shown = available.filter((f) => !hidden.includes(f.key));
  const hiddenCount = available.length - shown.length;

  return (
    <AcarsPanel
      icon={ClipboardList}
      title="Flight plan"
      className={className}
      actions={
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label="Choose flight plan fields"
                  className="-my-1 text-zinc-400 hover:bg-transparent hover:text-white data-[state=open]:text-white dark:hover:bg-transparent"
                >
                  <SlidersHorizontal />
                  {hiddenCount > 0 && (
                    <span className="tabular-nums">{hiddenCount} hidden</span>
                  )}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent className="shadcn-scope" sideOffset={6}>
              Choose fields
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="shadcn-scope w-52">
            <DropdownMenuLabel>Show fields</DropdownMenuLabel>
            {available.map((f) => (
              <DropdownMenuCheckboxItem
                key={f.key}
                checked={!hidden.includes(f.key)}
                onCheckedChange={(checked) =>
                  setVisible(f.key, checked === true)
                }
                onSelect={(e) => e.preventDefault()}
              >
                <f.icon />
                {f.label}
              </DropdownMenuCheckboxItem>
            ))}
            {hiddenCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => updateHidden([])}>
                  Show all
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {shown.length === 0 ? (
        <p className="text-sm text-zinc-500">
          All fields are hidden. Use the field menu to show them again.
        </p>
      ) : (
        <dl className="flex flex-col divide-y divide-zinc-800">
          {shown.map((f) => (
            <FieldRow
              key={f.key}
              field={f}
              onHide={() => setVisible(f.key, false)}
            />
          ))}
        </dl>
      )}
    </AcarsPanel>
  );
}
