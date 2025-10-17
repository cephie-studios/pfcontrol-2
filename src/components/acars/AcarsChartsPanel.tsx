import { Map, ZoomIn, ZoomOut } from 'lucide-react';
import type { Flight } from '../../types/flight';

interface ChartsPanelProps {
  flight: Flight;
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
  ) => { name: string; path: string; type: string }[];
  containerRef: React.RefObject<HTMLDivElement>;
  setImageSize: (size: { width: number; height: number }) => void;
}

export default function ChartsPanel({
  flight,
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
}: ChartsPanelProps) {
  if (!flight) return null;
  const charts = getChartsForAirport(flight.departure || '');

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden h-full flex flex-col">
        <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 px-4 h-12 flex items-center flex-shrink-0 border-b border-zinc-700 overflow-hidden">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Map className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-mono text-zinc-300 truncate">
                Charts
              </span>
            </div>
            {selectedChart && (
              <div className="flex gap-2">
                <button onClick={handleZoomOut} title="Zoom Out">
                  <ZoomOut className="w-4 h-4 text-zinc-400" />
                </button>
                <button onClick={handleResetZoom} title="Reset Zoom">
                  {Math.round(chartZoom * 100)}%
                </button>
                <button onClick={handleZoomIn} title="Zoom In">
                  <ZoomIn className="w-4 h-4 text-zinc-400" />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          {!selectedChart ? (
            <div className="p-3 space-y-4">
              {charts.map((chart) => (
                <div
                  key={chart.path}
                  className="cursor-pointer hover:bg-zinc-800 p-2 rounded-lg transition-colors border border-zinc-800 hover:border-zinc-700"
                  onClick={() => setSelectedChart(chart.path)}
                >
                  <span className="text-xs text-zinc-300">{chart.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="relative flex-1 min-h-0 bg-black flex flex-col">
              <button
                onClick={() => setSelectedChart(null)}
                className="absolute top-2 left-2 z-10 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 px-3 py-1 rounded text-[10px] font-mono"
              >
                ← Back to List
              </button>
              {chartLoadError ? (
                <div className="flex items-center justify-center flex-1 text-zinc-500 text-xs">
                  Chart not available
                </div>
              ) : (
                <div
                  ref={containerRef}
                  className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden"
                  onMouseDown={handleChartMouseDown}
                  onMouseMove={
                    isChartDragging ? handleChartMouseMove : undefined
                  }
                  onMouseUp={handleChartMouseUp}
                  onMouseLeave={handleChartMouseUp}
                  onWheel={(e) => {
                    e.preventDefault();
                    if (e.deltaY < 0) {
                      handleZoomIn();
                    } else if (e.deltaY > 0) {
                      handleZoomOut();
                    }
                  }}
                  style={{
                    cursor: isChartDragging ? 'grabbing' : 'grab',
                  }}
                >
                  <img
                    key={selectedChart}
                    src={selectedChart}
                    alt="Airport Chart"
                    className="object-contain select-none"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
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
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
