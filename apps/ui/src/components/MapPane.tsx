import { useEffect, useRef } from "react";
import maplibregl, { GeoJSONSource, Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { Place, ViewportBounds } from "../types";

type Props = {
  places: Place[];
  initialBounds: ViewportBounds;
  selectedOsmId: string | null;
  mapStyleUrl: string;
  enable3D: boolean;
  onViewportChanged: (bounds: ViewportBounds) => void;
  onCenterOnReady: (fn: (lat: number, lng: number) => void) => void;
};

const SOURCE_ID = "places-source";
const SELECTED_SOURCE_ID = "selected-source";

function toPlaceFeatures(places: Place[]) {
  return places.map((place) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [place.lng, place.lat],
    },
    properties: {
      osm_id: place.osm_id,
      name: place.name || "",
      type: place.type,
      category: place.category,
    },
  }));
}

export function MapPane({
  places,
  initialBounds,
  selectedOsmId,
  mapStyleUrl,
  enable3D,
  onViewportChanged,
  onCenterOnReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const onViewportChangedRef = useRef(onViewportChanged);
  const onCenterOnReadyRef = useRef(onCenterOnReady);
  const placesRef = useRef(places);
  const selectedOsmIdRef = useRef(selectedOsmId);
  const enable3DRef = useRef(enable3D);
  const currentStyleUrlRef = useRef(mapStyleUrl);
  onViewportChangedRef.current = onViewportChanged;
  onCenterOnReadyRef.current = onCenterOnReady;
  placesRef.current = places;
  selectedOsmIdRef.current = selectedOsmId;
  enable3DRef.current = enable3D;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const apply3DState = (map: Map) => {
      const has3DBuildings = Boolean(map.getLayer("building-3d"));
      if (has3DBuildings) {
        map.setLayoutProperty("building-3d", "visibility", enable3DRef.current ? "visible" : "none");
      }

      if (enable3DRef.current) {
        map.easeTo({ pitch: 60, bearing: 20, duration: 350 });
      } else {
        map.easeTo({ pitch: 0, bearing: 0, duration: 350 });
      }
    };

    const syncPlaceData = (map: Map) => {
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (source) {
        source.setData({
          type: "FeatureCollection",
          features: toPlaceFeatures(placesRef.current),
        });
      }

      const selectedSource = map.getSource(SELECTED_SOURCE_ID) as GeoJSONSource | undefined;
      if (!selectedSource) {
        return;
      }

      const selectedId = selectedOsmIdRef.current;
      if (!selectedId) {
        selectedSource.setData({ type: "FeatureCollection", features: [] });
        return;
      }

      const selectedPlace = placesRef.current.find((p) => p.osm_id === selectedId);
      if (!selectedPlace) {
        selectedSource.setData({ type: "FeatureCollection", features: [] });
        return;
      }

      selectedSource.setData({
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          geometry: { type: "Point", coordinates: [selectedPlace.lng, selectedPlace.lat] },
          properties: { osm_id: selectedPlace.osm_id },
        }],
      });
    };

    const ensureCustomLayers = (map: Map) => {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          cluster: true,
          clusterRadius: 40,
          clusterMaxZoom: 14,
        });
      }

      if (!map.getLayer("clusters")) {
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
      }

      if (!map.getLayer("cluster-count")) {
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
      }

      if (!map.getLayer("unclustered-point")) {
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
      }

      if (!map.getSource(SELECTED_SOURCE_ID)) {
        map.addSource(SELECTED_SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }

      if (!map.getLayer("selected-point")) {
        map.addLayer({
          id: "selected-point",
          type: "circle",
          source: SELECTED_SOURCE_ID,
          paint: {
            "circle-color": "#0a9396",
            "circle-radius": 9,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
      }

      syncPlaceData(map);
      apply3DState(map);
    };

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: currentStyleUrlRef.current,
      center: [(initialBounds.west + initialBounds.east) / 2, (initialBounds.south + initialBounds.north) / 2],
      zoom: 12,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    map.on("style.load", () => {
      ensureCustomLayers(map);
    });

    map.on("click", (event) => {
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

    map.on("load", () => {
      ensureCustomLayers(map);

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
    if (!map) {
      return;
    }

    if (currentStyleUrlRef.current === mapStyleUrl) {
      return;
    }

    currentStyleUrlRef.current = mapStyleUrl;
    map.setStyle(mapStyleUrl);
  }, [mapStyleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const has3DBuildings = Boolean(map.getLayer("building-3d"));
    if (has3DBuildings) {
      map.setLayoutProperty("building-3d", "visibility", enable3D ? "visible" : "none");
    }

    if (enable3D) {
      map.easeTo({ pitch: 60, bearing: 20, duration: 350 });
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: 350 });
    }
  }, [enable3D]);

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
      features: toPlaceFeatures(places),
    });
  }, [places]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const source = map.getSource(SELECTED_SOURCE_ID) as GeoJSONSource | undefined;
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
