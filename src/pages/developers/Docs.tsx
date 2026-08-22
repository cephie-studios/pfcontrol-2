import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Copy,
  Check,
  Loader2,
  ChevronDown,
  Search,
  Menu,
  X,
} from 'lucide-react';
import type {
  DeveloperApiDocEndpoint,
  DeveloperApiDocWebsocket,
  DeveloperApiPublicSpec,
} from '../../types/developerApiSpec';
import { fetchDeveloperApiDocs } from '../../utils/fetch/developer';
import { cardClass } from './constants';

const GROUP_LABELS: Record<string, string> = {
  self: 'Account',
  data: 'Data',
  sessions: 'Sessions',
  flights: 'Flights',
  ratings: 'Ratings',
  notifications: 'Notifications',
  flight_logs: 'Flight logs',
};

const GROUP_ORDER = [
  'self',
  'data',
  'sessions',
  'flights',
  'ratings',
  'notifications',
  'flight_logs',
];

function groupIdFor(scopeId: string): string {
  return scopeId.split('.')[0] ?? 'other';
}

function groupLabelFor(groupId: string): string {
  return (
    GROUP_LABELS[groupId] ??
    groupId.charAt(0).toUpperCase() + groupId.slice(1).replace(/_/g, ' ')
  );
}

function endpointAnchorId(e: DeveloperApiDocEndpoint): string {
  const slugPath = e.pathTemplate
    .replace(/[{}]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `ep-${e.method.toLowerCase()}-${slugPath}`;
}

function endpointMatchesQuery(e: DeveloperApiDocEndpoint, q: string): boolean {
  if (!q) return true;
  const n = q.toLowerCase();
  const chunks: string[] = [
    e.method,
    e.pathTemplate,
    e.scopeId,
    e.endpointKey,
    e.title,
    e.summary,
    e.fullUrlExample,
    e.responseSummary,
    e.responseContentType,
    e.requestBodySummary ?? '',
    e.requestBodyExampleJson ?? '',
  ];
  for (const p of e.pathParams ?? []) {
    chunks.push(p.name, p.description, p.example ?? '');
  }
  for (const qe of e.queryParams ?? []) {
    chunks.push(qe.name, qe.description, qe.example ?? '');
  }
  for (const h of e.requestHeaders) {
    chunks.push(h.name, h.description);
  }
  return chunks.some((c) => c.toLowerCase().includes(n));
}

function methodStyle(method: string) {
  const m = method.toUpperCase();
  if (m === 'GET')
    return {
      pill: 'bg-sky-900 text-sky-200 border-sky-900',
      text: 'text-sky-400',
    };
  if (m === 'POST')
    return {
      pill: 'bg-amber-900 text-amber-100 border-amber-900',
      text: 'text-amber-300',
    };
  if (m === 'PUT' || m === 'PATCH')
    return {
      pill: 'bg-violet-900 text-violet-200 border-violet-900',
      text: 'text-violet-300',
    };
  if (m === 'DELETE')
    return {
      pill: 'bg-red-900 text-rose-200 border-red-900',
      text: 'text-rose-300',
    };
  return {
    pill: 'bg-zinc-800/80 text-zinc-300 border-zinc-600/70',
    text: 'text-zinc-300',
  };
}

function highlightBash(cmd: string): ReactNode[] {
  const regex = /("(?:[^"\\]|\\.)*")|(\s-{1,2}[A-Za-z-]+)|(^curl\b)/g;
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(cmd))) {
    if (m.index > last) parts.push(cmd.slice(last, m.index));
    if (m[1]) {
      parts.push(
        <span key={key++} className="text-emerald-400/90">
          {m[1]}
        </span>
      );
    } else if (m[2]) {
      parts.push(
        <span key={key++} className="text-sky-400/90">
          {m[2]}
        </span>
      );
    } else if (m[3]) {
      parts.push(
        <span key={key++} className="text-fuchsia-400/90 font-semibold">
          {m[3]}
        </span>
      );
    }
    last = regex.lastIndex;
  }
  if (last < cmd.length) parts.push(cmd.slice(last));
  return parts;
}

function highlightJson(json: string): ReactNode[] {
  const regex =
    /("(?:[^"\\]|\\.)*"(?=\s*:))|("(?:[^"\\]|\\.)*")|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?)/g;
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(json))) {
    if (m.index > last) parts.push(json.slice(last, m.index));
    if (m[1]) {
      parts.push(
        <span key={key++} className="text-sky-300/90">
          {m[1]}
        </span>
      );
    } else if (m[2]) {
      parts.push(
        <span key={key++} className="text-emerald-400/90">
          {m[2]}
        </span>
      );
    } else if (m[3]) {
      parts.push(
        <span key={key++} className="text-violet-300/90">
          {m[3]}
        </span>
      );
    } else if (m[4]) {
      parts.push(
        <span key={key++} className="text-amber-300/90">
          {m[4]}
        </span>
      );
    }
    last = regex.lastIndex;
  }
  if (last < json.length) parts.push(json.slice(last));
  return parts;
}

function ParamTable({
  title,
  rows,
}: {
  title: string;
  rows: { cells: string[] }[];
}) {
  if (rows.length === 0) return null;
  const showTitle = Boolean(title?.trim());
  return (
    <div>
      {showTitle ? (
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
          {title.trim()}
        </p>
      ) : null}
      <div className="rounded-xl border border-zinc-800 overflow-hidden shadow-inner ring-1 ring-zinc-800/50">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-zinc-800/90">
            {rows.map((row, i) => (
              <tr key={i} className="bg-zinc-950/55">
                {row.cells.map((cell, j) => (
                  <td
                    key={j}
                    className={`px-3 py-2.5 align-top leading-snug ${
                      j === 0
                        ? 'font-mono text-zinc-200 w-[28%] shrink-0 text-[13px]'
                        : 'text-zinc-400'
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CodeBlock({
  label,
  code,
  language,
  copyId,
  copiedId,
  onCopy,
}: {
  label: string;
  code: string;
  language: 'bash' | 'json' | 'text';
  copyId: string;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  const isCopied = copiedId === copyId;
  const highlighted =
    language === 'json'
      ? highlightJson(code)
      : language === 'bash'
        ? highlightBash(code)
        : code;
  return (
    <div className="rounded-xl border border-zinc-800 bg-black/40 ring-1 ring-zinc-800/50 overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-zinc-800/80 bg-zinc-900/50">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        <button
          type="button"
          onClick={() => void onCopy(code, copyId)}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-sky-300 transition-colors"
        >
          {isCopied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          {isCopied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="text-[12.5px] sm:text-[13px] leading-relaxed p-3.5 overflow-x-auto font-mono whitespace-pre-wrap break-all text-zinc-300">
        <code>{highlighted}</code>
      </pre>
    </div>
  );
}

function EndpointCard({
  e,
  anchorId,
  copiedId,
  onCopy,
}: {
  e: DeveloperApiDocEndpoint;
  anchorId: string;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  const rowKey = e.endpointKey;
  const ms = methodStyle(e.method);
  const base =
    import.meta.env.VITE_SERVER_URL || 'https://your-host.example.com';
  const curl = e.exampleCurl.replace('https://your-host.example.com', base);

  const pathRows =
    e.pathParams?.map((p) => ({
      cells: [
        p.name,
        [p.description, p.example ? `e.g. ${p.example}` : '']
          .filter(Boolean)
          .join(' · '),
      ],
    })) ?? [];

  const queryRows =
    e.queryParams?.map((q) => ({
      cells: [
        q.name,
        `${q.required ? 'Required' : 'Optional'} · ${q.description}${q.example ? ` · e.g. ${q.example}` : ''}`,
      ],
    })) ?? [];

  const headerRows = e.requestHeaders.map((h) => ({
    cells: [
      h.name,
      `${h.required ? 'Required' : 'Optional'} · ${h.description}`,
    ],
  }));

  return (
    <article
      id={anchorId}
      className="scroll-mt-24 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 shadow-inner ring-1 ring-zinc-800/40 overflow-hidden"
    >
      <div className="px-5 sm:px-6 pt-4 pb-3.5 border-b border-zinc-800/70">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            {e.title}
          </p>
          <span className="text-zinc-700 text-[11px]">·</span>
          <code className="text-[11px] font-mono text-zinc-600 truncate">
            {e.scopeId}
          </code>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide border font-mono shrink-0 ${ms.pill}`}
          >
            {e.method}
          </span>
          <code className="text-[15px] sm:text-base text-zinc-50 font-mono font-medium break-all leading-snug">
            {e.pathTemplate}
          </code>
          {e.availableSince > 1 && (
            <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-200 bg-emerald-900 border border-emerald-900 rounded-md px-1.5 py-0.5 shrink-0">
              v{e.availableSince}+ only
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr]">
        <div className="min-w-0 px-5 sm:px-6 py-5 space-y-5 lg:border-r lg:border-zinc-800/70">
          <div className="space-y-1.5">
            <p className="text-sm text-zinc-400 leading-relaxed">
              {e.responseSummary}
            </p>
            <p className="text-xs text-zinc-600">
              Returns{' '}
              <code className="text-zinc-500">{e.responseContentType}</code>
            </p>
          </div>
          <ParamTable title="Path parameters" rows={pathRows} />
          <ParamTable title="Query parameters" rows={queryRows} />
          {e.requestBodySummary ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                Request body
              </p>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {e.requestBodySummary}
              </p>
            </div>
          ) : null}
          <ParamTable title="Headers" rows={headerRows} />
        </div>

        <div className="min-w-0 px-5 sm:px-6 py-5 bg-zinc-950/30">
          <div className="lg:sticky lg:top-24 space-y-3">
            <CodeBlock
              label="cURL"
              code={curl}
              language="bash"
              copyId={`${rowKey}:curl`}
              copiedId={copiedId}
              onCopy={onCopy}
            />
            {e.requestBodyExampleJson ? (
              <CodeBlock
                label="Request body example"
                code={e.requestBodyExampleJson}
                language="json"
                copyId={`${rowKey}:body`}
                copiedId={copiedId}
                onCopy={onCopy}
              />
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function websocketAnchorId(ws: DeveloperApiDocWebsocket): string {
  const slugPath = ws.path
    .replace(/[{}]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `ws-${slugPath}`;
}

function WebSocketCard({
  ws,
  anchorId,
  copiedId,
  onCopy,
}: {
  ws: DeveloperApiDocWebsocket;
  anchorId: string;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  const eventRows = ws.events.map((e) => ({
    cells: [e.name, `${e.direction} · ${e.description}`],
  }));

  return (
    <article
      id={anchorId}
      className="scroll-mt-24 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 shadow-inner ring-1 ring-zinc-800/40 overflow-hidden"
    >
      <div className="px-5 sm:px-6 pt-4 pb-3.5 border-b border-zinc-800/70">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            {ws.title}
          </p>
          <span className="text-zinc-700 text-[11px]">·</span>
          <code className="text-[11px] font-mono text-zinc-600 truncate">
            {ws.scopeId}
          </code>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide border font-mono shrink-0 bg-fuchsia-900 text-fuchsia-200 border-fuchsia-900">
            WS
          </span>
          <code className="text-[15px] sm:text-base text-zinc-50 font-mono font-medium break-all leading-snug">
            {ws.path}
          </code>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr]">
        <div className="min-w-0 px-5 sm:px-6 py-5 space-y-5 lg:border-r lg:border-zinc-800/70">
          <p className="text-sm text-zinc-400 leading-relaxed">
            {ws.description}
          </p>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
              Authentication
            </p>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {ws.authentication}
            </p>
          </div>
          <ParamTable title="Events" rows={eventRows} />
        </div>

        <div className="min-w-0 px-5 sm:px-6 py-5 bg-zinc-950/30">
          <div className="lg:sticky lg:top-24 space-y-3">
            <CodeBlock
              label="Example (Node / socket.io-client)"
              code={ws.exampleCode}
              language="text"
              copyId={`${anchorId}:example`}
              copiedId={copiedId}
              onCopy={onCopy}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

interface DeveloperDocsProps {
  initialSpec?: DeveloperApiPublicSpec | null;
}

export default function DeveloperDocs({ initialSpec }: DeveloperDocsProps = {}) {
  const [spec, setSpec] = useState<DeveloperApiPublicSpec | null>(
    initialSpec ?? null
  );
  const [loading, setLoading] = useState(!initialSpec);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [endpointSearch, setEndpointSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pendingHashRef = useRef<string | null>(
    typeof window !== 'undefined' ? window.location.hash.slice(1) : null
  );

  useEffect(() => {
    if (initialSpec) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const s = await fetchDeveloperApiDocs();
        if (!cancelled) setSpec(s);
      } catch (e) {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : 'Failed to load API docs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialSpec]);

  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const endpointQuery = endpointSearch.trim().toLowerCase();
  const filteredEndpoints = useMemo(() => {
    if (!spec) return [];
    if (!endpointQuery) return spec.endpoints;
    return spec.endpoints.filter((e) => endpointMatchesQuery(e, endpointQuery));
  }, [spec, endpointQuery]);

  const groups = useMemo(() => {
    const m = new Map<string, DeveloperApiDocEndpoint[]>();
    for (const e of filteredEndpoints) {
      const g = groupIdFor(e.scopeId);
      const arr = m.get(g) ?? [];
      arr.push(e);
      m.set(g, arr);
    }
    const ids = [...m.keys()].sort((a, b) => {
      const ia = GROUP_ORDER.indexOf(a);
      const ib = GROUP_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return ids.map((id) => ({ id, label: groupLabelFor(id), items: m.get(id)! }));
  }, [filteredEndpoints]);

  const goToEndpoint = (id: string) => {
    setActiveId(id);
    setMobileNavOpen(false);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      window.history.replaceState(null, '', `#${id}`);
    });
  };

  useEffect(() => {
    if (!spec || !pendingHashRef.current) return;
    const id = pendingHashRef.current;
    pendingHashRef.current = null;
    const exists = spec.endpoints.some((e) => endpointAnchorId(e) === id);
    if (!exists) return;
    setActiveId(id);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
    });
  }, [spec]);

  useEffect(() => {
    if (!spec) return;
    const ids = filteredEndpoints.map((e) => endpointAnchorId(e));
    if (ids.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((en) => en.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-104px 0px -70% 0px', threshold: 0 }
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [spec, filteredEndpoints]);

  const searchBox = (
    <div className="relative group w-full">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none group-focus-within:text-blue-400/90 transition-colors" />
      <input
        type="search"
        value={endpointSearch}
        onChange={(e) => setEndpointSearch(e.target.value)}
        placeholder="Search endpoints…"
        aria-label="Search API endpoints"
        className="w-full rounded-full border border-zinc-700 bg-zinc-800/50 pl-10 pr-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 hover:border-zinc-600"
      />
    </div>
  );

  const navList = (onNavigate: (id: string) => void) => (
    <nav className="space-y-4">
      <ul className="space-y-0.5 text-sm">
        <li>
          <a
            href="#overview"
            onClick={() => onNavigate('overview')}
            className="block rounded-lg px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800/70 hover:text-zinc-100"
          >
            Overview
          </a>
        </li>
        <li>
          <a
            href="#auth"
            onClick={() => onNavigate('auth')}
            className="block rounded-lg px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800/70 hover:text-zinc-100"
          >
            Authentication &amp; limits
          </a>
        </li>
        {spec && spec.websockets.length > 0 && (
          <li>
            <a
              href="#websockets"
              onClick={() => onNavigate('websockets')}
              className="block rounded-lg px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800/70 hover:text-zinc-100"
            >
              WebSockets
            </a>
          </li>
        )}
      </ul>
      {groups.length === 0 ? (
        <p className="text-xs text-zinc-600 px-2.5">No matching endpoints.</p>
      ) : (
        groups.map((g) => (
          <div key={g.id}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1 px-2.5">
              {g.label}
            </p>
            <ul className="space-y-0.5">
              {g.items.map((e) => {
                const id = endpointAnchorId(e);
                const ms = methodStyle(e.method);
                const active = activeId === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => goToEndpoint(id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                        active
                          ? 'bg-blue-950/40 text-blue-200 ring-1 ring-blue-800/50'
                          : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200'
                      }`}
                    >
                      <span
                        className={`shrink-0 font-mono font-bold text-[10px] w-11 ${ms.text}`}
                      >
                        {e.method}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono">
                        {e.pathTemplate}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </nav>
  );

  return (
    <section className={`${cardClass()} sm:p-6`}>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="lg:hidden inline-flex items-center gap-2 self-start rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          <Menu className="w-4 h-4" />
          Browse endpoints
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-zinc-400 text-sm py-16 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading documentation…
        </div>
      )}
      {err && (
        <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-amber-200 text-sm">
          {err}{' '}
          <span className="text-zinc-500">
            (Fallback: open{' '}
            <code className="text-zinc-400">/developer-api-docs.json</code> from
            the last build.)
          </span>
        </div>
      )}

      {spec && !loading && (
        <div className="lg:flex lg:items-start lg:gap-6">
          {/* Desktop sidebar — top-24 clears the fixed Navbar (same offset as
              the layout's own pt-24); the search box stays pinned while only
              the nav list below it scrolls independently. */}
          <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 sticky top-24 self-start max-h-[calc(100vh-7rem)]">
            <div className="shrink-0 pb-3">{searchBox}</div>
            <div className="flex-1 min-h-0 overflow-y-auto pb-6">
              {navList((id) => {
                if (id === 'overview' || id === 'auth' || id === 'websockets') {
                  setActiveId(null);
                  document
                    .getElementById(id)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              })}
            </div>
          </aside>

          {/* Mobile nav drawer */}
          {mobileNavOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div
                className="absolute inset-0 bg-black/60"
                onClick={() => setMobileNavOpen(false)}
              />
              <div className="absolute inset-y-0 left-0 w-[85vw] max-w-sm overflow-y-auto bg-zinc-900 border-r border-zinc-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-zinc-200">
                    Endpoints
                  </p>
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen(false)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="mb-3">{searchBox}</div>
                {navList((id) => {
                  setMobileNavOpen(false);
                  if (id === 'overview' || id === 'auth' || id === 'websockets') {
                    setActiveId(null);
                    requestAnimationFrame(() => {
                      document
                        .getElementById(id)
                        ?.scrollIntoView({ block: 'start' });
                    });
                  }
                })}
              </div>
            </div>
          )}

          <div className="flex-1 min-w-0 space-y-6">
            <div id="overview" className="scroll-mt-24 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 shadow-inner ring-1 ring-zinc-800/45">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Spec
                  </p>
                  <p className="text-sm font-medium text-zinc-100 mt-1">
                    v{spec.specVersion}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {new Date(spec.generatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 sm:col-span-2 shadow-inner ring-1 ring-zinc-800/45">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Base URL
                  </p>
                  <code className="text-xs sm:text-sm text-sky-400/90 break-all block mt-1 leading-relaxed">
                    {spec.baseUrlTemplate}
                  </code>
                  {spec.legacyBaseUrlTemplate && (
                    <p className="text-[11px] text-zinc-500 mt-1.5">
                      Legacy base still active:{' '}
                      <code className="text-zinc-400">
                        {spec.legacyBaseUrlTemplate}
                      </code>{' '}
                      — serves everything except endpoints tagged{' '}
                      <span className="text-emerald-400">v2+ only</span>.
                    </p>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/25 shadow-inner ring-1 ring-zinc-800/45 px-4 py-3">
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {spec.description}
                </p>
              </div>
            </div>

            <div
              id="auth"
              className="scroll-mt-24 grid grid-cols-1 md:grid-cols-2 gap-3"
            >
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-4 shadow-inner ring-1 ring-zinc-800/45 min-w-0">
                <p className="text-xs font-semibold text-zinc-300 mb-2">
                  Authentication
                </p>
                <p className="text-xs text-zinc-500 leading-relaxed mb-2">
                  {spec.authentication.description}
                </p>
                <ParamTable
                  title=""
                  rows={spec.authentication.headers.map((h) => ({
                    cells: [h.name, h.description],
                  }))}
                />
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-4 shadow-inner ring-1 ring-zinc-800/45">
                <p className="text-xs font-semibold text-zinc-300 mb-2">
                  Rate limits
                </p>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {spec.rateLimiting.description}
                </p>
                <p className="text-[11px] text-zinc-600 mt-2 font-mono">
                  Default {spec.rateLimiting.defaultPerMinute}/min
                </p>
              </div>
            </div>

            {/* Mobile-only search + flat grouped list (no persistent sidebar) */}
            <div className="lg:hidden">{searchBox}</div>

            {endpointQuery && groups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-10 text-center">
                <p className="text-sm text-zinc-500">
                  No endpoints match &quot;{endpointSearch.trim()}&quot;.
                </p>
                <button
                  type="button"
                  onClick={() => setEndpointSearch('')}
                  className="mt-2 text-sm font-medium text-blue-400 hover:text-blue-300"
                >
                  Clear search
                </button>
              </div>
            ) : (
              groups.map((g) => (
                <div key={g.id} className="space-y-3">
                  <h3
                    id={`group-${g.id}`}
                    className="scroll-mt-24 text-sm font-semibold text-zinc-300 flex items-center gap-2 pt-2"
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />
                    {g.label}
                    <span className="text-xs font-normal text-zinc-600">
                      ({g.items.length})
                    </span>
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    {g.items.map((e) => {
                      const id = endpointAnchorId(e);
                      return (
                        <EndpointCard
                          key={id}
                          e={e}
                          anchorId={id}
                          copiedId={copied}
                          onCopy={copy}
                        />
                      );
                    })}
                  </div>
                </div>
              ))
            )}

            {spec.websockets.length > 0 && (
              <div id="websockets" className="scroll-mt-24 space-y-3 pt-2">
                <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />
                  WebSockets
                  <span className="text-xs font-normal text-zinc-600">
                    ({spec.websockets.length})
                  </span>
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {spec.websockets.map((ws) => {
                    const id = websocketAnchorId(ws);
                    return (
                      <WebSocketCard
                        key={id}
                        ws={ws}
                        anchorId={id}
                        copiedId={copied}
                        onCopy={copy}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
