import http from 'node:http';
import type { Application } from 'express';

export type AppHttpResult = { status: number; body: unknown };

/**
 * HTTP-level assertions without supertest/superagent (avoids broken nested deps like asynckit on Windows).
 * Uses `http.request` (not `fetch`) so tests can mock `globalThis.fetch` for route handlers without breaking the client call.
 */
export async function appRequest(
  app: Application,
  method: 'GET' | 'POST',
  path: string,
  jsonBody?: unknown
): Promise<AppHttpResult> {
  return await new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr === null || typeof addr === 'string') {
        server.close();
        reject(new Error('invalid server address'));
        return;
      }
      const port = addr.port;
      const hasBody = method === 'POST' && jsonBody !== undefined;
      const bodyStr = hasBody ? JSON.stringify(jsonBody) : undefined;
      const opts: http.RequestOptions = {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: hasBody
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(bodyStr!, 'utf8'),
            }
          : undefined,
      };

      const req = http.request(opts, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let body: unknown;
          if (!text) {
            body = null;
          } else {
            try {
              body = JSON.parse(text) as unknown;
            } catch {
              body = text;
            }
          }
          resolve({ status: res.statusCode ?? 0, body });
          server.close();
        });
      });
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  });
}
