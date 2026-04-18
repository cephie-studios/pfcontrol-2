import { useState } from 'react';
import { ChevronDown, ChevronUp, RotateCcw, Table, PlaneLanding, PlaneTakeoff } from 'lucide-react';
import type { DepartureTableColumnSettings, ArrivalsTableColumnSettings } from '../../types/settings';
import Button from '../common/Button';
import Checkbox from '../common/Checkbox';
import { S } from './settingsTokens';

interface TableColumnSettingsProps {
  departureColumns: DepartureTableColumnSettings;
  arrivalsColumns: ArrivalsTableColumnSettings;
  onDepartureColumnsChange: (columns: DepartureTableColumnSettings) => void;
  onArrivalsColumnsChange: (columns: ArrivalsTableColumnSettings) => void;
  onReset: () => void;
}

const departureColumnLabels = {
  callsign: 'Callsign',
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

const arrivalsColumnLabels = {
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

export default function TableColumnSettings({
  departureColumns,
  arrivalsColumns,
  onDepartureColumnsChange,
  onArrivalsColumnsChange,
  onReset,
}: TableColumnSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDepartureColumnChange = (column: keyof DepartureTableColumnSettings, value: boolean) => {
    if (column === 'time') return;
    onDepartureColumnsChange({ ...departureColumns, [column]: value });
  };

  const handleArrivalsColumnChange = (column: keyof ArrivalsTableColumnSettings, value: boolean) => {
    if (column === 'time') return;
    onArrivalsColumnsChange({ ...arrivalsColumns, [column]: value });
  };

  return (
    <div className={S.card}>
      <div className={S.header}>
        <div className={S.headerInner}>
          <div className={S.headerClickable} onClick={() => setIsExpanded(!isExpanded)}>
            <div className={`${S.iconBox} ${S.iconBoxMr} bg-purple-500/20`}>
              <Table className={`${S.icon} text-purple-400`} />
            </div>
            <div className="text-left min-w-0">
              <h3 className={S.title}>Table Columns</h3>
              <p className={S.subtitle}>Configure which columns are visible in your flight tables</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button onClick={onReset} variant="outline" size="sm" className="border-zinc-600 text-zinc-300 hover:bg-zinc-800 hidden sm:flex">
              <RotateCcw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
            <Button onClick={onReset} variant="outline" size="sm" className="border-zinc-600 text-zinc-300 hover:bg-zinc-800 sm:hidden p-2">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setIsExpanded(!isExpanded)} variant="outline" size="sm" className={S.chevronBtn}>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className={S.content}>
          <div className="space-y-8">

            {/* Departure Table */}
            <div>
              <div className="flex items-center mb-4">
                <div className="p-2 bg-blue-500/20 rounded-lg mr-3 flex-shrink-0">
                  <PlaneTakeoff className="h-5 w-5 text-blue-400" />
                </div>
                <h4 className="text-lg font-medium text-white">Departure Table</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300 font-medium">Time</span>
                    <span className="text-xs text-zinc-500 bg-zinc-700/50 px-2 py-1 rounded">Required</span>
                  </div>
                </div>
                {Object.entries(departureColumnLabels).map(([key, label]) => (
                  <div key={key} className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-3 hover:bg-zinc-800/50 transition-colors">
                    <Checkbox
                      checked={departureColumns[key as keyof DepartureTableColumnSettings] as boolean}
                      onChange={(checked) => handleDepartureColumnChange(key as keyof DepartureTableColumnSettings, checked)}
                      label={label}
                      className="text-sm text-zinc-300"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Arrivals Table */}
            <div>
              <div className="flex items-center mb-4">
                <div className="p-2 bg-green-500/20 rounded-lg mr-3 flex-shrink-0">
                  <PlaneLanding className="h-5 w-5 text-green-400" />
                </div>
                <h4 className="text-lg font-medium text-white">Arrivals Table</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300 font-medium">Time</span>
                    <span className="text-xs text-zinc-500 bg-zinc-700/50 px-2 py-1 rounded">Required</span>
                  </div>
                </div>
                {Object.entries(arrivalsColumnLabels).map(([key, label]) => (
                  <div key={key} className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-3 hover:bg-zinc-800/50 transition-colors">
                    <Checkbox
                      checked={arrivalsColumns[key as keyof ArrivalsTableColumnSettings] as boolean}
                      onChange={(checked) => handleArrivalsColumnChange(key as keyof ArrivalsTableColumnSettings, checked)}
                      label={label}
                      className="text-sm text-zinc-300"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}