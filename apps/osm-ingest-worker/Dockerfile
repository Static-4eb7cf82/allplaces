FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends osm2pgsql ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /data

CMD ["osm2pgsql", "--help"]
