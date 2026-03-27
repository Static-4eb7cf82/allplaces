import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CssBaseline,
  IconButton,
  Input,
  Option,
  Select,
  Sheet,
  Stack,
  Switch,
  Table,
  Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import DarkModeRounded from "@mui/icons-material/DarkModeRounded";
import LightModeRounded from "@mui/icons-material/LightModeRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";

import { fetchPlaces, loadCurrentArea } from "./api";
import { Filters, Place, ViewportBounds } from "./types";
import { MapPane } from "./components/MapPane";

const DEFAULT_BOUNDS: ViewportBounds = {
  south: 40.699,
  west: -74.05,
  north: 40.84,
  east: -73.88,
};

function App() {
  const { mode, setMode } = useColorScheme();
  const [bounds, setBounds] = useState<ViewportBounds>(DEFAULT_BOUNDS);
  const [places, setPlaces] = useState<Place[]>([]);
  const [filters, setFilters] = useState<Filters>({ search: "", category: "", hasNameOnly: false });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoadingArea, setIsLoadingArea] = useState(false);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [status, setStatus] = useState<string>("Ready");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search.trim().toLowerCase()), 150);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  const refreshViewport = async (nextBounds: ViewportBounds) => {
    setIsLoadingPlaces(true);
    try {
      const viewportPlaces = await fetchPlaces(nextBounds);
      setPlaces(viewportPlaces);
      setStatus(`Showing ${viewportPlaces.length} places from database`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to fetch places");
    } finally {
      setIsLoadingPlaces(false);
    }
  };

  useEffect(() => {
    refreshViewport(bounds);
  }, []);

  const onLoadCurrentArea = async () => {
    setIsLoadingArea(true);
    setStatus("Loading current area from Overpass...");
    try {
      const result = await loadCurrentArea(bounds);
      await refreshViewport(bounds);
      setStatus(`Loaded ${result.fetched} OSM places, upserted ${result.upserted}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load current area");
    } finally {
      setIsLoadingArea(false);
    }
  };

  const filteredPlaces = useMemo(() => {
    return places.filter((place) => {
      if (filters.hasNameOnly && !place.name) {
        return false;
      }
      if (filters.category && place.category !== filters.category) {
        return false;
      }
      if (debouncedSearch && !(place.name || "").toLowerCase().includes(debouncedSearch)) {
        return false;
      }
      return true;
    });
  }, [places, filters.category, filters.hasNameOnly, debouncedSearch]);

  return (
    <>
      <CssBaseline />
      <Sheet sx={{ height: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(120deg, rgba(10,147,150,0.15), rgba(238,155,0,0.1))" }}>
        <Sheet
          variant="soft"
          sx={{
            p: 1.5,
            borderBottom: "1px solid",
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography level="h4">allplaces</Typography>
            <Chip color="neutral" size="sm">Phase 1</Chip>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Button onClick={onLoadCurrentArea} loading={isLoadingArea} startDecorator={<SyncRounded />}>
              Load current area
            </Button>
            <IconButton onClick={() => setMode(mode === "dark" ? "light" : "dark")}>
              {mode === "dark" ? <LightModeRounded /> : <DarkModeRounded />}
            </IconButton>
          </Stack>
        </Sheet>

        <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sheet
            variant="outlined"
            sx={{
              width: { xs: "100%", md: 420 },
              maxWidth: { xs: "100%", md: 420 },
              borderRight: { md: "1px solid" },
              borderColor: "divider",
              p: 1.5,
              overflow: "auto",
            }}
          >
            <Stack spacing={1.5}>
              <Typography level="title-md">Filters</Typography>
              <Input
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Search name contains..."
              />
              <Select
                value={filters.category || null}
                placeholder="Category"
                onChange={(_, value) => setFilters((current) => ({ ...current, category: value || "" }))}
              >
                <Option value="amenity">Amenity</Option>
                <Option value="shop">Shop</Option>
                <Option value="tourism">Tourism</Option>
                <Option value="leisure">Leisure</Option>
                <Option value="office">Office</Option>
                <Option value="other">Other</Option>
              </Select>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography level="body-sm">Has name only</Typography>
                <Switch checked={filters.hasNameOnly} onChange={(event) => setFilters((current) => ({ ...current, hasNameOnly: event.target.checked }))} />
              </Stack>

              <Typography level="body-sm" color="neutral">
                {status}
              </Typography>
              <Typography level="body-sm" color="neutral">
                {isLoadingPlaces ? "Refreshing viewport places..." : `${filteredPlaces.length} visible places`}
              </Typography>

              <Table size="sm" stickyHeader sx={{ "--TableCell-headBackground": "var(--joy-palette-background-level2)" }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlaces.slice(0, 500).map((place) => (
                    <tr key={place.osm_id}>
                      <td>{place.name || "(unnamed)"}</td>
                      <td>{place.type}</td>
                      <td>{place.category}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Stack>
          </Sheet>

          <Box sx={{ flex: 1, minHeight: { xs: 420, md: "auto" } }}>
            <MapPane
              places={filteredPlaces}
              initialBounds={DEFAULT_BOUNDS}
              onViewportChanged={(nextBounds) => {
                setBounds(nextBounds);
                refreshViewport(nextBounds);
              }}
            />
          </Box>
        </Box>
      </Sheet>
    </>
  );
}

export default App;
