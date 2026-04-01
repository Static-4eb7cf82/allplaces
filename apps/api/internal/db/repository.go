package db

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Place struct {
	OSMID    string                 `json:"osm_id"`
	Type     string                 `json:"type"`
	Name     *string                `json:"name,omitempty"`
	Lat      float64                `json:"lat"`
	Lng      float64                `json:"lng"`
	Tags     map[string]interface{} `json:"tags"`
	Category string                 `json:"category"`
}

type QueryFilters struct {
	South    float64
	West     float64
	North    float64
	East     float64
	Search   string
	Category string
	HasName  bool
	Limit    int
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) QueryPlaces(ctx context.Context, filters QueryFilters) ([]Place, error) {
	limit := filters.Limit
	if limit <= 0 {
		limit = 30000
	}

	args := []interface{}{filters.West, filters.South, filters.East, filters.North}
	whereParts := []string{
		"geom && ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, 4326), 3857)",
		"ST_Intersects(geom, ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, 4326), 3857))",
	}

	if strings.TrimSpace(filters.Search) != "" {
		args = append(args, "%"+strings.ToLower(strings.TrimSpace(filters.Search))+"%")
		whereParts = append(whereParts, fmt.Sprintf("LOWER(COALESCE(name, '')) LIKE $%d", len(args)))
	}

	if strings.TrimSpace(filters.Category) != "" {
		args = append(args, strings.TrimSpace(filters.Category))
		whereParts = append(whereParts, fmt.Sprintf("category = $%d", len(args)))
	}

	if filters.HasName {
		whereParts = append(whereParts, "COALESCE(TRIM(name), '') <> ''")
	}

	args = append(args, limit)
	query := fmt.Sprintf(`
		SELECT
			osm_id::text,
			'node' AS type,
			name,
			ST_Y(ST_Transform(geom, 4326)) AS lat,
			ST_X(ST_Transform(geom, 4326)) AS lng,
			jsonb_strip_nulls(jsonb_build_object(
				'amenity', amenity,
				'office', office,
				'shop', shop,
				'service', service,
				'tourism', tourism,
				'leisure', leisure,
				'sport', sport,
				'religion', religion
			)) AS tags,
			category
		FROM osm_places
		WHERE %s
		ORDER BY LOWER(COALESCE(name, '')) ASC, osm_id ASC
		LIMIT $%d`, strings.Join(whereParts, " AND "), len(args))

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	places := make([]Place, 0, limit)
	for rows.Next() {
		var place Place
		place.Tags = map[string]interface{}{}
		if err := rows.Scan(
			&place.OSMID,
			&place.Type,
			&place.Name,
			&place.Lat,
			&place.Lng,
			&place.Tags,
			&place.Category,
		); err != nil {
			return nil, err
		}
		places = append(places, place)
	}

	return places, rows.Err()
}
