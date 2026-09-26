import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  CornerUpRight,
  Eye,
  EyeOff,
  Loader2,
  Plug,
  Unplug,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import AdminModal from './AdminModal';
import AdminSection from './AdminSection';
import AdminSearchInput from './AdminSearchInput';
import AdminStatusBadge from './AdminStatusBadge';
import AdminTable from './AdminTable';
import { AdminAreaChart, AdminBarChart } from './AdminChart';
import { AdminEmptyState, AdminErrorState, AdminLoading } from './AdminStates';
import {
  ADMIN_CHART_COLORS,
  ADMIN_TONE_TEXT,
  httpStatusTone,
  type AdminTone,
} from './adminConstants';
import { Button } from '@/components/ui/button';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  fetchAdminDeveloperCatalog,
  fetchAdminDeveloperKeys,
  fetchAdminDeveloperUsage,
  type AdminDeveloperSummary,
  type AdminDeveloperUsageCallRow,
  type AdminDeveloperUsageSummary,
  type AdminScopeCatalogEntry,
  type AdminDeveloperKeyRow,
} from '../../utils/fetch/adminDevelopers';

type UsageChartWindow = '24h' | 7 | 14 | 30;

type Props = {
  developer: AdminDeveloperSummary;
  onClose: () => void;
};

const RANGE_OPTIONS: { id: UsageChartWindow; label: string }[] = [
  { id: '24h', label: '24h' },
  { id: 7, label: '7d' },
  { id: 14, label: '14d' },
  { id: 30, label: '30d' },
];

const CHART_HEIGHT = 280;
const BAR_ROW_HEIGHT = 28;

type CallsTab = 'all' | 'errors';

const HTTP_TONE_ICON: Record<AdminTone, LucideIcon> = {
  success: CheckCircle2,
  info: CornerUpRight,
  warning: AlertTriangle,
  danger: XCircle,
  purple: CircleDashed,
  orange: AlertTriangle,
  neutral: CircleDashed,
};

function formatMaskedIp(ip: string): string {
  if (ip.includes('.') && !ip.includes(':')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.*`;
    }
  }
  if (ip.includes(':')) {
    const first = ip.split(':').find((s) => s.length > 0);
    return first ? `${first}:****` : '****';
  }
  return '••••••••';
}

function prettyBody(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function CallStatus({ call }: { call: AdminDeveloperUsageCallRow }) {
  if (call.method === 'WS' && call.statusCode === 101) {
    return (
      <AdminStatusBadge tone="purple" icon={Plug} showLabel>
        Open
      </AdminStatusBadge>
    );
  }
  if (call.method === 'WS' && call.statusCode === 0) {
    return (
      <AdminStatusBadge tone="neutral" icon={Unplug} showLabel>
        Close
      </AdminStatusBadge>
    );
  }
  const tone = httpStatusTone(call.statusCode);
  return (
    <AdminStatusBadge
      tone={tone}
      icon={HTTP_TONE_ICON[tone]}
      showLabel
      className="tabular-nums"
    >
      {call.statusCode}
    </AdminStatusBadge>
  );
}

function breakdownHeight(rows: number) {
  return Math.max(180, rows * BAR_ROW_HEIGHT + 48);
}

function RecentCallsSection({
  recent,
  recentErrors,
  loading,
  scopeLabelMap,
  keyLabelMap,
}: {
  recent: AdminDeveloperUsageCallRow[];
  recentErrors: AdminDeveloperUsageCallRow[];
  loading: boolean;
  scopeLabelMap: Map<string, string>;
  keyLabelMap: Map<string, string>;
}) {
  const [tab, setTab] = useState<CallsTab>('all');
  const [search, setSearch] = useState('');
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleIn = useCallback(
    (setter: typeof setRevealed, id: string) =>
      setter((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    []
  );

  const activeList = tab === 'errors' ? recentErrors : recent;
  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return activeList;
    return activeList.filter((r) => {
      const hay = [
        r.method,
        r.path,
        r.scopeId,
        scopeLabelMap.get(r.scopeId) ?? r.scopeId,
        keyLabelMap.get(r.keyId) ?? r.keyId,
        String(r.statusCode),
        String(r.durationMs),
        r.clientIp ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(query);
    });
  }, [activeList, query, scopeLabelMap, keyLabelMap]);

  const errorCount = recentErrors.length;

  return (
    <AdminSection
      title="Latest API calls"
      actions={
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={tab}
          onValueChange={(v) => {
            if (v) setTab(v as CallsTab);
          }}
          aria-label="Call list filter"
        >
          <ToggleGroupItem value="all" className="px-3">
            Latest calls
          </ToggleGroupItem>
          <ToggleGroupItem value="errors" className="gap-1.5 px-3">
            Latest errors
            {errorCount > 0 ? (
              <span className="text-muted-foreground tabular-nums">
                {errorCount}
              </span>
            ) : null}
          </ToggleGroupItem>
        </ToggleGroup>
      }
      contentClassName="flex flex-col gap-4"
    >
      <AdminSearchInput
        value={search}
        onChange={setSearch}
        placeholder="Filter by path, method, scope, key, status, IP…"
        aria-label="Filter latest API calls"
      />

      {loading && activeList.length === 0 ? (
        <AdminLoading label="Loading calls…" />
      ) : activeList.length === 0 ? (
        <AdminEmptyState
          title={tab === 'errors' ? 'No errors on record' : 'No calls logged'}
        />
      ) : filtered.length === 0 ? (
        <AdminEmptyState
          title="No calls match your search"
          action={
            <Button variant="outline" size="sm" onClick={() => setSearch('')}>
              Clear filter
            </Button>
          }
        />
      ) : (
        <AdminTable minWidth="760px">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <span className="sr-only">Expand</span>
              </TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Request</TableHead>
              <TableHead>Key</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead className="text-right">Client IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => {
              const isOpen = expanded.has(r.id);
              const isRevealed = revealed.has(r.id);
              const ip = r.clientIp ?? null;
              const keyLabel = keyLabelMap.get(r.keyId) ?? 'Deleted key';
              const scopeLabel = scopeLabelMap.get(r.scopeId) ?? r.scopeId;
              const reqPretty = isOpen ? prettyBody(r.requestBody) : null;
              const resPretty = isOpen ? prettyBody(r.responseBody) : null;
              const toggleExpand = () => toggleIn(setExpanded, r.id);
              const toggleIp = () => toggleIn(setRevealed, r.id);
              const ipText = ip ? (isRevealed ? ip : formatMaskedIp(ip)) : '';

              return (
                <Fragment key={r.id}>
                  <TableRow
                    className="cursor-pointer"
                    data-state={isOpen ? 'selected' : undefined}
                    onClick={toggleExpand}
                  >
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-expanded={isOpen}
                        aria-label={isOpen ? 'Collapse call' : 'Expand call'}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand();
                        }}
                      >
                        {isOpen ? <ChevronDown /> : <ChevronRight />}
                      </Button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                      <time dateTime={r.createdAt}>
                        {new Date(r.createdAt).toLocaleString(undefined, {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </TableCell>
                    <TableCell>
                      <CallStatus call={r} />
                    </TableCell>
                    <TableCell className="max-w-[320px]">
                      <p className="truncate font-mono text-xs">
                        <span
                          className={
                            r.method === 'WS'
                              ? ADMIN_TONE_TEXT.purple
                              : 'text-muted-foreground'
                          }
                        >
                          {r.method}
                        </span>{' '}
                        {r.path}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate text-sm">
                      {keyLabel}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {r.durationMs}ms
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!ip ? (
                        <span className="text-xs text-muted-foreground">
                          N/A
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <span
                            className={cn(
                              'max-w-28 truncate font-mono text-xs text-muted-foreground',
                              !isRevealed && 'blur-sm select-none'
                            )}
                          >
                            {ipText}
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={
                                  isRevealed
                                    ? 'Hide IP address'
                                    : 'Show IP address'
                                }
                                onClick={toggleIp}
                              >
                                {isRevealed ? <EyeOff /> : <Eye />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isRevealed ? 'Hide IP' : 'Show IP'}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  {isOpen ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={7} className="whitespace-normal">
                        <div className="flex flex-col gap-5 py-2">
                          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                            <div className="grid gap-1">
                              <dt className="text-xs text-muted-foreground">
                                Key
                              </dt>
                              <dd className="text-sm">{keyLabel}</dd>
                            </div>
                            <div className="grid gap-1">
                              <dt className="text-xs text-muted-foreground">
                                Scope
                              </dt>
                              <dd className="text-sm">{scopeLabel}</dd>
                            </div>
                            <div className="grid gap-1">
                              <dt className="text-xs text-muted-foreground">
                                Time
                              </dt>
                              <dd className="text-sm tabular-nums">
                                {new Date(r.createdAt).toLocaleString()}
                              </dd>
                            </div>
                            <div className="grid gap-1 sm:col-span-2">
                              <dt className="text-xs text-muted-foreground">
                                Path
                              </dt>
                              <dd className="font-mono text-xs break-all">
                                {r.method} {r.path}
                              </dd>
                            </div>
                            <div className="grid gap-1">
                              <dt className="text-xs text-muted-foreground">
                                Duration
                              </dt>
                              <dd className="text-sm tabular-nums">
                                {r.durationMs} ms
                                {r.method === 'WS' && r.statusCode === 0
                                  ? ' (connection lifetime)'
                                  : ''}
                              </dd>
                            </div>
                            <div className="grid gap-1">
                              <dt className="text-xs text-muted-foreground">
                                Client IP
                              </dt>
                              <dd className="font-mono text-xs">
                                {!ip ? (
                                  <span className="font-sans text-sm text-muted-foreground">
                                    Not captured
                                  </span>
                                ) : (
                                  <span
                                    className={cn(
                                      'break-all',
                                      !isRevealed && 'blur-sm select-none'
                                    )}
                                  >
                                    {ipText}
                                  </span>
                                )}
                              </dd>
                            </div>
                          </dl>
                          <div className="grid gap-5 lg:grid-cols-2">
                            <div className="grid content-start gap-2">
                              <h3 className="text-sm font-medium">
                                Request body
                              </h3>
                              {reqPretty ? (
                                <pre className="max-h-80 overflow-auto rounded-xl bg-muted/50 p-4 font-mono text-xs break-all whitespace-pre-wrap">
                                  {reqPretty}
                                </pre>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  No body
                                </p>
                              )}
                            </div>
                            <div className="grid content-start gap-2">
                              <h3 className="text-sm font-medium">
                                Response body
                              </h3>
                              {resPretty ? (
                                <pre className="max-h-80 overflow-auto rounded-xl bg-muted/50 p-4 font-mono text-xs break-all whitespace-pre-wrap">
                                  {resPretty}
                                </pre>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  No body
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </AdminTable>
      )}
    </AdminSection>
  );
}

export default function AdminDeveloperUsageModal({
  developer,
  onClose,
}: Props) {
  const [chartWindow, setChartWindow] = useState<UsageChartWindow>(14);
  const [summary, setSummary] = useState<AdminDeveloperUsageSummary | null>(
    null
  );
  const [catalog, setCatalog] = useState<AdminScopeCatalogEntry[]>([]);
  const [keys, setKeys] = useState<AdminDeveloperKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, cat, keysPayload] = await Promise.all([
        fetchAdminDeveloperUsage(
          developer.userId,
          chartWindow === '24h' ? { hours: 24 } : { days: chartWindow }
        ),
        fetchAdminDeveloperCatalog(),
        fetchAdminDeveloperKeys(developer.userId),
      ]);
      setSummary(s);
      setCatalog(cat);
      setKeys(keysPayload.keys);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load usage');
    } finally {
      setLoading(false);
    }
  }, [developer.userId, chartWindow]);

  useEffect(() => {
    void load();
  }, [load]);

  const scopeLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of catalog) m.set(c.id, c.label);
    return m;
  }, [catalog]);

  const keyLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const k of keys) m.set(k.id, k.name);
    return m;
  }, [keys]);

  const volumeData = useMemo(
    () =>
      (summary?.daily ?? []).map((d) => ({ label: d.date, value: d.count })),
    [summary]
  );

  const scopeBars = useMemo(
    () =>
      [...(summary?.byScope ?? [])]
        .sort((a, b) => b.count - a.count)
        .map((r) => ({
          label: scopeLabelMap.get(r.scope_id) ?? r.scope_id,
          value: r.count,
        })),
    [summary, scopeLabelMap]
  );

  const keyBars = useMemo(
    () =>
      [...(summary?.byKey ?? [])]
        .sort((a, b) => b.count - a.count)
        .map((r) => ({
          label: keyLabelMap.get(r.key_id) ?? r.key_id,
          value: r.count,
        })),
    [summary, keyLabelMap]
  );

  return (
    <AdminModal
      open
      onClose={onClose}
      title={`Usage: ${developer.username}`}
      size="full"
    >
      {loading && !summary ? (
        <AdminLoading label="Loading usage…" />
      ) : error ? (
        <AdminErrorState
          title="Failed to load usage"
          message={error}
          onRetry={() => void load()}
        />
      ) : (
        <>
          <AdminSection
            title="Request volume"
            description={
              <span className="tabular-nums">
                {(summary?.totalInRange ?? 0).toLocaleString()} requests
                {summary?.granularity === 'hour'
                  ? ' in the rolling window.'
                  : ' in the selected calendar days.'}
              </span>
            }
            actions={
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={String(chartWindow)}
                onValueChange={(v) => {
                  if (!v) return;
                  setChartWindow(
                    v === '24h' ? '24h' : (Number(v) as 7 | 14 | 30)
                  );
                }}
                aria-label="Request volume time range"
              >
                {RANGE_OPTIONS.map((r) => (
                  <ToggleGroupItem
                    key={String(r.id)}
                    value={String(r.id)}
                    className="px-3"
                  >
                    {r.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            }
          >
            {loading ? (
              <div
                className="flex items-center justify-center"
                style={{ height: CHART_HEIGHT }}
              >
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <AdminAreaChart
                data={volumeData}
                valueLabel="Requests"
                color={ADMIN_CHART_COLORS.blue}
                height={CHART_HEIGHT}
                emptyLabel="No usage in this period yet"
              />
            )}
          </AdminSection>

          <div className="grid gap-6 lg:grid-cols-2">
            <AdminSection title="Scope mix">
              <AdminBarChart
                data={scopeBars}
                valueLabel="Requests"
                color={ADMIN_CHART_COLORS.blue}
                height={breakdownHeight(scopeBars.length)}
                emptyLabel="No usage in this period yet"
              />
            </AdminSection>

            <AdminSection title="Usage by key">
              <AdminBarChart
                data={keyBars}
                valueLabel="Requests"
                color={ADMIN_CHART_COLORS.green}
                height={breakdownHeight(keyBars.length)}
                emptyLabel="No usage in this period yet"
              />
            </AdminSection>
          </div>

          <RecentCallsSection
            recent={summary?.recent ?? []}
            recentErrors={summary?.recentErrors ?? []}
            loading={loading}
            scopeLabelMap={scopeLabelMap}
            keyLabelMap={keyLabelMap}
          />
        </>
      )}
    </AdminModal>
  );
}
