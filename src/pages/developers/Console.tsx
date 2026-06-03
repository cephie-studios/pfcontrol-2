import { Link } from 'react-router-dom';
import { useCallback, useMemo, useState } from 'react';
import {
  Loader2,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronDown,
  Search,
} from 'lucide-react';
import {
  DeveloperRequestsAreaChart,
  DeveloperScopeDonutChart,
} from '../../components/developers/DeveloperUsageCharts';
import DeveloperPillSegmentedControl from './DeveloperPillSegmentedControl';
import { cardClass } from './constants';
import {
  useDeveloperPortal,
  type DeveloperUsageChartWindow,
} from './developerPortalContext';

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

export default function DeveloperConsole() {
  const {
    loading,
    profileActive,
    usageChartWindow,
    setUsageChartWindow,
    summary,
    dashLoading,
    scopeLabelMap,
  } = useDeveloperPortal();

  const [revealedCallIds, setRevealedCallIds] = useState<Set<string>>(
    new Set()
  );
  const [expandedCallIds, setExpandedCallIds] = useState<Set<string>>(
    new Set()
  );
  const [callsSearch, setCallsSearch] = useState('');

  const callsQuery = callsSearch.trim().toLowerCase();
  const filteredRecent = useMemo(() => {
    const list = summary?.recent ?? [];
    if (!callsQuery) return list;
    return list.filter((r) => {
      const scopeLabel = scopeLabelMap.get(r.scopeId) ?? r.scopeId;
      const hay = [
        r.method,
        r.path,
        r.scopeId,
        scopeLabel,
        String(r.statusCode),
        String(r.durationMs),
        r.clientIp ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(callsQuery);
    });
  }, [summary?.recent, callsQuery, scopeLabelMap]);

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

  const rangeButtons: { id: DeveloperUsageChartWindow; label: string }[] = [
    { id: '24h', label: '24h' },
    { id: 7, label: '7d' },
    { id: 14, label: '14d' },
    { id: 30, label: '30d' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!profileActive) {
    return (
      <div className={`${cardClass()} max-w-lg`}>
        <h2 className="text-lg font-semibold text-zinc-100 mb-2">
          Usage dashboard
        </h2>
        <p className="text-sm text-zinc-400 mb-4">
          Charts and request logs appear here once your developer application is
          approved.
        </p>
        <Link
          to="/developers"
          className="inline-flex text-sm font-medium text-blue-400 hover:text-blue-300"
        >
          Back to overview
        </Link>
      </div>
    );
  }

  const recent = summary?.recent ?? [];

  return (
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
            value={usageChartWindow}
            onChange={setUsageChartWindow}
          />
        </div>
        <div className="h-72 sm:h-80">
          {dashLoading ? (
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

      <div className={cardClass()}>
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Scope mix</h2>
        <div className="h-72 sm:h-80 flex flex-col">
          {!summary?.byScope.length ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-zinc-500">
                No usage in this period yet.
              </p>
            </div>
          ) : (
            <DeveloperScopeDonutChart
              rows={summary.byScope}
              scopeLabelMap={scopeLabelMap}
            />
          )}
        </div>
      </div>

      <div className={cardClass()}>
        <div className="mb-4 space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              Latest API calls
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              One line per call for a quick scan. Click a row to expand scope,
              full path, timing, and IP (use the eye to show or hide the full
              address).
            </p>
          </div>
          <div className="relative group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none group-focus-within:text-blue-400/90 transition-colors" />
            <input
              type="search"
              value={callsSearch}
              onChange={(e) => setCallsSearch(e.target.value)}
              placeholder="Filter by path, method, scope, status, IP…"
              aria-label="Filter latest API calls"
              className="w-full rounded-full border border-zinc-700 bg-zinc-800/50 pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ring-1 ring-zinc-700/40 hover:border-zinc-600"
            />
          </div>
        </div>

        {dashLoading && recent.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : recent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-12 text-center">
            <p className="text-sm text-zinc-500">
              No calls logged in this period yet.
            </p>
          </div>
        ) : filteredRecent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-12 text-center">
            <p className="text-sm text-zinc-500">No calls match your search.</p>
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
                      <span className="text-zinc-500">{r.method}</span> {r.path}
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
                              revealed ? 'Hide IP address' : 'Show IP address'
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
                      <dl className="grid gap-1.5 sm:grid-cols-[auto_1fr] sm:gap-x-3 sm:gap-y-1">
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
                            <span className="text-zinc-600">Not captured</span>
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
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
