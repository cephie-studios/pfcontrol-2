import { useEffect, useMemo, useRef, useState } from 'react';
import ChartDrawer from '../tools/ChartDrawer';
import { createChartHandlers } from '../../utils/charts';
import { getChartsForAirport } from '../../utils/acars';
import type { Airport } from '../../types/airports';
import type { Settings } from '../../types/settings';

export default function AcarsCharts({
  open,
  onClose,
  airports,
  settings,
  departure,
  arrival,
}: {
  open: boolean;
  onClose: () => void;
  airports: Airport[];
  settings: Settings | null;
  departure?: string;
  arrival?: string;
}) {
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const [chartLoadError, setChartLoadError] = useState(false);
  const [chartZoom, setChartZoom] = useState(1);
  const [chartPan, setChartPan] = useState({ x: 0, y: 0 });
  const [isChartDragging, setIsChartDragging] = useState(false);
  const [chartDragStart, setChartDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChartZoom(1);
    setChartPan({ x: 0, y: 0 });
  }, [selectedChart]);

  const handlers = useMemo(
    () =>
      createChartHandlers(
        chartZoom,
        setChartZoom,
        chartPan,
        setChartPan,
        isChartDragging,
        setIsChartDragging,
        chartDragStart,
        setChartDragStart,
        containerRef as React.RefObject<HTMLDivElement>,
        imageSize
      ),
    [chartZoom, chartPan, isChartDragging, chartDragStart, imageSize]
  );

  return (
    <ChartDrawer
      isOpen={open}
      onClose={onClose}
      selectedChart={selectedChart}
      setSelectedChart={setSelectedChart}
      chartLoadError={chartLoadError}
      setChartLoadError={setChartLoadError}
      chartZoom={chartZoom}
      chartPan={chartPan}
      isChartDragging={isChartDragging}
      handleChartMouseDown={handlers.handleChartMouseDown}
      handleChartMouseMove={handlers.handleChartMouseMove}
      handleChartMouseUp={handlers.handleChartMouseUp}
      handleTouchStart={handlers.handleTouchStart}
      handleTouchMove={handlers.handleTouchMove}
      handleTouchEnd={handlers.handleTouchEnd}
      handleZoomIn={handlers.handleZoomIn}
      handleZoomOut={handlers.handleZoomOut}
      handleResetZoom={handlers.handleResetZoom}
      getChartsForAirport={getChartsForAirport}
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      setImageSize={setImageSize}
      airports={airports}
      settings={settings}
      departureAirport={departure}
      arrivalAirport={arrival}
    />
  );
}
