import { useId } from 'react';
import { List, PanelLeft, PanelsTopLeft } from 'lucide-react';
import type { Settings } from '../../types/settings';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import SettingsSection from './SettingsSection';
import SettingsGroup from './SettingsGroup';
import SettingsRow from './SettingsRow';

interface LayoutSettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

const previewFlights = [
  {
    callsign: 'BAW123',
    aircraft: 'B738',
    route: 'EGLL → KJFK',
    status: 'RWY',
    statusClass: 'text-emerald-400',
    time: '09:15',
  },
  {
    callsign: 'UAL456',
    aircraft: 'B777',
    route: 'KJFK → EGLL',
    status: 'TAXI',
    statusClass: 'text-blue-400',
    time: '09:22',
  },
];

function rowBackground(opacity: number) {
  return opacity === 0 ? 'transparent' : `rgba(0, 0, 0, ${opacity / 100})`;
}

export default function LayoutSettings({
  settings,
  onChange,
}: LayoutSettingsProps) {
  const combinedViewId = useId();

  const handleCombinedViewToggle = () => {
    if (!settings) return;
    const updatedSettings = {
      ...settings,
      layout: {
        ...settings.layout,
        showCombinedView: !settings.layout.showCombinedView,
      },
    };
    onChange(updatedSettings);
  };

  const handleOpacityChange = (opacity: number) => {
    if (!settings) return;
    const updatedSettings = {
      ...settings,
      layout: {
        ...settings.layout,
        flightRowOpacity: opacity,
      },
    };
    onChange(updatedSettings);
  };

  const handleChartViewModeChange = (mode: 'list' | 'legacy') => {
    if (!settings) return;
    const updatedSettings = {
      ...settings,
      layout: {
        ...settings.layout,
        chartDrawerViewMode: mode,
      },
    };
    onChange(updatedSettings);
  };

  if (!settings) return null;

  const opacity = settings.layout.flightRowOpacity;
  const chartViewMode = settings.layout.chartDrawerViewMode || 'legacy';

  return (
    <SettingsSection title="Layout" icon={PanelsTopLeft}>
      <SettingsGroup>
        <SettingsRow
          label="Combined view"
          description="Show departures and arrivals on one page. Desktop only."
          htmlFor={combinedViewId}
        >
          <Switch
            id={combinedViewId}
            checked={settings.layout.showCombinedView}
            onCheckedChange={handleCombinedViewToggle}
          />
        </SettingsRow>

        <SettingsRow
          label="Flight row opacity"
          description="Background opacity of flight rows over background images."
          stacked
        >
          <div className="flex w-full min-w-0 flex-col gap-4">
            <div className="flex items-center gap-4">
              <Slider
                min={0}
                max={100}
                step={5}
                value={[opacity]}
                onValueChange={([value]) => handleOpacityChange(value)}
                aria-label="Flight row opacity"
              />
              <span className="w-10 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
                {opacity}%
              </span>
            </div>

            <div
              className="relative overflow-hidden rounded-xl border bg-cover bg-center"
              style={{ backgroundImage: 'url("/assets/images/hero.webp")' }}
              aria-hidden="true"
            >
              <div className="flex flex-col gap-px py-3">
                {previewFlights.map((flight) => (
                  <div
                    key={flight.callsign}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                    style={{ backgroundColor: rowBackground(opacity) }}
                  >
                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                      <span className="font-mono font-medium text-blue-400">
                        {flight.callsign}
                      </span>
                      <span className="text-foreground">{flight.aircraft}</span>
                      <span className="hidden truncate text-muted-foreground min-[420px]:inline">
                        {flight.route}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={cn(
                          'text-xs font-medium',
                          flight.statusClass
                        )}
                      >
                        {flight.status}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {flight.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SettingsRow>

        <SettingsRow
          label="Chart drawer view"
          description="How charts are shown in the ACARS terminal."
        >
          <ToggleGroup
            type="single"
            value={chartViewMode}
            onValueChange={(value) => {
              if (value === 'legacy' || value === 'list') {
                handleChartViewModeChange(value);
              }
            }}
            aria-label="Chart drawer view"
          >
            <ToggleGroupItem value="legacy">
              <PanelLeft />
              Legacy
            </ToggleGroupItem>
            <ToggleGroupItem value="list">
              <List />
              List
            </ToggleGroupItem>
          </ToggleGroup>
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>
  );
}
