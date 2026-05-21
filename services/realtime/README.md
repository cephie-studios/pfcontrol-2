# pfcontrol-realtime

Go Socket.io service for high-traffic realtime paths:

- `/sockets/overview` — batched overview snapshot (`rt:overview:v1` cache, 3s refresh)
- `/sockets/arrivals` — cached external arrivals per airport/network
- `/sockets/flights` — per-session flight rooms
- `/sockets/session-users` — Redis-backed presence (compatible with existing `activeUsers:*` keys)

## Build

```bash
cd services/realtime
go mod tidy
go build -o pfcontrol-realtime ./cmd/pfcontrol-realtime
```

Requires **Go 1.24+** (socket.io stack pins `quic-go` v0.58).

## Run

Uses the same env as Node: `POSTGRES_DB_URL`, `REDIS_URL`, `JWT_SECRET`, `DB_ENCRYPTION_KEY`.

From `services/realtime`, it auto-loads the repo root `.env.development` (or `.env.production` / `.env.canary` when `NODE_ENV` is set). Existing shell env wins over the file.

From the repo root, `npm run dev` starts Vite, Node, and this service together. Or run only realtime:

```bash
go run ./cmd/pfcontrol-realtime
```

`npm run dev` starts Vite only after `http://127.0.0.1:8080/health` and `:9901/health` respond, which cuts down `ws proxy error: ECONNREFUSED` noise. Occasional `ECONNRESET` on refresh or HMR is normal.

Set `REALTIME_DELEGATED=true` on the Node API and proxy the four paths to this service (see `docs/DOKPLOY_REALTIME.md`).

## Redis events (Node → Go)

| Channel | Purpose |
|---------|---------|
| `rt:flight.updated` | Fan-out flight deltas |
| `rt:flight.added` | New flight |
| `rt:flight.deleted` | Removed flight |
| `rt:session.presence` | Invalidate overview cache |
| `rt:session.atis` | Invalidate overview ATIS |
| `rt:mention` | Chat mention → `user-{id}` room |
