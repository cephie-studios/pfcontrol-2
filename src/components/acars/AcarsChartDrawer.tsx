import { useState } from 'react';
import { Map, ZoomIn, ZoomOut, X, ArrowLeft, Plane, PlaneLanding, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import type { Airport } from '../../types/airports';
import type { Settings } from '../../types/settings';
import AirportDropdown from '../dropdowns/AirportDropdown';
import Button from '../common/Button';

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
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetZoom: () => void;
  getChartsForAirport: (
    icao: string
  ) => { name: string; path: string; type: string; credits?: string }[];
  containerRef: React.RefObject<HTMLDivElement>;
  setImageSize: (size: { width: number; height: number }) => void;
  airports: Airport[];
  settings: Settings | null;
  departureAirport?: string;
  arrivalAirport?: string;
}

export default function AcarsChartDrawer({
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
  handleZoomIn,
  handleZoomOut,
  handleResetZoom,
  getChartsForAirport,
  containerRef,
  setImageSize,
  settings,
  departureAirport,
  arrivalAirport,
}: ChartDrawerProps) {
  const [selectedAirport, setSelectedAirport] = useState<string>('');
  const [showAllAirports, setShowAllAirports] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  const charts = selectedAirport ? getChartsForAirport(selectedAirport) : [];
  const viewMode = settings?.acars?.chartDrawerViewMode || 'legacy';
  const isLegacyMode = viewMode === 'legacy';

  const departureCharts = departureAirport ? getChartsForAirport(departureAirport) : [];
  const arrivalCharts = arrivalAirport ? getChartsForAirport(arrivalAirport) : [];

  const availableAirports = ['EFKT', 'EGHI', 'EGKK', 'GCLP', 'LCLK', 'LCPH', 'LCRA', 'LEMH', 'MDAB', 'MDCR', 'MDPC', 'MDST', 'MTCA'];
  const otherAirports = availableAirports.filter(
    icao => icao !== departureAirport && icao !== arrivalAirport
  );

  const allChartsForLegacy = [
    ...departureCharts,
    ...arrivalCharts,
    ...otherAirports.flatMap(icao => getChartsForAirport(icao))
  ];

  const chartsToUse = isLegacyMode ? allChartsForLegacy : charts;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-zinc-900 text-white transition-transform duration-300 ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      } rounded-t-3xl border-t-2 border-blue-800 flex flex-col`}
      style={{ height: '85vh', zIndex: 100 }}
    >
      <div className="relative flex items-center py-4 px-6 border-b border-blue-800/50 rounded-t-3xl gap-4 bg-gradient-to-r from-zinc-800/80 via-zinc-800/60 to-zinc-900/80 backdrop-blur-sm shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <Map className="h-5 w-5 text-blue-400" />
          </div>
          <span className="font-semibold text-xl bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">
            Airport Charts
          </span>
        </div>
        <div
          className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-4"
          style={{ zIndex: 101 }}
        >
          {!isLegacyMode && (
            <AirportDropdown
              value={selectedAirport}
              onChange={(value) => {
                setSelectedAirport(value);
                setSelectedChart(null);
              }}
              size="sm"
            />
          )}
          {selectedChart && (
            <>
              {!isLegacyMode && (
                <Button
                  onClick={() => setSelectedChart(null)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to List
                </Button>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={handleZoomOut}
                  variant="outline"
                  size="sm"
                  className="p-2"
                >
                  <ZoomOut className="w-4 h-4 text-zinc-400" />
                </Button>
                <Button
                  onClick={handleResetZoom}
                  variant="outline"
                  size="sm"
                  className="px-3 py-2"
                >
                  {Math.round(chartZoom * 100)}%
                </Button>
                <Button
                  onClick={handleZoomIn}
                  variant="outline"
                  size="sm"
                  className="p-2"
                >
                  <ZoomIn className="w-4 h-4 text-zinc-400" />
                </Button>
              </div>
            </>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-red-500/20 hover:border-red-500/30 border border-zinc-700/50 transition-all ml-auto group"
        >
          <X className="h-5 w-5 text-zinc-400 group-hover:text-red-400 transition-colors" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {isLegacyMode ? (
          <>
            {/* Legacy Mode: Split View*/}
            <div className="w-80 border-r border-zinc-800 overflow-y-auto p-4">
              <div className="space-y-1">
                {/* Departure Airport Section */}
                {departureAirport && departureCharts.length > 0 && (
                  <div className="pb-3 border-b border-zinc-700/50">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <Plane className="w-3.5 h-3.5 text-green-400" />
                      <h3 className="text-xs font-semibold text-green-400 uppercase">
                        Departure - {departureAirport}
                      </h3>
                    </div>
                    <div className="space-y-1.5">
                      {departureCharts.map((chart) => (
                        <Button
                          size="sm"
                          variant="outline"
                          key={chart.path}
                          onClick={() => setSelectedChart(chart.path)}
                          className={`w-full text-left py-2 px-3 transition-colors flex flex-col items-start rounded-xl border-[0.5px] ${
                            selectedChart === chart.path
                              ? 'bg-green-600/20 border-green-500 text-green-200 hover:bg-green-800/70'
                              : 'bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 border-zinc-700 hover:bg-zinc-800/90 hover:border-zinc-600'
                          }`}
                        >
                          <span className="text-sm font-medium">{chart.name}</span>
                          <span className="text-xs text-zinc-400">{chart.type}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Arrival Airport Section */}
                {arrivalAirport && arrivalCharts.length > 0 && (
                  <div className="py-3 border-b border-zinc-700/50">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <PlaneLanding className="w-3.5 h-3.5 text-blue-400" />
                      <h3 className="text-xs font-semibold text-blue-400 uppercase">
                        Arrival - {arrivalAirport}
                      </h3>
                    </div>
                    <div className="space-y-1.5">
                      {arrivalCharts.map((chart) => (
                        <Button
                          size="sm"
                          variant="outline"
                          key={chart.path}
                          onClick={() => setSelectedChart(chart.path)}
                          className={`w-full text-left py-2 px-3 transition-colors flex flex-col items-start rounded-xl border-[0.5px] ${
                            selectedChart === chart.path
                              ? 'bg-green-600/20 border-green-500 text-green-200 hover:bg-green-800/70'
                              : 'bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 border-zinc-700 hover:bg-zinc-800/90 hover:border-zinc-600'
                          }`}
                        >
                          <span className="text-sm font-medium">{chart.name}</span>
                          <span className="text-xs text-zinc-400">{chart.type}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Other Airports Section */}
                {otherAirports.length > 0 && (
                  <div className="pt-3">
                    <button
                      onClick={() => setShowAllAirports(!showAllAirports)}
                      className="flex items-center justify-between w-full mb-2 px-1 py-1 hover:bg-zinc-800/50 rounded transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Map className="w-3.5 h-3.5 text-zinc-400" />
                        <h3 className="text-xs font-semibold text-zinc-400 uppercase">
                          All Airports
                        </h3>
                      </div>
                      {showAllAirports ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </button>
                    {showAllAirports && (
                      <div className="space-y-3">
                        {otherAirports.map((icao) => {
                          const airportCharts = getChartsForAirport(icao);
                          if (airportCharts.length === 0) return null;

                          return (
                            <div key={icao} className="space-y-1.5">
                              <div className="text-xs font-medium text-zinc-400 px-1">
                                {icao}
                              </div>
                              {airportCharts.map((chart) => (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  key={chart.path}
                                  onClick={() => setSelectedChart(chart.path)}
                                  className={`w-full text-left py-2 px-3 transition-colors flex flex-col items-start rounded-xl border-[0.5px] ${
                                    selectedChart === chart.path
                                      ? 'bg-green-600/20 border-green-500 text-green-200 hover:bg-green-800/70'
                                      : 'bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 border-zinc-700 hover:bg-zinc-800/90 hover:border-zinc-600'
                                  }`}
                                >
                                  <span className="text-sm font-medium">{chart.name}</span>
                                  <span className="text-xs text-zinc-400">{chart.type}</span>
                                </Button>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {!departureAirport && !arrivalAirport && (
                  <div className="text-center text-zinc-500 py-8">
                    No flight information available
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 relative bg-black flex flex-col">
              {!selectedChart ? (
                <div className="flex items-center justify-center flex-1 text-zinc-500">
                  Select a chart from the list
                </div>
              ) : chartLoadError ? (
                <div className="flex items-center justify-center flex-1 text-zinc-500">
                  Chart not available
                </div>
              ) : (
                <>
                  <div
                    ref={containerRef}
                    className="flex-1 w-full flex items-center justify-center overflow-hidden p-4"
                    onMouseDown={handleChartMouseDown}
                    onMouseMove={
                      isChartDragging ? handleChartMouseMove : undefined
                    }
                    onMouseUp={handleChartMouseUp}
                    onMouseLeave={handleChartMouseUp}
                    onWheel={(e) => {
                      e.preventDefault();
                      if (e.deltaY < 0) handleZoomIn();
                      else if (e.deltaY > 0) handleZoomOut();
                    }}
                    style={{ cursor: isChartDragging ? 'grabbing' : 'grab' }}
                  >
                    {imageLoading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                      </div>
                    )}
                    <img
                      key={selectedChart}
                      src={selectedChart}
                      alt="Airport Chart"
                      className={`object-contain select-none max-w-full max-h-full transition-opacity duration-200 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                      style={{
                        transform: `translate(${chartPan.x}px, ${chartPan.y}px) scale(${chartZoom})`,
                        transformOrigin: 'center',
                        transition: isChartDragging
                          ? 'none'
                          : 'transform 0.1s ease-out',
                        userSelect: 'none',
                        pointerEvents: 'auto',
                      }}
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      onLoadStart={() => setImageLoading(true)}
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
                  {chartsToUse.find((c) => c.path === selectedChart)?.credits && (
                    <div className="absolute bottom-4 right-4 bg-zinc-800/80 backdrop-blur-sm rounded-lg p-2 text-xs text-zinc-300 text-center max-w-52">
                      Chart created by{' '}
                      {chartsToUse.find((c) => c.path === selectedChart)?.credits}
                    </div>
                  )}
                  <div className="absolute bottom-4 left-4 bg-zinc-800/80 backdrop-blur-sm rounded-lg p-2 text-xs text-zinc-300 text-center max-w-xs">
                    Redistribution of this chart is prohibited.
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
        /* List Mode*/
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {!selectedChart ? (
              <div className="flex justify-center">
                <div className="w-full max-w-xs space-y-3">
                  {chartsToUse.length > 0 ? (
                    chartsToUse.map((chart) => (
                      <Button
                        size="sm"
                        variant="outline"
                        key={chart.path}
                        onClick={() => setSelectedChart(chart.path)}
                        className="w-full text-left py-4 transition-colors flex flex-col items-start"
                      >
                        <span className="text-sm">
                          {chart.name} ({chart.type})
                        </span>
                      </Button>
                    ))
                  ) : (
                    <div className="text-center text-zinc-500">
                      No charts available for this airport
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative flex-1 bg-black flex flex-col h-full">
                {chartLoadError ? (
                  <div className="flex items-center justify-center flex-1 text-zinc-500">
                    Chart not available
                  </div>
                ) : (
                  <>
                    <div
                      ref={containerRef}
                      className="flex-1 w-full flex items-center justify-center overflow-hidden p-4"
                      onMouseDown={handleChartMouseDown}
                      onMouseMove={
                        isChartDragging ? handleChartMouseMove : undefined
                      }
                      onMouseUp={handleChartMouseUp}
                      onMouseLeave={handleChartMouseUp}
                      onWheel={(e) => {
                        e.preventDefault();
                        if (e.deltaY < 0) handleZoomIn();
                        else if (e.deltaY > 0) handleZoomOut();
                      }}
                      style={{ cursor: isChartDragging ? 'grabbing' : 'grab' }}
                    >
                      {imageLoading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                        </div>
                      )}
                      <img
                        key={selectedChart}
                        src={selectedChart}
                        alt="Airport Chart"
                        className={`object-contain select-none max-w-full max-h-full transition-opacity duration-200 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                        style={{
                          transform: `translate(${chartPan.x}px, ${chartPan.y}px) scale(${chartZoom})`,
                          transformOrigin: 'center',
                          transition: isChartDragging
                            ? 'none'
                            : 'transform 0.1s ease-out',
                          userSelect: 'none',
                          pointerEvents: 'auto',
                        }}
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                        onLoadStart={() => setImageLoading(true)}
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
                    {chartsToUse.find((c) => c.path === selectedChart)?.credits && (
                      <div className="absolute bottom-4 right-4 bg-zinc-800/80 backdrop-blur-sm rounded-lg p-2 text-xs text-zinc-300 text-center max-w-52">
                        Chart created by{' '}
                        {chartsToUse.find((c) => c.path === selectedChart)?.credits}
                      </div>
                    )}
                    <div className="absolute bottom-4 left-4 bg-zinc-800/80 backdrop-blur-sm rounded-lg p-2 text-xs text-zinc-300 text-center max-w-xs">
                      Redistribution of this chart is prohibited.
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
