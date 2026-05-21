import { describe, it, expect, vi, beforeEach } from 'vitest';

const publish = vi.fn().mockResolvedValue(1);

vi.mock('../../server/db/connection.js', () => ({
  redisConnection: { publish },
}));

describe('rtEventBus', () => {
  beforeEach(() => {
    publish.mockClear();
  });

  it('publishes flight.updated on Redis channel rt:flight.updated', async () => {
    const { publishRtEvent } = await import('../../server/utils/rtEventBus.js');
    await publishRtEvent('flight.updated', {
      sessionId: 'sess-1',
      flight: { id: 'f1', callsign: 'TEST01' },
      networkKind: 'pfatc',
    });
    expect(publish).toHaveBeenCalledTimes(1);
    const [channel, body] = publish.mock.calls[0];
    expect(channel).toBe('rt:flight.updated');
    const parsed = JSON.parse(body as string);
    expect(parsed.payload.sessionId).toBe('sess-1');
    expect(parsed.payload.flight.id).toBe('f1');
  });
});