import { useMemo } from 'react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type Plugin,
  type ScriptableContext,
  type TooltipItem,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip
);

const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui';
const GRID_COLOR = 'rgba(255,255,255,0.06)';
const AXIS_BORDER_COLOR = 'rgba(255,255,255,0.1)';
const TICK_COLOR = '#a1a1aa';
const SPARKLINE_MIN_HEIGHT = 140;
const CROSSHAIR_COLOR = 'rgba(255,255,255,0.15)';
const SURFACE_COLOR = '#09090b';
const TICK_FONT = { family: FONT_FAMILY, size: 11 };

const TOOLTIP_STYLE = {
  enabled: true,
  backgroundColor: '#18181b',
  borderColor: 'rgba(255,255,255,0.1)',
  borderWidth: 1,
  padding: 10,
  cornerRadius: 8,
  titleColor: '#fafafa',
  bodyColor: '#a1a1aa',
  titleFont: { family: FONT_FAMILY, size: 12, weight: 500 },
  bodyFont: { family: FONT_FAMILY, size: 12 },
  titleMarginBottom: 6,
  bodySpacing: 4,
  usePointStyle: true,
  boxWidth: 8,
  boxHeight: 8,
  boxPadding: 4,
  caretSize: 0,
  caretPadding: 8,
} as const;

export type AdminChartPoint = {
  label: string;
  value: number;
  [key: string]: string | number;
};

type AdminAreaChartProps = {
  data: AdminChartPoint[];
  dataKey?: string;
  color?: string;
  height?: number;
  emptyLabel?: string;
  valueLabel?: string;
  /** @deprecated Axes are always shown; kept so existing call sites compile. */
  hideAxes?: boolean;
  formatValue?: (value: number) => string;
  beginAtZero?: boolean;
};

export type AdminChartSeries = {
  key: string;
  label: string;
  color: string;
  strokeDasharray?: string;
};

type AdminMultiSeriesChartProps = {
  data: Array<Record<string, string | number>>;
  series: AdminChartSeries[];
  xKey?: string;
  height?: number;
  emptyLabel?: string;
  /** @deprecated Axes are always shown; kept so existing call sites compile. */
  hideAxes?: boolean;
  showLegend?: boolean;
  filled?: boolean;
  formatValue?: (value: number) => string;
  beginAtZero?: boolean;
};

export type AdminBarDatum = {
  label: string;
  value: number;
};

type AdminBarChartProps = {
  data: AdminBarDatum[];
  color?: string;
  height?: number;
  horizontal?: boolean;
  valueLabel?: string;
  emptyLabel?: string;
  formatValue?: (value: number) => string;
};

function shortDateLabel(raw: string | Date | number): string {
  const s = raw instanceof Date ? raw.toISOString() : String(raw).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }

  if (/^\d{4}-\d{2}-\d{2}T00:00:00(\.0+)?Z?$/.test(s)) {
    const ymd = s.slice(0, 10);
    const d = new Date(`${ymd}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }

  if (s.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }

  if (s.includes(':')) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }

  return s;
}

function shortTickLabel(raw: string): string {
  const s = String(raw).trim();

  if (/^\d{4}-\d{2}-\d{2}(T00:00:00(\.0+)?Z?)?$/.test(s)) {
    const d = new Date(`${s.slice(0, 10)}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    }
  }

  if (s.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }

  return s;
}

function compactNumber(value: number): string {
  const abs = Math.abs(value);
  const units: Array<[number, string]> = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'k'],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) {
      return `${(value / size).toFixed(1).replace(/\.0$/, '')}${suffix}`;
    }
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const defaultFormat = (value: number) => value.toLocaleString();

function withAlpha(color: string, alpha: number): string {
  const hex = color.trim().replace(/^#/, '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return color;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function gradientFill(color: string) {
  return (ctx: ScriptableContext<'line'>): CanvasGradient | string => {
    const { ctx: canvas, chartArea } = ctx.chart;
    if (!chartArea) return 'transparent';
    const gradient = canvas.createLinearGradient(
      0,
      chartArea.top,
      0,
      chartArea.bottom
    );
    gradient.addColorStop(0, withAlpha(color, 0.35));
    gradient.addColorStop(0.55, withAlpha(color, 0.1));
    gradient.addColorStop(1, withAlpha(color, 0));
    return gradient;
  };
}

function parseDash(dash?: string): number[] {
  if (!dash) return [];
  return dash
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n >= 0);
}

function toNumber(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

const crosshairPlugin: Plugin<'line'> = {
  id: 'adminCrosshair',
  beforeDatasetsDraw(chart) {
    const active = chart.tooltip?.getActiveElements();
    if (!active?.length) return;
    const { x } = active[0].element;
    const { top, bottom } = chart.chartArea;
    const { ctx } = chart;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = CROSSHAIR_COLOR;
    ctx.stroke();
    ctx.restore();
  },
};
const LINE_PLUGINS = [crosshairPlugin];

type AxisOptions = {
  yMax?: number;
  integerTicks?: boolean;
  beginAtZero?: boolean;
  xTick?: (label: string) => string;
};

function valueAxis(integerTicks: boolean, yMax?: number, beginAtZero = true) {
  return {
    display: true,
    beginAtZero,
    suggestedMax: yMax,
    grid: { display: true, color: GRID_COLOR, drawTicks: false },
    border: { display: true, color: AXIS_BORDER_COLOR },
    ticks: {
      color: TICK_COLOR,
      font: TICK_FONT,
      padding: 6,
      maxTicksLimit: 5,
      precision: integerTicks ? 0 : undefined,
      callback: (value: string | number) => compactNumber(Number(value)),
    },
  };
}

function categoryAxis(
  xTick: (label: string) => string,
  maxTicksLimit: number | undefined
) {
  return {
    display: true,
    grid: { display: false },
    border: { display: true, color: AXIS_BORDER_COLOR },
    ticks: {
      color: TICK_COLOR,
      font: TICK_FONT,
      padding: 6,
      maxRotation: 0,
      autoSkip: maxTicksLimit !== undefined,
      autoSkipPadding: 12,
      maxTicksLimit,
      callback(
        this: { getLabelForValue: (value: number) => string },
        value: string | number
      ) {
        return xTick(this.getLabelForValue(Number(value)));
      },
    },
  };
}

function lineScales({
  yMax,
  integerTicks = true,
  beginAtZero = true,
  xTick = shortTickLabel,
}: AxisOptions): ChartOptions<'line'>['scales'] {
  return {
    x: categoryAxis(xTick, 6),
    y: valueAxis(integerTicks, yMax, beginAtZero),
  };
}

function lineOptions({
  formatValue,
  ...axes
}: AxisOptions & {
  formatValue: (value: number) => string;
}): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 8, right: 8, left: 0, bottom: 0 } },
    elements: {
      line: { tension: 0.4, borderWidth: 2 },
      point: {
        radius: 0,
        hoverRadius: 4,
        hitRadius: 8,
        hoverBorderWidth: 2,
      },
    },
    scales: lineScales(axes),
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP_STYLE,
        callbacks: {
          title: (items) =>
            items.length ? shortDateLabel(String(items[0].label)) : '',
          label: (item: TooltipItem<'line'>) =>
            `${item.dataset.label ?? ''}: ${formatValue(item.parsed.y ?? 0)}`,
          labelColor: (item) => {
            const c = String(item.dataset.borderColor);
            return {
              borderColor: c,
              backgroundColor: c,
              borderWidth: 0,
              borderRadius: 2,
            };
          },
          labelPointStyle: () => ({ pointStyle: 'rectRounded', rotation: 0 }),
        },
      },
    },
  };
}

function ChartEmpty({ height, label }: { height: number; label: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground"
      style={{ height }}
    >
      {label}
    </div>
  );
}

function ChartLegend({ series }: { series: AdminChartSeries[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {series.map((s) => (
        <span
          key={s.key}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            className="inline-block w-4 shrink-0 border-t-2"
            style={{
              borderColor: s.color,
              borderStyle: s.strokeDasharray ? 'dashed' : 'solid',
            }}
          />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function allIntegers(values: Array<number | null>): boolean {
  return values.every((v) => v === null || Number.isInteger(v));
}

export function AdminAreaChart({
  data,
  dataKey = 'value',
  color = '#60a5fa',
  height = 280,
  emptyLabel = 'No data for this period',
  valueLabel = 'Count',
  formatValue = defaultFormat,
  beginAtZero = true,
}: AdminAreaChartProps) {
  const values = useMemo(
    () => data.map((d) => toNumber(d[dataKey])),
    [data, dataKey]
  );

  const chartData = useMemo<ChartData<'line', (number | null)[], string>>(
    () => ({
      labels: data.map((d) => String(d.label ?? d[dataKey] ?? '')),
      datasets: [
        {
          label: valueLabel,
          data: values,
          borderColor: color,
          backgroundColor: gradientFill(color),
          pointHoverBackgroundColor: color,
          pointHoverBorderColor: SURFACE_COLOR,
          fill: beginAtZero ? 'origin' : 'start',
          spanGaps: true,
        },
      ],
    }),
    [data, dataKey, values, color, valueLabel, beginAtZero]
  );

  const maxVal = values.reduce<number>((m, v) => Math.max(m, v ?? 0), 0);
  const yMax = !beginAtZero
    ? undefined
    : maxVal === 0
      ? 8
      : Math.ceil(maxVal * 1.12);
  const integerTicks = allIntegers(values);

  const options = useMemo(
    () => lineOptions({ yMax, integerTicks, beginAtZero, formatValue }),
    [yMax, integerTicks, beginAtZero, formatValue]
  );

  if (data.length === 0) {
    return <ChartEmpty height={height} label={emptyLabel} />;
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <Line
        data={chartData}
        options={options}
        plugins={LINE_PLUGINS}
        role="img"
        aria-label={`${valueLabel} chart`}
      />
    </div>
  );
}

export function AdminMultiSeriesAreaChart({
  data,
  series,
  xKey = 'label',
  height = 280,
  emptyLabel = 'No data for this period',
  showLegend = false,
  filled = true,
  formatValue = defaultFormat,
  beginAtZero = true,
}: AdminMultiSeriesChartProps) {
  const chartData = useMemo<ChartData<'line', (number | null)[], string>>(
    () => ({
      labels: data.map((d) => String(d[xKey] ?? '')),
      datasets: series.map((s) => ({
        label: s.label,
        data: data.map((d) => toNumber(d[s.key])),
        borderColor: s.color,
        borderDash: parseDash(s.strokeDasharray),
        backgroundColor: filled ? gradientFill(s.color) : s.color,
        pointHoverBackgroundColor: s.color,
        pointHoverBorderColor: SURFACE_COLOR,
        pointHoverRadius: 3,
        fill: filled ? (beginAtZero ? 'origin' : 'start') : false,
        spanGaps: true,
      })),
    }),
    [data, series, xKey, filled, beginAtZero]
  );

  const integerTicks = chartData.datasets.every((ds) => allIntegers(ds.data));

  const options = useMemo(
    () => lineOptions({ integerTicks, beginAtZero, formatValue }),
    [integerTicks, beginAtZero, formatValue]
  );

  if (data.length === 0) {
    return <ChartEmpty height={height} label={emptyLabel} />;
  }

  return (
    <div>
      <div className="relative w-full" style={{ height }}>
        <Line
          data={chartData}
          options={options}
          plugins={LINE_PLUGINS}
          role="img"
          aria-label={`${series.map((s) => s.label).join(', ')} chart`}
        />
      </div>
      {showLegend ? <ChartLegend series={series} /> : null}
    </div>
  );
}

const SPARKLINE_OPTIONS: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  events: [],
  layout: { padding: { top: 4, right: 4, bottom: 0, left: 0 } },
  elements: {
    line: { tension: 0.4, borderWidth: 1.5 },
    point: { radius: 0, hoverRadius: 0, hitRadius: 0 },
  },
  scales: lineScales({ integerTicks: true, xTick: (label) => label }),
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false },
  },
};

function relativeSampleLabels(count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? 'now' : `-${count - 1 - i}`
  );
}

export function AdminSparkline({
  data,
  color = '#60a5fa',
  height = SPARKLINE_MIN_HEIGHT,
  labels,
}: {
  data: number[];
  color?: string;
  height?: number;
  labels?: string[];
}) {
  const chartData = useMemo<ChartData<'line', number[], string>>(
    () => ({
      labels:
        labels && labels.length === data.length
          ? labels
          : relativeSampleLabels(data.length),
      datasets: [
        {
          data,
          borderColor: color,
          backgroundColor: withAlpha(color, 0.15),
          fill: 'origin',
        },
      ],
    }),
    [data, color, labels]
  );

  if (data.length === 0) return null;

  return (
    <div
      className="relative w-full"
      style={{ height: Math.max(height, SPARKLINE_MIN_HEIGHT) }}
    >
      <Line data={chartData} options={SPARKLINE_OPTIONS} aria-hidden />
    </div>
  );
}

const truncateLabel = (label: string) =>
  label.length > 20 ? `${label.slice(0, 19)}…` : label;

export function AdminBarChart({
  data,
  color = '#60a5fa',
  height = 224,
  horizontal = true,
  valueLabel = 'Value',
  emptyLabel = 'No data',
  formatValue = defaultFormat,
}: AdminBarChartProps) {
  const chartData = useMemo<ChartData<'bar', number[], string>>(
    () => ({
      labels: data.map((d) => d.label),
      datasets: [
        {
          label: valueLabel,
          data: data.map((d) => d.value),
          backgroundColor: color,
          hoverBackgroundColor: withAlpha(color, 0.8),
          borderRadius: horizontal
            ? { topRight: 4, bottomRight: 4 }
            : { topLeft: 4, topRight: 4 },
          borderSkipped: false,
          maxBarThickness: 14,
          categoryPercentage: 0.8,
          barPercentage: 0.9,
        },
      ],
    }),
    [data, color, valueLabel, horizontal]
  );

  const integerTicks = data.every((d) => Number.isInteger(d.value));

  const options = useMemo<ChartOptions<'bar'>>(() => {
    const category = categoryAxis(truncateLabel, horizontal ? undefined : 6);
    const value = valueAxis(integerTicks);
    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: horizontal ? 'y' : 'x',
      interaction: {
        mode: 'index',
        intersect: false,
        axis: horizontal ? 'y' : 'x',
      },
      layout: { padding: { top: 4, right: 8, bottom: 0, left: 0 } },
      scales: horizontal
        ? {
            x: { ...value, ticks: { ...value.ticks, maxTicksLimit: 6 } },
            y: category,
          }
        : { x: category, y: value },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TOOLTIP_STYLE,
          callbacks: {
            label: (item: TooltipItem<'bar'>) =>
              `${item.dataset.label ?? ''}: ${formatValue(
                Number(horizontal ? item.parsed.x : item.parsed.y) || 0
              )}`,
            labelColor: () => ({
              borderColor: color,
              backgroundColor: color,
              borderWidth: 0,
              borderRadius: 2,
            }),
            labelPointStyle: () => ({
              pointStyle: 'rectRounded',
              rotation: 0,
            }),
          },
        },
      },
    };
  }, [horizontal, color, formatValue, integerTicks]);

  if (data.length === 0) {
    return <ChartEmpty height={height} label={emptyLabel} />;
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <Bar
        data={chartData}
        options={options}
        role="img"
        aria-label={`${valueLabel} chart`}
      />
    </div>
  );
}
