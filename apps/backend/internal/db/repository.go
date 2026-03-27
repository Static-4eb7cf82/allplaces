package db

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Place struct {
	OSMID     string                 `json:"osm_id"`
	Type      string                 `json:"type"`
	Name      *string                `json:"name,omitempty"`
	Lat       float64                `json:"lat"`
	Lng       float64                `json:"lng"`
	Tags      map[string]interface{} `json:"tags"`
	FetchedAt string                 `json:"fetched_at,omitempty"`
	Category  string                 `json:"category"`
}

type QueryFilters struct {
	South       float64
	West        float64
	North       float64
	East        float64
	Search      string
	Category    string
	HasNameOnly bool
	Limit       int
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) UpsertPlaces(ctx context.Context, places []Place) (int64, error) {
	if len(places) == 0 {
		return 0, nil
	}

	batch := &pgx.Batch{}
	for _, place := range places {
		tagsBytes, err := json.Marshal(place.Tags)
		if err != nil {
			return 0, fmt.Errorf("marshal tags for %s: %w", place.OSMID, err)
		}

		batch.Queue(
			`INSERT INTO osm_places (osm_id, type, name, lat, lng, tags)
			 VALUES ($1, $2, $3, $4, $5, $6::jsonb)
			 ON CONFLICT (osm_id)
			 DO UPDATE SET
			   type = EXCLUDED.type,
			   name = EXCLUDED.name,
			   lat = EXCLUDED.lat,
			   lng = EXCLUDED.lng,
			   tags = EXCLUDED.tags,
			   fetched_at = NOW()`,
			place.OSMID,
			place.Type,
			place.Name,
			place.Lat,
			place.Lng,
			string(tagsBytes),
		)
	}

	results := r.pool.SendBatch(ctx, batch)
	defer results.Close()

	var count int64
	for i := 0; i < len(places); i++ {
		if _, err := results.Exec(); err != nil {
			return count, fmt.Errorf("upsert batch item %d: %w", i, err)
		}
		count++
	}

	return count, nil
}

func (r *Repository) QueryPlaces(ctx context.Context, filters QueryFilters) ([]Place, error) {
	limit := filters.Limit
	if limit <= 0 || limit > 20000 {
		limit = 10000
	}

	args := []interface{}{filters.South, filters.North, filters.West, filters.East}
	whereParts := []string{
		"lat BETWEEN $1 AND $2",
		"lng BETWEEN $3 AND $4",
	}

	if strings.TrimSpace(filters.Search) != "" {
		args = append(args, "%"+strings.ToLower(strings.TrimSpace(filters.Search))+"%")
		whereParts = append(whereParts, fmt.Sprintf("LOWER(COALESCE(name, '')) LIKE $%d", len(args)))
	}

	if strings.TrimSpace(filters.Category) != "" {
		args = append(args, strings.TrimSpace(filters.Category))
		whereParts = append(whereParts, fmt.Sprintf(`
			CASE
				WHEN tags ? 'amenity' THEN 'amenity'
				WHEN tags ? 'shop' THEN 'shop'
				WHEN tags ? 'tourism' THEN 'tourism'
				WHEN tags ? 'leisure' THEN 'leisure'
				WHEN tags ? 'office' THEN 'office'
				ELSE 'other'
			END = $%d`, len(args)))
	}

	if filters.HasNameOnly {
		whereParts = append(whereParts, "COALESCE(TRIM(name), '') <> ''")
	}

	args = append(args, limit)
	query := fmt.Sprintf(`
		SELECT
			osm_id,
			type,
			name,
			lat,
			lng,
			tags,
			fetched_at::text,
			CASE
				WHEN tags ? 'amenity' THEN 'amenity'
				WHEN tags ? 'shop' THEN 'shop'
				WHEN tags ? 'tourism' THEN 'tourism'
				WHEN tags ? 'leisure' THEN 'leisure'
				WHEN tags ? 'office' THEN 'office'
				ELSE 'other'
			END AS category
		FROM osm_places
		WHERE %s
		ORDER BY fetched_at DESC
		LIMIT $%d`, strings.Join(whereParts, " AND "), len(args))

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	places := make([]Place, 0, limit)
	for rows.Next() {
		var place Place
		var tagsBytes []byte
		if err := rows.Scan(
			&place.OSMID,
			&place.Type,
			&place.Name,
			&place.Lat,
			&place.Lng,
			&tagsBytes,
			&place.FetchedAt,
			&place.Category,
		); err != nil {
			return nil, err
		}

		if err := json.Unmarshal(tagsBytes, &place.Tags); err != nil {
			place.Tags = map[string]interface{}{}
		}
		places = append(places, place)
	}

	return places, rows.Err()
}
