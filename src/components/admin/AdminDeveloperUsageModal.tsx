import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronDown,
  Search,
} from 'lucide-react';
import AdminModal from './AdminModal';
import {
  DeveloperRequestsAreaChart,
  DeveloperBreakdownDonutChart,
} from '../developers/DeveloperUsageCharts';
import DeveloperPillSegmentedControl from '../../pages/developers/DeveloperPillSegmentedControl';
import { cardClass } from '../../pages/developers/constants';
import {
  fetchAdminDeveloperCatalog,
  fetchAdminDeveloperKeys,
  fetchAdminDeveloperUsage,
  type AdminDeveloperSummary,
  type AdminDeveloperUsageSummary,
  type AdminScopeCatalogEntry,
  type AdminDeveloperKeyRow,
} from '../../utils/fetch/adminDevelopers';

type UsageChartWindow = '24h' | 7 | 14 | 30;

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

function prettyBody(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

type Props = {
  developer: AdminDeveloperSummary;
  onClose: () => void;
};

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

  const [revealedCallIds, setRevealedCallIds] = useState<Set<string>>(
    new Set()
  );
  const [expandedCallIds, setExpandedCallIds] = useState<Set<string>>(
    new Set()
  );
  const [callsSearch, setCallsSearch] = useState('');

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

  const toggleIpReveal = useCallback((id: string) => {
    setRevealedCallIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleCallExpand = useCallback((id: string) => {
    setExpandedCallIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const recent = summary?.recent ?? [];
  const callsQuery = callsSearch.trim().toLowerCase();
  const filteredRecent = useMemo(() => {
    if (!callsQuery) return recent;
    return recent.filter((r) => {
      const scopeLabel = scopeLabelMap.get(r.scopeId) ?? r.scopeId;
      const keyLabel = keyLabelMap.get(r.keyId) ?? r.keyId;
      const hay = [
        r.method,
        r.path,
        r.scopeId,
        scopeLabel,
        keyLabel,
        String(r.statusCode),
        String(r.durationMs),
        r.clientIp ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(callsQuery);
    });
  }, [recent, callsQuery, scopeLabelMap, keyLabelMap]);

  const rangeButtons: { id: UsageChartWindow; label: string }[] = [
    { id: '24h', label: '24h' },
    { id: 7, label: '7d' },
    { id: 14, label: '14d' },
    { id: 30, label: '30d' },
  ];

  return (
    <AdminModal
      open
      onClose={onClose}
      title={`Usage — ${developer.username}`}
      size="full"
    >
      {loading && !summary ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-6 text-center">
          <p className="text-sm text-red-300 mb-3">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="text-xs font-medium text-blue-400 hover:text-blue-300"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className={cardClass()}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-zinc-100">
                Request volume
              </h2>
              <DeveloperPillSegmentedControl
                aria-label="Request volume time range"
                className="w-full max-w-[min(100%,22rem)] sm:w-auto sm:min-w-[20rem]"
                tabs={rangeButtons}
                value={chartWindow}
                onChange={setChartWindow}
              />
            </div>
            <div className="h-64 sm:h-72">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                </div>
              ) : (
                <DeveloperRequestsAreaChart data={summary?.daily ?? []} />
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              {summary?.totalInRange ?? 0} requests
              {summary?.granularity === 'hour'
                ? ' in the rolling window.'
                : ' in the selected calendar days.'}
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className={cardClass()}>
              <h2 className="text-lg font-semibold text-zinc-100 mb-4">
                Scope mix
              </h2>
              <div className="h-64 sm:h-72 flex flex-col">
                {!summary?.byScope.length ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-zinc-500">
                      No usage in this period yet.
                    </p>
                  </div>
                ) : (
                  <DeveloperBreakdownDonutChart
                    rows={summary.byScope.map((r) => ({
                      id: r.scope_id,
                      count: r.count,
                    }))}
                    labelMap={scopeLabelMap}
                    ariaLabel="Scope breakdown"
                  />
                )}
              </div>
            </div>

            <div className={cardClass()}>
              <h2 className="text-lg font-semibold text-zinc-100 mb-4">
                Usage by key
              </h2>
              <div className="h-64 sm:h-72 flex flex-col">
                {!summary?.byKey.length ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-zinc-500">
                      No usage in this period yet.
                    </p>
                  </div>
                ) : (
                  <DeveloperBreakdownDonutChart
                    rows={summary.byKey.map((r) => ({
                      id: r.key_id,
                      count: r.count,
                    }))}
                    labelMap={keyLabelMap}
                    ariaLabel="Key breakdown"
                  />
                )}
              </div>
            </div>
          </div>

          <div className={cardClass()}>
            <div className="mb-4 space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">
                  Latest API calls
                </h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Click a row to expand scope, timing, IP, and the full
                  request/response bodies.
                </p>
              </div>
              <div className="relative group w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none group-focus-within:text-blue-400/90 transition-colors" />
                <input
                  type="search"
                  value={callsSearch}
                  onChange={(e) => setCallsSearch(e.target.value)}
                  placeholder="Filter by path, method, scope, key, status, IP…"
                  aria-label="Filter latest API calls"
                  className="w-full rounded-full border border-zinc-700 bg-zinc-800/50 pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ring-1 ring-zinc-700/40 hover:border-zinc-600"
                />
              </div>
            </div>

            {recent.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-12 text-center">
                <p className="text-sm text-zinc-500">
                  No calls logged in this period yet.
                </p>
              </div>
            ) : filteredRecent.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-12 text-center">
                <p className="text-sm text-zinc-500">
                  No calls match your search.
                </p>
                <button
                  type="button"
                  onClick={() => setCallsSearch('')}
                  className="mt-2 text-xs font-medium text-blue-400 hover:text-blue-300"
                >
                  Clear filter
                </button>
              </div>
            ) : (
              <ul className="overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-950/25 ring-1 ring-zinc-800/40 divide-y divide-zinc-800/80">
                {filteredRecent.map((r) => {
                  const scopeLabel = scopeLabelMap.get(r.scopeId) ?? r.scopeId;
                  const keyLabel = keyLabelMap.get(r.keyId) ?? 'Deleted key';
                  const revealed = revealedCallIds.has(r.id);
                  const expanded = expandedCallIds.has(r.id);
                  const ip = r.clientIp ?? null;
                  const ok = r.statusCode >= 200 && r.statusCode < 300;
                  const err = r.statusCode >= 400;
                  const shortTime = new Date(r.createdAt).toLocaleString(
                    undefined,
                    {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }
                  );
                  const reqPretty = prettyBody(r.requestBody);
                  const resPretty = prettyBody(r.responseBody);

                  return (
                    <li key={r.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={expanded}
                        onClick={() => toggleCallExpand(r.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleCallExpand(r.id);
                          }
                        }}
                        className="flex w-full cursor-pointer items-center gap-2 px-2 py-2 text-left min-h-10 hover:bg-zinc-900/50 sm:gap-3 sm:px-3"
                      >
                        <span className="shrink-0 text-zinc-500" aria-hidden>
                          {expanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </span>
                        <time
                          className="shrink-0 w-26 text-[11px] tabular-nums text-zinc-500 sm:w-29 sm:text-xs"
                          dateTime={r.createdAt}
                        >
                          {shortTime}
                        </time>
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums sm:text-[11px] ${
                            ok
                              ? 'bg-emerald-950/55 text-emerald-300'
                              : err
                                ? 'bg-red-950/50 text-red-300'
                                : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          {r.statusCode}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-300 sm:text-xs">
                          <span className="text-zinc-500">{r.method}</span>{' '}
                          {r.path}
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-zinc-500 sm:text-xs">
                          {r.durationMs}ms
                        </span>
                        <div
                          className="flex shrink-0 max-w-22 items-center gap-0.5 sm:max-w-28"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!ip ? (
                            <span className="truncate text-[10px] text-zinc-600 sm:text-xs">
                              —
                            </span>
                          ) : (
                            <>
                              <span
                                className={`min-w-0 flex-1 truncate text-right font-mono text-[10px] text-zinc-400 sm:text-xs ${revealed ? '' : 'filter blur-sm select-none'}`}
                                title={revealed ? ip : undefined}
                              >
                                {revealed ? ip : formatMaskedIp(ip)}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleIpReveal(r.id)}
                                className="shrink-0 rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                                aria-label={
                                  revealed
                                    ? 'Hide IP address'
                                    : 'Show IP address'
                                }
                              >
                                {revealed ? (
                                  <EyeOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {expanded && (
                        <div
                          className="border-t border-zinc-800/80 bg-zinc-950/50 px-3 py-2.5 pl-9 text-xs text-zinc-400 sm:pl-11"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <dl className="grid gap-1.5 sm:grid-cols-[auto_1fr] sm:gap-x-3 sm:gap-y-1 mb-3">
                            <dt className="text-zinc-600">Key</dt>
                            <dd className="text-zinc-200">{keyLabel}</dd>
                            <dt className="text-zinc-600">Scope</dt>
                            <dd className="text-zinc-200">{scopeLabel}</dd>
                            <dt className="text-zinc-600">Path</dt>
                            <dd className="break-all font-mono text-zinc-300">
                              {r.method} {r.path}
                            </dd>
                            <dt className="text-zinc-600">Time</dt>
                            <dd className="tabular-nums text-zinc-300">
                              {new Date(r.createdAt).toLocaleString()}
                            </dd>
                            <dt className="text-zinc-600">Duration</dt>
                            <dd className="tabular-nums text-zinc-300">
                              {r.durationMs} ms
                            </dd>
                            <dt className="text-zinc-600">Client IP</dt>
                            <dd className="font-mono text-zinc-300">
                              {!ip ? (
                                <span className="text-zinc-600">
                                  Not captured
                                </span>
                              ) : (
                                <span className="inline-flex flex-wrap items-center gap-2">
                                  <span
                                    className={`break-all ${revealed ? '' : 'filter blur-sm select-none'}`}
                                  >
                                    {revealed ? ip : formatMaskedIp(ip)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleIpReveal(r.id)}
                                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800"
                                  >
                                    {revealed ? (
                                      <>
                                        <EyeOff className="h-3 w-3" /> Hide
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="h-3 w-3" /> Reveal
                                      </>
                                    )}
                                  </button>
                                </span>
                              )}
                            </dd>
                          </dl>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1">
                                Request body
                              </p>
                              {reqPretty ? (
                                <pre className="max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 text-[11px] leading-snug text-zinc-300 whitespace-pre-wrap break-all">
                                  {reqPretty}
                                </pre>
                              ) : (
                                <p className="text-zinc-600 italic">
                                  No body
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1">
                                Response body
                              </p>
                              {resPretty ? (
                                <pre className="max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 text-[11px] leading-snug text-zinc-300 whitespace-pre-wrap break-all">
                                  {resPretty}
                                </pre>
                              ) : (
                                <p className="text-zinc-600 italic">
                                  No body
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </AdminModal>
  );
}
