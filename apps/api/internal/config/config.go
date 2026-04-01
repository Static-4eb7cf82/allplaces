package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port             string
	DatabaseURL      string
	QueryPlacesLimit int
}

func Load() Config {
	return Config{
		Port:             getEnv("PORT", "8081"),
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://allplaces:allplaces@db:5432/allplaces?sslmode=disable"),
		QueryPlacesLimit: getEnvInt("QUERY_PLACES_LIMIT", 30000),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}
