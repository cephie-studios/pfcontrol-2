package store

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/crypto"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/dto"
	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"
)

type SessionRow struct {
	SessionID     string
	AirportIcao   string
	ActiveRunway  *string
	CreatedAt     time.Time
	CreatedBy     string
	IsPFATC       bool
	IsAdvancedATC bool
	AtisRaw       *string
}

type UserRow struct {
	ID              string
	Username        *string
	Avatar          *string
	VatsimRatingID  *int
}

func (s *Store) GetNetworkSessionsByIDs(ctx context.Context, sessionIDs []string) ([]SessionRow, error) {
	if len(sessionIDs) == 0 {
		return nil, nil
	}
	rows, err := s.Pool.Query(ctx, `
		SELECT session_id, airport_icao, active_runway, created_at, created_by,
		       COALESCE(is_pfatc, false), COALESCE(is_advanced_atc, false), atis
		FROM sessions
		WHERE session_id = ANY($1)
		  AND (is_pfatc = true OR is_advanced_atc = true)
	`, sessionIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SessionRow
	for rows.Next() {
		var r SessionRow
		if err := rows.Scan(&r.SessionID, &r.AirportIcao, &r.ActiveRunway, &r.CreatedAt, &r.CreatedBy,
			&r.IsPFATC, &r.IsAdvancedATC, &r.AtisRaw); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) GetFlightsForSessionsSince(ctx context.Context, sessionIDs []string, hoursBack int) (map[string][]dto.OverviewFlight, error) {
	result := make(map[string][]dto.OverviewFlight)
	if len(sessionIDs) == 0 {
		return result, nil
	}
	sinceIso, sinceTime := flightRecencySince(hoursBack)
	rows, err := s.Pool.Query(ctx, `
		SELECT id, session_id, user_id, callsign, aircraft, flight_type, departure, arrival,
		       alternate, route, sid, star, runway, clearedfl, cruisingfl, stand, gate, remark,
		       flight_plan_time, status, clearance, position, squawk, wtc, hidden, pdc_remarks,
		       notes, snap_images, featured_on_profile, created_at, updated_at
		FROM flights
		WHERE session_id = ANY($1)
		  AND (
		    (flight_plan_time IS NOT NULL AND flight_plan_time <> '' AND flight_plan_time >= $2)
		    OR updated_at >= $3
		    OR created_at >= $3
		  )
		ORDER BY session_id,
		         COALESCE(NULLIF(flight_plan_time, '')::timestamp, created_at, updated_at) DESC,
		         callsign ASC
	`, sessionIDs, sinceIso, sinceTime)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	userIDs := make(map[string]struct{})
	type flightRaw struct {
		sessionID string
		data      dto.OverviewFlight
		userID    *string
	}
	var raw []flightRaw

	for rows.Next() {
		var (
			id, sessionID string
			userID        *string
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
			&createdAt, &updatedAt,
		); err != nil {
			return nil, err
		}
		f := dto.OverviewFlight{
			"id":        id,
			"session_id": sessionID,
		}
		setOpt(f, "callsign", callsign)
		setOpt(f, "aircraft", aircraft)
		setOpt(f, "flight_type", flightType)
		setOpt(f, "departure", dep)
		setOpt(f, "arrival", arr)
		setOpt(f, "alternate", alt)
		setOpt(f, "route", route)
		setOpt(f, "sid", sid)
		setOpt(f, "star", star)
		setOpt(f, "runway", runway)
		setOpt(f, "clearedFL", clearedfl)
		setOpt(f, "cruisingFL", cruisingfl)
		setOpt(f, "stand", stand)
		setOpt(f, "gate", gate)
		setOpt(f, "remark", remark)
		setOpt(f, "flight_plan_time", fpt)
		setOpt(f, "status", status)
		setOpt(f, "clearance", clearance)
		setOpt(f, "squawk", squawk)
		setOpt(f, "wtc", wtc)
		if hidden != nil {
			f["hidden"] = *hidden
		}
		setOpt(f, "pdc_remarks", pdc)
		setOpt(f, "notes", notes)
		if createdAt != nil {
			f["created_at"] = createdAt.UTC().Format(time.RFC3339)
		}
		if updatedAt != nil {
			f["updated_at"] = updatedAt.UTC().Format(time.RFC3339)
		}
		if position != nil {
			var pos interface{}
			_ = json.Unmarshal(position, &pos)
			f["position"] = pos
		}
		if snap != nil {
			var imgs interface{}
			_ = json.Unmarshal(snap, &imgs)
			f["snap_images"] = imgs
		}
		if featured != nil {
			f["featured_on_profile"] = *featured
		}
		if userID != nil {
			userIDs[*userID] = struct{}{}
		}
		raw = append(raw, flightRaw{sessionID: sessionID, data: f, userID: userID})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	users := s.fetchUsersMap(ctx, keys(userIDs))
	for _, fr := range raw {
		if fr.userID != nil {
			if u, ok := users[*fr.userID]; ok {
				fr.data["user"] = u
			}
		}
		result[fr.sessionID] = append(result[fr.sessionID], fr.data)
	}
	return result, nil
}

func setOpt(m map[string]interface{}, key string, v *string) {
	if v != nil {
		m[key] = *v
	}
}

func keys(m map[string]struct{}) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

func (s *Store) fetchUsersMap(ctx context.Context, userIDs []string) map[string]map[string]interface{} {
	out := make(map[string]map[string]interface{})
	if len(userIDs) == 0 {
		return out
	}
	rows, err := s.Pool.Query(ctx, `
		SELECT id, username, avatar FROM users WHERE id = ANY($1)
	`, userIDs)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var username, avatar *string
		if err := rows.Scan(&id, &username, &avatar); err != nil {
			continue
		}
		u := map[string]interface{}{"id": id}
		if username != nil {
			u["discord_username"] = *username
		}
		if avatar != nil && *avatar != "" {
			u["discord_avatar_url"] = fmt.Sprintf("https://cdn.discordapp.com/avatars/%s/%s.png", id, *avatar)
		} else {
			u["discord_avatar_url"] = nil
		}
		out[id] = u
	}
	return out
}

func (s *Store) GetUsersByIDs(ctx context.Context, userIDs []string) (map[string]UserRow, error) {
	out := make(map[string]UserRow)
	if len(userIDs) == 0 {
		return out, nil
	}
	rows, err := s.Pool.Query(ctx, `
		SELECT id, username, avatar, vatsim_rating_id FROM users WHERE id = ANY($1)
	`, userIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var u UserRow
		if err := rows.Scan(&u.ID, &u.Username, &u.Avatar, &u.VatsimRatingID); err != nil {
			return nil, err
		}
		out[u.ID] = u
	}
	return out, rows.Err()
}

func GetActiveUsersForSession(ctx context.Context, rdb *redis.Client, sessionID string) ([]dto.SessionUser, error) {
	raw, err := rdb.HGetAll(ctx, "activeUsers:"+sessionID).Result()
	if err != nil {
		return nil, err
	}
	users := make([]dto.SessionUser, 0, len(raw))
	for _, v := range raw {
		var u dto.SessionUser
		if err := json.Unmarshal([]byte(v), &u); err != nil {
			continue
		}
		users = append(users, u)
	}
	return users, nil
}

func GetActiveSectorControllers(ctx context.Context, rdb *redis.Client) ([]dto.SectorController, error) {
	raw, err := rdb.HGetAll(ctx, "activeSectorControllers").Result()
	if err != nil {
		return nil, err
	}
	out := make([]dto.SectorController, 0, len(raw))
	for _, v := range raw {
		var c dto.SectorController
		if err := json.Unmarshal([]byte(v), &c); err != nil {
			continue
		}
		out = append(out, c)
	}
	return out, nil
}

func DecryptSessionATIS(encKey string, atisRaw *string) interface{} {
	if atisRaw == nil || *atisRaw == "" {
		return nil
	}
	var blob crypto.EncryptedBlob
	if err := json.Unmarshal([]byte(*atisRaw), &blob); err != nil {
		// might be double-encoded JSON string
		var inner string
		if err2 := json.Unmarshal([]byte(*atisRaw), &inner); err2 == nil {
			_ = json.Unmarshal([]byte(inner), &blob)
		}
	}
	if blob.IV == "" {
		return nil
	}
	dec, err := crypto.DecryptATIS(encKey, blob)
	if err != nil {
		return nil
	}
	return dec
}

func UserHasEventControllerRole(roles []dto.UserRole) bool {
	for _, r := range roles {
		if r.Name == "Event Controller" {
			return true
		}
	}
	return false
}

func AvatarURL(userID string, avatar *string) *string {
	if avatar == nil || *avatar == "" {
		return nil
	}
	u := fmt.Sprintf("https://cdn.discordapp.com/avatars/%s/%s.png", userID, *avatar)
	return &u
}

func ValidateSessionAccess(ctx context.Context, s *Store, sessionID, accessID string) (bool, error) {
	var found string
	err := s.Pool.QueryRow(ctx, `
		SELECT session_id FROM sessions WHERE session_id = $1 AND access_id = $2
	`, sessionID, accessID).Scan(&found)
	if err == pgx.ErrNoRows {
		return false, nil
	}
	return err == nil, err
}
