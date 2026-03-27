package api

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"allplaces/api/internal/db"
	"allplaces/api/internal/osm"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	repo           *db.Repository
	overpassClient *osm.OverpassClient
}

type loadRequest struct {
	South float64 `json:"south" binding:"required"`
	West  float64 `json:"west" binding:"required"`
	North float64 `json:"north" binding:"required"`
	East  float64 `json:"east" binding:"required"`
}

func NewHandler(repo *db.Repository, overpassClient *osm.OverpassClient) *Handler {
	return &Handler{repo: repo, overpassClient: overpassClient}
}

func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *Handler) LoadPlaces(c *gin.Context) {
	var req loadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 35*time.Second)
	defer cancel()

	places, err := h.overpassClient.FetchPlaces(ctx, req.South, req.West, req.North, req.East)
	if err != nil {
		log.Printf("overpass fetch failed: %v", err)
		status := http.StatusBadGateway
		if strings.Contains(strings.ToLower(err.Error()), "status=429") {
			status = http.StatusTooManyRequests
		}
		c.JSON(status, gin.H{"error": "failed to fetch places from overpass"})
		return
	}

	upserted, err := h.repo.UpsertPlaces(ctx, places)
	if err != nil {
		log.Printf("db upsert failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save places"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"fetched":  len(places),
		"upserted": upserted,
	})
}

func (h *Handler) QueryPlaces(c *gin.Context) {
	south, err := parseFloatQuery(c, "south")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	west, err := parseFloatQuery(c, "west")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	north, err := parseFloatQuery(c, "north")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	east, err := parseFloatQuery(c, "east")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hasNameOnly := strings.EqualFold(strings.TrimSpace(c.Query("hasNameOnly")), "true")
	search := strings.TrimSpace(c.Query("search"))
	category := strings.TrimSpace(c.Query("category"))

	filters := db.QueryFilters{
		South:       south,
		West:        west,
		North:       north,
		East:        east,
		Search:      search,
		Category:    category,
		HasNameOnly: hasNameOnly,
		Limit:       10000,
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	places, err := h.repo.QueryPlaces(ctx, filters)
	if err != nil {
		log.Printf("query places failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query places"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"places": places})
}

func parseFloatQuery(c *gin.Context, key string) (float64, error) {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return 0, fmt.Errorf("%s is required", key)
	}
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return 0, fmt.Errorf("%s must be a number", key)
	}
	return value, nil
}
