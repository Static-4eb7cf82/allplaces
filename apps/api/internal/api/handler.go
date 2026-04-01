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

	"github.com/gin-gonic/gin"
)

type Handler struct {
	repo       *db.Repository
	queryLimit int
}

func NewHandler(repo *db.Repository, queryLimit int) *Handler {
	if queryLimit <= 0 {
		queryLimit = 30000
	}
	return &Handler{repo: repo, queryLimit: queryLimit}
}

func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
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

	hasName := strings.EqualFold(strings.TrimSpace(c.Query("hasName")), "true")
	search := strings.TrimSpace(c.Query("search"))
	category := strings.TrimSpace(c.Query("category"))

	filters := db.QueryFilters{
		South:    south,
		West:     west,
		North:    north,
		East:     east,
		Search:   search,
		Category: category,
		HasName:  hasName,
		Limit:    h.queryLimit,
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
