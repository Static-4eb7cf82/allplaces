package osm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"allplaces/backend/internal/db"
)

type OverpassClient struct {
	baseURL string
	http    *http.Client
}

type overpassElement struct {
	ID     int64                  `json:"id"`
	Type   string                 `json:"type"`
	Lat    *float64               `json:"lat,omitempty"`
	Lon    *float64               `json:"lon,omitempty"`
	Center map[string]float64     `json:"center,omitempty"`
	Tags   map[string]interface{} `json:"tags,omitempty"`
}

type overpassResponse struct {
	Elements []overpassElement `json:"elements"`
}

func NewOverpassClient(baseURL string, timeout time.Duration) *OverpassClient {
	return &OverpassClient{
		baseURL: baseURL,
		http: &http.Client{
			Timeout: timeout,
		},
	}
}

func (c *OverpassClient) FetchPlaces(ctx context.Context, south, west, north, east float64) ([]db.Place, error) {
	if err := validateBBox(south, west, north, east); err != nil {
		return nil, err
	}

	query := buildQuery(south, west, north, east)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL, bytes.NewBufferString(query))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("overpass error status=%d body=%s", resp.StatusCode, string(body))
	}

	var parsed overpassResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}

	places := make([]db.Place, 0, len(parsed.Elements))
	for _, element := range parsed.Elements {
		lat, lng, ok := extractLatLng(element)
		if !ok {
			continue
		}
		if math.IsNaN(lat) || math.IsNaN(lng) {
			continue
		}

		name := normalizeName(element.Tags)
		osmType := strings.TrimSpace(element.Type)
		if osmType == "" {
			continue
		}

		tags := element.Tags
		if tags == nil {
			tags = map[string]interface{}{}
		}

		place := db.Place{
			OSMID: fmt.Sprintf("%s:%d", osmType, element.ID),
			Type:  osmType,
			Name:  name,
			Lat:   lat,
			Lng:   lng,
			Tags:  tags,
		}
		places = append(places, place)
	}

	return places, nil
}

func validateBBox(south, west, north, east float64) error {
	if south >= north {
		return fmt.Errorf("invalid bbox: south must be < north")
	}
	if west >= east {
		return fmt.Errorf("invalid bbox: west must be < east")
	}
	if south < -90 || north > 90 || west < -180 || east > 180 {
		return fmt.Errorf("invalid bbox: coordinates out of range")
	}
	return nil
}

func buildQuery(south, west, north, east float64) string {
	bbox := strings.Join([]string{
		formatFloat(south),
		formatFloat(west),
		formatFloat(north),
		formatFloat(east),
	}, ",")

	return fmt.Sprintf(`[out:json][timeout:25];
(
  node["amenity"~"restaurant|cafe|bar|fast_food|bank|library|marketplace|hospital|clinic|doctors|pharmacy|school|college|university|kindergarten"](%s);
  way["amenity"~"restaurant|cafe|bar|fast_food|bank|library|marketplace|hospital|clinic|doctors|pharmacy|school|college|university|kindergarten"](%s);
  relation["amenity"~"restaurant|cafe|bar|fast_food|bank|library|marketplace|hospital|clinic|doctors|pharmacy|school|college|university|kindergarten"](%s);

  node["shop"](%s);
  way["shop"](%s);
  relation["shop"](%s);

  node["tourism"](%s);
  way["tourism"](%s);
  relation["tourism"](%s);

  node["leisure"~"park|garden|nature_reserve|sports_centre"](%s);
  way["leisure"~"park|garden|nature_reserve|sports_centre"](%s);
  relation["leisure"~"park|garden|nature_reserve|sports_centre"](%s);

  node["office"](%s);
  way["office"](%s);
  relation["office"](%s);

  node["healthcare"](%s);
  way["healthcare"](%s);
  relation["healthcare"](%s);

  node["public_transport"~"station|stop_position|platform"](%s);
  way["public_transport"~"station|stop_position|platform"](%s);
  relation["public_transport"~"station|stop_position|platform"](%s);

  node["railway"~"station|halt|tram_stop"](%s);
  way["railway"~"station|halt|tram_stop"](%s);
  relation["railway"~"station|halt|tram_stop"](%s);
);
out center tags;`, bbox, bbox, bbox, bbox, bbox, bbox, bbox, bbox, bbox, bbox, bbox, bbox, bbox, bbox, bbox, bbox, bbox, bbox, bbox, bbox, bbox, bbox, bbox, bbox)
}

func extractLatLng(element overpassElement) (float64, float64, bool) {
	if element.Lat != nil && element.Lon != nil {
		return *element.Lat, *element.Lon, true
	}
	if element.Center != nil {
		lat, latOK := element.Center["lat"]
		lng, lngOK := element.Center["lon"]
		if latOK && lngOK {
			return lat, lng, true
		}
	}
	return 0, 0, false
}

func normalizeName(tags map[string]interface{}) *string {
	if tags == nil {
		return nil
	}
	nameRaw, ok := tags["name"]
	if !ok {
		return nil
	}
	name := strings.TrimSpace(fmt.Sprintf("%v", nameRaw))
	if name == "" || name == "<nil>" {
		return nil
	}
	return &name
}

func formatFloat(v float64) string {
	return strconv.FormatFloat(v, 'f', 6, 64)
}
