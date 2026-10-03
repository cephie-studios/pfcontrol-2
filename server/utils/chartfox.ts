import dns from 'dns/promises';
import net from 'net';
import { redisConnection } from '../db/connection.js';
import {
  deleteChartfoxLink,
  getChartfoxLink,
  saveChartfoxLink,
  type ChartfoxLink,
} from '../db/chartfoxLinks.js';
import { prefixKey } from './cacheTtl.js';
import { fetchWithIssuer, isMissingIntermediate } from './tlsIntermediate.js';

const API_BASE = 'https://api.chartfox.org';
const SITE_BASE = 'https://chartfox.org';
const DEFAULT_SCOPES =
  'airports:view charts:index charts:view charts:files oauth:user:name';
const FETCH_TIMEOUT_MS = 15000;
const FILE_TIMEOUT_MS = 30000;
const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TOKEN_MARGIN_MS = 60 * 1000;
const AIRPORT_CACHE_SEC = 6 * 60 * 60;
const CHART_CACHE_SEC = 15 * 60;
const FILE_CACHE_SEC = 24 * 60 * 60;
const MAX_CACHED_FILE_BYTES = 15 * 1024 * 1024;

const airportKey = (icao: string) => prefixKey(`chartfox:airport:v1:${icao}`);
const chartKey = (id: string) => prefixKey(`chartfox:chart:v1:${id}`);
const fileKey = (id: string) => prefixKey(`chartfox:file:v1:${id}`);

export class ChartfoxAuthError extends Error {}

export interface ChartfoxChartSummary {
  id: string;
  parentId: string | null;
  name: string;
  code: string | null;
  type: number;
  typeKey: string;
  runways: string[];
  procedures: string[];
  viewUrl: string;
  georeferenced: boolean;
}

export interface ChartfoxChartDetail {
  id: string;
  airport: string;
  name: string;
  code: string | null;
  type: number;
  typeKey: string;
  viewUrl: string;
  source: {
    name: string | null;
    copyright: string | null;
    status: string | null;
  };
  requiresPreauth: boolean;
  updatedAt: string | null;
}

interface CachedChart {
  detail: ChartfoxChartDetail;
  files: string[];
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

interface UpstreamMeta {
  type?: number;
  value?: string[];
}

interface UpstreamChartOverview {
  id: string;
  parent_id?: string | null;
  airport_icao?: string;
  name?: string;
  code?: string | null;
  type?: number;
  type_key?: string;
  meta?: UpstreamMeta[] | null;
  view_url?: string;
  has_georeferences?: boolean | null;
}

interface UpstreamChart extends UpstreamChartOverview {
  url?: string;
  source_url?: string | null;
  source?: {
    display_name?: string;
    name?: string;
    copyright_statement_short?: string;
    copyright_status_description?: string;
  } | null;
  files?: { type?: number; url?: string }[] | null;
  requires_preauth?: boolean | null;
  updated_at?: string | null;
}

export interface ChartfoxFile {
  contentType: string;
  body: Buffer;
}

function config() {
  return {
    clientId: process.env.CHARTFOX_CLIENT_ID?.trim() ?? '',
    clientSecret: process.env.CHARTFOX_CLIENT_SECRET?.trim() ?? '',
    redirectUri: process.env.CHARTFOX_REDIRECT_URI?.trim() ?? '',
    scopes: process.env.CHARTFOX_SCOPES?.trim() || DEFAULT_SCOPES,
  };
}

export function isChartfoxConfigured(): boolean {
  const { clientId, clientSecret, redirectUri } = config();
  return !!(clientId && clientSecret && redirectUri);
}

export function chartfoxAuthorizeUrl(state: string): string {
  const { clientId, redirectUri, scopes } = config();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    state,
  });
  return `${API_BASE}/oauth/authorize?${params.toString()}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestToken(
  grant: Record<string, string>
): Promise<TokenResponse | null> {
  const { clientId, clientSecret } = config();
  const res = await fetchWithTimeout(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      ...grant,
    }),
  });
  if (!res.ok) {
    console.error(`[ChartFox] Token request failed: HTTP ${res.status}`);
    return null;
  }
  const data = (await res.json()) as TokenResponse;
  return data.access_token ? data : null;
}

function expiryFrom(token: TokenResponse): Date {
  const seconds = token.expires_in ?? 60 * 60;
  return new Date(Date.now() + seconds * 1000);
}

export async function linkChartfoxAccount(
  userId: string,
  code: string
): Promise<boolean> {
  const { redirectUri } = config();
  const token = await requestToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  if (!token?.access_token) return false;

  let chartfoxUserId: number | null = null;
  let chartfoxName: string | null = null;
  try {
    const res = await fetchWithTimeout(`${API_BASE}/v2/user`, {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: 'application/json',
      },
    });
    if (res.ok) {
      const user = (await res.json()) as { id?: number; full_name?: string };
      chartfoxUserId = user.id ?? null;
      chartfoxName = user.full_name ?? null;
    }
  } catch (e) {
    console.warn('[ChartFox] User lookup failed:', e);
  }

  await saveChartfoxLink({
    userId,
    chartfoxUserId,
    chartfoxName,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    expiresAt: expiryFrom(token),
    scopes: token.scope ?? config().scopes,
  });
  return true;
}

export async function unlinkChartfoxAccount(userId: string): Promise<void> {
  await deleteChartfoxLink(userId);
}

export async function getChartfoxStatus(userId: string) {
  const link = await getChartfoxLink(userId);
  return {
    configured: isChartfoxConfigured(),
    linked: !!link,
    name: link?.chartfoxName ?? null,
  };
}

const refreshInFlight = new Map<string, Promise<ChartfoxLink | null>>();

async function refreshLink(link: ChartfoxLink): Promise<ChartfoxLink | null> {
  if (!link.refreshToken) {
    await deleteChartfoxLink(link.userId);
    return null;
  }
  const token = await requestToken({
    grant_type: 'refresh_token',
    refresh_token: link.refreshToken,
    scope: link.scopes ?? config().scopes,
  });
  if (!token?.access_token) {
    await deleteChartfoxLink(link.userId);
    return null;
  }
  const next: ChartfoxLink = {
    ...link,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? link.refreshToken,
    expiresAt: expiryFrom(token),
  };
  await saveChartfoxLink(next);
  return next;
}

function refreshOnce(link: ChartfoxLink): Promise<ChartfoxLink | null> {
  let pending = refreshInFlight.get(link.userId);
  if (!pending) {
    pending = refreshLink(link).finally(() =>
      refreshInFlight.delete(link.userId)
    );
    refreshInFlight.set(link.userId, pending);
  }
  return pending;
}

async function getActiveLink(userId: string): Promise<ChartfoxLink> {
  const link = await getChartfoxLink(userId);
  if (!link) throw new ChartfoxAuthError('Not linked');
  if (link.expiresAt.getTime() - TOKEN_MARGIN_MS > Date.now()) return link;
  const refreshed = await refreshOnce(link);
  if (!refreshed) throw new ChartfoxAuthError('Link expired');
  return refreshed;
}

async function apiGet<T>(userId: string, path: string): Promise<T | null> {
  let link = await getActiveLink(userId);
  const send = (token: string) =>
    fetchWithTimeout(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

  let res = await send(link.accessToken);
  if (res.status === 401) {
    const refreshed = await refreshOnce(link);
    if (!refreshed) throw new ChartfoxAuthError('Link expired');
    link = refreshed;
    res = await send(link.accessToken);
    if (res.status === 401) {
      await deleteChartfoxLink(userId);
      throw new ChartfoxAuthError('Link revoked');
    }
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`ChartFox ${path} failed: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await redisConnection.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (e) {
    console.warn('[ChartFox] Redis read failed:', e);
    return null;
  }
}

async function writeCache(key: string, value: unknown, ttl: number) {
  try {
    await redisConnection.set(key, JSON.stringify(value), 'EX', ttl);
  } catch (e) {
    console.warn('[ChartFox] Redis write failed:', e);
  }
}

function metaValues(meta: UpstreamMeta[] | null | undefined, type: number) {
  return (meta ?? [])
    .filter((m) => m.type === type)
    .flatMap((m) => m.value ?? [])
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function viewUrlFor(icao: string, chart: UpstreamChartOverview) {
  return chart.view_url || `${SITE_BASE}/${icao}#${chart.id}`;
}

function toSummary(
  icao: string,
  chart: UpstreamChartOverview
): ChartfoxChartSummary {
  return {
    id: chart.id,
    parentId: chart.parent_id ?? null,
    name: chart.name ?? 'Untitled chart',
    code: chart.code ?? null,
    type: chart.type ?? 0,
    typeKey: chart.type_key ?? 'Unknown',
    runways: metaValues(chart.meta, 0),
    procedures: metaValues(chart.meta, 1),
    viewUrl: viewUrlFor(icao, chart),
    georeferenced: !!chart.has_georeferences,
  };
}

export async function getChartfoxAirportCharts(
  userId: string,
  icao: string
): Promise<ChartfoxChartSummary[]> {
  const key = airportKey(icao);
  const cached = await readCache<ChartfoxChartSummary[]>(key);
  if (cached) {
    await getActiveLink(userId);
    return cached;
  }

  const data = await apiGet<{
    data?: Record<string, UpstreamChartOverview[]> | UpstreamChartOverview[];
  }>(userId, `/v2/airports/${encodeURIComponent(icao)}/charts/grouped`);

  const groups = data?.data ?? {};
  const charts = (Array.isArray(groups) ? groups : Object.values(groups).flat())
    .filter((c) => c?.id)
    .map((c) => toSummary(icao, c));

  await writeCache(key, charts, AIRPORT_CACHE_SEC);
  return charts;
}

const ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  copy: '©',
  reg: '®',
  nbsp: ' ',
};

function decodeEntities(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITY_MAP[entity.toLowerCase()] ?? match;
  });
}

async function loadChart(
  userId: string,
  id: string
): Promise<CachedChart | null> {
  const key = chartKey(id);
  const cached = await readCache<CachedChart>(key);
  if (cached) {
    await getActiveLink(userId);
    return cached;
  }

  const chart = await apiGet<UpstreamChart>(
    userId,
    `/v2/charts/${encodeURIComponent(id)}`
  );
  if (!chart?.id) return null;

  const icao = chart.airport_icao ?? '';
  const mirrors = chart.files ?? [];
  const files = [
    ...mirrors.filter((f) => f.type === 1).map((f) => f.url),
    ...mirrors.filter((f) => f.type !== 1).map((f) => f.url),
    chart.url,
    chart.source_url,
  ].filter((u): u is string => typeof u === 'string' && u.length > 0);

  const entry: CachedChart = {
    detail: {
      id: chart.id,
      airport: icao,
      name: chart.name ?? 'Untitled chart',
      code: chart.code ?? null,
      type: chart.type ?? 0,
      typeKey: chart.type_key ?? 'Unknown',
      viewUrl: viewUrlFor(icao, chart),
      source: {
        name: chart.source?.display_name ?? chart.source?.name ?? null,
        copyright: decodeEntities(chart.source?.copyright_statement_short),
        status: chart.source?.copyright_status_description ?? null,
      },
      requiresPreauth: !!chart.requires_preauth,
      updatedAt: chart.updated_at ?? null,
    },
    files: Array.from(new Set(files)),
  };

  await writeCache(key, entry, CHART_CACHE_SEC);
  return entry;
}

export async function getChartfoxChart(
  userId: string,
  id: string
): Promise<ChartfoxChartDetail | null> {
  return (await loadChart(userId, id))?.detail ?? null;
}

function isPrivateAddress(host: string): boolean {
  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    const [a, b] = host.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (ipVersion === 6) {
    const lower = host.toLowerCase();
    return (
      lower === '::1' ||
      lower === '::' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe80') ||
      lower.startsWith('::ffff:')
    );
  }
  return host === 'localhost' || host.endsWith('.localhost');
}

async function parseRemoteUrl(raw: string): Promise<URL | null> {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (isPrivateAddress(host)) return null;
    if (!net.isIP(host)) {
      const addresses = await dns.lookup(host, { all: true });
      if (addresses.some((a) => isPrivateAddress(a.address))) return null;
    }
    return url;
  } catch {
    return null;
  }
}

function isChartfoxHost(url: URL) {
  return (
    url.hostname === 'chartfox.org' || url.hostname.endsWith('.chartfox.org')
  );
}

function sniffContentType(body: Buffer, header: string | null): string {
  if (body.subarray(0, 5).toString('latin1') === '%PDF-') {
    return 'application/pdf';
  }
  if (body[0] === 0x89 && body.subarray(1, 4).toString('latin1') === 'PNG') {
    return 'image/png';
  }
  if (body[0] === 0xff && body[1] === 0xd8) return 'image/jpeg';
  if (
    body.subarray(0, 4).toString('latin1') === 'RIFF' &&
    body.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return (header ?? 'application/octet-stream').split(';')[0].trim();
}

async function fetchFile(url: URL, headers: Record<string, string>) {
  try {
    return await fetchWithTimeout(
      url.toString(),
      { headers, redirect: 'manual' },
      FILE_TIMEOUT_MS
    );
  } catch (e) {
    if (!isMissingIntermediate(e)) throw e;
    const res = await fetchWithIssuer(
      url,
      headers,
      FILE_TIMEOUT_MS,
      parseRemoteUrl
    );
    if (!res) throw e;
    return res;
  }
}

async function downloadFile(
  raw: string,
  accessToken: string
): Promise<ChartfoxFile | null> {
  let target = raw;
  let res: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await parseRemoteUrl(target);
    if (!url) return null;

    const headers: Record<string, string> = {
      Accept: 'application/pdf,image/*;q=0.9,*/*;q=0.5',
    };
    if (isChartfoxHost(url)) headers.Authorization = `Bearer ${accessToken}`;

    res = await fetchFile(url, headers);
    const location = res.headers.get('location');
    if (res.status < 300 || res.status >= 400 || !location) break;
    target = new URL(location, url).toString();
    res = null;
  }
  if (!res?.ok || !res.body) return null;

  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > MAX_FILE_BYTES) return null;

  const chunks: Buffer[] = [];
  let size = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_FILE_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(Buffer.from(value));
  }

  const body = Buffer.concat(chunks);
  const contentType = sniffContentType(body, res.headers.get('content-type'));
  if (contentType !== 'application/pdf' && !contentType.startsWith('image/')) {
    return null;
  }
  return { contentType, body };
}

async function readFileCache(key: string): Promise<ChartfoxFile | null> {
  try {
    const [contentType, body] = await Promise.all([
      redisConnection.hget(key, 'type'),
      redisConnection.hgetBuffer(key, 'body'),
    ]);
    return contentType && body ? { contentType, body } : null;
  } catch (e) {
    console.warn('[ChartFox] Redis file read failed:', e);
    return null;
  }
}

async function writeFileCache(key: string, file: ChartfoxFile) {
  if (file.body.byteLength > MAX_CACHED_FILE_BYTES) return;
  try {
    await redisConnection
      .multi()
      .hset(key, { type: file.contentType, body: file.body })
      .expire(key, FILE_CACHE_SEC)
      .exec();
  } catch (e) {
    console.warn('[ChartFox] Redis file write failed:', e);
  }
}

async function fetchChartfoxFile(
  userId: string,
  id: string
): Promise<ChartfoxFile | null> {
  const chart = await loadChart(userId, id);
  if (!chart) return null;
  const link = await getActiveLink(userId);

  for (const candidate of chart.files) {
    try {
      const file = await downloadFile(candidate, link.accessToken);
      if (file) {
        await writeFileCache(fileKey(id), file);
        return file;
      }
    } catch (e) {
      console.warn(`[ChartFox] File download failed for ${id}:`, e);
    }
  }
  return null;
}

const fileInFlight = new Map<string, Promise<ChartfoxFile | null>>();

export async function getChartfoxFile(
  userId: string,
  id: string
): Promise<ChartfoxFile | null> {
  await getActiveLink(userId);
  const cached = await readFileCache(fileKey(id));
  if (cached) return cached;

  let pending = fileInFlight.get(id);
  if (!pending) {
    pending = fetchChartfoxFile(userId, id).finally(() =>
      fileInFlight.delete(id)
    );
    fileInFlight.set(id, pending);
  }
  return pending;
}
