import { describe, expect, it } from 'vitest';
import {
  ACARS_CHARACTERS,
  STANDBY,
  diffRoutes,
  isDelivered,
  isSendableAcarsText,
  normalizeAcarsText,
  providerFlight,
  providerMessages,
  repliesFor,
} from '../../src/utils/externalAcars.js';
import type {
  ProviderMessage,
  ProviderStatus,
} from '../../src/types/externalAcars.js';

const uplink = (overrides: Partial<ProviderMessage> = {}): ProviderMessage => ({
  id: 'm1',
  direction: 'uplink',
  state: 'open',
  min: 4,
  response_attr: 'W/U',
  ...overrides,
});

describe('repliesFor', () => {
  it('offers the replies a message accepts, plus STANDBY', () => {
    expect(repliesFor(uplink()).map((reply) => reply.label)).toEqual([
      'WILCO',
      'UNABLE',
      'STANDBY',
    ]);
  });

  it('drops STANDBY once it has been sent', () => {
    expect(repliesFor(uplink(), 'standby').map((reply) => reply.label)).toEqual(
      ['WILCO', 'UNABLE']
    );
  });

  it('offers nothing once a final answer has gone out', () => {
    expect(repliesFor(uplink(), 'final')).toEqual([]);
  });

  it.each([
    ['a downlink', { direction: 'downlink' as const }],
    ['a closed uplink', { state: 'closed' as const }],
    ['a message without a number', { min: undefined }],
    ['a message that needs no reply', { response_attr: 'N' }],
    ['an unknown reply attribute', { response_attr: undefined }],
  ])('offers nothing for %s', (_name, overrides) => {
    expect(repliesFor(uplink(overrides))).toEqual([]);
  });

  it('never repeats STANDBY among the replies', () => {
    expect(repliesFor(uplink({ response_attr: 'Y' }))).toContainEqual(STANDBY);
    expect(
      repliesFor(uplink({ response_attr: 'Y' })).filter(
        (reply) => reply.element === STANDBY.element
      )
    ).toHaveLength(1);
  });
});

describe('isDelivered', () => {
  it('only accepts an explicit delivery', () => {
    expect(isDelivered({ delivered: true })).toBe(true);
    expect(isDelivered({ delivered: false })).toBe(false);
    expect(isDelivered(null)).toBe(false);
    expect(isDelivered({} as never)).toBe(false);
  });
});

describe('ACARS_CHARACTERS', () => {
  it('matches what the datalink can carry', () => {
    expect(ACARS_CHARACTERS.test("REQ DIRECT ABC, FL350 (A/B) +1:2 'X'?")).toBe(
      true
    );
    expect(ACARS_CHARACTERS.test('lower case')).toBe(false);
    expect(ACARS_CHARACTERS.test('NO_UNDERSCORES')).toBe(false);
  });
});

describe('providerFlight', () => {
  const status: ProviderStatus = {
    filing: {
      callsign: 'BAW123',
      aircraft_type: 'A320',
      departure_airport: 'EGLL',
      destination_airport: 'EGKK',
      requested_flight_level: 350,
      route: 'DCT',
    },
  };

  it('maps a plan onto the native flight shape', () => {
    expect(providerFlight(status, 'S1', 'F1')).toMatchObject({
      id: 'F1',
      session_id: 'S1',
      callsign: 'BAW123',
      aircraft: 'A320',
      departure: 'EGLL',
      arrival: 'EGKK',
      cruisingFL: '350',
      route: 'DCT',
    });
  });

  it('prefers the live strip over the filing', () => {
    const live = { ...status, flight: { ...status.filing!, route: 'LAM' } };
    expect(providerFlight(live, 'S1', 'F1')?.route).toBe('LAM');
  });

  it('is null without a plan', () => {
    expect(providerFlight({}, 'S1', 'F1')).toBeNull();
  });

  it('shows what the controller cleared, not what is being squawked', () => {
    const plan = providerFlight(
      {
        flight: {
          callsign: 'BAW123',
          transponder: { squawk: '2000' },
          clearance: {
            assigned_squawk: '5271',
            cleared_flight_level: 60,
            stand: '512',
            cleared: true,
          },
        },
      },
      'S1',
      'F1'
    );
    expect(plan).toMatchObject({
      squawk: '5271',
      clearedFL: '60',
      stand: '512',
      clearance: true,
    });
  });
});

describe('isSendableAcarsText', () => {
  it('accepts free text the datalink can carry', () => {
    expect(isSendableAcarsText('request   descent fl240')).toBe(true);
    expect(normalizeAcarsText(' request   descent\tfl240 ')).toBe(
      'REQUEST DESCENT FL240'
    );
  });

  it.each([
    ['nothing', ''],
    ['only punctuation', ' . ? '],
    ['an underscore', 'NO_UNDERSCORES'],
    ['too much text', 'A'.repeat(221)],
  ])('refuses %s', (_name, text) => {
    expect(isSendableAcarsText(text)).toBe(false);
  });
});

describe('providerMessages', () => {
  const opened = '2026-01-01T10:00:00.000Z';

  it('opens with the warning and the filing state', () => {
    const messages = providerMessages(
      { filing: { callsign: 'BAW123' } },
      opened
    );
    expect(messages.map((message) => message.type)).toEqual([
      'warning',
      'Success',
    ]);
    expect(messages[1].text).toContain('AWAITING A CONTROLLER');
  });

  it('names the controller working the flight', () => {
    const messages = providerMessages(
      { flight: { callsign: 'BAW123', controller: 'EGLL_TWR' } },
      opened
    );
    expect(messages[1].text).toBe(
      'FLIGHT PLAN BAW123 IS BEING WORKED BY EGLL_TWR'
    );
  });

  it('turns datalink messages into terminal lines', () => {
    const messages = providerMessages(
      {
        flight: { callsign: 'BAW123' },
        datalink: {
          state: 'connected',
          messages: [
            uplink({
              id: 'u',
              sender: 'EGLL_TWR',
              lines: ['CLEARED', 'FL350'],
            }),
            {
              id: 'd',
              direction: 'downlink',
              body: 'WILCO',
              created_at: '2026-01-01T10:05:00.000Z',
            },
          ],
        },
      },
      opened
    );
    expect(messages.slice(2)).toEqual([
      expect.objectContaining({
        id: 'u',
        station: 'EGLL_TWR',
        text: 'CLEARED\nFL350',
        type: 'pdc',
        timestamp: opened,
      }),
      expect.objectContaining({
        id: 'd',
        station: 'BAW123',
        text: 'WILCO',
        type: 'pilot',
      }),
    ]);
  });

  it('flags a downlink that never got through', () => {
    const messages = providerMessages(
      {
        flight: { callsign: 'BAW123' },
        datalink: {
          state: 'connected',
          messages: [
            { id: 'd', direction: 'downlink', body: 'HELLO', state: 'error' },
          ],
        },
      },
      opened
    );
    expect(messages[2].text).toBe('HELLO\n[NOT DELIVERED]');
  });
});

describe('diffRoutes', () => {
  it('marks only the words that differ', () => {
    const diff = diffRoutes('DCT LAM DCT BNN', 'DCT OCK DCT BNN');
    expect(diff.from.filter((word) => word.changed).map((w) => w.text)).toEqual(
      ['LAM']
    );
    expect(diff.to.filter((word) => word.changed).map((w) => w.text)).toEqual([
      'OCK',
    ]);
  });

  it('marks everything on a route that was empty', () => {
    const diff = diffRoutes('', 'DCT LAM');
    expect(diff.from).toEqual([]);
    expect(diff.to.every((word) => word.changed)).toBe(true);
  });

  it('marks nothing on identical routes', () => {
    const diff = diffRoutes('DCT LAM', 'DCT  LAM');
    expect(diff.from.some((word) => word.changed)).toBe(false);
    expect(diff.to.some((word) => word.changed)).toBe(false);
  });
});
