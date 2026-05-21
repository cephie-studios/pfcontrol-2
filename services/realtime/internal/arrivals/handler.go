package arrivals

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/bus"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/config"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/conn"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/flights"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/sanitize"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/socketutil"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/store"
	"github.com/redis/go-redis/v9"
	socketio "github.com/zishang520/socket.io/servers/socket/v3"
)

func HandleConnection(
	ctx context.Context,
	cfg config.Config,
	db *store.Store,
	rdb *redis.Client,
	svc *Service,
	flightsIO *socketio.Server,
	arrivalsIO *socketio.Server,
	client *socketio.Socket,
) {
	sessionID := socketutil.Query(client, "sessionId")
	accessID := socketutil.Query(client, "accessId")
	if sessionID == "" || accessID == "" {
		client.Disconnect(true)
		return
	}
	ok, err := store.ValidateSessionAccess(ctx, db, sessionID, accessID)
	if err != nil || !ok {
		client.Disconnect(true)
		return
	}
	sess, err := db.GetSessionNetwork(ctx, sessionID)
	if err != nil || sess == nil || (!sess.IsPFATC && !sess.IsAdvancedATC) {
		client.Disconnect(true)
		return
	}
	network := "pfatc"
	if sess.IsAdvancedATC {
		network = "advanced_atc"
	}
	client.SetData(&conn.SocketData{
		SessionID:   sessionID,
		NetworkKind: network,
		AirportIcao: sess.AirportIcao,
	})
	client.Join(socketio.Room(sessionID))

	list, err := svc.GetCached(ctx, sess.AirportIcao, network)
	if err != nil {
		log.Printf("[arrivals] session %s (%s/%s): %v", sessionID, sess.AirportIcao, network, err)
		client.Emit("initialExternalArrivals", []any{})
		return
	}
	client.Emit("initialExternalArrivals", list)

	client.On("updateArrival", func(args ...any) {
		handleUpdate(ctx, db, rdb, flightsIO, arrivalsIO, client, args)
	})
}

func handleUpdate(
	ctx context.Context,
	db *store.Store,
	rdb *redis.Client,
	flightsIO *socketio.Server,
	arrivalsIO *socketio.Server,
	client *socketio.Socket,
	args []any,
) {
	body := parseArg(args)
	if body == nil {
		return
	}
	sd := conn.Get(client.Data())
	sessionID := sd.SessionID
	airport := sd.AirportIcao
	network := sd.NetworkKind
	flightID := fmt.Sprint(body["flightId"])
	updates, _ := body["updates"].(map[string]interface{})
	if flightID == "" || updates == nil {
		return
	}
	sourceSession, err := db.FindFlightSourceSession(ctx, flightID, airport, network)
	if err != nil || sourceSession == "" {
		client.Emit("arrivalError", map[string]interface{}{"action": "update", "flightId": flightID, "error": "Flight not found in any session"})
		return
	}
	filtered := map[string]interface{}{}
	allowed := map[string]bool{"clearedfl": true, "status": true, "star": true, "remark": true, "squawk": true, "gate": true}
	for k, v := range updates {
		lk := strings.ToLower(k)
		if lk == "clearedfl" {
			k = "clearedfl"
		}
		if allowed[lk] || allowed[k] {
			if lk == "clearedfl" {
				if s, ok := v.(string); ok {
					v = sanitize.FlightLevel(s)
				}
				filtered["clearedfl"] = v
			} else if lk == "star" && v != nil {
				filtered["star"] = sanitize.String(v.(string), 16)
			} else if lk == "remark" && v != nil {
				filtered["remark"] = sanitize.String(v.(string), 500)
			} else if lk == "squawk" && v != nil {
				filtered["squawk"] = sanitize.Squawk(v.(string))
			} else if lk == "gate" && v != nil {
				filtered["gate"] = sanitize.String(v.(string), 8)
			} else {
				filtered[k] = v
			}
		}
	}
	if len(filtered) == 0 {
		client.Emit("arrivalError", map[string]interface{}{"action": "update", "flightId": flightID, "error": "No valid fields to update"})
		return
	}
	updated, err := db.UpdateFlight(ctx, sourceSession, flightID, filtered)
	if err != nil || updated == nil {
		client.Emit("arrivalError", map[string]interface{}{"action": "update", "flightId": flightID, "error": "Failed to update arrival"})
		return
	}
	flightsIO.To(socketio.Room(sourceSession)).Emit("flightUpdated", updated)
	arrivalsIO.To(socketio.Room(sessionID)).Emit("arrivalUpdated", updated)
	nk := network
	bus.Publish(ctx, rdb, "rt:flight.updated", bus.FlightPayload{
		SessionID:   sourceSession,
		Flight:      updated,
		NetworkKind: &nk,
	})
	_ = flights.FanoutOtherArrivalSessions(ctx, db, arrivalsIO, updated, sessionID, network)
}

func parseArg(args []any) map[string]interface{} {
	if len(args) == 0 {
		return nil
	}
	if m, ok := args[0].(map[string]interface{}); ok {
		return m
	}
	return nil
}
