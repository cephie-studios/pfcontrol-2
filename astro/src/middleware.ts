import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  const type = response.headers.get('Content-Type');
  if (!type) return response;
  const lower = type.toLowerCase();
  if (!lower.includes('charset=') && lower.includes('text/html')) {
    const headers = new Headers(response.headers);
    headers.set(
      'Content-Type',
      type.trim().endsWith(';')
        ? `${type} charset=utf-8`
        : `${type}; charset=utf-8`
    );
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  return response;
});