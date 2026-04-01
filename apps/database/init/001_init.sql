CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS hstore;
CREATE SCHEMA IF NOT EXISTS osm AUTHORIZATION allplaces;

CREATE TABLE IF NOT EXISTS osm_places (
  osm_id BIGINT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('amenity', 'office', 'shop', 'service', 'tourism', 'leisure', 'sport', 'other')),
  sub_category TEXT,
  name TEXT,
  tags JSONB NOT NULL DEFAULT '{}'::jsonb,
  geom geometry(Point, 3857) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_osm_places_geom ON osm_places USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_osm_places_name_lower ON osm_places (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_osm_places_category ON osm_places (category);
CREATE INDEX IF NOT EXISTS idx_osm_places_sub_category ON osm_places (sub_category);
