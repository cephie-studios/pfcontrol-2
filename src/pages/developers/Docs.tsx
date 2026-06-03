import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Copy,
  Check,
  Loader2,
  ChevronRight,
  Search,
} from "lucide-react";
import type {
  DeveloperApiDocEndpoint,
  DeveloperApiPublicSpec,
} from "../../types/developerApiSpec";
import { fetchDeveloperApiDocs } from "../../utils/fetch/developer";
import { cardClass } from "./constants";

function endpointBodySummary(summary: string): string {
  const idx = summary.indexOf(" — ");
  if (idx !== -1) return summary.slice(idx + 3).trim();
  return summary.trim();
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
    e.requestBodySummary ?? "",
    e.requestBodyExampleJson ?? "",
  ];
  for (const p of e.pathParams ?? []) {
    chunks.push(p.name, p.description, p.example ?? "");
  }
  for (const qe of e.queryParams ?? []) {
    chunks.push(qe.name, qe.description, qe.example ?? "");
  }
  for (const h of e.requestHeaders) {
    chunks.push(h.name, h.description);
  }
  return chunks.some((c) => c.toLowerCase().includes(n));
}

function methodStyle(method: string) {
  const m = method.toUpperCase();
  if (m === "GET")
    return {
      pill: "bg-sky-950/55 text-sky-400/90 border-sky-800/70",
    };
  if (m === "POST")
    return {
      pill: "bg-amber-950/50 text-amber-300/90 border-amber-900/55",
    };
  if (m === "PUT" || m === "PATCH")
    return {
      pill: "bg-violet-950/50 text-violet-300/90 border-violet-900/55",
    };
  if (m === "DELETE")
    return {
      pill: "bg-rose-950/50 text-rose-300/90 border-rose-900/55",
    };
  return {
    pill: "bg-zinc-800/80 text-zinc-300 border-zinc-600/70",
  };
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
    <div className={showTitle ? "mt-3" : ""}>
      {showTitle ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
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
                        ? "font-mono text-zinc-200 w-[28%] shrink-0 text-[13px]"
                        : "text-zinc-400"
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

function EndpointCard({
  e,
  copiedId,
  onCopy,
}: {
  e: DeveloperApiDocEndpoint;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  const rowKey = e.endpointKey ?? `${e.method}:${e.pathTemplate}`;
  const ms = methodStyle(e.method);
  const base =
    import.meta.env.VITE_SERVER_URL || "https://your-host.example.com";

  const pathRows =
    e.pathParams?.map((p) => ({
      cells: [
        p.name,
        [p.description, p.example ? `e.g. ${p.example}` : ""]
          .filter(Boolean)
          .join(" · "),
      ],
    })) ?? [];

  const queryRows =
    e.queryParams?.map((q) => ({
      cells: [
        q.name,
        `${q.required ? "Required" : "Optional"} · ${q.description}${q.example ? ` · e.g. ${q.example}` : ""}`,
      ],
    })) ?? [];

  const headerRows = e.requestHeaders.map((h) => ({
    cells: [
      h.name,
      `${h.required ? "Required" : "Optional"} · ${h.description}`,
    ],
  }));

  return (
    <article className="rounded-2xl  bg-zinc-800/40 overflow-hidden min-h-0 shadow-inner ring-1 ring-zinc-800/45">
      <div className="p-4 sm:p-5 min-w-0">
        <div className="flex flex-wrap items-center gap-2 gap-y-2">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide border font-mono shrink-0 ${ms.pill}`}
          >
            {e.method}
          </span>
          <code className="text-sm sm:text-[15px] text-zinc-100 font-mono break-all leading-snug flex-1 min-w-48">
            {e.pathTemplate}
          </code>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400 px-2 py-1 shrink-0">
            {e.scopeId}
          </span>
        </div>
        <h3 className="text-lg font-semibold text-zinc-50 mt-4 leading-snug">
          {e.title}
        </h3>
        {(() => {
          const body = endpointBodySummary(e.summary);
          if (!body) return null;
          return (
            <p className="text-sm text-zinc-400 mt-2 leading-relaxed line-clamp-4">
              {body}
            </p>
          );
        })()}

        <details className="mt-4 group">
          <summary className="flex items-center gap-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden text-sm font-medium text-sky-400/95 hover:text-sky-300 select-none">
            <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
            Details
          </summary>
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2.5 shadow-inner ring-1 ring-zinc-800/40">
              <p className="text-xs font-semibold text-zinc-400 mb-1">
                Response
              </p>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <code className="text-sm text-emerald-400/95">
                  {e.responseContentType}
                </code>
                <span className="text-sm text-zinc-500">
                  {e.responseSummary}
                </span>
              </div>
            </div>
            <ParamTable title="Path" rows={pathRows} />
            <ParamTable title="Query" rows={queryRows} />
            <ParamTable title="Headers" rows={headerRows} />
            {(e.requestBodySummary || e.requestBodyExampleJson) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                  Request body
                </p>
                {e.requestBodySummary ? (
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {e.requestBodySummary}
                  </p>
                ) : null}
                {e.requestBodyExampleJson ? (
                  <pre className="text-xs sm:text-sm leading-relaxed bg-black/35 border border-zinc-700 rounded-xl p-3 overflow-x-auto text-zinc-300 mt-2 font-mono whitespace-pre-wrap ring-1 ring-zinc-800/40">
                    {e.requestBodyExampleJson}
                  </pre>
                ) : null}
              </div>
            )}
            <div className="pt-3 border-t border-zinc-800">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  curl
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void onCopy(
                      e.exampleCurl.replace(
                        "https://your-host.example.com",
                        base
                      ),
                      rowKey
                    )
                  }
                  className="flex items-center gap-1.5 text-sm font-medium text-sky-400/95 hover:text-sky-300 mr-2"
                >
                  {copiedId === rowKey ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  Copy
                </button>
              </div>
              <pre className="text-xs sm:text-sm leading-relaxed bg-black/35 border border-zinc-800 rounded-xl p-3 overflow-x-auto text-zinc-300 font-mono whitespace-pre-wrap ring-1 ring-zinc-800/40">
                {e.exampleCurl.replace("https://your-host.example.com", base)}
              </pre>
            </div>
          </div>
        </details>
      </div>
    </article>
  );
}

export default function DeveloperDocs() {
  const [spec, setSpec] = useState<DeveloperApiPublicSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [endpointSearch, setEndpointSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const s = await fetchDeveloperApiDocs();
        if (!cancelled) setSpec(s);
      } catch (e) {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : "Failed to load API docs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <section className={`${cardClass()} sm:p-6`}>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-zinc-50">
              API reference
            </h2>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
            Built from the same route definitions as production. Each route
            needs a key that includes its scope. Open &quot;Overview and
            authentication&quot; for surface area, keys, and header styles.
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-zinc-400 text-sm py-16 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading documentation…
        </div>
      )}
      {err && (
        <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-amber-200 text-sm">
          {err}{" "}
          <span className="text-zinc-500">
            (Fallback: open{" "}
            <code className="text-zinc-400">/developer-api-docs.json</code> from
            the last build.)
          </span>
        </div>
      )}

      {spec && !loading && (
        <div className="space-y-6">
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
            </div>
          </div>

          <details className="group rounded-2xl border border-zinc-800 bg-zinc-900/25 shadow-inner ring-1 ring-zinc-800/45">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-zinc-300 hover:text-zinc-100 select-none [&::-webkit-details-marker]:hidden">
              <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-90" />
              Overview and authentication
            </summary>
            <div className="space-y-3 border-t border-zinc-800/90 px-4 pb-4 pt-3 text-sm text-zinc-400 leading-relaxed">
              <p>{spec.description}</p>
              <p>{spec.authentication.description}</p>
            </div>
          </details>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-4 shadow-inner ring-1 ring-zinc-800/45 min-w-0">
              <p className="text-xs font-semibold text-zinc-300 mb-2">
                Auth headers
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

          <div>
            <h3 className="text-sm font-semibold text-zinc-300 mb-2">
              Endpoints
            </h3>
            <div className="relative group w-full mb-3">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none group-focus-within:text-blue-400/90 transition-colors" />
              <input
                type="search"
                value={endpointSearch}
                onChange={(e) => setEndpointSearch(e.target.value)}
                placeholder="Search path, method, scope, title…"
                aria-label="Search API endpoints"
                className="w-full rounded-full border border-zinc-700 bg-zinc-800/50 pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ring-1 ring-zinc-700/40 hover:border-zinc-600"
              />
            </div>
            {endpointQuery ? (
              <p className="text-xs text-zinc-500 mb-3">
                Showing {filteredEndpoints.length} of {spec.endpoints.length}{" "}
                endpoints
                {filteredEndpoints.length === 0
                  ? ` — no matches for "${endpointSearch.trim()}".`
                  : null}{" "}
                {filteredEndpoints.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setEndpointSearch("")}
                    className="text-blue-400 hover:text-blue-300 font-medium"
                  >
                    Clear search
                  </button>
                ) : null}
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-4">
              {filteredEndpoints.map((e) => (
                <EndpointCard
                  key={e.endpointKey ?? `${e.method}:${e.pathTemplate}`}
                  e={e}
                  copiedId={copied}
                  onCopy={copy}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
