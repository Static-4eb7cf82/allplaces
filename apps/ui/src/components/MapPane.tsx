import { useEffect, useRef } from "react";
import maplibregl, { GeoJSONSource, Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { Place, ViewportBounds } from "../types";

type Props = {
  places: Place[];
  initialBounds: ViewportBounds;
  selectedOsmId: string | null;
  onViewportChanged: (bounds: ViewportBounds) => void;
  onCenterOnReady: (fn: (lat: number, lng: number) => void) => void;
};

const SOURCE_ID = "places-source";
const BASE_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export function MapPane({ places, initialBounds, selectedOsmId, onViewportChanged, onCenterOnReady }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const onViewportChangedRef = useRef(onViewportChanged);
  const onCenterOnReadyRef = useRef(onCenterOnReady);
  onViewportChangedRef.current = onViewportChanged;
  onCenterOnReadyRef.current = onCenterOnReady;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_MAP_STYLE_URL,
      center: [(initialBounds.west + initialBounds.east) / 2, (initialBounds.south + initialBounds.north) / 2],
      zoom: 12,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    map.on("load", () => {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 40,
        clusterMaxZoom: 14,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#546fa2",
          "circle-opacity": 0.82,
          "circle-radius": ["step", ["get", "point_count"], 14, 20, 20, 100, 28],
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-font": ["Open Sans Bold"],
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#ee9b00",
          "circle-radius": 5,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#001219",
        },
      });

      map.addSource("selected-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "selected-point",
        type: "circle",
        source: "selected-source",
        paint: {
          "circle-color": "#0a9396",
          "circle-radius": 9,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", "clusters", (event) => {
        const features = map.queryRenderedFeatures(event.point, { layers: ["clusters"] });
        const clusterId = features[0]?.properties?.cluster_id;
        const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
        if (!source || clusterId === undefined) {
          return;
        }
        source
          .getClusterExpansionZoom(Number(clusterId))
          .then((zoom) => {
            const [lng, lat] = features[0].geometry.type === "Point" ? features[0].geometry.coordinates : [0, 0];
            map.easeTo({ center: [lng, lat], zoom });
          })
          .catch(() => {
            // Ignore transient cluster expansion failures.
          });
      });

      map.on("moveend", () => {
        const bounds = map.getBounds();
        onViewportChangedRef.current({
          south: bounds.getSouth(),
          west: bounds.getWest(),
          north: bounds.getNorth(),
          east: bounds.getEast(),
        });
      });

      const bounds = map.getBounds();
      onViewportChangedRef.current({
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
      });
    });

    mapRef.current = map;

    onCenterOnReadyRef.current((lat, lng) => {
      mapRef.current?.easeTo({ center: [lng, lat], zoom: Math.max(mapRef.current.getZoom(), 15) });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [initialBounds.east, initialBounds.north, initialBounds.south, initialBounds.west]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    source.setData({
      type: "FeatureCollection",
      features: places.map((place) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [place.lng, place.lat],
        },
        properties: {
          osm_id: place.osm_id,
          name: place.name || "",
          type: place.type,
          category: place.category,
        },
      })),
    });
  }, [places]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const source = map.getSource("selected-source") as GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    if (!selectedOsmId) {
      source.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    const place = places.find((p) => p.osm_id === selectedOsmId);
    if (!place) {
      source.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    source.setData({
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: { type: "Point", coordinates: [place.lng, place.lat] },
        properties: { osm_id: place.osm_id },
      }],
    });
  }, [selectedOsmId, places]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
