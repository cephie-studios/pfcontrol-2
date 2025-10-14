import { Map, ZoomIn, ZoomOut, Maximize, Minimize } from 'lucide-react';
import { getChartsForAirport } from '../../utils/acars';
import type { Flight } from '../../types/flight';

interface AcarsChartsProps {
    flight: Flight | null;
    selectedChart: string | null;
    chartZoom: number;
    chartPan: { x: number; y: number };
    isChartFullscreen: boolean;
    chartLoadError: boolean;
    chartListWidth: number;
    onSelectChart: (path: string) => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetZoom: () => void;
    onToggleFullscreen: () => void;
    onChartListMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: () => void;
    onChartMouseDown: (e: React.MouseEvent | React.TouchEvent) => void;
    onChartMouseMove: (e: React.MouseEvent | React.TouchEvent) => void;
    onChartMouseUp: (e?: React.MouseEvent | React.TouchEvent) => void;
    isChartDragging: boolean;
    chartContainerRef: React.RefObject<HTMLDivElement | null>;
    chartViewRef: React.RefObject<HTMLDivElement | null>;
    onMouseDown: (divider: 'terminal' | 'notes' | 'chartList') => void;
}

export default function AcarsCharts({
    flight,
    selectedChart,
    chartZoom,
    chartPan,
    isChartFullscreen,
    chartLoadError,
    chartListWidth,
    onSelectChart,
    onZoomIn,
    onZoomOut,
    onResetZoom,
    onToggleFullscreen,
    onMouseDown,
    onChartListMouseMove,
    onMouseUp,
    onChartMouseDown,
    onChartMouseMove,
    onChartMouseUp,
    chartContainerRef,
    chartViewRef,
    isChartDragging,
}: AcarsChartsProps) {
    return (
        <div
            ref={chartContainerRef}
            className={`bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 overflow-hidden h-full ${isChartFullscreen ? 'bg-black' : ''}`}
        >
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-3 border-b border-gray-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Map className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-mono text-gray-300">
                            Charts
                        </span>
                    </div>
                    {selectedChart && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={onZoomOut}
                                className="p-1 hover:bg-gray-700 rounded transition-colors"
                                title="Zoom Out"
                            >
                                <ZoomOut className="w-4 h-4 text-gray-400" />
                            </button>
                            <button
                                onClick={onResetZoom}
                                className="px-2 py-1 hover:bg-gray-700 rounded transition-colors text-[10px] text-gray-400 font-mono"
                                title="Reset Zoom"
                            >
                                {Math.round(chartZoom * 100)}%
                            </button>
                            <button
                                onClick={onZoomIn}
                                className="p-1 hover:bg-gray-700 rounded transition-colors"
                                title="Zoom In"
                            >
                                <ZoomIn className="w-4 h-4 text-gray-400" />
                            </button>
                            <button
                                onClick={onToggleFullscreen}
                                className="p-1 hover:bg-gray-700 rounded transition-colors ml-2"
                                title="Toggle Fullscreen"
                            >
                                {isChartFullscreen ? (
                                    <Minimize className="w-4 h-4 text-gray-400" />
                                ) : (
                                    <Maximize className="w-4 h-4 text-gray-400" />
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div
                className="flex"
                style={{
                    height: isChartFullscreen
                        ? 'calc(100vh - 60px)'
                        : 'calc(100vh - 200px)',
                }}
                onMouseMove={onChartListMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
            >
                <div
                    className="border-r border-gray-800 overflow-y-auto overflow-x-hidden p-3 flex-shrink-0"
                    style={{ width: `${chartListWidth}px` }}
                >
                    {flight && (
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-xs font-semibold text-cyan-400 mb-2 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                                    {flight.departure}
                                </h4>
                                <div className="space-y-1">
                                    {getChartsForAirport(
                                        flight.departure || ''
                                    ).map((chart, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() =>
                                                onSelectChart(chart.path)
                                            }
                                            className={`bg-gray-950 border rounded p-2 text-[10px] transition-colors cursor-pointer ${selectedChart === chart.path ? 'border-cyan-500 bg-cyan-950' : 'border-gray-800 hover:border-gray-700'}`}
                                        >
                                            <div className="text-gray-300 break-words">
                                                {chart.name}
                                            </div>
                                            <div className="text-[9px] text-gray-500 mt-0.5 break-words">
                                                {chart.type}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-xs font-semibold text-green-400 mb-2 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                                    {flight.arrival}
                                </h4>
                                <div className="space-y-1">
                                    {getChartsForAirport(
                                        flight.arrival || ''
                                    ).map((chart, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() =>
                                                onSelectChart(chart.path)
                                            }
                                            className={`bg-gray-950 border rounded p-2 text-[10px] transition-colors cursor-pointer ${selectedChart === chart.path ? 'border-green-500 bg-green-950' : 'border-gray-800 hover:border-gray-700'}`}
                                        >
                                            <div className="text-gray-300 break-words">
                                                {chart.name}
                                            </div>
                                            <div className="text-[9px] text-gray-500 mt-0.5 break-words">
                                                {chart.type}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {flight.alternate && (
                                <div>
                                    <h4 className="text-xs font-semibold text-yellow-400 mb-2 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                                        {flight.alternate}
                                    </h4>
                                    <div className="space-y-1">
                                        {getChartsForAirport(
                                            flight.alternate
                                        ).map((chart, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() =>
                                                    onSelectChart(chart.path)
                                                }
                                                className={`bg-gray-950 border rounded p-2 text-[10px] transition-colors cursor-pointer ${selectedChart === chart.path ? 'border-yellow-500 bg-yellow-950' : 'border-gray-800 hover:border-gray-700'}`}
                                            >
                                                <div className="text-gray-300 break-words">
                                                    {chart.name}
                                                </div>
                                                <div className="text-[9px] text-gray-500 mt-0.5 break-words">
                                                    {chart.type}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div
                    className="w-px bg-gray-800 hover:bg-gray-600 cursor-col-resize transition-colors flex-shrink-0"
                    onMouseDown={() => onMouseDown('chartList')}
                />
                <div
                    ref={chartViewRef}
                    className="flex-1 bg-black overflow-hidden relative"
                    onMouseDown={(e) => {
                        if (selectedChart && !chartLoadError) {
                            onChartMouseDown(e);
                        }
                    }}
                    onMouseMove={(e) => {
                        if (isChartDragging) {
                            onChartMouseMove(e);
                        }
                    }}
                    onMouseUp={(e) => {
                        if (isChartDragging) {
                            onChartMouseUp(e);
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (isChartDragging) {
                            onChartMouseUp(e);
                        }
                    }}
                    style={{
                        cursor: isChartDragging
                            ? 'grabbing'
                            : selectedChart && !chartLoadError
                              ? 'grab'
                              : 'default',
                    }}
                >
                    {selectedChart ? (
                        chartLoadError ? (
                            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                                Chart not available
                            </div>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center overflow-hidden">
                                <img
                                    key={selectedChart}
                                    src={selectedChart}
                                    alt="Airport Chart"
                                    className="max-w-none max-h-full"
                                    style={{
                                        transform: `translate(${chartPan.x}px, ${chartPan.y}px) scale(${chartZoom})`,
                                        transformOrigin: 'center',
                                        transition: isChartDragging
                                            ? 'none'
                                            : 'transform 0.1s ease-out',
                                        userSelect: 'none',
                                        pointerEvents: 'none',
                                    }}
                                    onLoad={() => {}}
                                    onError={() => {}}
                                    draggable={false}
                                />
                            </div>
                        )
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                            Select a chart to view
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
