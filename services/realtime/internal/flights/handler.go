package flights

import (
	"context"
	"fmt"
	"time"

	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/auth"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/bus"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/config"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/conn"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/dto"
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
	flightsIO *socketio.Server,
	client *socketio.Socket,
) {
	sessionID := socketutil.Query(client, "sessionId")
	accessID := socketutil.Query(client, "accessId")
	isEC := socketutil.Query(client, "isEventController") == "true"
	userID := auth.UserIDFromHandshake(client, cfg.JWTSecret)
	if userID == "" {
		userID = socketutil.Query(client, "userId")
	}

	if sessionID == "" {
		client.Disconnect(true)
		return
	}

	data := &conn.SocketData{SessionID: sessionID, Role: "pilot"}

	if isEC && userID != "" {
		if !auth.IsEventController(ctx, db, userID) {
			client.Disconnect(true)
			return
		}
		sess, err := db.GetSessionNetwork(ctx, sessionID)
		if err != nil || sess == nil || (!sess.IsPFATC && !sess.IsAdvancedATC) {
			client.Disconnect(true)
			return
		}
		data.Role = "controller"
		data.IsEventController = true
		data.NetworkKind = networkFrom(sess)
	} else if accessID != "" {
		ok, err := store.ValidateSessionAccess(ctx, db, sessionID, accessID)
		if err != nil || !ok {
			client.Disconnect(true)
			return
		}
		data.Role = "controller"
		if sess, _ := db.GetSessionNetwork(ctx, sessionID); sess != nil {
			data.NetworkKind = networkFrom(sess)
		}
	} else {
		client.Disconnect(true)
		return
	}

	client.SetData(data)
	client.Join(socketio.Room(sessionID))

	client.On("addFlight", func(args ...any) {
		body := parseArg(args)
		if body == nil {
			return
		}
		body["user_id"] = userID
		flight, err := db.InsertFlight(ctx, sessionID, body)
		if err != nil {
			client.Emit("flightError", map[string]string{"action": "add", "error": "Failed to add flight"})
			return
		}
		client.Emit("flightAdded", flight)
		flightsIO.To(socketio.Room(sessionID)).Emit("flightAdded", flight)
		publishFlight(ctx, rdb, "rt:flight.added", sessionID, flight, data.NetworkKind)
	})

	client.On("updateFlight", func(args ...any) {
		if data.Role != "controller" {
			client.Emit("flightError", map[string]interface{}{"action": "update", "error": "Not authorized"})
			return
		}
		body := parseArg(args)
		if body == nil {
			return
		}
		flightID := fmt.Sprint(body["flightId"])
		updates, _ := body["updates"].(map[string]interface{})
		if flightID == "" || updates == nil {
			return
		}
		if _, ok := updates["hidden"]; ok {
			return
		}
		sanitizeUpdates(updates)
		client.Emit("flightUpdateAck", map[string]interface{}{"flightId": flightID, "updates": updates})
		updated, err := db.UpdateFlight(ctx, sessionID, flightID, updates)
		if err != nil {
			client.Emit("flightError", map[string]interface{}{"action": "update", "flightId": flightID, "error": "Failed to update flight"})
			return
		}
		flightsIO.To(socketio.Room(sessionID)).Emit("flightUpdated", updated)
		publishFlight(ctx, rdb, "rt:flight.updated", sessionID, updated, data.NetworkKind)
	})

	client.On("deleteFlight", func(args ...any) {
		if data.Role != "controller" {
			return
		}
		flightID := fmt.Sprint(parseArg(args)["flightId"])
		if err := db.DeleteFlight(ctx, sessionID, flightID); err != nil {
			return
		}
		flightsIO.To(socketio.Room(sessionID)).Emit("flightDeleted", map[string]string{"flightId": flightID})
		nk := data.NetworkKind
		bus.Publish(ctx, rdb, "rt:flight.deleted", bus.FlightDeletedPayload{
			SessionID: sessionID, FlightID: flightID, NetworkKind: &nk,
		})
	})
}

func HandleOverviewUpdate(ctx context.Context, _ config.Config, db *store.Store, rdb *redis.Client, _ *bus.Hub, client *socketio.Socket, args []any) {
	data := conn.Get(client.Data())
	if !data.IsEventController {
		client.Emit("flightError", map[string]interface{}{"action": "update", "error": "Not authorized"})
		return
	}
	body := parseArg(args)
	if body == nil {
		return
	}
	sessionID := fmt.Sprint(body["sessionId"])
	flightID := fmt.Sprint(body["flightId"])
	updates, _ := body["updates"].(map[string]interface{})
	if _, ok := updates["hidden"]; ok {
		return
	}
	sanitizeUpdates(updates)
	updated, err := db.UpdateFlight(ctx, sessionID, flightID, updates)
	if err != nil {
		client.Emit("flightError", map[string]interface{}{"action": "update", "flightId": flightID, "error": err.Error()})
		return
	}
	client.Emit("flightUpdateAck", map[string]interface{}{"flightId": flightID, "updates": updates})
	nk := ""
	if sess, _ := db.GetSessionNetwork(ctx, sessionID); sess != nil {
		nk = networkFrom(sess)
	}
	publishFlight(ctx, rdb, "rt:flight.updated", sessionID, updated, nk)
}

func HandleOverviewContact(_ context.Context, flightsIO *socketio.Server, client *socketio.Socket, args []any) {
	data := conn.Get(client.Data())
	if !data.IsEventController {
		return
	}
	body := parseArg(args)
	if body == nil {
		return
	}
	sessionID := fmt.Sprint(body["sessionId"])
	msg := "CONTACT CONTROLLER ON FREQUENCY"
	if m, ok := body["message"].(string); ok && m != "" {
		msg = sanitize.String(m, 200)
	}
	flightsIO.To(socketio.Room(sessionID)).Emit("contactMe", map[string]interface{}{
		"flightId": body["flightId"],
		"message":  msg,
		"station":  body["station"],
		"position": body["position"],
		"ts":       time.Now().UTC().Format(time.RFC3339),
	})
}

func FanoutOtherArrivalSessions(ctx context.Context, db *store.Store, arrivalsIO *socketio.Server, flight dto.ClientFlight, excludeSessionID, network string) error {
	if arrivalsIO == nil || network == "" {
		return nil
	}
	arr, _ := flight["arrival"].(string)
	if arr == "" {
		return nil
	}
	ids, err := db.GetSessionsByAirportAndNetwork(ctx, arr, network)
	if err != nil {
		return err
	}
	for _, sid := range ids {
		if sid != excludeSessionID {
			arrivalsIO.To(socketio.Room(sid)).Emit("arrivalUpdated", flight)
		}
	}
	return nil
}

func publishFlight(ctx context.Context, rdb *redis.Client, channel, sessionID string, flight dto.ClientFlight, networkKind string) {
	var nk *string
	if networkKind != "" {
		nk = &networkKind
	}
	bus.Publish(ctx, rdb, channel, bus.FlightPayload{
		SessionID: sessionID, Flight: flight, NetworkKind: nk,
	})
}

func sanitizeUpdates(updates map[string]interface{}) {
	if v, ok := updates["callsign"].(string); ok {
		updates["callsign"] = sanitize.Callsign(v)
	}
	if v, ok := updates["remark"].(string); ok {
		updates["remark"] = sanitize.String(v, 500)
	}
	if v, ok := updates["squawk"].(string); ok {
		updates["squawk"] = sanitize.Squawk(v)
	}
	if v, ok := updates["clearedFL"].(string); ok {
		updates["clearedFL"] = sanitize.FlightLevel(v)
	}
	if v, ok := updates["cruisingFL"].(string); ok {
		updates["cruisingFL"] = sanitize.FlightLevel(v)
	}
	if v, ok := updates["runway"].(string); ok {
		updates["runway"] = sanitize.Runway(v)
	}
}

func networkFrom(sess *store.SessionNetwork) string {
	if sess.IsPFATC {
		return "pfatc"
	}
	if sess.IsAdvancedATC {
		return "advanced_atc"
	}
	return ""
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
