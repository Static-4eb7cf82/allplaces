CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS hstore;

CREATE TABLE IF NOT EXISTS osm_places (
  osm_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  tags JSONB NOT NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_osm_places_lat_lng ON osm_places (lat, lng);
CREATE INDEX IF NOT EXISTS idx_osm_places_type ON osm_places (type);
CREATE INDEX IF NOT EXISTS idx_osm_places_name_lower ON osm_places (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_osm_places_tags ON osm_places USING GIN (tags);
