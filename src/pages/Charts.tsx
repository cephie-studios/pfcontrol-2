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
  Loader2,
  Map as MapIcon,
  MapPin,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import PageHero from '../components/common/PageHero';
import ChartViewer from '../components/charts/ChartViewer';
import { useData } from '../hooks/data/useData';
import {
  fetchCephieCharts,
  type CephieChartIndex,
} from '../utils/fetch/charts';
import {
  chartMatchesQuery,
  fromCephie,
  type ChartEntry,
} from '../utils/chartCatalog';
import { cn } from '@/lib/utils';
import { minDuration } from '@/lib/minDuration';
import { SIGNATURE_TONES } from '@/lib/signatureTones';
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

interface AirportCharts {
  icao: string;
  name: string | null;
  charts: ChartEntry[];
}

const AIRPORT_GRID =
  'grid items-start gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-3';

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
  onSelect,
}: {
  chart: ChartEntry;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex min-w-0 cursor-pointer flex-col gap-1.5 text-left outline-none"
    >
      <Preview
        chart={chart}
        className="aspect-[1414/1000] rounded-xl border-2 border-zinc-800 transition-colors group-hover:border-zinc-600 group-focus-visible:border-blue-600"
      />
      <span className="flex min-w-0 items-baseline gap-2 px-0.5">
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

function AirportSection({
  airport,
  onSelect,
}: {
  airport: AirportCharts;
  onSelect: (chart: ChartEntry) => void;
}) {
  const count = airport.charts.length;
  return (
    <section className="min-w-0">
      <div className="mb-3 flex min-w-0 items-center gap-2.5">
        <MapPin className="size-4 shrink-0 text-blue-400" />
        <h2 className="font-mono text-lg font-semibold">{airport.icao}</h2>
        {airport.name && (
          <span className="truncate text-sm text-zinc-400">{airport.name}</span>
        )}
        <span className="ml-auto shrink-0 text-xs text-zinc-500 tabular-nums">
          {count} {count === 1 ? 'chart' : 'charts'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {airport.charts.map((chart) => (
          <ChartThumb
            key={chart.id}
            chart={chart}
            onSelect={() => onSelect(chart)}
          />
        ))}
      </div>
    </section>
  );
}

function SectionSkeleton() {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2.5">
        <Skeleton className="size-4 rounded-md" />
        <Skeleton className="h-5 w-14" />
        <Skeleton className="h-3.5 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="aspect-[1414/1000] rounded-xl" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        ))}
      </div>
    </section>
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
    <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-zinc-800 bg-zinc-900 px-6 py-12 text-center">
      <Icon className="size-10 text-blue-400" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-zinc-300">{body}</p>
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
  const selectedAirport = airports.find((a) => a.icao === selectedIcao);
  const selectedChart =
    selectedAirport?.charts.find(
      (chart) => chart.id === `cephie:${selectedIcao}:${selectedKind}`
    ) ?? null;

  const openChart = (chart: ChartEntry, replace = false) =>
    setSearchParams(
      { airport: chart.airport, chart: chartKind(chart) },
      { replace }
    );

  const closeChart = () => setSearchParams({});

  const showSkeleton = status === 'loading';

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
            status === 'ready' && (
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="max-w-xl text-sm text-zinc-300 sm:text-base">
                  Airport diagrams and stand charts for PFATC airports. Free to
                  use, no account needed.
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
          <div className="flex flex-col gap-8">
            {status === 'error' ? (
              <div
                role="alert"
                className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" />
                  Charts could not be loaded.
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={retry}
                  disabled={retrying}
                  className={cn('cursor-pointer', SIGNATURE_TONES.red)}
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
                  className="h-11 rounded-xl border-zinc-800 bg-zinc-900 pl-10 dark:bg-zinc-900"
                />
              </div>
            )}

            {showSkeleton ? (
              <div className={AIRPORT_GRID}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <SectionSkeleton key={i} />
                ))}
              </div>
            ) : status === 'error' ? null : airports.length === 0 ? (
              <EmptyState
                icon={MapIcon}
                title="No charts yet"
                body="Charts haven't been published for any airport yet."
              />
            ) : filteredAirports.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No matching charts"
                body={<>Nothing matches “{query.trim()}”.</>}
              />
            ) : (
              <div className={AIRPORT_GRID}>
                {filteredAirports.map((airport) => (
                  <AirportSection
                    key={airport.icao}
                    airport={airport}
                    onSelect={openChart}
                  />
                ))}
              </div>
            )}

            {status === 'ready' && airports.length > 0 && (
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
            showCloseButton={false}
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
            <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900 py-2 pr-2 pl-3">
              {selectedAirport && selectedAirport.charts.length > 1 ? (
                <div
                  role="tablist"
                  aria-label={`${selectedAirport.icao} charts`}
                  className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto"
                >
                  {selectedAirport.charts.map((chart) => {
                    const active = chart.id === selectedChart?.id;
                    return (
                      <button
                        key={chart.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => openChart(chart, true)}
                        className={cn(
                          'flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl border-2 p-1 pr-3 text-left transition-colors outline-none focus-visible:border-blue-400',
                          active
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/60'
                        )}
                      >
                        <Preview
                          chart={chart}
                          className="aspect-[1414/1000] h-9 shrink-0 rounded-lg"
                        />
                        <span>
                          <span className="block text-sm leading-tight font-medium whitespace-nowrap">
                            {chart.name}
                          </span>
                          {chart.code && (
                            <span
                              className={cn(
                                'block font-mono text-xs',
                                active ? 'text-blue-100' : 'text-zinc-500'
                              )}
                            >
                              {chart.code}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <span className="flex-1" />
              )}
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
