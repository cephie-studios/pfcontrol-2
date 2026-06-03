const GET_SAMPLES: { scopeId: string; path: string; label: string }[] = [
  {
    scopeId: "data.airports",
    path: "/data/airports",
    label: "GET /data/airports",
  },
  {
    scopeId: "data.aircrafts",
    path: "/data/aircrafts",
    label: "GET /data/aircrafts",
  },
  {
    scopeId: "data.airlines",
    path: "/data/airlines",
    label: "GET /data/airlines",
  },
  {
    scopeId: "data.frequencies",
    path: "/data/frequencies",
    label: "GET /data/frequencies",
  },
  {
    scopeId: "data.backgrounds",
    path: "/data/backgrounds",
    label: "GET /data/backgrounds",
  },
  {
    scopeId: "data.find_route",
    path: "/data/findRoute?from=EGLL&to=LFPG",
    label: "GET /data/findRoute",
  },
  {
    scopeId: "data.airport_runways",
    path: "/data/airports/EGLL/runways",
    label: "GET /data/airports/…/runways",
  },
  {
    scopeId: "data.airport_sids",
    path: "/data/airports/EGLL/sids",
    label: "GET /data/airports/…/sids",
  },
  {
    scopeId: "data.airport_stars",
    path: "/data/airports/EGLL/stars",
    label: "GET /data/airports/…/stars",
  },
  {
    scopeId: "data.airport_status",
    path: "/data/airports/EGLL/status",
    label: "GET /data/airports/…/status",
  },
  {
    scopeId: "notifications.read",
    path: "/notifications/active",
    label: "GET /notifications/active",
  },
  {
    scopeId: "flight_logs.read",
    path: "/flight-logs",
    label: "GET /flight-logs",
  },
  {
    scopeId: "sessions.network_pfatc",
    path: "/sessions/network/pfatc",
    label: "GET /sessions/network/pfatc",
  },
  {
    scopeId: "sessions.network_aatc",
    path: "/sessions/network/aatc",
    label: "GET /sessions/network/aatc",
  },
  { scopeId: "sessions.list", path: "/sessions", label: "GET /sessions" },
  {
    scopeId: "sessions.read",
    path: "/sessions/sess_abc123",
    label: "GET /sessions/{id}",
  },
  {
    scopeId: "flights.list",
    path: "/sessions/sess_abc123/flights",
    label: "GET /sessions/…/flights",
  },
  {
    scopeId: "flights.read",
    path: "/sessions/sess_abc123/flights/550e8400-e29b-41d4-a716-446655440000",
    label: "GET /sessions/…/flights/{id}",
  },
  {
    scopeId: "ratings.controller_stats",
    path: "/ratings/controllers/1234567/stats",
    label: "GET /ratings/controllers/…/stats",
  },
];

const SESSION_CREATE_BODY = JSON.stringify({
  airportIcao: "EGLL",
  isPFATC: false,
  isAdvancedATC: false,
  activeRunway: "27L",
});

const FLIGHT_CREATE_BODY = JSON.stringify({
  callsign: "BAW123",
  aircraft: "A320",
  flight_type: "IFR",
  departure: "EGLL",
  arrival: "LFPG",
});

const FLIGHT_UPDATE_BODY = JSON.stringify({
  status: "ACTIVE",
  runway: "27L",
  squawk: "1234",
});

export type SampleCurlResult = {
  command: string;
  label: string;
};

export function buildSampleCurlForScopes(
  secret: string,
  apiExtBase: string,
  scopes: string[]
): SampleCurlResult {
  const base = apiExtBase.replace(/\/$/, "");
  const set = new Set(scopes);

  for (const g of GET_SAMPLES) {
    if (set.has(g.scopeId)) {
      const url = `${base}${g.path}`;
      return {
        command: `curl -s -H "Authorization: Bearer ${secret}" "${url}"`,
        label: g.label,
      };
    }
  }

  if (set.has("sessions.create")) {
    return {
      command: `curl -s -X POST -H "Authorization: Bearer ${secret}" -H "Content-Type: application/json" -d '${SESSION_CREATE_BODY}' "${base}/sessions"`,
      label: "POST /sessions",
    };
  }

  if (set.has("flights.create")) {
    return {
      command: `curl -s -X POST -H "Authorization: Bearer ${secret}" -H "Content-Type: application/json" -d '${FLIGHT_CREATE_BODY}' "${base}/sessions/sess_abc123/flights"`,
      label: "POST /sessions/…/flights",
    };
  }

  if (set.has("flights.update")) {
    return {
      command: `curl -s -X PUT -H "Authorization: Bearer ${secret}" -H "Content-Type: application/json" -d '${FLIGHT_UPDATE_BODY}' "${base}/sessions/sess_abc123/flights/550e8400-e29b-41d4-a716-446655440000"`,
      label: "PUT /sessions/…/flights/{id}",
    };
  }

  const url = `${base}/data/airports`;
  return {
    command: `curl -s -H "Authorization: Bearer ${secret}" "${url}"`,
    label: "GET /data/airports (fallback)",
  };
}
