function trimEnvUrl(raw: string | undefined): string {
  return (raw ?? '').trim().replace(/\/$/, '');
}

function forwardedFirst(value: string | null): string | undefined {
  const v = value?.split(',')[0]?.trim();
  return v || undefined;
}

function pickProto(request: Request, url: URL): 'http' | 'https' {
  const fp = forwardedFirst(request.headers.get('x-forwarded-proto'));
  if (fp === 'http' || fp === 'https') return fp;
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    return url.protocol === 'http:' ? 'http' : 'https';
  }
  return 'https';
}

function originFromProtoHost(proto: 'http' | 'https', host: string): string {
  const h = host.replace(/^https?:\/\//i, '').trim();
  if (!h) throw new Error('empty host');
  return new URL(`${proto}://${h}`).origin;
}

export function getSiteOrigin(request: Request): string {
  const envRaw = trimEnvUrl(import.meta.env.PUBLIC_SITE_URL);
  if (envRaw) {
    try {
      const withScheme = /^https?:\/\//i.test(envRaw)
        ? envRaw
        : `https://${envRaw}`;
      return new URL(withScheme).origin;
    } catch {
      /* fall through */
    }
  }

  const url = new URL(request.url);
  const proto = pickProto(request, url);

  const forwardedHost = forwardedFirst(request.headers.get('x-forwarded-host'));
  if (forwardedHost) {
    try {
      return originFromProtoHost(proto, forwardedHost);
    } catch {
      /* fall through */
    }
  }

  const rawHost = forwardedFirst(request.headers.get('host'));
  if (rawHost) {
    const headerHostname = rawHost.split(':')[0]?.toLowerCase() ?? '';
    const urlHostname = url.hostname.toLowerCase();
    if (headerHostname && headerHostname !== urlHostname) {
      try {
        return originFromProtoHost(proto, rawHost);
      } catch {
        /* fall through */
      }
    }
  }

  return url.origin;
}
