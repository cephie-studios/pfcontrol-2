package bus

import (
	"context"
	"encoding/json"
	"log"

	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/dto"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/overview"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/store"
	"github.com/redis/go-redis/v9"
	socketio "github.com/zishang520/socket.io/servers/socket/v3"
)

type FlightPayload struct {
	SessionID   string                 `json:"sessionId"`
	Flight      dto.ClientFlight       `json:"flight"`
	NetworkKind *string                `json:"networkKind,omitempty"`
}

type FlightDeletedPayload struct {
	SessionID   string  `json:"sessionId"`
	FlightID    string  `json:"flightId"`
	NetworkKind *string `json:"networkKind,omitempty"`
}

type Hub struct {
	rdb           *redis.Client
	db            *store.Store
	overview      *overview.Service
	overviewIO    *socketio.Server
	flightsIO     *socketio.Server
	arrivalsIO    *socketio.Server
	sessionIO     *socketio.Server
}

func NewHub(rdb *redis.Client, db *store.Store, ov *overview.Service) *Hub {
	return &Hub{rdb: rdb, db: db, overview: ov}
}

func (h *Hub) SetServers(overviewIO, flightsIO, arrivalsIO, sessionIO *socketio.Server) {
	h.overviewIO = overviewIO
	h.flightsIO = flightsIO
	h.arrivalsIO = arrivalsIO
	h.sessionIO = sessionIO
}

func (h *Hub) StartSubscriber(ctx context.Context) {
	channels := []string{
		"rt:flight.updated",
		"rt:flight.added",
		"rt:flight.deleted",
		"rt:session.presence",
		"rt:session.atis",
		"rt:mention",
	}
	sub := h.rdb.Subscribe(ctx, channels...)
	go func() {
		for msg := range sub.Channel() {
			h.handleMessage(ctx, msg.Channel, msg.Payload)
		}
	}()
}

func (h *Hub) handleMessage(ctx context.Context, channel, payload string) {
	switch channel {
	case "rt:flight.updated", "rt:flight.added":
		var envelope struct {
			Type    string          `json:"type"`
			Payload FlightPayload   `json:"payload"`
		}
		if err := json.Unmarshal([]byte(payload), &envelope); err != nil {
			return
		}
		h.onFlightChange(ctx, envelope.Payload, channel == "rt:flight.added")
	case "rt:flight.deleted":
		var envelope struct {
			Payload FlightDeletedPayload `json:"payload"`
		}
		if err := json.Unmarshal([]byte(payload), &envelope); err != nil {
			return
		}
		h.onFlightDeleted(envelope.Payload)
	case "rt:session.presence", "rt:session.atis":
		h.overview.Invalidate(ctx)
	case "rt:mention":
		var envelope struct {
			Payload struct {
				UserID  string                 `json:"userId"`
				Mention map[string]interface{} `json:"mention"`
			} `json:"payload"`
		}
		if err := json.Unmarshal([]byte(payload), &envelope); err != nil {
			return
		}
		if h.sessionIO != nil && envelope.Payload.UserID != "" {
			h.sessionIO.To(socketio.Room("user-" + envelope.Payload.UserID)).Emit("mention", envelope.Payload.Mention)
		}
	}
}

func (h *Hub) onFlightChange(ctx context.Context, p FlightPayload, isAdd bool) {
	h.overview.Invalidate(ctx)

	if h.overviewIO != nil {
		event := "flightUpdated"
		if isAdd {
			event = "flightAdded"
		}
		h.overviewIO.Emit(event, map[string]interface{}{
			"sessionId": p.SessionID,
			"flight":    p.Flight,
		})
	}

	if h.flightsIO != nil {
		event := "flightUpdated"
		if isAdd {
			event = "flightAdded"
		}
		h.flightsIO.To(socketio.Room(p.SessionID)).Emit(event, p.Flight)
	}

	h.fanoutArrivals(p)
}

func (h *Hub) onFlightDeleted(p FlightDeletedPayload) {
	if h.flightsIO != nil {
		h.flightsIO.To(socketio.Room(p.SessionID)).Emit("flightDeleted", map[string]string{"flightId": p.FlightID})
	}
}

func (h *Hub) fanoutArrivals(p FlightPayload) {
	arr, _ := p.Flight["arrival"].(string)
	if arr == "" || h.arrivalsIO == nil {
		return
	}
	network := ""
	if p.NetworkKind != nil {
		network = *p.NetworkKind
	}
	if network == "" {
		return
	}
	ctx := context.Background()
	sessionIDs, err := h.db.GetSessionsByAirportAndNetwork(ctx, arr, network)
	if err != nil {
		return
	}
	for _, sid := range sessionIDs {
		h.arrivalsIO.To(socketio.Room(sid)).Emit("arrivalUpdated", p.Flight)
	}
}

func Publish(ctx context.Context, rdb *redis.Client, channel string, payload interface{}) {
	body, err := json.Marshal(map[string]interface{}{
		"type":    channel,
		"payload": payload,
	})
	if err != nil {
		return
	}
	if err := rdb.Publish(ctx, channel, body).Err(); err != nil {
		log.Printf("[bus] publish %s: %v", channel, err)
	}
}
