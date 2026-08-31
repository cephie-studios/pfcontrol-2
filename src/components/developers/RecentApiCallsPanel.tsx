import { useCallback, useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  ChevronRight,
  ChevronDown,
  Search,
  Loader2,
} from 'lucide-react';
import DeveloperPillSegmentedControl from '../../pages/developers/DeveloperPillSegmentedControl';
import { cardClass } from '../../pages/developers/constants';

export interface RecentApiCall {
  id: string;
  keyId: string;
  scopeId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  createdAt: string;
  clientIp?: string | null;
  requestBody?: string | null;
  responseBody?: string | null;
}

type CallsTab = 'all' | 'errors';

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

function isErrorRow(r: RecentApiCall): boolean {
  return r.statusCode >= 400;
}

function statusBadge(r: RecentApiCall): { label: string; cls: string } {
  if (r.method === 'WS') {
    if (r.statusCode === 101) {
      return { label: 'OPEN', cls: 'bg-violet-950/55 text-violet-300' };
    }
    if (r.statusCode === 0) {
      return { label: 'CLOSE', cls: 'bg-zinc-800 text-zinc-400' };
    }
  }
  const ok = r.statusCode >= 200 && r.statusCode < 300;
  const err = isErrorRow(r);
  return {
    label: String(r.statusCode),
    cls: ok
      ? 'bg-emerald-950/55 text-emerald-300'
      : err
        ? 'bg-red-950/50 text-red-300'
        : 'bg-zinc-800 text-zinc-300',
  };
}

function methodBadgeClass(method: string): string {
  return method === 'WS' ? 'text-violet-400' : 'text-zinc-500';
}

const TABS: { id: CallsTab; label: string }[] = [
  { id: 'all', label: 'Latest calls' },
  { id: 'errors', label: 'Latest errors' },
];

export default function RecentApiCallsPanel({
  recent,
  recentErrors,
  loading = false,
  scopeLabelMap,
  keyLabelMap,
}: {
  recent: RecentApiCall[];
  recentErrors: RecentApiCall[];
  loading?: boolean;
  scopeLabelMap: Map<string, string>;
  keyLabelMap: Map<string, string>;
}) {
  const [revealedCallIds, setRevealedCallIds] = useState<Set<string>>(
    new Set()
  );
  const [expandedCallIds, setExpandedCallIds] = useState<Set<string>>(
    new Set()
  );
  const [callsSearch, setCallsSearch] = useState('');
  const [tab, setTab] = useState<CallsTab>('all');

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

  const activeList = tab === 'errors' ? recentErrors : recent;

  const callsQuery = callsSearch.trim().toLowerCase();
  const filteredRecent = useMemo(() => {
    if (!callsQuery) return activeList;
    return activeList.filter((r) => {
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
  }, [activeList, callsQuery, scopeLabelMap, keyLabelMap]);

  const errorCount = recentErrors.length;

  return (
    <div className={cardClass()}>
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              Latest API calls
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Click a row to expand scope, timing, IP, and the full
              request/response bodies. WebSocket connects/disconnects show up
              here as well.
            </p>
          </div>
          <DeveloperPillSegmentedControl
            aria-label="Call list filter"
            className="w-full max-w-xs sm:w-auto sm:min-w-[16rem]"
            tabs={TABS.map((t) =>
              t.id === 'errors' && errorCount > 0
                ? { ...t, label: `${t.label} (${errorCount})` }
                : t
            )}
            value={tab}
            onChange={setTab}
          />
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

      {loading && activeList.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      ) : activeList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-12 text-center">
          <p className="text-sm text-zinc-500">
            {tab === 'errors'
              ? 'No errors on record — nice.'
              : 'No calls logged yet.'}
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
            const keyLabel = keyLabelMap.get(r.keyId) ?? 'Deleted key';
            const revealed = revealedCallIds.has(r.id);
            const expanded = expandedCallIds.has(r.id);
            const ip = r.clientIp ?? null;
            const badge = statusBadge(r);
            const reqPretty = prettyBody(r.requestBody);
            const resPretty = prettyBody(r.responseBody);
            const shortTime = new Date(r.createdAt).toLocaleString(undefined, {
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

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
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums sm:text-[11px] ${badge.cls}`}
                  >
                    {badge.label}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-300 sm:text-xs">
                    <span className={methodBadgeClass(r.method)}>
                      {r.method}
                    </span>{' '}
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
                        {r.method === 'WS' && r.statusCode === 0
                          ? ' (connection lifetime)'
                          : ''}
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
                          <p className="text-zinc-600 italic">No body</p>
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
                          <p className="text-zinc-600 italic">No body</p>
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
  );
}
