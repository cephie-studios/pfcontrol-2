package server

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/arrivals"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/bus"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/config"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/conn"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/flights"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/socketutil"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/dto"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/overview"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/sessionusers"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/store"
	"github.com/redis/go-redis/v9"
	socketio "github.com/zishang520/socket.io/servers/socket/v3"
	"github.com/zishang520/socket.io/v3/pkg/types"
)

type RealtimeServer struct {
	cfg        config.Config
	db         *store.Store
	rdb        *redis.Client
	overview   *overview.Service
	arrivals   *arrivals.Service
	hub        *bus.Hub
	overviewIO *socketio.Server
	flightsIO  *socketio.Server
	arrivalsIO *socketio.Server
	sessionIO  *socketio.Server
}

func New(cfg config.Config, db *store.Store, rdb *redis.Client) *RealtimeServer {
	ov := overview.New(cfg, db, rdb)
	arr := arrivals.New(cfg, db, rdb)
	h := bus.NewHub(rdb, db, ov)
	return &RealtimeServer{
		cfg:      cfg,
		db:       db,
		rdb:      rdb,
		overview: ov,
		arrivals: arr,
		hub:      h,
	}
}

func (s *RealtimeServer) cors() *types.Cors {
	return &types.Cors{
		Origin:      s.cfg.CORSOrigins,
		Credentials: true,
	}
}

func (s *RealtimeServer) Handler(ctx context.Context) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","service":"pfcontrol-realtime"}`))
	})

	s.overviewIO = s.newSocketServer("/sockets/overview/")
	s.flightsIO = s.newSocketServer("/sockets/flights/")
	s.arrivalsIO = s.newSocketServer("/sockets/arrivals/")
	s.sessionIO = s.newSocketServer("/sockets/session-users/")

	s.hub.SetServers(s.overviewIO, s.flightsIO, s.arrivalsIO, s.sessionIO)
	s.hub.StartSubscriber(ctx)
	s.overview.StartBackground(ctx, func(data *dto.OverviewData) {
		if s.overviewIO != nil {
			s.overviewIO.Emit("overviewData", data)
		}
	})

	s.registerOverview(ctx)
	s.registerArrivals(ctx)
	s.registerFlights(ctx)
	s.registerSessionUsers(ctx)

	mux.Handle("/sockets/overview/", s.overviewIO.ServeHandler(nil))
	mux.Handle("/sockets/flights/", s.flightsIO.ServeHandler(nil))
	mux.Handle("/sockets/arrivals/", s.arrivalsIO.ServeHandler(nil))
	mux.Handle("/sockets/session-users/", s.sessionIO.ServeHandler(nil))

	return mux
}

func (s *RealtimeServer) newSocketServer(path string) *socketio.Server {
	opts := socketio.DefaultServerOptions()
	opts.SetPath(path)
	opts.SetCors(s.cors())
	// WebTransport pulls in quic/http3 deps that break some toolchain pairs; polling+websocket match the Node server.
	opts.SetTransports(types.NewSet(socketio.Polling, socketio.WebSocket))
	return socketio.NewServer(nil, opts)
}

func (s *RealtimeServer) registerOverview(ctx context.Context) {
	s.overviewIO.On("connection", func(clients ...any) {
		client := clients[0].(*socketio.Socket)
		s.overview.IncClients()
		go func() {
			data, err := s.overview.GetCached(ctx)
			if err != nil {
				log.Printf("[overview] initial snapshot: %v", err)
				client.Emit("overviewError", map[string]string{"error": "Failed to fetch overview data"})
				return
			}
			client.Emit("overviewData", data)
		}()

		client.On("disconnect", func(...any) {
			s.overview.DecClients()
		})

		isEC := queryString(client, "isEventController") == "true"
		userID := queryString(client, "userId")
		if isEC && userID != "" {
			client.SetData(&conn.SocketData{IsEventController: true})
		}

		client.On("updateFlight", func(args ...any) {
			flights.HandleOverviewUpdate(ctx, s.cfg, s.db, s.rdb, s.hub, client, args)
		})
		client.On("contactMe", func(args ...any) {
			flights.HandleOverviewContact(ctx, s.flightsIO, client, args)
		})
	})
}

func (s *RealtimeServer) registerArrivals(ctx context.Context) {
	s.arrivalsIO.On("connection", func(clients ...any) {
		client := clients[0].(*socketio.Socket)
		arrivals.HandleConnection(ctx, s.cfg, s.db, s.rdb, s.arrivals, s.flightsIO, s.arrivalsIO, client)
	})
}

func (s *RealtimeServer) registerFlights(ctx context.Context) {
	s.flightsIO.On("connection", func(clients ...any) {
		client := clients[0].(*socketio.Socket)
		flights.HandleConnection(ctx, s.cfg, s.db, s.rdb, s.flightsIO, client)
	})
}

func (s *RealtimeServer) registerSessionUsers(ctx context.Context) {
	var fieldStates sync.Map
	s.sessionIO.On("connection", func(clients ...any) {
		client := clients[0].(*socketio.Socket)
		sessionusers.HandleConnection(ctx, s.cfg, s.db, s.rdb, s.sessionIO, &fieldStates, client)
	})
}

// BroadcastOverviewSnapshot pushes full overview to all connected overview clients.
func (s *RealtimeServer) BroadcastOverviewSnapshot(ctx context.Context) {
	data, err := s.overview.BuildAndCache(ctx)
	if err != nil {
		log.Printf("[overview] broadcast build: %v", err)
		return
	}
	s.overviewIO.Emit("overviewData", data)
}

func queryString(client *socketio.Socket, key string) string {
	return socketutil.Query(client, key)
}

func parseJSONArg(args []any) map[string]interface{} {
	if len(args) == 0 {
		return nil
	}
	switch v := args[0].(type) {
	case map[string]interface{}:
		return v
	case string:
		var m map[string]interface{}
		if json.Unmarshal([]byte(v), &m) == nil {
			return m
		}
	}
	return nil
}
