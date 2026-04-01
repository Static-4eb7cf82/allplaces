#!/bin/sh
set -eu

INPUT_FILE="${1:-/data/data.osm.pbf}"
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-allplaces}"
DB_NAME="${DB_NAME:-allplaces}"
DB_SCHEMA="${DB_SCHEMA:-osm}"
OSM2PGSQL_PROCESSES="${OSM2PGSQL_PROCESSES:-4}"

if [ ! -f "$INPUT_FILE" ]; then
  echo "Input file not found: $INPUT_FILE" >&2
  exit 1
fi

exec osm2pgsql \
  -H "$DB_HOST" \
  -P "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --create \
  --slim \
  --middle-schema "$DB_SCHEMA" \
  --output-pgsql-schema "$DB_SCHEMA" \
  --hstore \
  --multi-geometry \
  --number-processes "$OSM2PGSQL_PROCESSES" \
  "$INPUT_FILE"
