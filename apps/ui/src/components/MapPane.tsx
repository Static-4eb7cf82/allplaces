import { useEffect, useRef } from "react";
import Box from "@mui/joy/Box";
import { useColorScheme } from "@mui/joy/styles";
import maplibregl, { GeoJSONSource, Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { Place, ViewportBounds } from "../types";

type Props = {
  places: Place[];
  initialBounds: ViewportBounds;
  selectedOsmId: string | null;
  mapStyleUrl: string;
  enable3D: boolean;
  onPlaceSelected: (osmId: string) => void;
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
      category: place.category,
    },
  }));
}

function buildPlacePopupHtml(place: Place) {
  const displayName = place.name || "Unnamed place";
  const subCategory = place.sub_category?.trim() || "None";
  const previewTags = Object.entries(place.tags || {}).slice(0, 4);
  const tagsHtml = previewTags.length > 0
    ? `<div style="display:grid;grid-template-columns:auto 1fr;column-gap:10px;row-gap:4px;margin-top:8px">${previewTags
        .map(([key, value]) => `<span style="font-size:11px;color:#5c667a;text-transform:capitalize">${key}</span><span style="font-size:12px;color:#102a43">${String(value)}</span>`)
        .join("")}</div>`
    : "";

  return `
    <div style="min-width:220px;max-width:280px;font-family:system-ui,Segoe UI,sans-serif;padding:2px 0">
      <div style="font-size:15px;font-weight:700;color:#102a43;line-height:1.25;margin-bottom:6px">${displayName}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        <span style="font-size:11px;padding:2px 8px;border-radius:999px;background:#e8f3f1;color:#0a6c6f">${place.category || "Unknown"}</span>
        <span style="font-size:11px;padding:2px 8px;border-radius:999px;background:#fff3e1;color:#9b5a00">${subCategory}</span>
      </div>
      <div style="font-size:11px;color:#5c667a">OSM ID</div>
      <div style="font-size:12px;color:#102a43;word-break:break-all">${place.osm_id}</div>
      <div style="margin-top:8px;font-size:11px;color:#5c667a">Location</div>
      <div style="font-size:12px;color:#102a43">${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}</div>
      ${tagsHtml}
    </div>
  `;
}

export function MapPane({
  places,
  initialBounds,
  selectedOsmId,
  mapStyleUrl,
  enable3D,
  onPlaceSelected,
  onViewportChanged,
  onCenterOnReady,
}: Props) {
  const { mode } = useColorScheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const onViewportChangedRef = useRef(onViewportChanged);
  const onCenterOnReadyRef = useRef(onCenterOnReady);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  const placesRef = useRef(places);
  const selectedOsmIdRef = useRef(selectedOsmId);
  const enable3DRef = useRef(enable3D);
  const currentStyleUrlRef = useRef(mapStyleUrl);
  onViewportChangedRef.current = onViewportChanged;
  onCenterOnReadyRef.current = onCenterOnReady;
  onPlaceSelectedRef.current = onPlaceSelected;
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

    const syncPopup = (map: Map) => {
      const selectedId = selectedOsmIdRef.current;
      if (!selectedId) {
        popupRef.current?.remove();
        popupRef.current = null;
        return;
      }

      const selectedPlace = placesRef.current.find((p) => p.osm_id === selectedId);
      if (!selectedPlace) {
        popupRef.current?.remove();
        popupRef.current = null;
        return;
      }

      if (!popupRef.current) {
        popupRef.current = new maplibregl.Popup({ closeButton: true, closeOnClick: false, offset: 14 });
      }

      popupRef.current
        .setLngLat([selectedPlace.lng, selectedPlace.lat])
        .setHTML(buildPlacePopupHtml(selectedPlace))
        .addTo(map);
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
      syncPopup(map);
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
      const interactiveFeatures = map.queryRenderedFeatures(event.point, {
        layers: ["clusters", "unclustered-point", "selected-point"],
      });
      const feature = interactiveFeatures[0];
      if (!feature) {
        return;
      }

      const isCluster = feature.properties?.point_count !== undefined;
      if (isCluster) {
        const clusterId = feature.properties?.cluster_id;
        const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
        if (!source || clusterId === undefined) {
          return;
        }
        source
          .getClusterExpansionZoom(Number(clusterId))
          .then((zoom) => {
            const [lng, lat] = feature.geometry.type === "Point" ? feature.geometry.coordinates : [0, 0];
            map.easeTo({ center: [lng, lat], zoom });
          })
          .catch(() => {
            // Ignore transient cluster expansion failures.
          });
        return;
      }

      const osmId = feature.properties?.osm_id;
      if (typeof osmId === "string") {
        onPlaceSelectedRef.current(osmId);
      }
    });

    map.on("mousemove", (event) => {
      const features = map.queryRenderedFeatures(event.point, { layers: ["unclustered-point", "selected-point"] });
      map.getCanvas().style.cursor = features.length > 0 ? "pointer" : "";
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
      popupRef.current?.remove();
      popupRef.current = null;
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

    if (!popupRef.current) {
      popupRef.current = new maplibregl.Popup({ closeButton: true, closeOnClick: false, offset: 14 });
    }

    popupRef.current
      .setLngLat([place.lng, place.lat])
      .setHTML(buildPlacePopupHtml(place))
      .addTo(map);
  }, [selectedOsmId, places]);

  return (
    <Box
      ref={containerRef}
      sx={{
        width: "100%",
        height: "100%",
        ".maplibregl-ctrl-top-right": {
          top: 10,
          right: 10,
        },
        ".maplibregl-ctrl-group": {
          border: "none",
          borderRadius: "sm",
          boxShadow: "sm",
          overflow: "hidden",
          backgroundColor: "var(--joy-palette-neutral-softBg)",
        },
        ".maplibregl-ctrl-group button": {
          width: 32,
          height: 32,
          color: "var(--joy-palette-text-primary)",
          backgroundColor: "transparent",
        },
        ".maplibregl-ctrl-group button + button": {
          borderTop: "1px solid var(--joy-palette-divider)",
        },
        ".maplibregl-ctrl-group button:hover": {
          backgroundColor: "var(--joy-palette-neutral-softHoverBg)",
        },
        ".maplibregl-ctrl-group button:active": {
          backgroundColor: "var(--joy-palette-neutral-softActiveBg)",
        },
        ".maplibregl-ctrl-group button:focus-visible": {
          outline: "2px solid var(--joy-palette-primary-500)",
          outlineOffset: -2,
        },
        ".maplibregl-ctrl-icon": {
          filter: mode === "dark" ? "brightness(0) invert(1)" : "none",
        },
      }}
    />
  );
}
