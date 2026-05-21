package config

import (
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
)

// loadDotenv loads repo .env files when vars are not already set (same files as Node).
func loadDotenv() {
	name := ".env.development"
	switch os.Getenv("NODE_ENV") {
	case "production":
		name = ".env.production"
	case "canary":
		name = ".env.canary"
	}

	dir, err := os.Getwd()
	if err != nil {
		return
	}
	for {
		path := filepath.Join(dir, name)
		if _, statErr := os.Stat(path); statErr == nil {
			_ = godotenv.Load(path)
			return
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return
		}
		dir = parent
	}
}
