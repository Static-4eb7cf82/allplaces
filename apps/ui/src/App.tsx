import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [filters, setFilters] = useState<Filters>({ search: "", category: "", hasName: true });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoadingArea, setIsLoadingArea] = useState(false);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [status, setStatus] = useState<string>("Ready");
  const lastViewportKeyRef = useRef<string>("");
  const [tableWidth, setTableWidth] = useState(420);
  const [isDragging, setIsDragging] = useState(false);
  const [ghostX, setGhostX] = useState<number | null>(null);
  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartRef.current = { startX: e.clientX, startWidth: tableWidth };
    setIsDragging(true);
    setGhostX(e.clientX);
  }, [tableWidth]);

  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => setGhostX(e.clientX);
    const onMouseUp = (e: MouseEvent) => {
      if (dragStartRef.current) {
        const delta = e.clientX - dragStartRef.current.startX;
        const newWidth = Math.max(240, Math.min(Math.floor(window.innerWidth * 0.8), dragStartRef.current.startWidth + delta));
        setTableWidth(newWidth);
      }
      setIsDragging(false);
      setGhostX(null);
      dragStartRef.current = null;
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search.trim().toLowerCase()), 150);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  const refreshViewport = useCallback(async (nextBounds: ViewportBounds) => {
    const viewportKey = [nextBounds.south, nextBounds.west, nextBounds.north, nextBounds.east]
      .map((value) => value.toFixed(5))
      .join(":");

    if (viewportKey === lastViewportKeyRef.current) {
      return;
    }

    lastViewportKeyRef.current = viewportKey;
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
  }, []);

  useEffect(() => {
    refreshViewport(bounds);
  }, [bounds, refreshViewport]);

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

  const handleViewportChanged = useCallback(
    (nextBounds: ViewportBounds) => {
      setBounds(nextBounds);
      refreshViewport(nextBounds);
    },
    [refreshViewport]
  );

  const filteredPlaces = useMemo(() => {
    return places.filter((place) => {
      if (filters.hasName && !place.name) {
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
  }, [places, filters.category, filters.hasName, debouncedSearch]);

  return (
    <>
      <CssBaseline />
      <Sheet sx={{ height: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(120deg, rgba(10,147,150,0.15), rgba(238,155,0,0.1))" }}>
        <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
          {isDragging && ghostX !== null && (
            <Box
              sx={{
                position: "fixed",
                top: 0,
                left: ghostX,
                width: "4px",
                height: "100vh",
                backgroundColor: "primary.500",
                opacity: 0.5,
                zIndex: 9999,
                pointerEvents: "none",
              }}
            />
          )}
          {isDragging && (
            <Box
              sx={{
                position: "fixed",
                inset: 0,
                cursor: "col-resize",
                zIndex: 9998,
                userSelect: "none",
              }}
            />
          )}
          <Sheet
            variant="outlined"
            sx={{
              width: { xs: "100%", md: tableWidth },
              minWidth: { md: tableWidth },
              maxWidth: { xs: "100%", md: tableWidth },
              flexShrink: 0,
              borderRight: "none",
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
                <Switch checked={filters.hasName} onChange={(event) => setFilters((current) => ({ ...current, hasName: event.target.checked }))} />
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

          <Box
            onMouseDown={onDividerMouseDown}
            sx={{
              width: "6px",
              flexShrink: 0,
              cursor: "col-resize",
              backgroundColor: isDragging ? "primary.softBg" : "transparent",
              borderLeft: "1px solid",
              borderColor: isDragging ? "primary.400" : "divider",
              transition: "background-color 0.15s, border-color 0.15s",
              "&:hover": {
                backgroundColor: "primary.softBg",
                borderColor: "primary.400",
              },
              zIndex: 10,
            }}
          />

          <Box sx={{ flex: 1, minHeight: { xs: 420, md: "auto" }, position: "relative" }}>
            <Button
              variant="soft"
              onClick={onLoadCurrentArea}
              loading={isLoadingArea}
              startDecorator={<SyncRounded />}
              sx={{
                position: "absolute",
                top: 12,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 2,
                borderRadius: "999px",
                boxShadow: "md",
                px: 2,
              }}
            >
              Load current area
            </Button>
            <IconButton
              size="sm"
              onClick={() => setMode(mode === "dark" ? "light" : "dark")}
              sx={{
                backgroundColor: "#ffffff",
                position: "absolute",
                bottom: 40,
                right: 10,
                zIndex: 2,
                width: 24,
                height: 24,
                minWidth: 0,
                minHeight: 0,
                borderRadius: "4px",
                boxShadow: "sm",
                "--IconButton-size": "24px",
              }}
            >
              {mode === "dark" ? <LightModeRounded sx={{ fontSize: 14 }} /> : <DarkModeRounded sx={{ fontSize: 14 }} />}
            </IconButton>
            <MapPane
              places={filteredPlaces}
              initialBounds={DEFAULT_BOUNDS}
              onViewportChanged={handleViewportChanged}
            />
          </Box>
        </Box>
      </Sheet>
    </>
  );
}

export default App;
