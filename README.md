# allplaces
Find the place you're looking for. Explore every place in any area with powerful filters and sorting, beyond the limits of traditional map apps.

## Phase 1 stack

- UI: React + TypeScript + Joy UI + Material Icons + MapLibre GL, served by Nginx
- Backend: Go + Gin REST API
- Database: PostgreSQL
- Runtime: Docker Compose

## Monorepo layout

- apps/ui
- apps/backend
- apps/database
- deploy/docker-compose

## Run locally

1. From repo root:

```bash
docker compose -f deploy/docker-compose/docker-compose.yml up --build
```

2. Open:
- UI: http://localhost:8080
- Backend health: http://localhost:8081/health
- Postgres: localhost:5432

## Phase 1 behavior

- Top map button "Load current area" sends current viewport bbox to backend.
- Backend queries Overpass for meaningful places and upserts into `osm_places`.
- Map always renders DB places for current viewport, with clustering.
- Left flyout list shows the same viewport results.
- Filters are instant and local: debounced name search, category, has-name-only.
- Light and dark modes are available from the top bar toggle.

## Database table

`apps/database/init/001_init.sql` creates:

```sql
CREATE TABLE osm_places (
	osm_id TEXT PRIMARY KEY,
	type TEXT NOT NULL,
	name TEXT,
	lat DOUBLE PRECISION NOT NULL,
	lng DOUBLE PRECISION NOT NULL,
	tags JSONB NOT NULL,
	fetched_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```
