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
  CASE
    WHEN amenity IS NOT NULL THEN 'amenity'
    WHEN office IS NOT NULL THEN 'office'
    WHEN shop IS NOT NULL THEN 'shop'
    WHEN service IS NOT NULL THEN 'service'
    WHEN tourism IS NOT NULL THEN 'tourism'
    WHEN leisure IS NOT NULL THEN 'leisure'
    WHEN sport IS NOT NULL THEN 'sport'
    ELSE 'other'
  END AS category,
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
  name IS NOT NULL;

ALTER TABLE osm_places
  ADD PRIMARY KEY (osm_id);

ALTER TABLE osm_places
  ALTER COLUMN category SET NOT NULL;

ALTER TABLE osm_places
  ADD CONSTRAINT osm_places_category_check
  CHECK (category IN ('amenity', 'office', 'shop', 'service', 'tourism', 'leisure', 'sport', 'other'));

CREATE INDEX idx_osm_places_geom ON osm_places USING GIST (geom);
CREATE INDEX idx_osm_places_name_lower ON osm_places (LOWER(name));
CREATE INDEX idx_osm_places_category ON osm_places (category);

ANALYZE osm_places;

COMMIT;