import type { AcarsMessage } from '../types/acars';
import type { Flight } from '../types/flight';
import type {
  ProviderMessage,
  ProviderResult,
  ProviderStatus,
} from '../types/externalAcars';

export const MAX_ACARS_MESSAGE = 220;
export const ACARS_CHARACTERS = /^[A-Z0-9 .,\-/+:'()?]*$/;
export const DATALINK_STATION = /^[A-Z0-9]{4}$/;
export const SQUAWK = /^[0-7]{4}$/;

export interface AcarsReply {
  element: string;
  label: string;
}

export const STANDBY: AcarsReply = { element: 'DM2', label: 'STANDBY' };

const WILCO: AcarsReply = { element: 'DM0', label: 'WILCO' };
const UNABLE: AcarsReply = { element: 'DM1', label: 'UNABLE' };
const ROGER: AcarsReply = { element: 'DM3', label: 'ROGER' };
const AFFIRM: AcarsReply = { element: 'DM4', label: 'AFFIRM' };
const NEGATIVE: AcarsReply = { element: 'DM5', label: 'NEGATIVE' };

const REPLIES: Record<string, AcarsReply[]> = {
  'W/U': [WILCO, UNABLE],
  'A/N': [AFFIRM, NEGATIVE],
  R: [ROGER],
  Y: [WILCO, UNABLE, ROGER, AFFIRM, NEGATIVE],
};

export type ReplyProgress = 'standby' | 'final';

export function repliesFor(
  message: ProviderMessage,
  progress?: ReplyProgress
): AcarsReply[] {
  if (
    message.direction !== 'uplink' ||
    message.state !== 'open' ||
    !Number.isInteger(message.min) ||
    progress === 'final'
  ) {
    return [];
  }
  const replies = REPLIES[message.response_attr ?? ''];
  if (!replies?.length) return [];
  return progress === 'standby' ? replies : [...replies, STANDBY];
}

export function isDelivered(result: ProviderResult | null | undefined) {
  return result?.delivered === true;
}

export function providerFlight(
  status: ProviderStatus,
  sessionId: string,
  flightId: string
): Flight | null {
  const plan = status.flight ?? status.filing;
  if (!plan) return null;
  return {
    id: flightId,
    session_id: sessionId,
    callsign: plan.callsign,
    aircraft: plan.aircraft_type ?? undefined,
    flight_type: plan.flight_rules ?? undefined,
    departure: plan.departure_airport ?? undefined,
    arrival: plan.destination_airport ?? undefined,
    cruisingFL:
      plan.requested_flight_level == null
        ? undefined
        : String(plan.requested_flight_level),
    route: plan.route ?? undefined,
    alternate: plan.alternate ?? undefined,
    runway: plan.runway ?? undefined,
    sid: plan.sid ?? undefined,
    star: plan.star ?? undefined,
    squawk: plan.transponder?.squawk ?? undefined,
    clearance: plan.clearance?.cleared,
  };
}

export function providerMessages(
  status: ProviderStatus,
  opened: string
): AcarsMessage[] {
  const plan = status.flight ?? status.filing;

  const banner: AcarsMessage[] = [
    {
      id: 'external-warning',
      timestamp: opened,
      station: 'SYSTEM',
      text: 'DO NOT CLOSE THIS WINDOW, CONTROLLERS MAY SEND CLEARANCES AND INSTRUCTIONS THROUGH THE ACARS TERMINAL',
      type: 'warning',
    },
  ];

  if (!plan) {
    banner.push({
      id: 'external-plan',
      timestamp: opened,
      station: 'SYSTEM',
      text: 'NO FLIGHT PLAN ON FILE',
      type: 'contact',
    });
  } else {
    banner.push({
      id: 'external-plan',
      timestamp: opened,
      station: 'SYSTEM',
      text: status.flight
        ? `FLIGHT PLAN ${plan.callsign} IS BEING WORKED${plan.controller ? ` BY ${plan.controller}` : ''}`
        : `FLIGHT PLAN ${plan.callsign} SUBMITTED SUCCESSFULLY, AWAITING A CONTROLLER`,
      type: 'Success',
    });
  }

  const datalink = (status.datalink?.messages ?? []).map(
    (message): AcarsMessage => {
      const uplink = message.direction === 'uplink';
      return {
        id: message.id,
        timestamp: message.created_at ?? opened,
        station: uplink
          ? (message.sender ?? 'ATC')
          : (plan?.callsign ?? 'PILOT'),
        text: message.lines?.length
          ? message.lines.join('\n')
          : (message.body ?? ''),
        type: uplink ? 'pdc' : 'pilot',
      };
    }
  );

  return [...banner, ...datalink];
}

export type RouteWord = { text: string; changed: boolean };

export function diffRoutes(
  from: string,
  to: string
): { from: RouteWord[]; to: RouteWord[] } {
  const a = from.split(/\s+/).filter(Boolean);
  const b = to.split(/\s+/).filter(Boolean);

  const common = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0)
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      common[i][j] =
        a[i] === b[j]
          ? common[i + 1][j + 1] + 1
          : Math.max(common[i + 1][j], common[i][j + 1]);
    }
  }

  const keptA = new Set<number>();
  const keptB = new Set<number>();
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) {
      keptA.add(i++);
      keptB.add(j++);
    } else if (common[i + 1][j] >= common[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  return {
    from: a.map((text, i) => ({ text, changed: !keptA.has(i) })),
    to: b.map((text, j) => ({ text, changed: !keptB.has(j) })),
  };
}

export function initialNotes(plan: Flight): string {
  return [
    'FLIGHT PLAN DETAILS',
    `Callsign: ${plan.callsign ?? ''}`,
    `Aircraft: ${plan.aircraft ?? ''}`,
    `Departure: ${plan.departure ?? ''}`,
    `Arrival: ${plan.arrival ?? ''}`,
    `Requested FL: ${plan.cruisingFL ?? ''}`,
    `Route: ${plan.route ?? ''}`,
    '',
    'NOTES:',
    '',
  ].join('\n');
}
