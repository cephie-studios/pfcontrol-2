import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'react-router';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  Map as MapIcon,
  MapPin,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import PageHero from '../components/common/PageHero';
import ChartViewer from '../components/charts/ChartViewer';
import { CephieUnlockStrip } from '../components/charts/CephieUnlock';
import { useCephieLocked } from '../hooks/useCephieLocked';
import {
  FIELD_OPTION_CLASS,
  FIELD_PANEL_CLASS,
  FIELD_TRIGGER_CLASS,
} from '../components/dropdowns/fieldStyles';
import { useData } from '../hooks/data/useData';
import { useChartSources } from '../hooks/useChartSources';
import {
  fetchCephieCharts,
  type CephieChartIndex,
} from '../utils/fetch/charts';
import {
  CATEGORY_LABELS,
  chartMatchesQuery,
  fromCephie,
  groupByCategory,
  type ChartEntry,
} from '../utils/chartCatalog';
import { cn } from '@/lib/utils';
import { minDuration } from '@/lib/minDuration';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface AirportCharts {
  icao: string;
  name: string | null;
  charts: ChartEntry[];
}

const CHART_GRID =
  'grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 xl:grid-cols-4';

const chartKind = (chart: ChartEntry) => chart.id.split(':').pop()!;

function CountLabel({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-zinc-200 tabular-nums [&_svg]:size-4 [&_svg]:text-blue-400">
      {icon}
      {children}
    </div>
  );
}

function Preview({
  chart,
  className,
}: {
  chart: ChartEntry;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <span
      className={cn('relative block overflow-hidden bg-zinc-900', className)}
    >
      {!loaded && <Skeleton className="absolute inset-0 rounded-none" />}
      <img
        src={chart.previewUrl}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        className={cn(
          'size-full object-contain transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-0'
        )}
      />
    </span>
  );
}

function ChartThumb({
  chart,
  locked,
  onSelect,
}: {
  chart: ChartEntry;
  locked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex min-w-0 cursor-pointer flex-col gap-2 text-left outline-none"
    >
      <Preview
        chart={chart}
        className="aspect-[1414/1000] rounded-xl border-2 border-zinc-800 transition-colors group-hover:border-zinc-600 group-focus-visible:border-blue-600"
      />
      <span className="flex min-w-0 items-baseline gap-2 px-0.5">
        {locked && (
          <Lock
            aria-label="Supporters only"
            className="size-3.5 shrink-0 self-center text-amber-500"
          />
        )}
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-300 transition-colors group-hover:text-white">
          {chart.name}
        </span>
        {chart.code && (
          <span className="shrink-0 font-mono text-xs text-zinc-500">
            {chart.code}
          </span>
        )}
      </span>
    </button>
  );
}

function AirportList({
  airports,
  active,
  onSelect,
}: {
  airports: AirportCharts[];
  active: string | null;
  onSelect: (icao: string) => void;
}) {
  return (
    <nav aria-label="Airports" className="flex flex-col gap-0.5">
      {airports.map((airport) => {
        const selected = airport.icao === active;
        return (
          <button
            key={airport.icao}
            type="button"
            aria-current={selected || undefined}
            onClick={() => onSelect(airport.icao)}
            className={cn(
              'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              selected
                ? 'bg-blue-600 text-white'
                : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
            )}
          >
            <span className="font-mono text-sm font-semibold">
              {airport.icao}
            </span>
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-sm',
                selected ? 'text-blue-100' : 'text-zinc-500'
              )}
            >
              {airport.name}
            </span>
            <span
              className={cn(
                'shrink-0 text-xs tabular-nums',
                selected ? 'text-blue-100' : 'text-zinc-500'
              )}
            >
              {airport.charts.length}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function AirportPicker({
  airports,
  active,
  onSelect,
}: {
  airports: AirportCharts[];
  active: AirportCharts | null;
  onSelect: (icao: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={FIELD_TRIGGER_CLASS}>
          <span className="flex min-w-0 items-center gap-2">
            <MapPin className="size-4 shrink-0 text-blue-400" />
            <span className="font-mono font-semibold">
              {active?.icao ?? 'Airport'}
            </span>
            {active?.name && (
              <span className="truncate text-zinc-400">{active.name}</span>
            )}
          </span>
          <ChevronDown className="size-4 shrink-0 text-zinc-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          'shadcn-scope w-(--radix-popover-trigger-width) overflow-hidden p-0',
          FIELD_PANEL_CLASS
        )}
      >
        <Command>
          <CommandInput placeholder="Search airports" />
          <CommandList className="no-scrollbar max-h-72">
            <CommandEmpty>No airports found.</CommandEmpty>
            <CommandGroup>
              {airports.map((airport) => (
                <CommandItem
                  key={airport.icao}
                  value={`${airport.icao} ${airport.name ?? ''}`}
                  onSelect={() => {
                    onSelect(airport.icao);
                    setOpen(false);
                  }}
                  className={cn(FIELD_OPTION_CLASS, 'cursor-pointer')}
                >
                  <span className="font-mono font-medium">{airport.icao}</span>
                  <span className="truncate text-zinc-400 group-data-[selected=true]/option:text-blue-100">
                    {airport.name}
                  </span>
                  {airport.icao === active?.icao ? (
                    <Check className="ml-auto" />
                  ) : (
                    <span className="ml-auto text-xs text-zinc-500 tabular-nums group-data-[selected=true]/option:text-blue-100">
                      {airport.charts.length}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ChartPicker({
  airport,
  chart,
  container,
  onSelect,
}: {
  airport: AirportCharts;
  chart: ChartEntry;
  // Inside the modal viewer, so its scroll lock doesn't swallow the wheel.
  container: HTMLElement | null;
  onSelect: (chart: ChartEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const charts = airport.charts;
  const index = charts.findIndex((c) => c.id === chart.id);
  const prev = index > 0 ? charts[index - 1] : null;
  const next = index < charts.length - 1 ? charts[index + 1] : null;

  const step = (target: ChartEntry | null, label: string, back: boolean) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={label}
          disabled={!target}
          onClick={() => target && onSelect(target)}
          className="shrink-0 cursor-pointer"
        >
          {back ? <ChevronLeft /> : <ChevronRight />}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="shadcn-scope" sideOffset={6}>
        {target ? `${label}: ${target.name}` : label}
      </TooltipContent>
    </Tooltip>
  );

  return (
    <div className="flex min-w-0 items-center gap-2">
      {step(prev, 'Previous chart', true)}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-9 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg bg-secondary px-3 text-left text-sm outline-none hover:brightness-125 focus-visible:ring-2 focus-visible:ring-ring sm:w-80"
          >
            <span className="min-w-0 flex-1 truncate font-medium">
              {chart.name}
            </span>
            {chart.code && (
              <span className="shrink-0 font-mono text-xs text-zinc-500">
                {chart.code}
              </span>
            )}
            <span className="shrink-0 text-xs text-zinc-500 tabular-nums">
              {index + 1}/{charts.length}
            </span>
            <ChevronDown className="size-4 shrink-0 text-zinc-500" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          container={container}
          className={cn(
            'shadcn-scope w-80 overflow-hidden p-0',
            FIELD_PANEL_CLASS
          )}
        >
          <Command>
            <CommandInput placeholder={`Search ${airport.icao} charts`} />
            <CommandList className="no-scrollbar max-h-96">
              <CommandEmpty>No charts found.</CommandEmpty>
              {groupByCategory(charts).map(({ category, charts: group }) => (
                <CommandGroup
                  key={category}
                  heading={CATEGORY_LABELS[category]}
                >
                  {group.map((entry) => (
                    <CommandItem
                      key={entry.id}
                      value={`${entry.name} ${entry.code ?? ''} ${entry.id}`}
                      onSelect={() => {
                        onSelect(entry);
                        setOpen(false);
                      }}
                      className={cn(FIELD_OPTION_CLASS, 'cursor-pointer')}
                    >
                      <Preview
                        chart={entry}
                        className="aspect-[1414/1000] h-8 shrink-0 rounded-md"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {entry.name}
                      </span>
                      {entry.id === chart.id ? (
                        <Check className="shrink-0" />
                      ) : (
                        entry.code && (
                          <span className="shrink-0 font-mono text-xs text-zinc-500 group-data-[selected=true]/option:text-blue-100">
                            {entry.code}
                          </span>
                        )
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {step(next, 'Next chart', false)}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Search;
  title: string;
  body: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <Icon className="size-10 text-blue-400" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-zinc-300">{body}</p>
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
      <div className="hidden flex-col gap-2 lg:flex">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-9 rounded-xl" />
        ))}
      </div>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-56" />
        <div className={CHART_GRID}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="aspect-[1414/1000] rounded-xl" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Charts() {
  const { airports: airportData } = useData();
  const [index, setIndex] = useState<CephieChartIndex | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  );
  const [retrying, setRetrying] = useState(false);
  const [query, setQuery] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewerEl, setViewerEl] = useState<HTMLDivElement | null>(null);
  const locked = useCephieLocked();
  const cephieOff = useChartSources()?.cephie === false;

  const load = useCallback(async () => {
    const result = await fetchCephieCharts();
    setIndex(result);
    setStatus(result ? 'ready' : 'error');
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const retry = async () => {
    setRetrying(true);
    try {
      await minDuration(load());
    } finally {
      setRetrying(false);
    }
  };

  const airports = useMemo<AirportCharts[]>(() => {
    if (!index) return [];
    const names = new Map(
      airportData.map((airport) => [airport.icao, airport.name?.trim()])
    );
    return Object.entries(index)
      .filter(([, charts]) => charts.length > 0)
      .map(([icao, charts]) => ({
        icao,
        name: names.get(icao) || null,
        charts: charts.map((chart) => fromCephie(icao, chart)),
      }))
      .sort((a, b) => a.icao.localeCompare(b.icao));
  }, [index, airportData]);

  const chartCount = airports.reduce((n, a) => n + a.charts.length, 0);

  const filteredAirports = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return airports;
    return airports
      .map((airport) => {
        const airportMatches = [airport.icao, airport.name]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q));
        return airportMatches
          ? airport
          : {
              ...airport,
              charts: airport.charts.filter((chart) =>
                chartMatchesQuery(chart, q)
              ),
            };
      })
      .filter((airport) => airport.charts.length > 0);
  }, [airports, query]);

  const selectedIcao = searchParams.get('airport')?.toUpperCase() ?? null;
  const selectedKind = searchParams.get('chart');
  const activeAirport =
    filteredAirports.find((a) => a.icao === selectedIcao) ??
    filteredAirports[0] ??
    null;
  const viewerAirport = airports.find((a) => a.icao === selectedIcao) ?? null;
  const selectedChart =
    viewerAirport?.charts.find(
      (chart) => chart.id === `cephie:${selectedIcao}:${selectedKind}`
    ) ?? null;

  const selectAirport = (icao: string) => setSearchParams({ airport: icao });

  const openChart = (chart: ChartEntry, replace = false) =>
    setSearchParams(
      { airport: chart.airport, chart: chartKind(chart) },
      { replace }
    );

  const closeChart = () =>
    setSearchParams(selectedIcao ? { airport: selectedIcao } : {});

  const showSkeleton = status === 'loading';
  const activeCount = activeAirport?.charts.length ?? 0;

  return (
    <TooltipProvider>
      <div className="shadcn-scope min-h-screen bg-background text-foreground">
        {!selectedChart && <Navbar />}

        <PageHero title="CHARTS">
          {showSkeleton ? (
            <div className="flex gap-6">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-24" />
            </div>
          ) : (
            status === 'ready' &&
            !cephieOff && (
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="max-w-xl text-sm text-zinc-300 sm:text-base">
                  Airport diagrams, stands and procedures for PFATC airports.
                </p>
                <div className="flex items-center gap-6">
                  <CountLabel icon={<MapPin />}>
                    {airports.length}{' '}
                    {airports.length === 1 ? 'airport' : 'airports'}
                  </CountLabel>
                  <CountLabel icon={<MapIcon />}>
                    {chartCount} {chartCount === 1 ? 'chart' : 'charts'}
                  </CountLabel>
                </div>
              </div>
            )
          )}
        </PageHero>

        <div className="relative z-10 mx-auto -mt-6 w-full max-w-7xl px-4 pb-16 sm:px-6 md:-mt-8">
          <div className="flex flex-col gap-6">
            {cephieOff ? (
              <EmptyState
                icon={MapIcon}
                title="Charts are turned off"
                body="Cephie Charts are switched off for now. Session charts still work."
              />
            ) : status === 'error' ? (
              <div
                role="alert"
                className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" />
                  Charts could not be loaded.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={retry}
                  disabled={retrying}
                  className="cursor-pointer"
                >
                  {retrying ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <RefreshCw />
                  )}
                  Try again
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search airport, ICAO or chart..."
                  aria-label="Search charts"
                  className="h-11 rounded-xl border-2 border-zinc-800 bg-zinc-900 pl-10 focus-visible:border-ring focus-visible:ring-0 dark:bg-zinc-900"
                />
              </div>
            )}

            {!cephieOff && locked && status === 'ready' && chartCount > 0 && (
              <CephieUnlockStrip />
            )}

            {cephieOff ? null : showSkeleton ? (
              <PageSkeleton />
            ) : status === 'error' ? null : airports.length === 0 ? (
              <EmptyState
                icon={MapIcon}
                title="No charts yet"
                body="Charts haven't been published for any airport yet."
              />
            ) : filteredAirports.length === 0 || !activeAirport ? (
              <EmptyState
                icon={Search}
                title="No matching charts"
                body={<>Nothing matches “{query.trim()}”.</>}
              />
            ) : (
              <div className="grid gap-6 lg:grid-cols-[17rem_1fr] lg:gap-10">
                <aside className="hidden lg:block">
                  <div className="no-scrollbar sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto pb-4">
                    <AirportList
                      airports={filteredAirports}
                      active={activeAirport.icao}
                      onSelect={selectAirport}
                    />
                  </div>
                </aside>

                <div className="lg:hidden">
                  <AirportPicker
                    airports={filteredAirports}
                    active={activeAirport}
                    onSelect={selectAirport}
                  />
                </div>

                <section className="flex min-w-0 flex-col gap-6">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="font-mono text-2xl font-bold">
                      {activeAirport.icao}
                    </h2>
                    {activeAirport.name && (
                      <span className="text-zinc-400">
                        {activeAirport.name}
                      </span>
                    )}
                    <span className="ml-auto text-sm text-zinc-500 tabular-nums">
                      {activeCount} {activeCount === 1 ? 'chart' : 'charts'}
                    </span>
                  </div>

                  {groupByCategory(activeAirport.charts).map(
                    ({ category, charts }) => (
                      <div key={category} className="flex flex-col gap-3">
                        <h3 className="text-sm font-semibold text-zinc-400">
                          {CATEGORY_LABELS[category]}
                        </h3>
                        <div className={CHART_GRID}>
                          {charts.map((chart) => (
                            <ChartThumb
                              key={chart.id}
                              chart={chart}
                              locked={locked}
                              onSelect={() => openChart(chart)}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </section>
              </div>
            )}

            {!cephieOff && status === 'ready' && airports.length > 0 && (
              <p className="text-center text-xs text-zinc-500">
                Generated by Cephie from map data ©{' '}
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-300 underline-offset-2 hover:underline"
                >
                  OpenStreetMap contributors
                </a>
                . For flight simulation use only, not for real-world navigation.
              </p>
            )}
          </div>
        </div>

        <Dialog
          open={!!selectedChart}
          onOpenChange={(open) => !open && closeChart()}
        >
          <DialogContent
            ref={setViewerEl}
            showCloseButton={false}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              viewerEl?.focus();
            }}
            onEscapeKeyDown={(e) => {
              // Escape in the chart picker should close only the picker.
              if (document.querySelector('[data-slot="popover-content"]')) {
                e.preventDefault();
              }
            }}
            className="shadcn-scope top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-zinc-950 p-0 sm:max-w-none"
          >
            <DialogTitle className="sr-only">
              {selectedChart
                ? `${selectedChart.airport} ${selectedChart.name}`
                : 'Chart'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Pan and zoom the chart. Press Escape to close.
            </DialogDescription>
            <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-zinc-800 bg-zinc-900 py-2 pr-2 pl-3">
              <span className="truncate font-mono text-sm font-semibold text-zinc-300">
                {viewerAirport?.icao}
              </span>
              {viewerAirport && selectedChart ? (
                <ChartPicker
                  airport={viewerAirport}
                  chart={selectedChart}
                  container={viewerEl}
                  onSelect={(chart) => openChart(chart, true)}
                />
              ) : (
                <span />
              )}
              <div className="flex justify-end">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Close chart"
                      onClick={closeChart}
                      className="shrink-0 cursor-pointer rounded-full text-zinc-300 hover:bg-zinc-800 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-zinc-800"
                    >
                      <X className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="shadcn-scope" sideOffset={6}>
                    Close chart
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            {selectedChart && (
              <ChartViewer
                key={selectedChart.id}
                chart={selectedChart}
                active
                onBack={closeChart}
                backLabel="Back to all charts"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
