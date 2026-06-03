import { DEVELOPER_SCOPE_CATALOG } from './scopeRegistry.js';
import {
  DEVELOPER_EXT_ROUTES,
  pathTemplateForRoute,
  type DeveloperExtRouteDefinition,
} from './extRoutes.js';

export interface DeveloperApiDocHeader {
  name: string;
  required: boolean;
  description: string;
}

export interface DeveloperApiDocEndpoint {
  scopeId: string;
  // Stable key for UI (method + path; scopeId can repeat across methods in future).
  endpointKey: string;
  title: string;
  summary: string;
  method: string;
  // Path appended to base URL (includes /data/...).
  pathTemplate: string;
  fullUrlExample: string;
  pathParams?: { name: string; description: string; example?: string }[];
  queryParams?: {
    name: string;
    required: boolean;
    description: string;
    example?: string;
  }[];
  requestBodySummary?: string;
  requestBodyExampleJson?: string;
  requestHeaders: DeveloperApiDocHeader[];
  responseContentType: string;
  responseSummary: string;
  exampleCurl: string;
}

export interface DeveloperApiPublicSpec {
  specVersion: number;
  generatedAt: string;
  title: string;
  description: string;
  baseUrlTemplate: string;
  authentication: {
    description: string;
    headers: DeveloperApiDocHeader[];
  };
  rateLimiting: {
    description: string;
    defaultPerMinute: number;
    envVar: string;
  };
  endpoints: DeveloperApiDocEndpoint[];
}

const DEFAULT_BASE = 'https://pfcontrol.com/api/ext/v1';

function catalogTitle(scopeId: string): string {
  const c = DEVELOPER_SCOPE_CATALOG.find((x) => x.id === scopeId);
  return c?.label ?? scopeId;
}

function catalogSummary(scopeId: string): string {
  const c = DEVELOPER_SCOPE_CATALOG.find((x) => x.id === scopeId);
  return c?.description ?? '';
}

function escapeShellSingleQuotes(s: string): string {
  return `'${s.replace(/'/g, `'"'"'`)}'`;
}

function buildExampleCurl(
  method: string,
  pathWithQuery: string,
  bodyJson?: string
): string {
  const headers =
    '-H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json"';
  const m = method.toUpperCase();
  if (m === 'GET' || m === 'HEAD') {
    return `curl -sS ${headers} "${DEFAULT_BASE}${pathWithQuery}"`;
  }
  if (bodyJson) {
    return `curl -sS -X ${m} ${headers} -H "Content-Type: application/json" -d ${escapeShellSingleQuotes(bodyJson)} "${DEFAULT_BASE}${pathWithQuery}"`;
  }
  return `curl -sS -X ${m} ${headers} "${DEFAULT_BASE}${pathWithQuery}"`;
}

function endpointFromRoute(
  r: DeveloperExtRouteDefinition
): DeveloperApiDocEndpoint {
  const pathTemplate = pathTemplateForRoute(r);
  let examplePath = pathTemplate;
  if (r.pathParams?.length) {
    for (const p of r.pathParams) {
      examplePath = examplePath.replace(
        `{${p.name}}`,
        p.example ?? `{${p.name}}`
      );
    }
  }
  let query = '';
  if (r.queryParams?.length) {
    const parts = r.queryParams
      .filter((q) => q.required && q.example)
      .map(
        (q) => `${encodeURIComponent(q.name)}=${encodeURIComponent(q.example!)}`
      );
    if (parts.length) query = `?${parts.join('&')}`;
  }
  const pathWithQuery = `${examplePath}${query}`;

  const requestHeaders: DeveloperApiDocHeader[] = [
    {
      name: 'Authorization',
      required: false,
      description: 'Bearer token: `Authorization: Bearer pfc_live_...`',
    },
    {
      name: 'X-Api-Key',
      required: false,
      description:
        'Alternative to Authorization: send the raw `pfc_live_...` secret in this header.',
    },
    {
      name: 'Accept',
      required: false,
      description: 'Optional; responses are JSON (`application/json`).',
    },
  ];

  return {
    scopeId: r.scopeId,
    endpointKey: `${r.method} ${pathTemplate}`,
    title: catalogTitle(r.scopeId),
    summary: catalogSummary(r.scopeId),
    method: r.method,
    pathTemplate,
    fullUrlExample: `${DEFAULT_BASE}${pathWithQuery}`,
    pathParams: r.pathParams,
    queryParams: r.queryParams,
    requestBodySummary: r.requestBodySummary,
    requestBodyExampleJson: r.requestBodyExampleJson,
    requestHeaders,
    responseContentType: 'application/json',
    responseSummary: r.responseSummary,
    exampleCurl: buildExampleCurl(
      r.method,
      pathWithQuery,
      r.requestBodyExampleJson
    ),
  };
}

export function buildDeveloperApiPublicSpec(): DeveloperApiPublicSpec {
  const defaultPerMinute = Number(
    process.env.DEVELOPER_API_RATE_LIMIT_PER_MINUTE
  );
  const perMin =
    Number.isFinite(defaultPerMinute) && defaultPerMinute > 0
      ? defaultPerMinute
      : 120;

  return {
    specVersion: 1,
    generatedAt: new Date().toISOString(),
    title: 'PFControl Developer API',
    description:
      'HTTP JSON API under /api/ext/v1: static /data/... routes (mirrors the public data API), plus /sessions and /sessions/.../flights for session and flight access when granted. Join codes, client IPs, and ACARS tokens are never returned in developer API responses. Flight updates via PUT are only allowed for sessions created with the same API key. Each key is limited to its scopes.',
    baseUrlTemplate: '/api/ext/v1',
    authentication: {
      description:
        'Use a developer API key issued from the Developers portal after your application is approved. Keys start with `pfc_live_` (legacy `pf_live_` keys still work until rotated). Either header style works; do not send cookies for machine clients.',
      headers: [
        {
          name: 'Authorization',
          required: false,
          description: 'Bearer pfc_live_…',
        },
        {
          name: 'X-Api-Key',
          required: false,
          description: 'Raw secret string (same value as after Bearer).',
        },
      ],
    },
    rateLimiting: {
      description:
        'Per API key, per minute sliding window (Redis-backed). HTTP 429 with Retry-After when exceeded.',
      defaultPerMinute: perMin,
      envVar: 'DEVELOPER_API_RATE_LIMIT_PER_MINUTE',
    },
    endpoints: [...DEVELOPER_EXT_ROUTES].map(endpointFromRoute),
  };
}
