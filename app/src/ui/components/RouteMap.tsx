import { useEffect, useRef, useState } from "react";
import type { GpsCoord } from "../types";

// PawPal route colours (match RouteCanvas).
const LINE = "#2AA98B";
const START = "#0F6E56";
const END = "#F5A623";

// Selectable basemap styles. All are free/key-less raster tiles; each keeps the
// attribution its provider requires.
export type MapStyle = "osm" | "light" | "dark" | "voyager";

interface TileConfig {
  url: string;
  attribution: string;
  maxZoom: number;
}

const TILE_STYLES: Record<MapStyle, TileConfig> = {
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    maxZoom: 20,
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    maxZoom: 20,
  },
  voyager: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    maxZoom: 20,
  },
};

// Leaflet is loaded from CDN on demand (see loadLeaflet). These minimal typings
// cover only the surface we use, so we never fall back to `any`.
interface LeafletBounds {
  readonly _isBounds?: true;
}
interface LeafletAttributionControl {
  setPrefix(prefix: string | false): void;
}
interface LeafletLayer {
  addTo(map: LeafletMap): LeafletLayer;
}
interface LeafletPolyline extends LeafletLayer {
  getBounds(): LeafletBounds;
}
interface LeafletMap {
  readonly attributionControl: LeafletAttributionControl;
  fitBounds(bounds: LeafletBounds, options?: { padding?: [number, number] }): void;
  setView(center: [number, number], zoom: number): void;
  remove(): void;
}
interface LeafletStatic {
  map(
    el: HTMLElement,
    options?: { zoomControl?: boolean; attributionControl?: boolean },
  ): LeafletMap;
  tileLayer(
    url: string,
    options?: { maxZoom?: number; attribution?: string },
  ): LeafletLayer;
  polyline(
    latlngs: [number, number][],
    options?: {
      color?: string;
      weight?: number;
      opacity?: number;
      lineJoin?: string;
      lineCap?: string;
    },
  ): LeafletPolyline;
  circleMarker(
    center: [number, number],
    options?: {
      radius?: number;
      color?: string;
      fillColor?: string;
      fillOpacity?: number;
      weight?: number;
    },
  ): LeafletLayer;
}

const LEAFLET_VERSION = "1.9.4";
const CSS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const JS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;

let leafletPromise: Promise<LeafletStatic> | null = null;

// Injects Leaflet's CSS + JS once and resolves with the global `L`.
function loadLeaflet(): Promise<LeafletStatic> {
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise<LeafletStatic>((resolve, reject) => {
    const existing = (window as unknown as { L?: LeafletStatic }).L;
    if (existing) {
      resolve(existing);
      return;
    }

    if (!document.querySelector(`link[href="${CSS_URL}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = CSS_URL;
      document.head.appendChild(link);
    }

    const script = document.createElement("script");
    script.src = JS_URL;
    script.async = true;
    script.onload = () => {
      const L = (window as unknown as { L?: LeafletStatic }).L;
      if (L) resolve(L);
      else reject(new Error("Leaflet loaded but window.L is undefined"));
    };
    script.onerror = () => reject(new Error("Failed to load Leaflet from CDN"));
    document.head.appendChild(script);
  });

  return leafletPromise;
}

interface RouteMapProps {
  coords: GpsCoord[];
  height?: number;
  /** Basemap style. Defaults to a clean light basemap. */
  mapStyle?: MapStyle;
  /** Route line colour. */
  lineColor?: string;
  /** Start marker colour. */
  startColor?: string;
  /** End marker colour. */
  endColor?: string;
  /** Hide the "Leaflet" wordmark (tile attribution is always kept). */
  hideWordmark?: boolean;
}

// Renders a saved walk's GPS route on an interactive OpenStreetMap (Strava-style).
export function RouteMap({
  coords,
  height = 200,
  mapStyle = "light",
  lineColor = LINE,
  startColor = START,
  endColor = END,
  hideWordmark = true,
}: RouteMapProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [error, setError] = useState(false);

  const points: [number, number][] = coords
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
    .map((c) => [c.lat, c.lng]);

  useEffect(() => {
    if (points.length < 2) return;
    let cancelled = false;

    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current) return;

        const map = L.map(containerRef.current, {
          zoomControl: false,
          attributionControl: true,
        });
        mapRef.current = map;

        if (hideWordmark) map.attributionControl.setPrefix(false);

        const tiles = TILE_STYLES[mapStyle];
        L.tileLayer(tiles.url, {
          maxZoom: tiles.maxZoom,
          attribution: tiles.attribution,
        }).addTo(map);

        const line = L.polyline(points, {
          color: lineColor,
          weight: 4,
          opacity: 0.9,
          lineJoin: "round",
          lineCap: "round",
        });
        line.addTo(map);

        const first = points[0];
        const last = points[points.length - 1];
        L.circleMarker(first, {
          radius: 6,
          color: "#ffffff",
          fillColor: startColor,
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);
        L.circleMarker(last, {
          radius: 7,
          color: "#ffffff",
          fillColor: endColor,
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);

        map.fitBounds(line.getBounds(), { padding: [24, 24] });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // Re-run when the underlying route or styling changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, mapStyle, lineColor, startColor, endColor, hideWordmark]);

  if (points.length < 2) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#E8F4F0",
          color: "#2AA98B",
          borderRadius: "var(--radius-sm)",
          fontSize: 13,
        }}
      >
        No route recorded for this walk
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#E8F4F0",
          color: "#2AA98B",
          borderRadius: "var(--radius-sm)",
          fontSize: 13,
          textAlign: "center",
          padding: 12,
        }}
      >
        Map unavailable — check your connection
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        height,
        width: "100%",
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        zIndex: 0,
      }}
    />
  );
}
