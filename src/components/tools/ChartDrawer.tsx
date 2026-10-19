import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  File,
  FileText,
  LandPlot,
  Link2,
  Loader2,
  Map,
  PlaneLanding,
  PlaneTakeoff,
  Radar,
  RefreshCw,
  Search,
  SearchX,
  Target,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import type { Settings } from '../../types/settings';
import { PanelHeader } from '../common/SidePanel';
import ChartViewer from '../charts/ChartViewer';
import { cn } from '@/lib/utils';
import { SIGNATURE_TONES } from '@/lib/signatureTones';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  FIELD_OPTION_CLASS,
  FIELD_PANEL_CLASS,
} from '../dropdowns/fieldStyles';
import { useAirportCharts } from '../../hooks/useAirportCharts';
import {
  useChartfoxAirportCharts,
  useChartfoxStatus,
} from '../../hooks/useChartfox';
import { useAuth } from '../../hooks/auth/useAuth';
import { useData } from '../../hooks/data/useData';
import {
  CATEGORY_LABELS,
  CHARTFOX_LOGO_URL,
  SOURCE_LABELS,
  SOURCE_ORDER,
  chartMatchesQuery,
  groupByCategory,
  type ChartCategory,
  type ChartEntry,
  type ChartSource,
} from '../../utils/chartCatalog';

type AirportRole = 'departure' | 'arrival' | 'sector';

const ROLE_META: Record<
  AirportRole,
  { icon: LucideIcon; color: string; label: string }
> = {
  departure: {
    icon: PlaneTakeoff,
    color: 'text-green-400',
    label: 'Departure',
  },
  arrival: { icon: PlaneLanding, color: 'text-blue-400', label: 'Arrival' },
  sector: { icon: Radar, color: 'text-purple-400', label: 'Sector' },
};

const CATEGORY_META: Record<
  ChartCategory,
  { icon: LucideIcon; color: string }
> = {
  ground: { icon: LandPlot, color: 'text-amber-400' },
  sid: { icon: PlaneTakeoff, color: 'text-green-400' },
  star: { icon: PlaneLanding, color: 'text-blue-400' },
  approach: { icon: Target, color: 'text-purple-400' },
  transition: { icon: Waypoints, color: 'text-cyan-400' },
  general: { icon: FileText, color: 'text-zinc-400' },
  briefing: { icon: BookOpen, color: 'text-zinc-400' },
  other: { icon: File, color: 'text-zinc-500' },
};

const SECTOR_AIRPORTS: Record<string, string[]> = {
  EGTT_CTR: ['EGKK', 'EGLC', 'EGFF', 'EGHC', 'EGHJ', 'EGCK', 'X2BH'],
  EGPX_CTR: [],
  LPPC_CTR: ['LPMA'],
  ANC_CTR: ['PAFA'],
  LCCC_CTR: ['LCLK', 'LCPH', 'LCRA'],
  LCCC_E_CTR: ['LCLK', 'LCPH', 'LCRA'],
  LCCC_W_CTR: ['LCLK', 'LCPH', 'LCRA'],
  LCCC_S1_CTR: ['LCLK', 'LCPH', 'LCRA'],
  LCCC_S2_CTR: ['LCLK', 'LCPH', 'LCRA'],
  MDCS_N_CTR: ['MDPC', 'MDST', 'MDAB', 'MTCA'],
  MDCS_S_CTR: ['MDPC', 'MDST', 'MDAB', 'MTCA'],
};

const ICAO_QUERY = /^[A-Z0-9]{3,4}$/;

const AIRPORT_PILL_CLASS =
  'box-border flex h-8 shrink-0 items-center gap-1.5 rounded-full border-2 px-3 text-sm leading-none font-medium transition-colors outline-none [&_svg]:size-3.5 [&_svg]:shrink-0';
const AIRPORT_PILL_IDLE_CLASS =
  'cursor-pointer border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/60';
const AIRPORT_PILL_ACTIVE_CLASS = 'border-blue-600 bg-blue-600 text-white';

function chartDetails(chart: ChartEntry) {
  return [
    chart.code,
    chart.runways.length ? `RWY ${chart.runways.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function CategoryHeading({
  category,
  count,
}: {
  category: ChartCategory;
  count: number;
}) {
  const { icon: Icon, color } = CATEGORY_META[category];
  return (
    <div className="flex items-center gap-2 px-3 pt-4 pb-1.5 text-xs font-semibold tracking-wide text-zinc-400 uppercase">
      <Icon className={cn('size-3.5 shrink-0', color)} />
      <span>{CATEGORY_LABELS[category]}</span>
      <span className="ml-auto font-medium text-zinc-500 tabular-nums">
        {count}
      </span>
    </div>
  );
}

function ChartRow({
  chart,
  active,
  showSource,
  onSelect,
}: {
  chart: ChartEntry;
  active: boolean;
  showSource: boolean;
  onSelect: () => void;
}) {
  const details = chartDetails(chart);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active || undefined}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        active
          ? 'bg-blue-600 text-white'
          : 'text-zinc-200 hover:bg-zinc-800 hover:text-white'
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{chart.name}</span>
        {details && (
          <span
            className={cn(
              'block truncate text-xs',
              active ? 'text-blue-100' : 'text-zinc-500'
            )}
          >
            {details}
          </span>
        )}
      </span>
      {showSource && (
        <span
          className={cn(
            'shrink-0 text-xs',
            active ? 'text-blue-100' : 'text-zinc-500'
          )}
        >
          {SOURCE_LABELS[chart.source]}
        </span>
      )}
    </button>
  );
}

function ChartCard({
  chart,
  showSource,
  onSelect,
}: {
  chart: ChartEntry;
  showSource: boolean;
  onSelect: () => void;
}) {
  const details = chartDetails(chart);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="cursor-pointer rounded-2xl border-2 border-zinc-800 bg-zinc-900 p-3 text-left transition-colors outline-none hover:border-zinc-700 hover:bg-zinc-800/60 focus-visible:border-blue-600"
    >
      <span className="line-clamp-2 text-sm font-medium text-white">
        {chart.name}
      </span>
      <span className="mt-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
        <span className="truncate">{details}</span>
        {showSource && (
          <span className="shrink-0">{SOURCE_LABELS[chart.source]}</span>
        )}
      </span>
    </button>
  );
}

function AirportPicker({
  airports,
  active,
  allowLookup,
  onSelect,
}: {
  airports: { icao: string; name: string | null; count: number }[];
  active: string | null;
  allowLookup: boolean;
  onSelect: (icao: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const lookup = query.trim().toUpperCase();
  const canLookup =
    allowLookup &&
    ICAO_QUERY.test(lookup) &&
    !airports.some((airport) => airport.icao === lookup);

  const select = (icao: string) => {
    onSelect(icao);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            AIRPORT_PILL_CLASS,
            AIRPORT_PILL_IDLE_CLASS,
            'focus-visible:border-blue-600 data-[state=open]:border-blue-600'
          )}
        >
          <Search className="text-zinc-500" />
          Airports
          <ChevronDown className="text-zinc-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          'shadcn-scope w-72 overflow-hidden p-0',
          FIELD_PANEL_CLASS
        )}
      >
        <Command>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={
              allowLookup ? 'ICAO or airport name' : 'Search airports'
            }
          />
          <CommandList className="no-scrollbar max-h-72">
            <CommandEmpty>No airports found.</CommandEmpty>
            {canLookup && (
              <CommandGroup heading="ChartFox">
                <CommandItem
                  value={`lookup ${lookup}`}
                  onSelect={() => select(lookup)}
                  className={FIELD_OPTION_CLASS}
                >
                  <img
                    src={CHARTFOX_LOGO_URL}
                    alt=""
                    className="size-4 rounded"
                  />
                  <span>
                    Show charts for{' '}
                    <span className="font-mono font-medium">{lookup}</span>
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
            {airports.length > 0 && (
              <CommandGroup heading="Airports">
                {airports.map((airport) => (
                  <CommandItem
                    key={airport.icao}
                    value={`${airport.icao} ${airport.name ?? ''}`}
                    onSelect={() => select(airport.icao)}
                    className={FIELD_OPTION_CLASS}
                  >
                    <span className="font-mono font-medium">
                      {airport.icao}
                    </span>
                    <span className="truncate text-zinc-400 group-data-[selected=true]/option:text-blue-100">
                      {airport.name}
                    </span>
                    {airport.icao === active ? (
                      <Check className="ml-auto" />
                    ) : (
                      <span className="ml-auto text-xs text-zinc-500 tabular-nums group-data-[selected=true]/option:text-blue-100">
                        {airport.count}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface ChartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings | null;
  departureAirport?: string;
  arrivalAirport?: string;
  sectorStation?: string;
}

export default function ChartDrawer({
  isOpen,
  onClose,
  settings,
  departureAirport,
  arrivalAirport,
  sectorStation,
}: ChartDrawerProps) {
  const { user } = useAuth();
  const { airports: airportData } = useData();
  const { getLocalCharts } = useAirportCharts();
  const chartfox = useChartfoxStatus(!!user && isOpen);
  const [pickedAirport, setPickedAirport] = useState<string | null>(null);
  const [selectedChart, setSelectedChart] = useState<ChartEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<ChartSource | 'all'>('all');
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chart'>('list');

  const isListMode = settings?.layout?.chartDrawerViewMode === 'list';

  const relevantAirports = useMemo(() => {
    const entries: { icao: string; role: AirportRole }[] = [];
    const add = (icao: string | undefined, role: AirportRole) => {
      const code = icao?.trim().toUpperCase();
      if (code && !entries.some((entry) => entry.icao === code)) {
        entries.push({ icao: code, role });
      }
    };
    add(departureAirport, 'departure');
    add(arrivalAirport, 'arrival');
    (sectorStation ? (SECTOR_AIRPORTS[sectorStation] ?? []) : []).forEach(
      (icao) => add(icao, 'sector')
    );
    return entries;
  }, [departureAirport, arrivalAirport, sectorStation]);

  const activeAirport = pickedAirport ?? relevantAirports[0]?.icao ?? null;
  const pickedExtra =
    activeAirport &&
    !relevantAirports.some((entry) => entry.icao === activeAirport)
      ? activeAirport
      : null;

  const chartfoxCharts = useChartfoxAirportCharts(
    activeAirport,
    isOpen && chartfox.linked
  );

  const allCharts = useMemo(
    () => [
      ...(activeAirport ? getLocalCharts(activeAirport) : []),
      ...chartfoxCharts.charts,
    ],
    [activeAirport, getLocalCharts, chartfoxCharts.charts]
  );

  const sourceCounts = SOURCE_ORDER.map((source) => ({
    source,
    count: allCharts.filter((chart) => chart.source === source).length,
  })).filter(({ count }) => count > 0);
  const effectiveSource =
    sourceFilter !== 'all' &&
    sourceCounts.some(({ source }) => source === sourceFilter)
      ? sourceFilter
      : 'all';
  const showSource = effectiveSource === 'all' && sourceCounts.length > 1;

  const groups = groupByCategory(
    allCharts.filter(
      (chart) =>
        (effectiveSource === 'all' || chart.source === effectiveSource) &&
        chartMatchesQuery(chart, searchQuery)
    )
  );

  const pickerAirports = useMemo(
    () =>
      airportData
        .filter((airport) => !airport.controlName?.includes('Center'))
        .map((airport) => ({
          icao: airport.icao,
          name: airport.name,
          count: getLocalCharts(airport.icao).length,
        }))
        .sort((a, b) => a.icao.localeCompare(b.icao)),
    [airportData, getLocalCharts]
  );

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const chooseAirport = (icao: string) => {
    setPickedAirport(icao);
    setSearchQuery('');
  };

  const selectChart = (chart: ChartEntry) => {
    setSelectedChart(chart);
    setMobileView('chart');
  };

  const chartfoxLoading =
    chartfox.linked && chartfoxCharts.status === 'loading';

  const airportTabs = (
    <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
      {relevantAirports.map(({ icao, role }) => {
        const { icon: Icon, color, label } = ROLE_META[role];
        const active = icao === activeAirport;
        return (
          <button
            key={icao}
            type="button"
            onClick={() => chooseAirport(icao)}
            aria-pressed={active}
            aria-label={`${label} airport ${icao}`}
            className={cn(
              AIRPORT_PILL_CLASS,
              'font-mono focus-visible:border-blue-400',
              active ? AIRPORT_PILL_ACTIVE_CLASS : AIRPORT_PILL_IDLE_CLASS
            )}
          >
            <Icon className={active ? 'text-white' : color} />
            {icao}
          </button>
        );
      })}
      {pickedExtra && (
        <span
          className={cn(
            AIRPORT_PILL_CLASS,
            AIRPORT_PILL_ACTIVE_CLASS,
            'font-mono'
          )}
        >
          <Map />
          {pickedExtra}
        </span>
      )}
      <AirportPicker
        airports={pickerAirports}
        active={activeAirport}
        allowLookup={chartfox.linked}
        onSelect={chooseAirport}
      />
    </div>
  );

  const searchField = (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
      <Input
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search name, procedure or runway"
        aria-label="Search charts"
        className="h-10 rounded-xl border-2 border-zinc-800 bg-zinc-950 pl-9 text-sm focus-visible:border-blue-600"
      />
    </div>
  );

  const sourceTabs = sourceCounts.length > 1 && (
    <div
      role="tablist"
      aria-label="Chart source"
      className="flex max-w-md items-center gap-0.5 overflow-x-auto rounded-xl border-2 border-zinc-800 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {[
        { source: 'all' as const, count: allCharts.length },
        ...sourceCounts,
      ].map(({ source, count }) => {
        const active = effectiveSource === source;
        return (
          <button
            key={source}
            type="button"
            role="tab"
            aria-selected={active}
            title={`${count} chart${count === 1 ? '' : 's'}`}
            onClick={() => setSourceFilter(source)}
            className={cn(
              'flex h-7 flex-1 shrink-0 basis-auto cursor-pointer items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              active
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-white'
            )}
          >
            {source === 'all' ? 'All' : SOURCE_LABELS[source]}
            {active && (
              <span className="text-zinc-500 tabular-nums">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );

  const canConnectChartfox =
    !!user && chartfox.loaded && chartfox.configured && !chartfox.linked;

  const chartfoxPanel = (() => {
    if (!user || !chartfox.loaded || !chartfox.configured || !activeAirport) {
      return null;
    }
    if (canConnectChartfox) {
      return (
        <div className="space-y-3 rounded-2xl border-2 border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-start gap-3">
            <img
              src={CHARTFOX_LOGO_URL}
              alt=""
              className="size-9 shrink-0 rounded-lg"
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">
                Real-world charts
              </p>
              <p className="text-sm text-zinc-300">
                {allCharts.length === 0
                  ? `There are no ${SOURCE_LABELS.pfatc} charts for ${activeAirport} yet. Connect ChartFox to view its real-world charts.`
                  : `Connect ChartFox to show real-world charts for ${activeAirport} alongside the ${SOURCE_LABELS.pfatc} charts.`}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={chartfox.connect}
            disabled={chartfox.connecting}
            className={cn('w-full cursor-pointer', SIGNATURE_TONES.blue)}
          >
            {chartfox.connecting ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Link2 />
            )}
            {chartfox.connecting ? 'Waiting for ChartFox…' : 'Connect ChartFox'}
          </Button>
        </div>
      );
    }
    if (chartfoxCharts.status === 'error') {
      return (
        <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
          <span>ChartFox charts could not be loaded.</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={chartfoxCharts.retry}
            className={cn('cursor-pointer', SIGNATURE_TONES.blue)}
          >
            <RefreshCw />
            Retry
          </Button>
        </div>
      );
    }
    if (chartfoxCharts.status !== 'ready' || allCharts.length === 0) {
      return null;
    }
    return (
      <p className="px-3 text-xs text-zinc-500">
        {chartfoxCharts.charts.length === 0
          ? `ChartFox has no charts for ${activeAirport}. `
          : ''}
        Chart data powered by{' '}
        <a
          href="https://chartfox.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-300 underline-offset-2 hover:underline"
        >
          ChartFox
        </a>
        .
      </p>
    );
  })();

  const emptyState = (icon: LucideIcon, title: string, body?: string) => {
    const Icon = icon;
    return (
      <div className="px-4 py-10 text-center">
        <Icon className="mx-auto mb-3 size-9 text-zinc-600" />
        <p className="text-sm font-medium text-zinc-300">{title}</p>
        {body && <p className="mt-1 text-sm text-zinc-500">{body}</p>}
      </div>
    );
  };

  const listStatus = (() => {
    if (!activeAirport) {
      return emptyState(
        Map,
        'Choose an airport',
        'Pick an airport from the list above to see its charts.'
      );
    }
    if (groups.length > 0) return null;
    if (chartfoxLoading && allCharts.length === 0) {
      return (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-400">
          <Loader2 className="size-4 animate-spin text-blue-400" />
          Loading charts…
        </div>
      );
    }
    if (allCharts.length > 0) {
      return emptyState(
        SearchX,
        'No charts match your search',
        'Try a procedure name, runway or chart type.'
      );
    }
    if (canConnectChartfox) return null;
    return emptyState(
      Map,
      `No charts available for ${activeAirport}`,
      chartfox.linked && chartfoxCharts.status === 'ready'
        ? 'ChartFox has no charts for this airport either.'
        : undefined
    );
  })();

  const chartfoxPending = chartfoxLoading && groups.length > 0 && (
    <div className="flex items-center gap-2 px-3 pt-4 text-xs text-zinc-500">
      <Loader2 className="size-3.5 animate-spin text-blue-400" />
      Loading ChartFox charts…
    </div>
  );

  const chartList = (
    <div className="pb-4">
      {groups.map(({ category, charts }) => (
        <section key={category}>
          <CategoryHeading category={category} count={charts.length} />
          <div className="space-y-0.5">
            {charts.map((chart) => (
              <ChartRow
                key={chart.id}
                chart={chart}
                active={selectedChart?.id === chart.id}
                showSource={showSource}
                onSelect={() => selectChart(chart)}
              />
            ))}
          </div>
        </section>
      ))}
      {chartfoxPending}
      {listStatus}
    </div>
  );

  const chartGrid = (
    <div className="space-y-6 pb-4">
      {groups.map(({ category, charts }) => (
        <section key={category}>
          <CategoryHeading category={category} count={charts.length} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {charts.map((chart) => (
              <ChartCard
                key={chart.id}
                chart={chart}
                showSource={showSource}
                onSelect={() => selectChart(chart)}
              />
            ))}
          </div>
        </section>
      ))}
      {chartfoxPending}
      {listStatus}
    </div>
  );

  const viewer = (onBack?: () => void) =>
    selectedChart ? (
      <ChartViewer
        key={selectedChart.id}
        chart={selectedChart}
        active={isOpen}
        onBack={onBack}
        onReconnect={chartfox.connect}
      />
    ) : (
      <div className="flex flex-1 items-center justify-center bg-zinc-950 p-6">
        {emptyState(
          Map,
          'No chart selected',
          'Select a chart from the list to view it here.'
        )}
      </div>
    );

  const controls = (
    <div className="space-y-3">
      {airportTabs}
      {activeAirport && allCharts.length > 0 && searchField}
      {activeAirport && sourceTabs}
    </div>
  );

  const sidebar = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 p-3 pb-0">{controls}</div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 pt-1">
        {chartList}
        {chartfoxPanel}
      </div>
    </div>
  );

  const body = (() => {
    if (isListMode) {
      if (selectedChart) return viewer(() => setSelectedChart(null));
      return (
        <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-950">
          <div className="mx-auto max-w-6xl space-y-3 p-4">
            {controls}
            {chartGrid}
            <div className="max-w-md">{chartfoxPanel}</div>
          </div>
        </div>
      );
    }
    if (isMobile) {
      return mobileView === 'chart' && selectedChart
        ? viewer(() => setMobileView('list'))
        : sidebar;
    }
    return (
      <>
        <div className="flex w-96 shrink-0 flex-col border-r border-zinc-800">
          {sidebar}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">{viewer()}</div>
      </>
    );
  })();

  return (
    <TooltipProvider>
      <div
        className={cn(
          'shadcn-scope fixed right-0 bottom-0 left-0 flex h-[85vh] flex-col overflow-hidden rounded-t-3xl border-t-2 border-blue-800 bg-zinc-900 text-white transition-transform duration-300',
          isOpen
            ? 'translate-y-0 shadow-2xl shadow-black/60'
            : 'pointer-events-none translate-y-full'
        )}
        style={{ zIndex: 48 }}
        inert={!isOpen}
      >
        <PanelHeader icon={Map} title="Charts" onClose={onClose} />
        <div className="flex min-h-0 flex-1">{body}</div>
      </div>
    </TooltipProvider>
  );
}
