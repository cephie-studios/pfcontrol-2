package store

import (
	"context"
	"fmt"
	"time"

	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/dto"
)

func (s *Store) GetExternalArrivalFlights(ctx context.Context, airportIcao string, networkKind string) ([]dto.ClientFlight, error) {
	if networkKind != "pfatc" && networkKind != "advanced_atc" {
		return nil, nil
	}
	icao := airportIcao
	if len(icao) != 4 {
		return nil, fmt.Errorf("invalid ICAO")
	}
	sinceIso, sinceTime := flightRecencySince(2)
	networkFilter := "s.is_pfatc = true"
	if networkKind == "advanced_atc" {
		networkFilter = "s.is_advanced_atc = true"
	}
	q := fmt.Sprintf(`
		SELECT f.id, f.session_id, f.user_id, f.callsign, f.aircraft, f.flight_type, f.departure, f.arrival,
		       f.alternate, f.route, f.sid, f.star, f.runway, f.clearedfl, f.cruisingfl, f.stand, f.gate,
		       f.remark, f.flight_plan_time, f.status, f.clearance, f.position, f.squawk, f.wtc, f.hidden,
		       f.pdc_remarks, f.notes, f.snap_images, f.featured_on_profile, f.created_at, f.updated_at,
		       s.session_id AS source_session_id, s.airport_icao AS source_airport
		FROM flights f
		INNER JOIN sessions s ON s.session_id = f.session_id
		WHERE UPPER(f.arrival) = UPPER($1)
		  AND UPPER(s.airport_icao) != UPPER($1)
		  AND %s
		  AND (
		    (f.flight_plan_time IS NOT NULL AND f.flight_plan_time <> '' AND f.flight_plan_time >= $2)
		    OR f.updated_at >= $3
		    OR f.created_at >= $3
		  )
	`, networkFilter)

	rows, err := s.Pool.Query(ctx, q, icao, sinceIso, sinceTime)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	userIDs := make(map[string]struct{})
	var flights []dto.ClientFlight

	for rows.Next() {
		var (
			id, sessionID string
			userID        *string
			sourceSession, sourceAirport string
			callsign, aircraft, flightType, dep, arr, alt, route, sid, star, runway *string
			clearedfl, cruisingfl, stand, gate, remark, fpt, status, clearance, squawk, wtc *string
			pdc, notes *string
			hidden, featured *bool
			position, snap []byte
			createdAt, updatedAt *time.Time
		)
		if err := rows.Scan(
			&id, &sessionID, &userID, &callsign, &aircraft, &flightType, &dep, &arr, &alt, &route,
			&sid, &star, &runway, &clearedfl, &cruisingfl, &stand, &gate, &remark, &fpt, &status,
			&clearance, &position, &squawk, &wtc, &hidden, &pdc, &notes, &snap, &featured,
			&createdAt, &updatedAt, &sourceSession, &sourceAirport,
		); err != nil {
			return nil, err
		}
		f := dto.ClientFlight{
			"id":               id,
			"session_id":       sessionID,
			"sourceSessionId":  sourceSession,
			"sourceAirport":    sourceAirport,
			"isExternal":       true,
		}
		setOpt(f, "callsign", callsign)
		setOpt(f, "aircraft", aircraft)
		setOpt(f, "flight_type", flightType)
		setOpt(f, "departure", dep)
		setOpt(f, "arrival", arr)
		setOpt(f, "clearedFL", clearedfl)
		setOpt(f, "cruisingFL", cruisingfl)
		setOpt(f, "star", star)
		setOpt(f, "squawk", squawk)
		setOpt(f, "status", status)
		setOpt(f, "gate", gate)
		setOpt(f, "remark", remark)
		if updatedAt != nil {
			f["updated_at"] = updatedAt.UTC().Format(time.RFC3339)
		}
		if userID != nil {
			userIDs[*userID] = struct{}{}
			f["_userId"] = *userID
		}
		flights = append(flights, f)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	users := s.fetchUsersMap(ctx, keys(userIDs))
	for i := range flights {
		if uid, ok := flights[i]["_userId"].(string); ok {
			delete(flights[i], "_userId")
			if u, ok := users[uid]; ok {
				flights[i]["user"] = u
			}
		}
	}
	return flights, nil
}

func (s *Store) GetSessionsByAirportAndNetwork(ctx context.Context, arrivalIcao, networkKind string) ([]string, error) {
	var rows interface {
		Next() bool
		Scan(dest ...any) error
		Close()
		Err() error
	}
	var err error
	if networkKind == "pfatc" {
		rows, err = s.Pool.Query(ctx, `
			SELECT session_id FROM sessions
			WHERE UPPER(airport_icao) = UPPER($1) AND is_pfatc = true
		`, arrivalIcao)
	} else {
		rows, err = s.Pool.Query(ctx, `
			SELECT session_id FROM sessions
			WHERE UPPER(airport_icao) = UPPER($1) AND is_advanced_atc = true
		`, arrivalIcao)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
