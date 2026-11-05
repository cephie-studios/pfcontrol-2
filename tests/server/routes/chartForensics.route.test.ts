import express from 'express';
import http from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchChartGen: vi.fn() }));

vi.mock('../../../server/db/connection.js', () => ({ mainDb: {} }));
vi.mock('../../../server/db/audit.js', () => ({ logAdminAction: vi.fn() }));
vi.mock('../../../server/middleware/rolePermissions.js', () => ({
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) =>
    next(),
}));
vi.mock('../../../server/utils/chartGen.js', () => ({
  fetchChartGen: mocks.fetchChartGen,
}));

import chartForensicsRouter from '../../../server/routes/admin/chartForensics.js';

function post(path: string, body?: Buffer) {
  const app = express();
  app.use('/', chartForensicsRouter);
  return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    const server = http.createServer(app).listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method: 'POST',
          headers: { 'Content-Type': 'image/png' },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            server.close();
            resolve({
              status: res.statusCode ?? 0,
              body: JSON.parse(Buffer.concat(chunks).toString() || 'null'),
            });
          });
        }
      );
      req.on('error', reject);
      req.end(body);
    });
  });
}

describe('POST /api/admin/chart-forensics', () => {
  beforeEach(() => {
    mocks.fetchChartGen.mockReset().mockResolvedValue({
      status: 200,
      version: 'abc',
      body: Buffer.from(
        JSON.stringify({
          version: 'abcdef012345',
          airports: { EGKK: [{ kind: 'sid-1' }] },
        })
      ),
    });
  });

  it('needs both an airport and a chart when one is given', async () => {
    const res = await post('/?icao=EGKK', Buffer.from('x'));
    expect(res.status).toBe(400);
  });

  it('needs an image', async () => {
    const res = await post('/?icao=EGKK&kind=sid-1');
    expect(res.status).toBe(400);
  });

  it('rejects malformed extra user IDs', async () => {
    const res = await post(
      '/?icao=EGKK&kind=sid-1&userIds=abc',
      Buffer.from('x')
    );
    expect(res.status).toBe(400);
  });

  it('rejects a chart that does not exist', async () => {
    const res = await post('/?icao=EGKK&kind=nope', Buffer.from('x'));
    expect(res.status).toBe(404);
  });

  it('reports an unavailable chart generator', async () => {
    mocks.fetchChartGen.mockResolvedValue(null);
    const res = await post('/?icao=EGKK&kind=sid-1', Buffer.from('x'));
    expect(res.status).toBe(503);
  });
});
