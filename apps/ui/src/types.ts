export type ViewportBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type Place = {
  osm_id: string;
  name?: string;
  lat: number;
  lng: number;
  tags: Record<string, unknown>;
  category: string;
};
