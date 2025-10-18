import { useState } from 'react';
import { Map, ZoomIn, ZoomOut, X, ArrowLeft } from 'lucide-react';
import type { Airport } from '../../types/airports';
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
}: ChartDrawerProps) {
  const [selectedAirport, setSelectedAirport] = useState<string>('');

  const charts = selectedAirport ? getChartsForAirport(selectedAirport) : [];

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-zinc-900 text-white transition-transform duration-300 ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      } rounded-t-3xl border-t-2 border-blue-800 flex flex-col`}
      style={{ height: '80vh', zIndex: 100 }}
    >
      <div className="relative flex items-center py-3 p-5 border-b border-blue-800 rounded-t-3xl gap-4">
        <div className="flex items-center gap-3">
          <Map className="h-6 w-6 text-blue-500" />
          <span className="font-medium text-xl text-blue-500">
            Airport Charts
          </span>
        </div>
        <div
          className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-4"
          style={{ zIndex: 101 }}
        >
          <AirportDropdown
            value={selectedAirport}
            onChange={(value) => {
              setSelectedAirport(value);
              setSelectedChart(null);
            }}
            size="sm"
          />
          {selectedChart && (
            <>
              <Button
                onClick={() => setSelectedChart(null)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to List
              </Button>
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
          className="p-1 rounded-full hover:bg-zinc-700 ml-auto"
        >
          <X className="h-5 w-5 text-zinc-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {!selectedChart ? (
          <div className="flex justify-center">
            <div className="w-full max-w-xs space-y-3">
              {charts.length > 0 ? (
                charts.map((chart) => (
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
                  <img
                    key={selectedChart}
                    src={selectedChart}
                    alt="Airport Chart"
                    className="object-contain select-none max-w-full max-h-full"
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
                    onLoad={(e) => {
                      setChartLoadError(false);
                      setImageSize({
                        width: (e.target as HTMLImageElement).naturalWidth,
                        height: (e.target as HTMLImageElement).naturalHeight,
                      });
                    }}
                    onError={() => setChartLoadError(true)}
                  />
                </div>
                {charts.find((c) => c.path === selectedChart)?.credits && (
                  <div className="absolute bottom-4 right-4 bg-zinc-800/80 backdrop-blur-sm rounded-lg p-2 text-xs text-zinc-300 text-center max-w-52">
                    Chart created by{' '}
                    {charts.find((c) => c.path === selectedChart)?.credits}
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
    </div>
  );
}
