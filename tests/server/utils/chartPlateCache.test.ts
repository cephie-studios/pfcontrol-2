import { beforeEach, describe, expect, it, vi } from 'vitest';

const redis = vi.hoisted(() => ({
  getBuffer: vi.fn(),
  set: vi.fn(),
}));

vi.mock('../../../server/db/connection.js', () => ({
  redisConnection: redis,
}));

import {
  createMarkedPlate,
  markedPlateKey,
  readMarkedPlate,
} from '../../../server/utils/chartPlateCache.js';

describe('marked plate cache', () => {
  beforeEach(() => {
    redis.getBuffer.mockReset().mockResolvedValue(null);
    redis.set.mockReset().mockResolvedValue('OK');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('keys a plate by viewer, label, version and file', () => {
    const base = markedPlateKey('u1', 'a b c', 'v', 'EGKK', 'sid.webp');
    expect(markedPlateKey('u2', 'a b c', 'v', 'EGKK', 'sid.webp')).not.toBe(
      base
    );
    expect(markedPlateKey('u1', 'a b d', 'v', 'EGKK', 'sid.webp')).not.toBe(
      base
    );
    expect(markedPlateKey('u1', 'a b c', 'w', 'EGKK', 'sid.webp')).not.toBe(
      base
    );
    expect(markedPlateKey('u1', 'a b c', 'v', 'EGKK', 'star.webp')).not.toBe(
      base
    );
  });

  it('stores a created plate with an expiry', async () => {
    const body = Buffer.from('marked');
    await createMarkedPlate('k1', async () => body);
    expect(redis.set).toHaveBeenCalledWith(
      'k1',
      body,
      'EX',
      expect.any(Number)
    );
  });

  it('creates a plate once for simultaneous requests', async () => {
    const create = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return Buffer.from('marked');
    });
    const [a, b] = await Promise.all([
      createMarkedPlate('k2', create),
      createMarkedPlate('k2', create),
    ]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('does not cache oversized plates', async () => {
    await createMarkedPlate('k3', async () => Buffer.alloc(5 * 1024 * 1024));
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('keeps serving when the cache is down', async () => {
    redis.getBuffer.mockRejectedValue(new Error('down'));
    redis.set.mockRejectedValue(new Error('down'));
    expect(await readMarkedPlate('k4')).toBeNull();
    const body = Buffer.from('marked');
    expect(await createMarkedPlate('k4', async () => body)).toBe(body);
  });

  it('retries after a failed creation', async () => {
    await expect(
      createMarkedPlate('k5', async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    const body = Buffer.from('ok');
    expect(await createMarkedPlate('k5', async () => body)).toBe(body);
  });
});
