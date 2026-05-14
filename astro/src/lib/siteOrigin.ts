export function getSiteOrigin(request: Request): string {
  const forwardedHost = request.headers
    .get('x-forwarded-host')
    ?.split(',')[0]
    ?.trim();
  const url = new URL(request.url);
  const host = forwardedHost || url.host;

  const forwardedProto = request.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim();
  const proto =
    forwardedProto ||
    (url.protocol === 'http:' || url.protocol === 'https:'
      ? url.protocol.slice(0, -1)
      : 'https');

  return `${proto}://${host}`;
}