FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends osm2pgsql ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY ingest.sh /usr/local/bin/ingest.sh
RUN chmod +x /usr/local/bin/ingest.sh

WORKDIR /data

CMD ["ingest.sh"]
