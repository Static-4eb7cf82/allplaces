package config

import "os"

type Config struct {
	Port                   string
	DatabaseURL            string
	OverpassURL            string
	OverpassTimeoutSeconds int
}

func Load() Config {
	return Config{
		Port:                   getEnv("PORT", "8081"),
		DatabaseURL:            getEnv("DATABASE_URL", "postgres://allplaces:allplaces@db:5432/allplaces?sslmode=disable"),
		OverpassURL:            getEnv("OVERPASS_URL", "https://overpass-api.de/api/interpreter"),
		OverpassTimeoutSeconds: 30,
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
