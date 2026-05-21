package overview

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/config"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/dto"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/store"
	"github.com/redis/go-redis/v9"
)

const cacheKey = "rt:overview:v1"

type Service struct {
	cfg      config.Config
	db       *store.Store
	rdb      *redis.Client
	mu       sync.RWMutex
	cached   *dto.OverviewData
	building bool
	clients  int
}

func New(cfg config.Config, db *store.Store, rdb *redis.Client) *Service {
	return &Service{cfg: cfg, db: db, rdb: rdb}
}

func (s *Service) IncClients() { s.mu.Lock(); s.clients++; s.mu.Unlock() }
func (s *Service) DecClients() {
	s.mu.Lock()
	s.clients--
	if s.clients < 0 {
		s.clients = 0
	}
	s.mu.Unlock()
}

func (s *Service) StartBackground(ctx context.Context, broadcast func(*dto.OverviewData)) {
	ticker := time.NewTicker(time.Duration(s.cfg.OverviewRefreshSec) * time.Second)
	go func() {
		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				return
			case <-ticker.C:
				if s.clientCount() > 0 {
					data, err := s.BuildAndCache(ctx)
					if err != nil {
						log.Printf("[overview] background refresh: %v", err)
					} else if data != nil && broadcast != nil {
						broadcast(data)
					}
				}
			}
		}
	}()
}

func (s *Service) clientCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.clients
}

func (s *Service) GetCached(ctx context.Context) (*dto.OverviewData, error) {
	raw, err := s.rdb.Get(ctx, cacheKey).Bytes()
	if err == nil && len(raw) > 0 {
		var data dto.OverviewData
		if json.Unmarshal(raw, &data) == nil {
			return &data, nil
		}
	}
	return s.BuildAndCache(ctx)
}

func (s *Service) BuildAndCache(ctx context.Context) (*dto.OverviewData, error) {
	data, err := s.build(ctx)
	if err != nil {
		return nil, err
	}
	s.mu.Lock()
	s.cached = data
	s.mu.Unlock()
	if b, err := json.Marshal(data); err == nil {
		ttl := time.Duration(s.cfg.OverviewRefreshSec*2) * time.Second
		_ = s.rdb.Set(ctx, cacheKey, b, ttl).Err()
	}
	return data, nil
}

func (s *Service) Invalidate(ctx context.Context) {
	_ = s.rdb.Del(ctx, cacheKey).Err()
}

func (s *Service) build(ctx context.Context) (*dto.OverviewData, error) {
	activeIDs, err := store.ScanActiveSessionIDs(ctx, s.rdb)
	if err != nil {
		return nil, err
	}
	sessions, err := s.db.GetNetworkSessionsByIDs(ctx, activeIDs)
	if err != nil {
		return nil, err
	}

	sessionIDs := make([]string, 0, len(sessions))
	for _, sess := range sessions {
		sessionIDs = append(sessionIDs, sess.SessionID)
	}
	flightsBySession, err := s.db.GetFlightsForSessionsSince(ctx, sessionIDs, 1)
	if err != nil {
		return nil, err
	}

	sectorControllers, _ := store.GetActiveSectorControllers(ctx, s.rdb)

	activeSessions := make([]dto.OverviewSession, 0)
	totalFlights := 0

	for _, sess := range sessions {
		users, err := store.GetActiveUsersForSession(ctx, s.rdb, sess.SessionID)
		if err != nil || len(users) == 0 {
			continue
		}

		userIDs := make([]string, 0, len(users))
		for _, u := range users {
			userIDs = append(userIDs, u.ID)
		}
		userRows, _ := s.db.GetUsersByIDs(ctx, userIDs)

		controllers := make([]dto.ControllerBadge, 0, len(users))
		for _, u := range users {
			badge := dto.ControllerBadge{
				Username:          u.Username,
				Role:              u.Position,
				HasVatsimRating:   false,
				IsEventController: store.UserHasEventControllerRole(u.Roles),
			}
			if u.Avatar != nil {
				badge.Avatar = u.Avatar
			} else if row, ok := userRows[u.ID]; ok {
				badge.Avatar = store.AvatarURL(u.ID, row.Avatar)
			}
			if row, ok := userRows[u.ID]; ok && row.VatsimRatingID != nil && *row.VatsimRatingID > 1 {
				badge.HasVatsimRating = true
			}
			controllers = append(controllers, badge)
		}

		flights := flightsBySession[sess.SessionID]
		if flights == nil {
			flights = []dto.OverviewFlight{}
		}
		atis := store.DecryptSessionATIS(s.cfg.EncryptionKey, sess.AtisRaw)

		activeSessions = append(activeSessions, dto.OverviewSession{
			SessionID:     sess.SessionID,
			AirportIcao:   sess.AirportIcao,
			ActiveRunway:  sess.ActiveRunway,
			CreatedAt:     sess.CreatedAt.UTC().Format(time.RFC3339),
			CreatedBy:     sess.CreatedBy,
			IsPFATC:       sess.IsPFATC,
			IsAdvancedATC: sess.IsAdvancedATC,
			ActiveUsers:   len(users),
			Controllers:   controllers,
			Atis:          atis,
			Flights:       flights,
			FlightCount:   len(flights),
		})
		totalFlights += len(flights)
	}

	for _, sc := range sectorControllers {
		badge := dto.ControllerBadge{
			Username:          sc.Username,
			Role:              "CTR",
			Avatar:            sc.Avatar,
			IsEventController: store.UserHasEventControllerRole(sc.Roles),
		}
		userRows, _ := s.db.GetUsersByIDs(ctx, []string{sc.ID})
		if row, ok := userRows[sc.ID]; ok {
			if badge.Avatar == nil {
				badge.Avatar = store.AvatarURL(sc.ID, row.Avatar)
			}
			if row.VatsimRatingID != nil && *row.VatsimRatingID > 1 {
				badge.HasVatsimRating = true
			}
		}
		activeSessions = append(activeSessions, dto.OverviewSession{
			SessionID:     "sector-" + sc.ID,
			AirportIcao:   sc.Station,
			CreatedAt:     time.UnixMilli(sc.JoinedAt).UTC().Format(time.RFC3339),
			CreatedBy:     sc.ID,
			IsPFATC:       true,
			ActiveUsers:   1,
			Controllers:   []dto.ControllerBadge{badge},
			Flights:       []dto.OverviewFlight{},
			FlightCount:   0,
		})
	}

	arrivalsByAirport := make(map[string][]dto.OverviewFlight)
	for _, sess := range activeSessions {
		for _, f := range sess.Flights {
			arr, _ := f["arrival"].(string)
			if arr == "" {
				continue
			}
			upper := strings.ToUpper(strings.TrimSpace(arr))
			if upper == "" {
				continue
			}
			copyF := make(dto.OverviewFlight)
			for k, v := range f {
				copyF[k] = v
			}
			copyF["sessionId"] = sess.SessionID
			copyF["departureAirport"] = sess.AirportIcao
			arrivalsByAirport[upper] = append(arrivalsByAirport[upper], copyF)
		}
	}

	return &dto.OverviewData{
		ActiveSessions:      activeSessions,
		TotalActiveSessions: len(activeSessions),
		TotalFlights:        totalFlights,
		ArrivalsByAirport:   arrivalsByAirport,
		LastUpdated:         time.Now().UTC().Format(time.RFC3339),
	}, nil
}
