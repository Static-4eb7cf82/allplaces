import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Autocomplete,
  AutocompleteOption,
  Box,
  Button,
  Chip,
  CssBaseline,
  Divider,
  Dropdown,
  IconButton,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  Sheet,
  Stack,
  Switch,
  Table,
  Tooltip,
  Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import DarkModeRounded from "@mui/icons-material/DarkModeRounded";
import LightModeRounded from "@mui/icons-material/LightModeRounded";
import MapRounded from "@mui/icons-material/MapRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";
import SearchRounded from "@mui/icons-material/SearchRounded"
import UnfoldMoreRounded from "@mui/icons-material/UnfoldMoreRounded";

import { fetchPlaces, loadCurrentArea } from "./api";
import { Place, ViewportBounds } from "./types";
import { MapPane } from "./components/MapPane";

type BaseMapOption = "positron" | "bright" | "liberty" | "liberty-3d";

const BASE_MAP_STYLES: Record<BaseMapOption, { label: string; styleUrl: string; enable3D: boolean }> = {
  positron: {
    label: "Positron",
    styleUrl: "https://tiles.openfreemap.org/styles/positron",
    enable3D: false,
  },
  bright: {
    label: "Bright",
    styleUrl: "https://tiles.openfreemap.org/styles/bright",
    enable3D: false,
  },
  liberty: {
    label: "Liberty",
    styleUrl: "https://tiles.openfreemap.org/styles/liberty",
    enable3D: false,
  },
  "liberty-3d": {
    label: "Liberty (3D)",
    styleUrl: "https://tiles.openfreemap.org/styles/liberty",
    enable3D: true,
  },
};

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
  const [columnFilters, setColumnFilters] = useState({
    name: "",
    category: [] as string[],
    subCategory: [] as string[],
    fuzzySearch: "",
  });
  const [hasName, setHasName] = useState(true);
  const [sortState, setSortState] = useState<{ column: "name" | "category" | "subCategory" | null; direction: "asc" | "desc" }>({
    column: null,
    direction: "asc",
  });
  const [isLoadingArea, setIsLoadingArea] = useState(false);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [status, setStatus] = useState<string>("Ready");
  const [selectedOsmId, setSelectedOsmId] = useState<string | null>(null);
  const centerOnRef = useRef<((lat: number, lng: number) => void) | null>(null);
  const lastViewportKeyRef = useRef<string>("");
  const [tableWidth, setTableWidth] = useState(Math.floor(window.innerWidth * 0.35));
  const [isDragging, setIsDragging] = useState(false);
  const [ghostX, setGhostX] = useState<number | null>(null);
  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [baseMapOption, setBaseMapOption] = useState<BaseMapOption>("bright");

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
      setSelectedOsmId((current) =>
        current && viewportPlaces.some((p) => p.osm_id === current) ? current : null
      );
      setStatus(`${viewportPlaces.length} places loaded from database`);
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

  const getSubCategoryValue = useCallback((place: Place): string => {
    const value = place.tags?.[place.category];
    if (value === undefined || value === null) {
      return "None";
    }

    if (typeof value === "string") {
      const trimmedValue = value.trim();
      return trimmedValue || "None";
    }

    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
      return String(value);
    }

    try {
      const serializedValue = JSON.stringify(value);
      if (!serializedValue || serializedValue === "{}" || serializedValue === "[]") {
        return "None";
      }
      return serializedValue;
    } catch {
      return "None";
    }
  }, []);

  const availableCategories = useMemo(() => {
    const values = new Set(places.map((p) => p.category).filter(Boolean));
    return Array.from(values).sort();
  }, [places]);

  const availableSubCategories = useMemo(() => {
    const sourcePlaces = columnFilters.category.length > 0
      ? places.filter((p) => columnFilters.category.includes(p.category))
      : places;
    const values = new Set(
      sourcePlaces.map((p) => getSubCategoryValue(p)).filter((v) => v !== "None")
    );
    return Array.from(values).sort();
  }, [places, columnFilters.category, getSubCategoryValue]);

  const fuzzyMatch = useCallback((text: string, query: string): boolean => {
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();
    let textIdx = 0;
    for (let i = 0; i < queryLower.length; i++) {
      const char = queryLower[i];
      textIdx = textLower.indexOf(char, textIdx);
      if (textIdx === -1) {
        return false;
      }
      textIdx++;
    }
    return true;
  }, []);

  const getPlaceMetadataFields = useCallback((place: Place): string[] => {
    const fields: string[] = [];
    
    if (place.name) {
      fields.push(place.name);
    }
    
    if (place.category) {
      fields.push(place.category);
    }
    
    if (place.tags) {
      Object.values(place.tags).forEach((value) => {
        if (typeof value === "string") {
          fields.push(value);
        } else if (typeof value === "number" || typeof value === "boolean") {
          fields.push(String(value));
        } else if (value !== null && value !== undefined) {
          try {
            fields.push(JSON.stringify(value));
          } catch {
            // skip unparseable values
          }
        }
      });
    }
    
    return fields;
  }, []);

  const filteredPlaces = useMemo(() => {
    return places.filter((place) => {
      if (hasName && !place.name) {
        return false;
      }

      const nameValue = (place.name || "").toLowerCase();
      if (columnFilters.name && !nameValue.includes(columnFilters.name.trim().toLowerCase())) {
        return false;
      }

      if (columnFilters.category.length > 0 && !columnFilters.category.includes(place.category)) {
        return false;
      }

      if (columnFilters.subCategory.length > 0 && !columnFilters.subCategory.includes(getSubCategoryValue(place))) {
        return false;
      }

      if (columnFilters.fuzzySearch) {
        const searchTerms = columnFilters.fuzzySearch.trim().split(/\s+/).filter(term => term.length > 0);
        const fields = getPlaceMetadataFields(place);
        const matches = searchTerms.some((term) => 
          fields.some((field) => fuzzyMatch(field, term))
        );
        if (!matches) {
          return false;
        }
      }

      return true;
    });
  }, [places, hasName, columnFilters.name, columnFilters.category, columnFilters.subCategory, columnFilters.fuzzySearch, getSubCategoryValue, getPlaceMetadataFields, fuzzyMatch]);

  const sortedPlaces = useMemo(() => {
    if (!sortState.column) {
      return filteredPlaces;
    }

    const getSortValue = (place: Place): string => {
      if (sortState.column === "name") {
        return place.name || "";
      }
      if (sortState.column === "category") {
        return place.category || "";
      }
      return getSubCategoryValue(place);
    };

    return [...filteredPlaces].sort((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);
      const compareResult = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: "base" });
      return sortState.direction === "asc" ? compareResult : -compareResult;
    });
  }, [filteredPlaces, getSubCategoryValue, sortState.column, sortState.direction]);

  const toggleSort = useCallback((column: "name" | "category" | "subCategory") => {
    setSortState((current) => {
      if (current.column !== column) {
        return { column, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { column, direction: "desc" };
      }
      return { column: null, direction: "asc" };
    });
  }, []);

  const getSortIcon = useCallback((column: "name" | "category" | "subCategory") => {
    if (sortState.column !== column) {
      return <UnfoldMoreRounded sx={{ fontSize: 14 }} />;
    }
    return sortState.direction === "asc"
      ? <ArrowUpwardRounded sx={{ fontSize: 14 }} />
      : <ArrowDownwardRounded sx={{ fontSize: 14 }} />;
  }, [sortState.column, sortState.direction]);

  return (
    <>
      <CssBaseline />
      {/* Sheet that appears behind table, shows the drag edge  */}
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
            sx={{
              width: { xs: "100%", md: tableWidth },
              minWidth: { md: tableWidth },
              maxWidth: { xs: "100%", md: tableWidth },
              flexShrink: 0,
              p: 1.5,
              overflow: "auto",
            }}
          >
            <Stack spacing={1.5}>
              <Typography level="title-md">Places</Typography>

              <Typography level="body-sm" color="neutral">
                {status}
              </Typography>
              <Typography level="body-sm" color="neutral">
                {isLoadingPlaces ? "Refreshing viewport places..." : `${filteredPlaces.length} visible places`}
              </Typography>

              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography level="body-sm">Has name</Typography>
                <Switch checked={hasName} onChange={(event) => setHasName(event.target.checked)} />
              </Stack>

              <Input
                startDecorator={<SearchRounded />}
                size="sm"
                placeholder="Fuzzy search"
                value={columnFilters.fuzzySearch}
                onChange={(event) => setColumnFilters((current) => ({ ...current, fuzzySearch: event.target.value }))}
              />

              <Table size="sm" stickyHeader>
                <thead>
                  <tr>
                    <th style={{ width: '40%' }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography level="body-sm">Name</Typography>
                        <IconButton size="sm" onClick={() => toggleSort("name")}>{getSortIcon("name")}</IconButton>
                      </Stack>
                    </th>
                    <th style={{ width: '30%' }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography level="body-sm">Category</Typography>
                        <IconButton size="sm" onClick={() => toggleSort("category")}>{getSortIcon("category")}</IconButton>
                      </Stack>
                    </th>
                    <th style={{ width: '30%' }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography level="body-sm">Sub Category</Typography>
                        <IconButton size="sm" onClick={() => toggleSort("subCategory")}>{getSortIcon("subCategory")}</IconButton>
                      </Stack>
                    </th>
                  </tr>
                  <tr>
                    <th style={{ width: '40%' }}>
                      <Input
                        size="sm"
                        value={columnFilters.name}
                        placeholder="Filter name"
                        onChange={(event) => setColumnFilters((current) => ({ ...current, name: event.target.value }))}
                      />
                    </th>
                    <th style={{ width: '30%' }}>
                      <Autocomplete
                        size="sm"
                        multiple
                        options={availableCategories}
                        value={columnFilters.category}
                        placeholder={columnFilters.category.length === 0 ? "Filter category" : undefined}
                        onChange={(_, value) => setColumnFilters((current) => ({ ...current, category: value }))}
                        renderOption={(props, option) => (
                          <AutocompleteOption {...props} key={option}>
                            {option}
                          </AutocompleteOption>
                        )}
                        renderTags={(selected, getTagProps) =>
                          selected.map((option, index) => (
                            <Chip size="sm" {...getTagProps({ index })} key={option}>{option}</Chip>
                          ))
                        }
                        sx={{ minWidth: 0 }}
                      />
                    </th>
                    <th style={{ width: '30%' }}>
                      <Autocomplete
                        size="sm"
                        multiple
                        options={availableSubCategories}
                        value={columnFilters.subCategory}
                        placeholder={columnFilters.subCategory.length === 0 ? "Filter sub category" : undefined}
                        onChange={(_, value) => setColumnFilters((current) => ({ ...current, subCategory: value }))}
                        renderOption={(props, option) => (
                          <AutocompleteOption {...props} key={option}>
                            {option}
                          </AutocompleteOption>
                        )}
                        renderTags={(selected, getTagProps) =>
                          selected.map((option, index) => (
                            <Chip size="sm" {...getTagProps({ index })} key={option}>{option}</Chip>
                          ))
                        }
                        sx={{ minWidth: 0 }}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlaces.slice(0, 500).map((place) => (
                    <tr
                      key={place.osm_id}
                      onClick={() => {
                        setSelectedOsmId(place.osm_id);
                        centerOnRef.current?.(place.lat, place.lng);
                      }}
                      style={{
                        cursor: "pointer",
                        backgroundColor: selectedOsmId === place.osm_id ? "var(--joy-palette-primary-softBg)" : undefined,
                      }}
                    >
                      <td style={{ width: '40%', fontWeight: 'bold' }}>{place.name || "(unnamed)"}</td>
                      <td style={{ width: '30%' }}>{place.category}</td>
                      <td style={{ width: '30%' }}>{getSubCategoryValue(place)}</td>
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
              size="sm"
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
                // borderRadius: "12px",
                boxShadow: "sm",
                px: 3,
              }}
            >
              Load current area
            </Button>
            <Dropdown>
              <Tooltip title="Select base map" placement="left" variant="soft">
                <MenuButton
                  slots={{ root: IconButton }}
                  slotProps={{
                    root: {
                      size: "sm",
                      variant: "soft",
                      sx: {
                        position: "absolute",
                        top: 124,
                        right: 20,
                        zIndex: 2,
                        boxShadow: "sm",
                      },
                    },
                  }}
                >
                  <MapRounded sx={{ fontSize: 18 }} />
                </MenuButton>
              </Tooltip>
              <Menu placement="bottom-end" sx={{ minWidth: 176 }}>
                {(Object.entries(BASE_MAP_STYLES) as [BaseMapOption, { label: string; styleUrl: string; enable3D: boolean }][]).map(([key, style]) => (
                  <MenuItem
                    key={key}
                    selected={baseMapOption === key}
                    onClick={() => setBaseMapOption(key)}
                  >
                    {style.label}
                  </MenuItem>
                ))}
              </Menu>
            </Dropdown>
            <Tooltip title="Toggle light/dark mode" placement="left" variant="soft">
              <IconButton
                size="sm"
                variant="soft"
                onClick={() => setMode(mode === "dark" ? "light" : "dark")}
                sx={{
                  position: "absolute",
                  top: 164,
                  right: 20,
                  zIndex: 2,
                  boxShadow: "sm",
                }}
              >
                {mode === "dark" ? <LightModeRounded sx={{ fontSize: 18 }} /> : <DarkModeRounded sx={{ fontSize: 18 }} />}
              </IconButton>
            </Tooltip>

            <MapPane
              places={filteredPlaces}
              initialBounds={DEFAULT_BOUNDS}
              selectedOsmId={selectedOsmId}
              mapStyleUrl={BASE_MAP_STYLES[baseMapOption].styleUrl}
              enable3D={BASE_MAP_STYLES[baseMapOption].enable3D}
              onViewportChanged={handleViewportChanged}
              onCenterOnReady={(fn) => { centerOnRef.current = fn; }}
            />
          </Box>
        </Box>
      </Sheet>
    </>
  );
}

export default App;
