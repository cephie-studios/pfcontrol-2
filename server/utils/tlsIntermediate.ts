import { X509Certificate } from 'crypto';
import https from 'https';
import net from 'net';
import { Readable } from 'stream';
import tls from 'tls';

const PEEK_TIMEOUT_MS = 10000;
const ISSUER_TIMEOUT_MS = 10000;
const MAX_ISSUER_BYTES = 64 * 1024;
const MAX_CHAIN_DEPTH = 4;
const MAX_CACHED_CHAINS = 100;
const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);
const MISSING_ISSUER_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
]);

const chainCache = new Map<string, string[]>();
let trustedRoots: X509Certificate[] | null = null;

type UrlGuard = (raw: string) => Promise<URL | null>;

export function isMissingIntermediate(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } } | null)?.cause;
  return MISSING_ISSUER_CODES.has(cause?.code ?? '');
}

function isTrustedRootIssuerOf(cert: X509Certificate): boolean {
  trustedRoots ??= tls.rootCertificates.map((pem) => new X509Certificate(pem));
  return trustedRoots.some(
    (root) => cert.checkIssued(root) && cert.verify(root.publicKey)
  );
}

// Unverified on purpose: it only reads the certificates, nothing is sent.
function peekTopOfChain(url: URL): Promise<X509Certificate | null> {
  return new Promise((resolve) => {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const socket = tls.connect({
      host,
      port: Number(url.port) || 443,
      servername: net.isIP(host) ? undefined : host,
      rejectUnauthorized: false,
    });
    const done = (cert: X509Certificate | null) => {
      socket.destroy();
      resolve(cert);
    };
    socket.setTimeout(PEEK_TIMEOUT_MS, () => done(null));
    socket.once('error', () => done(null));
    socket.once('secureConnect', () => {
      let peer = socket.getPeerCertificate(true);
      while (peer.issuerCertificate && peer.issuerCertificate !== peer) {
        peer = peer.issuerCertificate;
      }
      try {
        done(peer.raw ? new X509Certificate(peer.raw) : null);
      } catch {
        done(null);
      }
    });
  });
}

function issuerUrlOf(cert: X509Certificate): string | null {
  const match = cert.infoAccess?.match(/^CA Issuers - URI:(\S+)$/m);
  return match?.[1] ?? null;
}

async function downloadIssuer(
  raw: string,
  subject: X509Certificate,
  guard: UrlGuard
): Promise<X509Certificate | null> {
  const url = await guard(raw);
  if (!url) return null;

  const res = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(ISSUER_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const body = Buffer.from(await res.arrayBuffer());
  if (body.byteLength > MAX_ISSUER_BYTES) return null;

  const issuer = new X509Certificate(body);
  if (!issuer.ca || !subject.checkIssued(issuer)) return null;
  if (!subject.verify(issuer.publicKey)) return null;
  return issuer;
}

async function completeChain(
  top: X509Certificate,
  guard: UrlGuard
): Promise<string[] | null> {
  const chain: string[] = [];
  let current = top;
  for (let depth = 0; depth < MAX_CHAIN_DEPTH; depth++) {
    const issuerUrl = issuerUrlOf(current);
    if (!issuerUrl) return null;
    const issuer = await downloadIssuer(issuerUrl, current, guard);
    if (!issuer) return null;
    chain.push(issuer.toString());
    if (isTrustedRootIssuerOf(issuer)) return chain;
    current = issuer;
  }
  return null;
}

async function missingChainFor(
  url: URL,
  guard: UrlGuard
): Promise<string[] | null> {
  const top = await peekTopOfChain(url);
  const issuerUrl = top && issuerUrlOf(top);
  if (!top || !issuerUrl) return null;

  const cached = chainCache.get(issuerUrl);
  if (cached) return cached;

  const chain = await completeChain(top, guard).catch(() => null);
  if (!chain) return null;
  if (chainCache.size >= MAX_CACHED_CHAINS) {
    chainCache.delete(chainCache.keys().next().value!);
  }
  chainCache.set(issuerUrl, chain);
  return chain;
}

function requestWithCa(
  url: URL,
  headers: Record<string, string>,
  chain: string[],
  timeoutMs: number
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        headers,
        ca: [...tls.rootCertificates, ...chain],
        signal: AbortSignal.timeout(timeoutMs),
      },
      (res) => {
        const status = res.statusCode ?? 502;
        const responseHeaders = new Headers();
        for (const [name, value] of Object.entries(res.headers)) {
          if (value === undefined) continue;
          for (const item of Array.isArray(value) ? value : [value]) {
            responseHeaders.append(name, item);
          }
        }
        const body = NULL_BODY_STATUSES.has(status)
          ? null
          : (Readable.toWeb(res) as ReadableStream<Uint8Array>);
        if (!body) res.resume();
        resolve(new Response(body, { status, headers: responseHeaders }));
      }
    );
    req.once('error', reject);
    req.end();
  });
}

// Node doesn't fetch intermediates a server forgets to send, unlike browsers.
// The chain still has to verify up to a trusted root.
export async function fetchWithIssuer(
  url: URL,
  headers: Record<string, string>,
  timeoutMs: number,
  guard: UrlGuard
): Promise<Response | null> {
  if (url.protocol !== 'https:') return null;
  const chain = await missingChainFor(url, guard);
  return chain ? requestWithCa(url, headers, chain, timeoutMs) : null;
}
