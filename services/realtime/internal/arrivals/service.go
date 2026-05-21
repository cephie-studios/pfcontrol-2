package arrivals

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/config"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/dto"
	"github.com/PFConnect/pfcontrol-2/services/realtime/internal/store"
	"github.com/redis/go-redis/v9"
)

type Service struct {
	cfg config.Config
	db  *store.Store
	rdb *redis.Client
}

func New(cfg config.Config, db *store.Store, rdb *redis.Client) *Service {
	return &Service{cfg: cfg, db: db, rdb: rdb}
}

func cacheKey(network, icao string) string {
	return fmt.Sprintf("rt:arrivals:%s:%s", network, icao)
}

func (s *Service) GetCached(ctx context.Context, airportIcao, networkKind string) ([]dto.ClientFlight, error) {
	key := cacheKey(networkKind, airportIcao)
	raw, err := s.rdb.Get(ctx, key).Bytes()
	if err == nil && len(raw) > 0 {
		var flights []dto.ClientFlight
		if json.Unmarshal(raw, &flights) == nil {
			return flights, nil
		}
	}
	return s.Refresh(ctx, airportIcao, networkKind)
}

func (s *Service) Refresh(ctx context.Context, airportIcao, networkKind string) ([]dto.ClientFlight, error) {
	flights, err := s.db.GetExternalArrivalFlights(ctx, airportIcao, networkKind)
	if err != nil {
		return nil, err
	}
	if b, err := json.Marshal(flights); err == nil {
		ttl := time.Duration(s.cfg.ArrivalsCacheSec) * time.Second
		_ = s.rdb.Set(ctx, cacheKey(networkKind, airportIcao), b, ttl).Err()
	}
	return flights, nil
}

func (s *Service) Invalidate(ctx context.Context, networkKind, icao string) {
	_ = s.rdb.Del(ctx, cacheKey(networkKind, icao)).Err()
}
