import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileWarning,
  Link2,
  Loader2,
  Moon,
  RefreshCw,
  RotateCw,
  Sun,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { SIGNATURE_TONES } from '@/lib/signatureTones';
import {
  fetchChartfoxChart,
  fetchChartfoxFile,
  type ChartfoxChartDetail,
} from '../../utils/fetch/charts';
import {
  CATEGORY_LABELS,
  CHARTFOX_LOGO_URL,
  type ChartEntry,
} from '../../utils/chartCatalog';
import { openPdf, type OpenedPdf, type PDFDocumentProxy } from './pdf';

type ChartDocument =
  | { kind: 'image'; url: string; width: number; height: number }
  | { kind: 'pdf'; pdf: PDFDocumentProxy };

type LoadError = 'unavailable' | 'unlinked';

interface View {
  zoom: number;
  x: number;
  y: number;
  animate: boolean;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.4;
const FIT_MARGIN = 0.94;
const MAX_CANVAS_SIDE = 8192;
const MAX_CANVAS_PIXELS = 40_000_000;
const INVERT_KEY = 'pfcontrol.charts.invert';
const RESET_VIEW: View = { zoom: 1, x: 0, y: 0, animate: false };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function loadImage(url: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });
}

function readInvert() {
  try {
    return localStorage.getItem(INVERT_KEY) === '1';
  } catch {
    return false;
  }
}

function renderBucket(zoom: number) {
  if (zoom <= 1.25) return 1;
  if (zoom <= 2.5) return 2;
  if (zoom <= 5) return 4;
  return 8;
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  pressed,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'cursor-pointer rounded-full text-zinc-300 hover:bg-zinc-800 hover:text-white dark:hover:bg-zinc-800',
            pressed && 'text-blue-400 hover:text-blue-300'
          )}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="shadcn-scope" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

interface ChartViewerProps {
  chart: ChartEntry;
  active: boolean;
  onBack?: () => void;
  backLabel?: string;
  onReconnect?: () => void;
}

export default function ChartViewer({
  chart,
  active,
  onBack,
  backLabel = 'Back to charts',
  onReconnect,
}: ChartViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [chartDoc, setChartDoc] = useState<ChartDocument | null>(null);
  const [error, setError] = useState<LoadError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [detail, setDetail] = useState<ChartfoxChartDetail | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(
    null
  );
  const [canvasReady, setCanvasReady] = useState(false);
  const [container, setContainer] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>(RESET_VIEW);
  const [rotation, setRotation] = useState(0);
  const [inverted, setInverted] = useState(readInvert);
  const [dragging, setDragging] = useState(false);

  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    let opened: OpenedPdf | null = null;
    const controller = new AbortController();

    const load = async () => {
      if (chart.imageUrl) {
        const size = await loadImage(chart.imageUrl);
        if (!cancelled) {
          setChartDoc({ kind: 'image', url: chart.imageUrl, ...size });
        }
        return;
      }
      if (!chart.chartfoxId) throw new Error('Chart has no file');

      fetchChartfoxChart(chart.chartfoxId).then((result) => {
        if (!cancelled && result.status === 'ok') setDetail(result.data);
      });

      const file = await fetchChartfoxFile(chart.chartfoxId, controller.signal);
      if (cancelled) return;
      if (file.status === 'unlinked') {
        setError('unlinked');
        return;
      }
      if (file.status !== 'ok') throw new Error('Chart file unavailable');

      if (file.data.type === 'application/pdf') {
        opened = await openPdf(await file.data.arrayBuffer());
        if (cancelled) {
          opened.destroy();
          return;
        }
        setChartDoc({ kind: 'pdf', pdf: opened.pdf });
        return;
      }

      objectUrl = URL.createObjectURL(file.data);
      const size = await loadImage(objectUrl);
      if (!cancelled) setChartDoc({ kind: 'image', url: objectUrl, ...size });
    };

    load().catch((e) => {
      if (cancelled || (e as Error)?.name === 'AbortError') return;
      console.error('Failed to load chart:', e);
      setError('unavailable');
    });

    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      opened?.destroy();
    };
  }, [chart.imageUrl, chart.chartfoxId, attempt]);

  useEffect(() => {
    if (chartDoc?.kind !== 'pdf') return;
    let cancelled = false;
    chartDoc.pdf.getPage(page).then((p) => {
      if (cancelled) return;
      const viewport = p.getViewport({ scale: 1 });
      setPageSize({ w: viewport.width, h: viewport.height });
    });
    return () => {
      cancelled = true;
    };
  }, [chartDoc, page]);

  const goToPage = (next: number) => {
    setPage(next);
    setPageSize(null);
    setCanvasReady(false);
    setView(RESET_VIEW);
  };

  const retry = () => {
    setError(null);
    setChartDoc(null);
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainer({
        w: entry.contentRect.width,
        h: entry.contentRect.height,
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const base =
    chartDoc?.kind === 'image'
      ? { w: chartDoc.width, h: chartDoc.height }
      : pageSize;
  const sideways = rotation % 180 !== 0;
  const rotated = base
    ? sideways
      ? { w: base.h, h: base.w }
      : { w: base.w, h: base.h }
    : null;
  const fit =
    rotated && container.w && container.h
      ? Math.min(
          (container.w * FIT_MARGIN) / rotated.w,
          (container.h * FIT_MARGIN) / rotated.h
        )
      : 0;

  const metricsRef = useRef({ cw: 0, ch: 0, rw: 0, rh: 0 });
  metricsRef.current = {
    cw: container.w,
    ch: container.h,
    rw: rotated ? rotated.w * fit : 0,
    rh: rotated ? rotated.h * fit : 0,
  };

  const clampView = useCallback((next: View): View => {
    const { cw, ch, rw, rh } = metricsRef.current;
    const zoom = clamp(next.zoom, MIN_ZOOM, MAX_ZOOM);
    const overflowX = (rw * zoom - cw) / 2;
    const overflowY = (rh * zoom - ch) / 2;
    const maxX = overflowX > 0 ? overflowX + 32 : 0;
    const maxY = overflowY > 0 ? overflowY + 32 : 0;
    return {
      zoom,
      x: clamp(next.x, -maxX, maxX),
      y: clamp(next.y, -maxY, maxY),
      animate: next.animate,
    };
  }, []);

  const zoomAt = useCallback(
    (factor: number, px = 0, py = 0, animate = true) => {
      setView((v) => {
        const zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
        const ratio = zoom / v.zoom;
        return clampView({
          zoom,
          x: px - (px - v.x) * ratio,
          y: py - (py - v.y) * ratio,
          animate,
        });
      });
    },
    [clampView]
  );

  const resetView = useCallback(
    () => setView({ ...RESET_VIEW, animate: true }),
    []
  );

  const rotate = useCallback(() => {
    setRotation((r) => (r + 90) % 360);
    setView(RESET_VIEW);
  }, []);

  const toggleInvert = useCallback(() => {
    setInverted((value) => {
      try {
        localStorage.setItem(INVERT_KEY, value ? '0' : '1');
      } catch {
        // Storage can be unavailable in private mode.
      }
      return !value;
    });
  }, []);

  const pointFromEvent = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: clientX - rect.left - rect.width / 2,
      y: clientY - rect.top - rect.height / 2,
    };
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      const rect = el.getBoundingClientRect();
      zoomAt(
        Math.exp(-delta * 0.002),
        e.clientX - rect.left - rect.width / 2,
        e.clientY - rect.top - rect.height / 2,
        false
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    view: View;
    start: { x: number; y: number };
    distance: number;
  } | null>(null);

  const beginGesture = () => {
    const points = [...pointers.current.values()];
    if (points.length === 0) {
      gesture.current = null;
      return;
    }
    const mid =
      points.length === 1
        ? points[0]
        : {
            x: (points[0].x + points[1].x) / 2,
            y: (points[0].y + points[1].y) / 2,
          };
    gesture.current = {
      view: viewRef.current,
      start: pointFromEvent(mid.x, mid.y),
      distance:
        points.length > 1
          ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
          : 0,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    beginGesture();
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const points = [...pointers.current.values()];
    const g = gesture.current;

    if (points.length === 1) {
      const p = pointFromEvent(points[0].x, points[0].y);
      setView(
        clampView({
          ...g.view,
          x: g.view.x + p.x - g.start.x,
          y: g.view.y + p.y - g.start.y,
          animate: false,
        })
      );
      return;
    }

    const distance = Math.hypot(
      points[0].x - points[1].x,
      points[0].y - points[1].y
    );
    const mid = pointFromEvent(
      (points[0].x + points[1].x) / 2,
      (points[0].y + points[1].y) / 2
    );
    const zoom = clamp(
      g.view.zoom * (distance / (g.distance || distance)),
      MIN_ZOOM,
      MAX_ZOOM
    );
    const ratio = zoom / g.view.zoom;
    setView(
      clampView({
        zoom,
        x: mid.x - (g.start.x - g.view.x) * ratio,
        y: mid.y - (g.start.y - g.view.y) * ratio,
        animate: false,
      })
    );
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    beginGesture();
    if (pointers.current.size === 0) setDragging(false);
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (viewRef.current.zoom > 1.05) {
      resetView();
      return;
    }
    const p = pointFromEvent(e.clientX, e.clientY);
    zoomAt(2.5, p.x, p.y);
  };

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        target?.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }
      if (e.key === '+' || e.key === '=') zoomAt(ZOOM_STEP);
      else if (e.key === '-' || e.key === '_') zoomAt(1 / ZOOM_STEP);
      else if (e.key === '0') resetView();
      else if (e.key === 'r' || e.key === 'R') rotate();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, zoomAt, resetView, rotate]);

  const bucket = renderBucket(view.zoom);
  const roundedFit = Math.round(fit * 1000) / 1000;

  useEffect(() => {
    if (chartDoc?.kind !== 'pdf' || !pageSize || !roundedFit) return;
    let cancelled = false;
    let task: ReturnType<
      Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']
    > | null = null;

    chartDoc.pdf
      .getPage(page)
      .then(async (p) => {
        if (cancelled) return;
        const dpr = window.devicePixelRatio || 1;
        let scale = roundedFit * dpr * bucket;
        scale = Math.min(
          scale,
          MAX_CANVAS_SIDE / pageSize.w,
          MAX_CANVAS_SIDE / pageSize.h,
          Math.sqrt(MAX_CANVAS_PIXELS / (pageSize.w * pageSize.h))
        );
        const viewport = p.getViewport({ scale });
        const offscreen = document.createElement('canvas');
        offscreen.width = Math.floor(viewport.width);
        offscreen.height = Math.floor(viewport.height);
        task = p.render({ canvas: offscreen, viewport });
        await task.promise;
        const target = canvasRef.current;
        if (cancelled || !target) return;
        target.width = offscreen.width;
        target.height = offscreen.height;
        target.getContext('2d')?.drawImage(offscreen, 0, 0);
        setCanvasReady(true);
      })
      .catch((e) => {
        if (cancelled || (e as Error)?.name === 'RenderingCancelledException')
          return;
        console.error('Failed to render chart page:', e);
        setError('unavailable');
      });

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [chartDoc, page, pageSize, roundedFit, bucket]);

  const pageCount = chartDoc?.kind === 'pdf' ? chartDoc.pdf.numPages : 1;
  const ready =
    !!base &&
    fit > 0 &&
    (chartDoc?.kind === 'image' || (chartDoc?.kind === 'pdf' && canvasReady));
  const loading = !error && !ready;

  const subtitle = [
    chart.airport,
    CATEGORY_LABELS[chart.category],
    chart.code,
    chart.runways.length ? `RWY ${chart.runways.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const viewUrl = detail?.viewUrl ?? chart.viewUrl;
  const isChartfox = chart.source === 'chartfox';
  const copyright = isChartfox
    ? (detail?.source.copyright ?? detail?.source.name ?? null)
    : chart.credits;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-950">
      <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {onBack && (
            <ToolbarButton
              icon={ArrowLeft}
              label={backLabel}
              onClick={onBack}
            />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {chart.name}
            </p>
            <p className="truncate text-xs text-zinc-400">{subtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {pageCount > 1 && (
            <>
              <ToolbarButton
                icon={ChevronLeft}
                label="Previous page"
                onClick={() => goToPage(Math.max(1, page - 1))}
                disabled={page <= 1}
              />
              <span className="min-w-12 text-center text-xs text-zinc-300 tabular-nums">
                {page} / {pageCount}
              </span>
              <ToolbarButton
                icon={ChevronRight}
                label="Next page"
                onClick={() => goToPage(Math.min(pageCount, page + 1))}
                disabled={page >= pageCount}
              />
              <span aria-hidden className="mx-1 h-5 w-px bg-zinc-800" />
            </>
          )}
          <ToolbarButton
            icon={ZoomOut}
            label="Zoom out (−)"
            onClick={() => zoomAt(1 / ZOOM_STEP)}
            disabled={!ready || view.zoom <= MIN_ZOOM}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={resetView}
                disabled={!ready}
                aria-label="Fit to screen"
                className="h-8 min-w-14 cursor-pointer rounded-full px-2 text-xs font-medium text-zinc-300 tabular-nums transition-colors outline-none hover:bg-zinc-800 hover:text-white focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-50"
              >
                {Math.round(view.zoom * 100)}%
              </button>
            </TooltipTrigger>
            <TooltipContent className="shadcn-scope" sideOffset={6}>
              Fit to screen (0)
            </TooltipContent>
          </Tooltip>
          <ToolbarButton
            icon={ZoomIn}
            label="Zoom in (+)"
            onClick={() => zoomAt(ZOOM_STEP)}
            disabled={!ready || view.zoom >= MAX_ZOOM}
          />
          <span aria-hidden className="mx-1 h-5 w-px bg-zinc-800" />
          <ToolbarButton
            icon={RotateCw}
            label="Rotate (R)"
            onClick={rotate}
            disabled={!ready}
          />
          <ToolbarButton
            icon={inverted ? Sun : Moon}
            label={inverted ? 'Show original colours' : 'Night mode'}
            onClick={toggleInvert}
            pressed={inverted}
          />
          {isChartfox && viewUrl && (
            <ToolbarButton
              icon={ExternalLink}
              label="Open in ChartFox"
              onClick={() =>
                window.open(viewUrl, '_blank', 'noopener,noreferrer')
              }
            />
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className={cn(
          'relative min-h-0 flex-1 touch-none overflow-hidden select-none',
          ready && (dragging ? 'cursor-grabbing' : 'cursor-grab')
        )}
        onPointerDown={ready ? onPointerDown : undefined}
        onPointerMove={ready ? onPointerMove : undefined}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onDoubleClick={ready ? onDoubleClick : undefined}
      >
        {base && fit > 0 && (
          <div
            className={cn(
              'absolute top-1/2 left-1/2 shadow-2xl shadow-black/60 transition-opacity duration-200',
              ready ? 'opacity-100' : 'opacity-0'
            )}
            style={{
              width: base.w * fit,
              height: base.h * fit,
              transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) rotate(${rotation}deg) scale(${view.zoom})`,
              transition: view.animate
                ? 'transform 160ms ease-out, opacity 200ms'
                : 'opacity 200ms',
            }}
          >
            <div
              className="size-full bg-white"
              style={{
                filter: inverted
                  ? 'invert(0.92) hue-rotate(180deg)'
                  : undefined,
              }}
            >
              {chartDoc?.kind === 'image' ? (
                <img
                  src={chartDoc.url}
                  alt={chart.name}
                  draggable={false}
                  className="size-full"
                />
              ) : (
                <canvas ref={canvasRef} className="size-full" />
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-zinc-400">
            <Loader2 className="size-8 animate-spin text-blue-400" />
            {isChartfox && <span>Loading chart from ChartFox…</span>}
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-sm space-y-4 text-center">
              <FileWarning className="mx-auto size-10 text-zinc-500" />
              <div className="space-y-1">
                <p className="font-medium text-white">
                  {error === 'unlinked'
                    ? 'Your ChartFox connection has expired'
                    : 'This chart could not be loaded'}
                </p>
                <p className="text-sm text-zinc-400">
                  {error === 'unlinked'
                    ? 'Reconnect ChartFox to keep viewing real-world charts.'
                    : detail?.requiresPreauth
                      ? 'The publisher requires accepting their terms on ChartFox before viewing this chart.'
                      : isChartfox
                        ? 'The publisher may not allow it to be shown here. You can still open it on ChartFox.'
                        : 'The chart file is missing or unreachable.'}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {error === 'unlinked' && onReconnect ? (
                  <Button
                    variant="ghost"
                    onClick={onReconnect}
                    className={cn('cursor-pointer', SIGNATURE_TONES.blue)}
                  >
                    <Link2 />
                    Reconnect ChartFox
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={retry}
                    className={cn('cursor-pointer', SIGNATURE_TONES.blue)}
                  >
                    <RefreshCw />
                    Try again
                  </Button>
                )}
                {isChartfox && viewUrl && error !== 'unlinked' && (
                  <Button
                    variant="ghost"
                    asChild
                    className={cn('cursor-pointer', SIGNATURE_TONES.blue)}
                  >
                    <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink />
                      Open in ChartFox
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-zinc-800 bg-zinc-900 px-4 py-2 text-xs text-zinc-400">
        <p className="min-w-0 truncate">
          {isChartfox ? (
            <>
              {copyright && <span>{copyright} · </span>}
              Chart data powered by{' '}
              <a
                href="https://chartfox.org"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 align-middle font-medium text-zinc-200 underline-offset-2 hover:underline"
              >
                <img
                  src={CHARTFOX_LOGO_URL}
                  alt=""
                  className="size-4 rounded"
                />
                ChartFox
              </a>
            </>
          ) : copyright ? (
            <>Chart by {copyright}</>
          ) : null}
        </p>
        <p className="shrink-0">
          {isChartfox
            ? 'Not for real-world navigation'
            : 'Redistribution of this chart is prohibited'}
        </p>
      </div>
    </div>
  );
}
