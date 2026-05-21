package store

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/dto"
	"github.com/jackc/pgx/v5"
)

type SessionNetwork struct {
	SessionID     string
	AirportIcao   string
	IsPFATC       bool
	IsAdvancedATC bool
}

func (s *Store) GetSessionNetwork(ctx context.Context, sessionID string) (*SessionNetwork, error) {
	var sn SessionNetwork
	err := s.Pool.QueryRow(ctx, `
		SELECT session_id, airport_icao, COALESCE(is_pfatc, false), COALESCE(is_advanced_atc, false)
		FROM sessions WHERE session_id = $1
	`, sessionID).Scan(&sn.SessionID, &sn.AirportIcao, &sn.IsPFATC, &sn.IsAdvancedATC)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &sn, nil
}

func (s *Store) FindFlightSourceSession(ctx context.Context, flightID, arrivalAirport, networkKind string) (string, error) {
	var sessionID string
	var err error
	if networkKind == "pfatc" {
		err = s.Pool.QueryRow(ctx, `
			SELECT f.session_id FROM flights f
			INNER JOIN sessions s ON s.session_id = f.session_id
			WHERE f.id = $1 AND UPPER(s.airport_icao) != UPPER($2) AND s.is_pfatc = true
		`, flightID, arrivalAirport).Scan(&sessionID)
	} else if networkKind == "advanced_atc" {
		err = s.Pool.QueryRow(ctx, `
			SELECT f.session_id FROM flights f
			INNER JOIN sessions s ON s.session_id = f.session_id
			WHERE f.id = $1 AND UPPER(s.airport_icao) != UPPER($2) AND s.is_advanced_atc = true
		`, flightID, arrivalAirport).Scan(&sessionID)
	} else {
		return "", fmt.Errorf("unknown network")
	}
	if err == pgx.ErrNoRows {
		return "", nil
	}
	return sessionID, err
}

var allowedFlightCols = map[string]bool{
	"callsign": true, "aircraft": true, "departure": true, "arrival": true,
	"flight_type": true, "stand": true, "gate": true, "runway": true,
	"sid": true, "star": true, "cruisingfl": true, "clearedfl": true,
	"squawk": true, "wtc": true, "status": true, "remark": true,
	"clearance": true, "pdc_remarks": true, "hidden": true, "route": true,
}

func (s *Store) UpdateFlight(ctx context.Context, sessionID, flightID string, updates map[string]interface{}) (dto.ClientFlight, error) {
	dbUpdates := map[string]interface{}{}
	for k, v := range updates {
		dbKey := k
		if k == "cruisingFL" {
			dbKey = "cruisingfl"
		}
		if k == "clearedFL" {
			dbKey = "clearedfl"
		}
		if allowedFlightCols[dbKey] {
			if dbKey == "clearance" {
				dbUpdates[dbKey] = fmt.Sprint(v)
			} else {
				dbUpdates[dbKey] = v
			}
		}
	}
	if len(dbUpdates) == 0 {
		return nil, fmt.Errorf("no valid fields")
	}
	dbUpdates["updated_at"] = time.Now().UTC()

	setParts := make([]string, 0, len(dbUpdates))
	args := []interface{}{sessionID, flightID}
	i := 3
	for col, val := range dbUpdates {
		setParts = append(setParts, fmt.Sprintf("%s = $%d", col, i))
		args = append(args, val)
		i++
	}
	q := fmt.Sprintf(`
		UPDATE flights SET %s
		WHERE session_id = $1 AND id = $2
		RETURNING id, session_id, callsign, aircraft, flight_type, departure, arrival,
		          runway, clearedfl, cruisingfl, stand, gate, remark, flight_plan_time,
		          status, clearance, squawk, star, sid, updated_at, created_at
	`, strings.Join(setParts, ", "))

	var (
		id, sid, callsign, aircraft, ft, dep, arr, runway, cleared, cruising, stand, gate, remark, fpt, status, clearance, squawk, star, sidCol *string
		updatedAt, createdAt *time.Time
	)
	err := s.Pool.QueryRow(ctx, q, args...).Scan(
		&id, &sid, &callsign, &aircraft, &ft, &dep, &arr, &runway, &cleared, &cruising,
		&stand, &gate, &remark, &fpt, &status, &clearance, &squawk, &star, &sidCol, &updatedAt, &createdAt,
	)
	if err != nil {
		return nil, err
	}
	f := dto.ClientFlight{"id": id, "session_id": sid}
	setOpt(f, "callsign", callsign)
	setOpt(f, "aircraft", aircraft)
	setOpt(f, "departure", dep)
	setOpt(f, "arrival", arr)
	setOpt(f, "clearedFL", cleared)
	setOpt(f, "cruisingFL", cruising)
	setOpt(f, "star", star)
	setOpt(f, "status", status)
	setOpt(f, "squawk", squawk)
	setOpt(f, "gate", gate)
	setOpt(f, "remark", remark)
	if updatedAt != nil {
		f["updated_at"] = updatedAt.UTC().Format(time.RFC3339)
	}
	return f, nil
}

func (s *Store) DeleteFlight(ctx context.Context, sessionID, flightID string) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM flights WHERE session_id = $1 AND id = $2`, sessionID, flightID)
	return err
}

func (s *Store) InsertFlight(ctx context.Context, sessionID string, data map[string]interface{}) (dto.ClientFlight, error) {
	id, _ := data["id"].(string)
	if id == "" {
		id = randomHex(8)
	}
	cols := []string{"id", "session_id", "updated_at", "created_at"}
	vals := []interface{}{id, sessionID, time.Now().UTC(), time.Now().UTC()}
	placeholders := []string{"$1", "$2", "$3", "$4"}
	idx := 5
	for k, v := range data {
		if k == "id" || k == "session_id" {
			continue
		}
		dbKey := k
		if k == "cruisingFL" {
			dbKey = "cruisingfl"
		}
		if k == "clearedFL" {
			dbKey = "clearedfl"
		}
		if !allowedFlightCols[dbKey] && dbKey != "user_id" && dbKey != "ip_address" && dbKey != "acars_token" && dbKey != "flight_plan_time" && dbKey != "wtc" && dbKey != "squawk" {
			continue
		}
		cols = append(cols, dbKey)
		vals = append(vals, v)
		placeholders = append(placeholders, fmt.Sprintf("$%d", idx))
		idx++
	}
	q := fmt.Sprintf(`INSERT INTO flights (%s) VALUES (%s) RETURNING id, session_id, callsign, departure, arrival, updated_at`,
		strings.Join(cols, ","), strings.Join(placeholders, ","))
	var fid, sid, callsign, dep, arr *string
	var updated *time.Time
	err := s.Pool.QueryRow(ctx, q, vals...).Scan(&fid, &sid, &callsign, &dep, &arr, &updated)
	if err != nil {
		return nil, err
	}
	f := dto.ClientFlight{"id": *fid, "session_id": *sid}
	setOpt(f, "callsign", callsign)
	setOpt(f, "departure", dep)
	setOpt(f, "arrival", arr)
	return f, nil
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
