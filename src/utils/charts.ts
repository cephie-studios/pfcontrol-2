export const createChartHandlers = (
  chartZoom: number,
  setChartZoom: React.Dispatch<React.SetStateAction<number>>,
  chartPan: { x: number; y: number },
  setChartPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>,
  isChartDragging: boolean,
  setIsChartDragging: React.Dispatch<React.SetStateAction<boolean>>,
  chartDragStart: { x: number; y: number },
  setChartDragStart: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>,
  containerRef: React.RefObject<HTMLDivElement>,
  imageSize: { width: number; height: number }
) => {
  const handleZoomIn = () => setChartZoom((prev) => Math.min(5, prev + 0.25));
  const handleZoomOut = () =>
    setChartZoom((prev) => Math.max(0.5, prev - 0.25));
  const handleResetZoom = () => {
    setChartZoom(1);
    setChartPan({ x: 0, y: 0 });
  };

  const handleChartMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsChartDragging(true);
    setChartDragStart({
      x: e.clientX - chartPan.x,
      y: e.clientY - chartPan.y,
    });
  };

  const handleChartMouseMove = (e: React.MouseEvent) => {
    if (
      !isChartDragging ||
      !containerRef.current ||
      imageSize.width === 0 ||
      imageSize.height === 0
    )
      return;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;
    const scaledWidth = imageSize.width * chartZoom;
    const scaledHeight = imageSize.height * chartZoom;
    const maxPanX = Math.max(0, (scaledWidth - containerWidth) / 2);
    const maxPanY = Math.max(0, (scaledHeight - containerHeight) / 2);
    const newX = e.clientX - chartDragStart.x;
    const newY = e.clientY - chartDragStart.y;
    setChartPan({
      x: Math.max(-maxPanX, Math.min(maxPanX, newX)),
      y: Math.max(-maxPanY, Math.min(maxPanY, newY)),
    });
  };

  const handleChartMouseUp = () => {
    setIsChartDragging(false);
  };

  return {
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleChartMouseDown,
    handleChartMouseMove,
    handleChartMouseUp,
  };
};