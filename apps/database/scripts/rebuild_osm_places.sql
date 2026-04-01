DO $$
BEGIN
  IF to_regclass('osm.planet_osm_point') IS NULL THEN
    RAISE EXCEPTION 'osm.planet_osm_point does not exist. Run osm-ingest-worker first.';
  END IF;
END
$$;

BEGIN;

DROP TABLE IF EXISTS osm_places;

CREATE TABLE osm_places AS
SELECT
  osm_id,
  name,
  amenity,
  office,
  shop,
  service,
  tourism,
  leisure,
  sport,
  religion,
  way AS geom
FROM osm.planet_osm_point
WHERE
  name IS NOT NULL
  AND (
    amenity IS NOT NULL OR
    office IS NOT NULL OR
    shop IS NOT NULL OR
    service IS NOT NULL OR
    tourism IS NOT NULL OR
    leisure IS NOT NULL OR
    sport IS NOT NULL OR
    religion IS NOT NULL
  );

ALTER TABLE osm_places
  ADD PRIMARY KEY (osm_id);

CREATE INDEX idx_osm_places_geom ON osm_places USING GIST (geom);
CREATE INDEX idx_osm_places_name_lower ON osm_places (LOWER(name));
CREATE INDEX idx_osm_places_category ON osm_places (
  COALESCE(amenity, office, shop, service, tourism, leisure, sport, religion)
);

ANALYZE osm_places;

COMMIT;