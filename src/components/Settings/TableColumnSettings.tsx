import { useId } from 'react';
import { Columns3, RotateCcw } from 'lucide-react';
import type {
  DepartureTableColumnSettings,
  ArrivalsTableColumnSettings,
} from '../../types/settings';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import SettingsSection from './SettingsSection';
import SettingsGroup from './SettingsGroup';

interface TableColumnSettingsProps {
  departureColumns: DepartureTableColumnSettings;
  arrivalsColumns: ArrivalsTableColumnSettings;
  onDepartureColumnsChange: (columns: DepartureTableColumnSettings) => void;
  onArrivalsColumnsChange: (columns: ArrivalsTableColumnSettings) => void;
  onReset: () => void;
}

const departureColumnLabels: Record<
  Exclude<keyof DepartureTableColumnSettings, 'time'>,
  string
> = {
  callsign: 'Callsign',
  req: 'On Request (REQ)',
  stand: 'Stand',
  aircraft: 'Aircraft Type',
  wakeTurbulence: 'Wake Turbulence',
  flightType: 'Flight Type',
  arrival: 'Arrival Airport',
  runway: 'Runway',
  sid: 'SID',
  rfl: 'RFL (Requested Flight Level)',
  cfl: 'CFL (Cleared Flight Level)',
  squawk: 'Squawk',
  clearance: 'Clearance',
  status: 'Status',
  remark: 'Remarks',
  route: 'Route Button',
  pdc: 'PDC Button',
  hide: 'Hide Button',
  delete: 'Delete Button',
};

const arrivalsColumnLabels: Record<
  Exclude<keyof ArrivalsTableColumnSettings, 'time'>,
  string
> = {
  callsign: 'Callsign',
  gate: 'Gate',
  aircraft: 'Aircraft Type',
  wakeTurbulence: 'Wake Turbulence',
  flightType: 'Flight Type',
  departure: 'Departure Airport',
  runway: 'Runway',
  star: 'STAR',
  rfl: 'RFL (Requested Flight Level)',
  cfl: 'CFL (Cleared Flight Level)',
  squawk: 'Squawk',
  status: 'Status',
  remark: 'Remarks',
  route: 'Route Button',
  hide: 'Hide Button',
};

type ColumnOption = {
  key: string;
  label: string;
  checked: boolean;
  locked?: boolean;
};

function ColumnGrid({
  idPrefix,
  options,
  onToggle,
}: {
  idPrefix: string;
  options: ColumnOption[];
  onToggle: (key: string, checked: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3.5 px-5 py-4 min-[420px]:grid-cols-2 md:grid-cols-3">
      {options.map(({ key, label, checked, locked }) => {
        const id = `${idPrefix}-${key}`;
        return (
          <div key={key} className="flex min-w-0 items-center gap-2.5">
            <Checkbox
              id={id}
              checked={checked}
              disabled={locked}
              onCheckedChange={(value) => onToggle(key, value === true)}
            />
            <Label htmlFor={id} className="leading-snug font-normal">
              {label}
            </Label>
          </div>
        );
      })}
    </div>
  );
}

export default function TableColumnSettings({
  departureColumns,
  arrivalsColumns,
  onDepartureColumnsChange,
  onArrivalsColumnsChange,
  onReset,
}: TableColumnSettingsProps) {
  const idPrefix = useId();

  const handleDepartureColumnChange = (
    column: keyof DepartureTableColumnSettings,
    value: boolean
  ) => {
    if (column === 'time') return;
    onDepartureColumnsChange({
      ...departureColumns,
      [column]: value,
    });
  };

  const handleArrivalsColumnChange = (
    column: keyof ArrivalsTableColumnSettings,
    value: boolean
  ) => {
    if (column === 'time') return;
    onArrivalsColumnsChange({
      ...arrivalsColumns,
      [column]: value,
    });
  };

  const departureOptions: ColumnOption[] = [
    { key: 'time', label: 'Time', checked: true, locked: true },
    ...Object.entries(departureColumnLabels).map(([key, label]) => ({
      key,
      label,
      checked:
        departureColumns[key as keyof DepartureTableColumnSettings] !== false,
    })),
  ];

  const arrivalsOptions: ColumnOption[] = [
    { key: 'time', label: 'Time', checked: true, locked: true },
    ...Object.entries(arrivalsColumnLabels).map(([key, label]) => ({
      key,
      label,
      checked:
        arrivalsColumns[key as keyof ArrivalsTableColumnSettings] !== false,
    })),
  ];

  return (
    <SettingsSection
      title="Table Columns"
      icon={Columns3}
      actions={
        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw />
          Reset
        </Button>
      }
    >
      <SettingsGroup title="Departures">
        <ColumnGrid
          idPrefix={`${idPrefix}-dep`}
          options={departureOptions}
          onToggle={(key, checked) =>
            handleDepartureColumnChange(
              key as keyof DepartureTableColumnSettings,
              checked
            )
          }
        />
      </SettingsGroup>

      <SettingsGroup title="Arrivals">
        <ColumnGrid
          idPrefix={`${idPrefix}-arr`}
          options={arrivalsOptions}
          onToggle={(key, checked) =>
            handleArrivalsColumnChange(
              key as keyof ArrivalsTableColumnSettings,
              checked
            )
          }
        />
      </SettingsGroup>
    </SettingsSection>
  );
}
