package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port                 string
	PostgresURL          string
	RedisURL             string
	JWTSecret            string
	EncryptionKey        string
	CORSOrigins          []string
	OverviewRefreshSec   int
	ArrivalsCacheSec     int
}

func Load() Config {
	loadDotenv()
	refresh := 3
	if v := os.Getenv("OVERVIEW_REFRESH_SEC"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			refresh = n
		}
	}
	arrivalsTTL := 5
	if v := os.Getenv("ARRIVALS_CACHE_SEC"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			arrivalsTTL = n
		}
	}
	origins := []string{
		"http://localhost:5173",
		"http://localhost:9901",
		"https://pfcontrol.com",
		"https://canary.pfcontrol.com",
	}
	if extra := os.Getenv("CORS_ORIGINS"); extra != "" {
		for _, o := range strings.Split(extra, ",") {
			o = strings.TrimSpace(o)
			if o != "" {
				origins = append(origins, o)
			}
		}
	}
	port := os.Getenv("REALTIME_PORT")
	if port == "" {
		port = "8080"
	}
	return Config{
		Port:               port,
		PostgresURL:        os.Getenv("POSTGRES_DB_URL"),
		RedisURL:           os.Getenv("REDIS_URL"),
		JWTSecret:          os.Getenv("JWT_SECRET"),
		EncryptionKey:      os.Getenv("DB_ENCRYPTION_KEY"),
		CORSOrigins:        origins,
		OverviewRefreshSec: refresh,
		ArrivalsCacheSec:   arrivalsTTL,
	}
}

func (c Config) Validate() error {
	if c.PostgresURL == "" {
		return errMissing("POSTGRES_DB_URL")
	}
	if c.RedisURL == "" {
		return errMissing("REDIS_URL")
	}
	if c.JWTSecret == "" {
		return errMissing("JWT_SECRET")
	}
	if len(c.EncryptionKey) != 128 {
		return errMissing("DB_ENCRYPTION_KEY must be 128 characters")
	}
	return nil
}

type missingEnv string

func (e missingEnv) Error() string { return string(e) }
func errMissing(name string) error { return missingEnv(name) }
