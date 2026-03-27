package main

import (
	"context"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"allplaces/backend/internal/api"
	"allplaces/backend/internal/config"
	"allplaces/backend/internal/db"
	"allplaces/backend/internal/osm"
)

func main() {
	cfg := config.Load()

	database, err := db.NewPool(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}
	defer database.Close()

	repo := db.NewRepository(database)
	overpassClient := osm.NewOverpassClient(cfg.OverpassURL, time.Duration(cfg.OverpassTimeoutSeconds)*time.Second)
	handler := api.NewHandler(repo, overpassClient)
	router := api.NewRouter(handler)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("backend listening on %s", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}
