CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS hstore;
CREATE SCHEMA IF NOT EXISTS osm AUTHORIZATION allplaces;

CREATE TABLE IF NOT EXISTS osm_places (
  osm_id BIGINT PRIMARY KEY,
  name TEXT,
  amenity TEXT,
  office TEXT,
  shop TEXT,
  service TEXT,
  tourism TEXT,
  leisure TEXT,
  sport TEXT,
  religion TEXT,
  geom geometry(Point, 3857) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_osm_places_geom ON osm_places USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_osm_places_name_lower ON osm_places (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_osm_places_category ON osm_places (
  COALESCE(amenity, office, shop, service, tourism, leisure, sport, religion)
);
