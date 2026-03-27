export type ViewportBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type Place = {
  osm_id: string;
  type: "node" | "way" | "relation";
  name?: string;
  lat: number;
  lng: number;
  tags: Record<string, unknown>;
  fetched_at?: string;
  category: string;
};

export type Filters = {
  search: string;
  category: string;
  hasNameOnly: boolean;
};
