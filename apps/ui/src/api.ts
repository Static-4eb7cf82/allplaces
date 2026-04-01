import { Place, ViewportBounds } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";

export async function fetchPlaces(bounds: ViewportBounds): Promise<Place[]> {
  const params = new URLSearchParams({
    south: String(bounds.south),
    west: String(bounds.west),
    north: String(bounds.north),
    east: String(bounds.east),
  });

  const response = await fetch(`${API_BASE_URL}/api/places?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch places from database");
  }

  const payload = await response.json();
  return payload.places as Place[];
}
