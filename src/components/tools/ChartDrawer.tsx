import { useState, useEffect } from 'react';
import {
  Map,
  ZoomIn,
  ZoomOut,
  PlaneLanding,
  ChevronDown,
  Loader2,
  PlaneTakeoff,
  List,
  Search,
  type LucideIcon,
} from 'lucide-react';
import type { Airport } from '../../types/airports';
import type { Settings } from '../../types/settings';
import Button from '../common/Button';
import { PanelHeader, panelInputClass } from '../common/SidePanel';
import { cn } from '@/lib/utils';

type ChartEntry = {
  name: string;
  path: string;
  type: string;
  credits?: string;
  procedures?: string[];
};

type Accent = 'green' | 'blue' | 'purple' | 'gray';

const accentText: Record<Accent, string> = {
  green: 'text-green-400',
  blue: 'text-blue-400',
  purple: 'text-purple-400',
  gray: 'text-zinc-300',
};

const accentGridHover: Record<Accent, { border: string; text: string }> = {
  green: {
    border: 'hover:border-green-500/50',
    text: 'group-hover:text-green-400',
  },
  blue: {
    border: 'hover:border-blue-500/50',
    text: 'group-hover:text-blue-400',
  },
  purple: {
    border: 'hover:border-purple-500/50',
    text: 'group-hover:text-purple-400',
  },
  gray: { border: 'hover:border-zinc-500', text: 'group-hover:text-zinc-300' },
};

function ChartListSection({
  title,
  charts,
  selectedChart,
  onSelect,
}: {
  title: string;
  charts: ChartEntry[];
  selectedChart: string | null;
  onSelect: (path: string) => void;
}) {
  return (
    <div>
      <div className="px-4 pt-4 pb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        {title}
      </div>
      <div className="space-y-1">
        {charts.map((chart) => {
          const active = selectedChart === chart.path;
          return (
            <button
              key={chart.path}
              type="button"
              onClick={() => onSelect(chart.path)}
              aria-current={active || undefined}
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-full px-4 py-2.5 text-left text-sm transition-colors',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
              )}
            >
              <span className="truncate">{chart.name}</span>
              <span
                className={cn(
                  'shrink-0 text-xs',
                  active ? 'text-blue-100' : 'text-zinc-500'
                )}
              >
                {chart.type}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChartGridItem({
  chart,
  accent,
  onSelect,
}: {
  chart: ChartEntry;
  accent: Accent;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group rounded-xl border border-zinc-800 bg-zinc-800/40 p-3 text-left transition-colors hover:bg-zinc-800',
        accentGridHover[accent].border
      )}
    >
      <div
        className={cn(
          'line-clamp-1 text-sm font-medium text-white transition-colors',
          accentGridHover[accent].text
        )}
      >
        {chart.name}
      </div>
      <div className="mt-0.5 text-xs text-zinc-500">{chart.type}</div>
    </button>
  );
}

function ChartGroupLabel({
  icon: Icon,
  accent,
  children,
  count,
}: {
  icon: LucideIcon;
  accent: Accent;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 px-2.5 pt-1 pb-1.5 text-xs font-semibold tracking-wide text-zinc-400 uppercase">
      <Icon className={cn('size-3.5 shrink-0', accentText[accent])} />
      <span className="truncate">{children}</span>
      {count !== undefined && (
        <span className="ml-auto font-medium text-zinc-500 tabular-nums">
          {count}
        </span>
      )}
    </div>
  );
}

interface ChartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedChart: string | null;
  setSelectedChart: (chart: string | null) => void;
  chartLoadError: boolean;
  setChartLoadError: (err: boolean) => void;
  chartZoom: number;
  chartPan: { x: number; y: number };
  isChartDragging: boolean;
  handleChartMouseDown: (e: React.MouseEvent) => void;
  handleChartMouseMove: (e: React.MouseEvent) => void;
  handleChartMouseUp: () => void;
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: (e: React.TouchEvent) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetZoom: () => void;
  getChartsForAirport: (icao: string) => {
    name: string;
    path: string;
    type: string;
    credits?: string;
    procedures?: string[];
  }[];
  containerRef: React.RefObject<HTMLDivElement>;
  setImageSize: (size: { width: number; height: number }) => void;
  airports: Airport[];
  settings: Settings | null;
  departureAirport?: string;
  arrivalAirport?: string;
  sectorStation?: string;
}

export default function ChartDrawer({
  isOpen,
  onClose,
  selectedChart,
  setSelectedChart,
  chartLoadError,
  setChartLoadError,
  chartZoom,
  chartPan,
  isChartDragging,
  handleChartMouseDown,
  handleChartMouseMove,
  handleChartMouseUp,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  handleZoomIn,
  handleZoomOut,
  handleResetZoom,
  getChartsForAirport,
  containerRef,
  setImageSize,
  settings,
  departureAirport,
  arrivalAirport,
  sectorStation,
}: ChartDrawerProps) {
  const [showAllAirports, setShowAllAirports] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<'chart' | 'sidebar'>('sidebar');

  const viewMode = settings?.layout?.chartDrawerViewMode || 'legacy';

  const sectorAirportMap: Record<string, string[]> = {
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

  const sectorAirports = sectorStation
    ? sectorAirportMap[sectorStation] || []
    : [];

  const isLegacyMode = viewMode === 'legacy';
  const hasSectorAirports = sectorAirports.length > 0;

  const departureCharts = departureAirport
    ? getChartsForAirport(departureAirport)
    : [];
  const arrivalCharts = arrivalAirport
    ? getChartsForAirport(arrivalAirport)
    : [];

  const availableAirports = [
    'EGCK',
    'EGFF',
    'EGHC',
    'EGHJ',
    'EGKK',
    'EGLC',
    'LCLK',
    'LCPH',
    'LCRA',
    'LPMA',
    'MDAB',
    'MDPC',
    'MDST',
    'MTCA',
    'PAFA',
    'X2BH',
  ];

  const otherAirports = hasSectorAirports
    ? [
        ...sectorAirports.filter(
          (icao) => icao !== departureAirport && icao !== arrivalAirport
        ),
        ...availableAirports.filter(
          (icao) =>
            !sectorAirports.includes(icao) &&
            icao !== departureAirport &&
            icao !== arrivalAirport
        ),
      ]
    : availableAirports.filter(
        (icao) => icao !== departureAirport && icao !== arrivalAirport
      );

  const chartsToUse = [
    ...departureCharts,
    ...arrivalCharts,
    ...otherAirports.flatMap((icao) => getChartsForAirport(icao)),
  ];

  const filteredDepartureCharts = departureCharts.filter(
    (chart) =>
      chart.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chart.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (chart.credits &&
        chart.credits.toLowerCase().includes(searchQuery.toLowerCase())) ||
      departureAirport?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (chart.procedures &&
        chart.procedures.some((proc) =>
          proc.toLowerCase().includes(searchQuery.toLowerCase())
        ))
  );
  const filteredArrivalCharts = arrivalCharts.filter(
    (chart) =>
      chart.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chart.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (chart.credits &&
        chart.credits.toLowerCase().includes(searchQuery.toLowerCase())) ||
      arrivalAirport?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (chart.procedures &&
        chart.procedures.some((proc: string) =>
          proc.toLowerCase().includes(searchQuery.toLowerCase())
        ))
  );
  const sectorAirportsList = hasSectorAirports
    ? otherAirports
        .filter((icao) => sectorAirports.includes(icao))
        .map((icao) => {
          const airportCharts = getChartsForAirport(icao);
          const filteredCharts = airportCharts.filter(
            (chart) =>
              chart.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              chart.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (chart.credits &&
                chart.credits
                  .toLowerCase()
                  .includes(searchQuery.toLowerCase())) ||
              icao.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (chart.procedures &&
                chart.procedures.some((proc: string) =>
                  proc.toLowerCase().includes(searchQuery.toLowerCase())
                ))
          );
          return { icao, charts: filteredCharts };
        })
        .filter(({ charts }) => charts.length > 0)
    : [];

  const filteredOtherAirports = otherAirports
    .filter((icao) => !hasSectorAirports || !sectorAirports.includes(icao))
    .map((icao) => {
      const airportCharts = getChartsForAirport(icao);
      const filteredCharts = airportCharts.filter(
        (chart) =>
          chart.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          chart.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (chart.credits &&
            chart.credits.toLowerCase().includes(searchQuery.toLowerCase())) ||
          icao.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (chart.procedures &&
            chart.procedures.some((proc: string) =>
              proc.toLowerCase().includes(searchQuery.toLowerCase())
            ))
      );
      return { icao, charts: filteredCharts };
    })
    .filter(({ charts }) => charts.length > 0);

  const matchedCategories = new Set<string>();
  if (searchQuery) {
    filteredDepartureCharts.forEach((chart) => {
      if (chart.name.toLowerCase().includes(searchQuery.toLowerCase()))
        matchedCategories.add('Name');
      if (chart.type.toLowerCase().includes(searchQuery.toLowerCase()))
        matchedCategories.add('Type');
      if (
        chart.credits &&
        chart.credits.toLowerCase().includes(searchQuery.toLowerCase())
      )
        matchedCategories.add('Author');
      if (departureAirport?.toLowerCase().includes(searchQuery.toLowerCase()))
        matchedCategories.add('Airport');
      if (
        chart.procedures &&
        chart.procedures.some((proc: string) =>
          proc.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
        matchedCategories.add('Procedure');
    });
    filteredArrivalCharts.forEach((chart) => {
      if (chart.name.toLowerCase().includes(searchQuery.toLowerCase()))
        matchedCategories.add('Name');
      if (chart.type.toLowerCase().includes(searchQuery.toLowerCase()))
        matchedCategories.add('Type');
      if (
        chart.credits &&
        chart.credits.toLowerCase().includes(searchQuery.toLowerCase())
      )
        matchedCategories.add('Author');
      if (arrivalAirport?.toLowerCase().includes(searchQuery.toLowerCase()))
        matchedCategories.add('Airport');
      if (
        chart.procedures &&
        chart.procedures.some((proc: string) =>
          proc.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
        matchedCategories.add('Procedure');
    });
    sectorAirportsList.forEach(({ icao, charts }) => {
      charts.forEach((chart) => {
        if (chart.name.toLowerCase().includes(searchQuery.toLowerCase()))
          matchedCategories.add('Name');
        if (chart.type.toLowerCase().includes(searchQuery.toLowerCase()))
          matchedCategories.add('Type');
        if (
          chart.credits &&
          chart.credits.toLowerCase().includes(searchQuery.toLowerCase())
        )
          matchedCategories.add('Author');
        if (icao.toLowerCase().includes(searchQuery.toLowerCase()))
          matchedCategories.add('Airport');
        if (
          chart.procedures &&
          chart.procedures.some((proc: string) =>
            proc.toLowerCase().includes(searchQuery.toLowerCase())
          )
        )
          matchedCategories.add('Procedure');
      });
    });
    filteredOtherAirports.forEach(({ icao, charts }) => {
      charts.forEach((chart) => {
        if (chart.name.toLowerCase().includes(searchQuery.toLowerCase()))
          matchedCategories.add('Name');
        if (chart.type.toLowerCase().includes(searchQuery.toLowerCase()))
          matchedCategories.add('Type');
        if (
          chart.credits &&
          chart.credits.toLowerCase().includes(searchQuery.toLowerCase())
        )
          matchedCategories.add('Author');
        if (icao.toLowerCase().includes(searchQuery.toLowerCase()))
          matchedCategories.add('Airport');
        if (
          chart.procedures &&
          chart.procedures.some((proc: string) =>
            proc.toLowerCase().includes(searchQuery.toLowerCase())
          )
        )
          matchedCategories.add('Procedure');
      });
    });
  }

  useEffect(() => {
    if (selectedChart) {
      setImageLoading(true);
    }
    handleResetZoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChart]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) handleZoomIn();
      else if (e.deltaY > 0) handleZoomOut();
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [containerRef, handleZoomIn, handleZoomOut]);

  const selectChart = (path: string) => {
    setSelectedChart(path);
    setMobileView('chart');
  };

  const selectedCredits = chartsToUse.find(
    (c) => c.path === selectedChart
  )?.credits;

  const hasNoResults =
    !!searchQuery &&
    filteredDepartureCharts.length === 0 &&
    filteredArrivalCharts.length === 0 &&
    sectorAirportsList.length === 0 &&
    filteredOtherAirports.length === 0;

  const searchField = (
    <div>
      <div className="relative">
        <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            isLegacyMode
              ? 'Search charts...'
              : 'Search charts by name, type, or airport...'
          }
          className={cn(panelInputClass, 'pl-10')}
        />
      </div>
      {searchQuery && matchedCategories.size > 0 && (
        <div className="mt-1.5 px-4 text-xs text-zinc-500">
          Filtered by: {Array.from(matchedCategories).join(', ')}
        </div>
      )}
    </div>
  );

  const allAirportsToggle = (
    <button
      type="button"
      onClick={() => setShowAllAirports(!showAllAirports)}
      aria-expanded={showAllAirports}
      className="flex w-full items-center gap-2 rounded-full px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
    >
      All Airports
      <ChevronDown
        className={cn(
          'ml-auto size-4 transition-transform',
          showAllAirports && 'rotate-180'
        )}
      />
    </button>
  );

  const emptyState = (message: string) => (
    <div className="py-12 text-center text-sm text-zinc-500">
      <Map className="mx-auto mb-3 h-10 w-10 opacity-30" />
      <p>{message}</p>
    </div>
  );

  const icaoLabel = (icao: string, count?: number) => (
    <div className="px-2.5 pt-2 pb-1 font-mono text-[11px] font-medium text-zinc-500">
      {icao}
      {count !== undefined && ` (${count})`}
    </div>
  );

  const chartSidebar = (
    <div className="p-3">
      {searchField}
      {departureAirport && filteredDepartureCharts.length > 0 && (
        <ChartListSection
          title={
            arrivalAirport
              ? `${departureAirport} · Departure`
              : departureAirport
          }
          charts={filteredDepartureCharts}
          selectedChart={selectedChart}
          onSelect={selectChart}
        />
      )}
      {arrivalAirport && filteredArrivalCharts.length > 0 && (
        <ChartListSection
          title={`${arrivalAirport} · Arrival`}
          charts={filteredArrivalCharts}
          selectedChart={selectedChart}
          onSelect={selectChart}
        />
      )}
      {sectorAirportsList.map(({ icao, charts }) => (
        <ChartListSection
          key={icao}
          title={`${icao} · Sector`}
          charts={charts}
          selectedChart={selectedChart}
          onSelect={selectChart}
        />
      ))}
      {filteredOtherAirports.length > 0 && (
        <div className="mt-3 border-t border-zinc-800 pt-3">
          {allAirportsToggle}
          {showAllAirports &&
            filteredOtherAirports.map(({ icao, charts }) => (
              <ChartListSection
                key={icao}
                title={icao}
                charts={charts}
                selectedChart={selectedChart}
                onSelect={selectChart}
              />
            ))}
        </div>
      )}
      {!departureAirport &&
        !arrivalAirport &&
        filteredOtherAirports.length === 0 &&
        emptyState('No flight information available')}
      {hasNoResults && emptyState('No charts match your search')}
    </div>
  );

  const chartViewer = !selectedChart ? (
    <div className="flex flex-1 items-center justify-center text-zinc-500">
      Select a chart from the list
    </div>
  ) : chartLoadError ? (
    <div className="flex flex-1 items-center justify-center text-zinc-500">
      Chart not available
    </div>
  ) : (
    <>
      <div
        ref={containerRef}
        className="flex w-full flex-1 items-center justify-center overflow-hidden p-4"
        onMouseDown={handleChartMouseDown}
        onMouseMove={isChartDragging ? handleChartMouseMove : undefined}
        onMouseUp={handleChartMouseUp}
        onMouseLeave={handleChartMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          cursor: isChartDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        )}
        <img
          key={selectedChart}
          src={selectedChart}
          alt="Airport Chart"
          className={`max-h-full max-w-full object-contain transition-opacity duration-200 select-none ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
          style={{
            transform: `translate(${chartPan.x}px, ${chartPan.y}px) scale(${chartZoom})`,
            transformOrigin: 'center',
            transition: isChartDragging ? 'none' : 'transform 0.1s ease-out',
            userSelect: 'none',
            pointerEvents: 'auto',
          }}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          onLoad={(e) => {
            setChartLoadError(false);
            setImageLoading(false);
            setImageSize({
              width: (e.target as HTMLImageElement).naturalWidth,
              height: (e.target as HTMLImageElement).naturalHeight,
            });
          }}
          onError={() => {
            setChartLoadError(true);
            setImageLoading(false);
          }}
        />
      </div>
      {selectedCredits && (
        <div className="absolute right-4 bottom-4 max-w-52 rounded-xl bg-zinc-800/80 p-2 text-center text-xs text-zinc-300 backdrop-blur-sm">
          Chart created by {selectedCredits}
        </div>
      )}
      <div className="absolute bottom-4 left-4 max-w-xs rounded-xl bg-zinc-800/80 p-2 text-center text-xs text-zinc-300 backdrop-blur-sm">
        Redistribution of this chart is prohibited.
      </div>
    </>
  );

  const chartGrid = (charts: ChartEntry[], accent: Accent) => (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {charts.map((chart) => (
        <ChartGridItem
          key={chart.path}
          chart={chart}
          accent={accent}
          onSelect={() => setSelectedChart(chart.path)}
        />
      ))}
    </div>
  );

  const showZoomControls =
    !!selectedChart && (!isLegacyMode || !isMobile || mobileView === 'chart');

  return (
    <div
      className={cn(
        'fixed right-0 bottom-0 left-0 flex h-[85vh] flex-col rounded-t-3xl border-t-2 border-blue-800 bg-zinc-900 text-white transition-transform duration-300',
        isOpen
          ? 'translate-y-0 shadow-2xl shadow-black/60'
          : 'pointer-events-none translate-y-full'
      )}
      style={{ zIndex: 48 }}
    >
      <PanelHeader
        icon={Map}
        title={<span className="hidden sm:inline">Airport Charts</span>}
        onClose={onClose}
        center={
          showZoomControls && (
            <>
              {!isLegacyMode && (
                <Button
                  onClick={() => setSelectedChart(null)}
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  aria-label="Back to chart list"
                >
                  <List className="h-4 w-4" />
                </Button>
              )}
              <Button
                onClick={handleZoomOut}
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleResetZoom}
                variant="outline"
                size="sm"
                className="h-9 min-w-16 px-3 py-0 tabular-nums"
                aria-label="Reset zoom"
              >
                {Math.round(chartZoom * 100)}%
              </Button>
              <Button
                onClick={handleZoomIn}
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </>
          )
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {isLegacyMode ? (
          isMobile ? (
            mobileView === 'sidebar' ? (
              <div className="flex-1 overflow-y-auto">{chartSidebar}</div>
            ) : (
              <div className="relative flex flex-1 flex-col bg-black">
                <Button
                  onClick={() => setMobileView('sidebar')}
                  variant="outline"
                  size="sm"
                  className="absolute top-4 left-4 z-10 gap-2 bg-zinc-900/80 backdrop-blur-sm"
                >
                  <List className="h-4 w-4" />
                  List
                </Button>
                {chartViewer}
              </div>
            )
          ) : (
            <>
              <div className="w-80 shrink-0 overflow-y-auto border-r border-zinc-800">
                {chartSidebar}
              </div>
              <div className="relative flex flex-1 flex-col bg-black">
                {chartViewer}
              </div>
            </>
          )
        ) : selectedChart ? (
          <div className="relative flex h-full flex-1 flex-col bg-black">
            {chartViewer}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mx-auto max-w-6xl space-y-5">
              <div className="sticky top-0 z-10 bg-zinc-900 pb-1">
                {searchField}
              </div>

              {chartsToUse.length > 0 ? (
                <>
                  {departureAirport && filteredDepartureCharts.length > 0 && (
                    <section>
                      <ChartGroupLabel
                        icon={PlaneTakeoff}
                        accent="green"
                        count={filteredDepartureCharts.length}
                      >
                        {arrivalAirport ? 'Departure' : 'Airport'} ·{' '}
                        {departureAirport}
                      </ChartGroupLabel>
                      {chartGrid(filteredDepartureCharts, 'green')}
                    </section>
                  )}

                  {arrivalAirport && filteredArrivalCharts.length > 0 && (
                    <section>
                      <ChartGroupLabel
                        icon={PlaneLanding}
                        accent="blue"
                        count={filteredArrivalCharts.length}
                      >
                        Arrival · {arrivalAirport}
                      </ChartGroupLabel>
                      {chartGrid(filteredArrivalCharts, 'blue')}
                    </section>
                  )}

                  {sectorAirportsList.length > 0 && (
                    <section>
                      <ChartGroupLabel icon={Map} accent="purple">
                        Sector Airports
                      </ChartGroupLabel>
                      <div className="space-y-2">
                        {sectorAirportsList.map(({ icao, charts }) => (
                          <div key={icao}>
                            {icaoLabel(icao, charts.length)}
                            {chartGrid(charts, 'purple')}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {filteredOtherAirports.length > 0 && (
                    <section>
                      {allAirportsToggle}
                      {showAllAirports && (
                        <div className="space-y-2">
                          {filteredOtherAirports.map(({ icao, charts }) => (
                            <div key={icao}>
                              {icaoLabel(icao, charts.length)}
                              {chartGrid(charts, 'gray')}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  {!departureAirport &&
                    !arrivalAirport &&
                    filteredOtherAirports.length === 0 &&
                    emptyState('No flight information available')}
                  {hasNoResults && emptyState('No charts match your search')}
                </>
              ) : (
                emptyState('No charts available for this airport')
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
