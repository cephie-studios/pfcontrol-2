let lastTouchDistance: number | null = null;
let lastTouchCenter: { x: number; y: number } | null = null;
let initialZoom: number = 1;
let initialPan: { x: number; y: number } = { x: 0, y: 0 };

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

  // Touch event handlers for mobile
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return null;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length < 2) return null;
    const x = (touches[0].clientX + touches[1].clientX) / 2;
    const y = (touches[0].clientY + touches[1].clientY) / 2;
    return { x, y };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Check if touch started on a button or interactive element
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return; // Let the button handle the touch
    }

    if (e.touches.length === 1) {
      // Single touch - start panning
      setIsChartDragging(true);
      setChartDragStart({
        x: e.touches[0].clientX - chartPan.x,
        y: e.touches[0].clientY - chartPan.y,
      });
      lastTouchDistance = null;
      lastTouchCenter = null;
    } else if (e.touches.length === 2) {
      // Two touches - initialize pinch zoom
      setIsChartDragging(false);
      lastTouchDistance = getTouchDistance(e.touches);
      lastTouchCenter = getTouchCenter(e.touches);
      initialZoom = chartZoom;
      initialPan = { ...chartPan };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Only prevent default when actively panning or zooming, not on simple taps
    if (e.touches.length >= 1 && (isChartDragging || e.touches.length === 2)) {
      e.preventDefault(); // Prevent scrolling
    }

    if (e.touches.length === 1 && isChartDragging) {
      // Single touch - pan
      if (!containerRef.current || imageSize.width === 0 || imageSize.height === 0) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const containerWidth = rect.width;
      const containerHeight = rect.height;
      const scaledWidth = imageSize.width * chartZoom;
      const scaledHeight = imageSize.height * chartZoom;
      const maxPanX = Math.max(0, (scaledWidth - containerWidth) / 2);
      const maxPanY = Math.max(0, (scaledHeight - containerHeight) / 2);

      const newX = e.touches[0].clientX - chartDragStart.x;
      const newY = e.touches[0].clientY - chartDragStart.y;

      setChartPan({
        x: Math.max(-maxPanX, Math.min(maxPanX, newX)),
        y: Math.max(-maxPanY, Math.min(maxPanY, newY)),
      });
    } else if (e.touches.length === 2 && lastTouchDistance && lastTouchCenter) {
      // Two touches - pinch zoom with center point anchoring
      const currentDistance = getTouchDistance(e.touches);
      const currentCenter = getTouchCenter(e.touches);

      if (!currentDistance || !currentCenter) return;

      // Calculate zoom scale
      const scale = currentDistance / lastTouchDistance;
      const newZoom = Math.max(0.5, Math.min(5, initialZoom * scale));

      // Calculate pan adjustment to keep zoom centered
      const deltaX = currentCenter.x - lastTouchCenter.x;
      const deltaY = currentCenter.y - lastTouchCenter.y;

      if (!containerRef.current || imageSize.width === 0 || imageSize.height === 0) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const containerWidth = rect.width;
      const containerHeight = rect.height;
      const scaledWidth = imageSize.width * newZoom;
      const scaledHeight = imageSize.height * newZoom;
      const maxPanX = Math.max(0, (scaledWidth - containerWidth) / 2);
      const maxPanY = Math.max(0, (scaledHeight - containerHeight) / 2);

      const newPanX = initialPan.x + deltaX;
      const newPanY = initialPan.y + deltaY;

      setChartZoom(newZoom);
      setChartPan({
        x: Math.max(-maxPanX, Math.min(maxPanX, newPanX)),
        y: Math.max(-maxPanY, Math.min(maxPanY, newPanY)),
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      // All touches ended
      setIsChartDragging(false);
      lastTouchDistance = null;
      lastTouchCenter = null;
    } else if (e.touches.length === 1) {
      // One touch remaining after pinch - reset for panning
      lastTouchDistance = null;
      lastTouchCenter = null;
      setIsChartDragging(true);
      setChartDragStart({
        x: e.touches[0].clientX - chartPan.x,
        y: e.touches[0].clientY - chartPan.y,
      });
    }
  };

  return {
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleChartMouseDown,
    handleChartMouseMove,
    handleChartMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
};