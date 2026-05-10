# Developer API (generated)

> Generated at **2026-05-10T14:14:23.154Z**. Do not edit by hand — run `npm run generate:developer-docs` or `npm run build`.

## Overview

HTTP JSON API under /api/ext/v1: static /data/... routes (mirrors the public data API), plus /sessions and /sessions/.../flights for session and flight access when granted. Join codes, client IPs, and ACARS tokens are never returned in developer API responses. Flight updates via PUT are only allowed for sessions created with the same API key. Each key is limited to its scopes.

- **Base URL pattern:** `/api/ext/v1`

## Authentication

Use a developer API key issued from the Developers portal after your application is approved. Keys start with `pfc_live_` (legacy `pf_live_` keys still work until rotated). Either header style works; do not send cookies for machine clients.

- **Authorization** (optional): Bearer pfc_live_…
- **X-Api-Key** (optional): Raw secret string (same value as after Bearer).

## Rate limiting

Per API key, per minute sliding window (Redis-backed). HTTP 429 with Retry-After when exceeded.

- Default: **120** requests/minute per key
- Configure: `DEVELOPER_API_RATE_LIMIT_PER_MINUTE`

## Endpoints

### Controller rating stats

**Scope:** `ratings.controller_stats`  

- **GET** `/ratings/controllers/{controllerId}/stats`
- **Response:** application/json — Aggregate rating count and average for a VATSIM controller id (no pilot identifiers).

**Path parameters**

- `controllerId` (e.g. `1234567`): VATSIM controller identifier.

**Example**

```bash
curl -sS -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" "https://your-host.example.com/api/ext/v1/ratings/controllers/1234567/stats"
```

### Active notifications

**Scope:** `notifications.read`  

- **GET** `/notifications/active`
- **Response:** application/json — Public active announcements (same fields as web homepage feed; no admin-only data).

**Example**

```bash
curl -sS -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" "https://your-host.example.com/api/ext/v1/notifications/active"
```

### Own session flight logs (metadata)

**Scope:** `flight_logs.read`  

- **GET** `/flight-logs`
- **Response:** application/json — Sanitized flight change audit entries for sessions you own (id, timestamps, action, session/flight ids only; no IP, no old/new payload text).

**Query parameters**

- `sessionId` (optional) e.g. `sess_abc123`: Filter to one owned session.
- `page` (optional) e.g. `1`: Page number (default 1).
- `limit` (optional) e.g. `50`: Page size (max 100, default 50).

**Example**

```bash
curl -sS -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" "https://your-host.example.com/api/ext/v1/flight-logs"
```

### PFATC sessions

**Scope:** `sessions.network_pfatc`  

- **GET** `/sessions/network/pfatc/{sessionId}`
- **Response:** application/json — One PFATC network session (sanitized): airport, runway, counts, controller public profile. Not limited to sessions you own.

**Path parameters**

- `sessionId` (e.g. `sess_abc123`): Session identifier.

**Example**

```bash
curl -sS -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" "https://your-host.example.com/api/ext/v1/sessions/network/pfatc/sess_abc123"
```

### PFATC sessions

**Scope:** `sessions.network_pfatc`  

- **GET** `/sessions/network/pfatc`
- **Response:** application/json — JSON array of PFATC network sessions (sanitized; no access_id). Optional airport (ICAO), page, limit.

**Query parameters**

- `airport` (optional) e.g. `EGLL`: Filter to one airport ICAO (4 letters).
- `page` (optional) e.g. `1`: Page number (default 1).
- `limit` (optional) e.g. `50`: Page size (max 100, default 50).

**Example**

```bash
curl -sS -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" "https://your-host.example.com/api/ext/v1/sessions/network/pfatc"
```

### AATC sessions

**Scope:** `sessions.network_aatc`  

- **GET** `/sessions/network/aatc/{sessionId}`
- **Response:** application/json — One Advanced ATC (AATC) network session (sanitized). Not limited to sessions you own.

**Path parameters**

- `sessionId` (e.g. `sess_abc123`): Session identifier.

**Example**

```bash
curl -sS -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" "https://your-host.example.com/api/ext/v1/sessions/network/aatc/sess_abc123"
```

### AATC sessions

**Scope:** `sessions.network_aatc`  

- **GET** `/sessions/network/aatc`
- **Response:** application/json — JSON array of Advanced ATC (AATC) network sessions (sanitized; no access_id). Optional airport, page, limit.

**Query parameters**

- `airport` (optional) e.g. `EGLL`: Filter to one airport ICAO (4 letters).
- `page` (optional) e.g. `1`: Page number (default 1).
- `limit` (optional) e.g. `50`: Page size (max 100, default 50).

**Example**

```bash
curl -sS -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" "https://your-host.example.com/api/ext/v1/sessions/network/aatc"
```

### Read flight

**Scope:** `flights.read`  

- **GET** `/sessions/{sessionId}/flights/{flightId}`
- **Response:** application/json — Single flight JSON (no IP, ACARS token, or pilot Discord linkage).

**Path parameters**

- `sessionId` (e.g. `sess_abc123`): Session identifier.
- `flightId` (e.g. `550e8400-e29b-41d4-a716-446655440000`): Flight UUID.

**Example**

```bash
curl -sS -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" "https://your-host.example.com/api/ext/v1/sessions/sess_abc123/flights/550e8400-e29b-41d4-a716-446655440000"
```

### Update flight

**Scope:** `flights.update`  

- **PUT** `/sessions/{sessionId}/flights/{flightId}`
- **Response:** application/json — Updated flight JSON (sanitized). Only allowed for sessions created with this same API key.

**Path parameters**

- `sessionId` (e.g. `sess_abc123`): Session identifier.
- `flightId` (e.g. `550e8400-e29b-41d4-a716-446655440000`): Flight UUID.

**Request body**

Partial flight fields (same subset as web UI): callsign, aircraft, departure, arrival, route, sid, star, runway, cruisingFL, clearedFL, squawk, wtc, status, remark, clearance, stand, gate, hidden, etc.

```json
{"status":"ACTIVE","runway":"27L","squawk":"1234"}
```

**Example**

```bash
curl -sS -X PUT -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" -H "Content-Type: application/json" -d '{"status":"ACTIVE","runway":"27L","squawk":"1234"}' "https://your-host.example.com/api/ext/v1/sessions/sess_abc123/flights/550e8400-e29b-41d4-a716-446655440000"
```

### List session flights

**Scope:** `flights.list`  

- **GET** `/sessions/{sessionId}/flights`
- **Response:** application/json — JSON array of flights (sanitized; no IPs or ACARS tokens).

**Path parameters**

- `sessionId` (e.g. `sess_abc123`): Session you own (created_by matches key owner).

**Example**

```bash
curl -sS -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" "https://your-host.example.com/api/ext/v1/sessions/sess_abc123/flights"
```

### Create flight

**Scope:** `flights.create`  

- **POST** `/sessions/{sessionId}/flights`
- **Response:** application/json — Creates a flight; returns sanitized flight (no ACARS token in response).

**Path parameters**

- `sessionId` (e.g. `sess_abc123`): Session you own.

**Request body**

Flight fields (same as web submit): callsign, aircraft, flight_type, departure, arrival, route, etc.

```json
{"callsign":"BAW123","aircraft":"A320","flight_type":"IFR","departure":"EGLL","arrival":"LFPG"}
```

**Example**

```bash
curl -sS -X POST -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" -H "Content-Type: application/json" -d '{"callsign":"BAW123","aircraft":"A320","flight_type":"IFR","departure":"EGLL","arrival":"LFPG"}' "https://your-host.example.com/api/ext/v1/sessions/sess_abc123/flights"
```

### Read session

**Scope:** `sessions.read`  

- **GET** `/sessions/{sessionId}`
- **Response:** application/json — Session metadata without access_id (join codes are not exposed via developer API).

**Path parameters**

- `sessionId` (e.g. `sess_abc123`): Session identifier.

**Example**

```bash
curl -sS -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" "https://your-host.example.com/api/ext/v1/sessions/sess_abc123"
```

### List my sessions

**Scope:** `sessions.list`  

- **GET** `/sessions`
- **Response:** application/json — JSON array of sessions you created (no access_id). Includes apiManaged when the session was created via the developer API.

**Example**

```bash
curl -sS -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" "https://your-host.example.com/api/ext/v1/sessions"
```

### Create session

**Scope:** `sessions.create`  

- **POST** `/sessions`
- **Response:** application/json — Creates a session tied to your user and this API key (API-managed). Returns session id and metadata without access_id.

**Request body**

airportIcao (required), optional isPFATC, isAdvancedATC (mutually exclusive), activeRunway.

```json
{"airportIcao":"EGLL","isPFATC":false,"isAdvancedATC":false,"activeRunway":"27L"}
```

**Example**

```bash
curl -sS -X POST -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" -H "Content-Type: application/json" -d '{"airportIcao":"EGLL","isPFATC":false,"isAdvancedATC":false,"activeRunway":"27L"}' "https://your-host.example.com/api/ext/v1/sessions"
```

### Airport directory

**Scope:** `data.airports`  

- **GET** `/data/airports`
- **Response:** application/json — JSON array of airport objects (static dataset).

**Example**

```bash
curl -sS -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" "https://your-host.example.com/api/ext/v1/data/airports"
```

### Aircraft types

**Scope:** `data.aircrafts`  

- **GET** `/data/aircrafts`
- **Response:** application/json — JSON array of aircraft reference records.

**Example**

```bash
curl -sS -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" "https://your-host.example.com/api/ext/v1/data/aircrafts"
```

### Airlines

**Scope:** `data.airlines`  

- **GET** `/data/airlines`
- **Response:** application/json — JSON array of airline reference records.

**Example**

```bash
curl -sS -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" "https://your-host.example.com/api/ext/v1/data/airlines"
```

### Frequencies summary

**Scope:** `data.frequencies`  

- **GET** `/data/frequencies`
- **Response:** application/json — JSON array of per-airport frequency summaries.

**Example**

```bash
curl -sS -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" "https://your-host.example.com/api/ext/v1/data/frequencies"
```

### Background assets

**Scope:** `data.backgrounds`  

- **GET** `/data/backgrounds`
- **Response:** application/json — JSON array of background image metadata (filename, path, extension).

**Example**

```bash
curl -sS -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" "https://your-host.example.com/api/ext/v1/data/backgrounds"
```

### Route finder

**Scope:** `data.find_route`  

- **GET** `/data/findRoute`
- **Response:** application/json — JSON object with path (waypoint ids), distance, success.

**Query parameters**

- `from` (required) e.g. `EGLL`: Start waypoint identifier.
- `to` (required) e.g. `LFPG`: End waypoint identifier.

**Example**

```bash
curl -sS -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" "https://your-host.example.com/api/ext/v1/data/findRoute?from=EGLL&to=LFPG"
```

### Airport runways

**Scope:** `data.airport_runways`  

- **GET** `/data/airports/{icao}/runways`
- **Response:** application/json — JSON array of runway strings/objects for the airport.

**Path parameters**

- `icao` (e.g. `EGLL`): Airport ICAO code (case-insensitive in URL).

**Example**

```bash
curl -sS -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" "https://your-host.example.com/api/ext/v1/data/airports/EGLL/runways"
```

### Airport SIDs

**Scope:** `data.airport_sids`  

- **GET** `/data/airports/{icao}/sids`
- **Response:** application/json — JSON array of SID definitions for the airport.

**Path parameters**

- `icao` (e.g. `EGLL`): Airport ICAO code.

**Example**

```bash
curl -sS -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" "https://your-host.example.com/api/ext/v1/data/airports/EGLL/sids"
```

### Airport STARs

**Scope:** `data.airport_stars`  

- **GET** `/data/airports/{icao}/stars`
- **Response:** application/json — JSON array of STAR definitions for the airport.

**Path parameters**

- `icao` (e.g. `EGLL`): Airport ICAO code.

**Example**

```bash
curl -sS -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" "https://your-host.example.com/api/ext/v1/data/airports/EGLL/stars"
```

### Airport status

**Scope:** `data.airport_status`  

- **GET** `/data/airports/{icao}/status`
- **Response:** application/json — JSON with active PFATC/Advanced session summary, controller, runway, flight count, METAR when available.

**Path parameters**

- `icao` (e.g. `EGLL`): Airport ICAO code.

**Example**

```bash
curl -sS -H "Authorization: Bearer YOUR_PFC_LIVE_KEY" -H "Accept: application/json" "https://your-host.example.com/api/ext/v1/data/airports/EGLL/status"
```
