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
  remove(): void;
}
interface LeafletPolyline extends LeafletLayer {
  getBounds(): LeafletBounds;
  setLatLngs(latlngs: [number, number][]): LeafletPolyline;
}
interface LeafletCircle extends LeafletLayer {
  setLatLng(latlng: [number, number]): LeafletCircle;
  setRadius(radius: number): LeafletCircle;
}
interface LeafletMarker extends LeafletLayer {
  setLatLng(latlng: [number, number]): LeafletMarker;
}
interface LeafletDivIcon {
  readonly _isDivIcon?: true;
}
interface LeafletMap {
  readonly attributionControl: LeafletAttributionControl;
  fitBounds(bounds: LeafletBounds, options?: { padding?: [number, number] }): void;
  setView(center: [number, number], zoom: number): LeafletMap;
  panTo(center: [number, number], options?: { animate?: boolean; duration?: number }): LeafletMap;
  getZoom(): number;
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
      className?: string;
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
  circle(
    center: [number, number],
    options?: {
      radius?: number;
      color?: string;
      fillColor?: string;
      fillOpacity?: number;
      opacity?: number;
      weight?: number;
      className?: string;
    },
  ): LeafletCircle;
  marker(
    center: [number, number],
    options?: {
      icon?: LeafletDivIcon;
      interactive?: boolean;
      keyboard?: boolean;
      zIndexOffset?: number;
    },
  ): LeafletMarker;
  divIcon(options: {
    html?: string;
    className?: string;
    iconSize?: [number, number];
    iconAnchor?: [number, number];
  }): LeafletDivIcon;
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
  /**
   * Live mode: the route grows as fixes arrive. Instead of a static fitBounds
   * snapshot, the map keeps a moving "current position" marker, an accuracy
   * ring, and (when `follow`) recentres on the latest fix without tearing the
   * map down. Used by the in-progress walk sheet.
   */
  live?: boolean;
  /** Auto-recenter on the newest fix (live mode only). */
  follow?: boolean;
  /** SVG/HTML for the live position marker (e.g. the dog avatar). */
  markerHtml?: string;
  /** GPS accuracy (metres) for the pulsing accuracy ring (live mode only). */
  accuracyM?: number;
}

// Renders a walk's GPS route on an interactive OpenStreetMap (Strava-style).
// In `live` mode the route updates incrementally and follows the walker.
export function RouteMap({
  coords,
  height = 200,
  mapStyle = "light",
  lineColor = LINE,
  startColor = START,
  endColor = END,
  hideWordmark = true,
  live = false,
  follow = false,
  markerHtml,
  accuracyM,
}: RouteMapProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const glowRef = useRef<LeafletPolyline | null>(null);
  const lineRef = useRef<LeafletPolyline | null>(null);
  const posMarkerRef = useRef<LeafletMarker | null>(null);
  const accuracyRef = useRef<LeafletCircle | null>(null);
  const startRef = useRef<LeafletLayer | null>(null);
  const endRef = useRef<LeafletLayer | null>(null);
  const readyRef = useRef(false);
  const didCenterRef = useRef(false);
  const syncRef = useRef<((L: LeafletStatic, pts: [number, number][]) => void) | null>(null);
  const [error, setError] = useState(false);

  const points: [number, number][] = coords
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
    .map((c) => [c.lat, c.lng]);

  // Latest prop/derived values mirrored into refs so the one-time init effect
  // (and the closure it captures) can read them without being a dependency.
  const pointsRef = useRef(points);
  const markerHtmlRef = useRef(markerHtml);
  const accuracyMRef = useRef(accuracyM);
  const followRef = useRef(follow);
  pointsRef.current = points;
  markerHtmlRef.current = markerHtml;
  accuracyMRef.current = accuracyM;
  followRef.current = follow;

  // ---- Init effect: create the map once (rebuild only when the basemap or
  // mode changes). Live-mode layers are (re)created here empty and populated by
  // the update effect below, so incoming fixes never tear the map down.
  useEffect(() => {
    let cancelled = false;
    readyRef.current = false;
    didCenterRef.current = false;

    // Populate/refresh the map layers for the given points. Declared inside the
    // effect so both the init pass and the update effect share one code path.
    const syncLayers = (L: LeafletStatic, pts: [number, number][]): void => {
      const map = mapRef.current;
      if (!map || !readyRef.current) return;

      glowRef.current?.setLatLngs(pts);
      lineRef.current?.setLatLngs(pts);

      if (pts.length === 0) return;
      const first = pts[0];
      const last = pts[pts.length - 1];

      if (live) {
        if (!posMarkerRef.current) {
          const icon = L.divIcon({
            html: markerHtmlRef.current ?? "",
            className: "lw-pin",
            iconSize: [52, 52],
            iconAnchor: [26, 26],
          });
          posMarkerRef.current = L.marker(last, {
            icon,
            interactive: false,
            keyboard: false,
            zIndexOffset: 1000,
          });
          posMarkerRef.current.addTo(map);
        } else {
          posMarkerRef.current.setLatLng(last);
        }

        if (!accuracyRef.current) {
          accuracyRef.current = L.circle(last, {
            radius: accuracyMRef.current ?? 20,
            color: lineColor,
            fillColor: lineColor,
            fillOpacity: 0.1,
            opacity: 0.35,
            weight: 1,
            className: "lw-accuracy",
          });
          accuracyRef.current.addTo(map);
        } else {
          accuracyRef.current.setLatLng(last).setRadius(accuracyMRef.current ?? 20);
        }

        if (!didCenterRef.current) {
          map.setView(last, 16);
          didCenterRef.current = true;
        } else if (followRef.current) {
          map.panTo(last, { animate: true, duration: 0.6 });
        }
        return;
      }

      // Static (saved-walk) mode: start/end dots + a one-time fitBounds.
      if (pts.length < 2) return;
      if (!startRef.current) {
        startRef.current = L.circleMarker(first, {
          radius: 6,
          color: "#ffffff",
          fillColor: startColor,
          fillOpacity: 1,
          weight: 2,
        });
        startRef.current.addTo(map);
      }
      if (!endRef.current) {
        // Use the dog-avatar pin at the finish when provided (matches the live
        // walk), otherwise the default end dot.
        if (markerHtmlRef.current) {
          const icon = L.divIcon({
            html: markerHtmlRef.current,
            className: "lw-pin",
            iconSize: [52, 52],
            iconAnchor: [26, 26],
          });
          endRef.current = L.marker(last, {
            icon,
            interactive: false,
            keyboard: false,
            zIndexOffset: 1000,
          });
        } else {
          endRef.current = L.circleMarker(last, {
            radius: 7,
            color: "#ffffff",
            fillColor: endColor,
            fillOpacity: 1,
            weight: 2,
          });
        }
        endRef.current.addTo(map);
      }
      if (!didCenterRef.current && lineRef.current) {
        map.fitBounds(lineRef.current.getBounds(), { padding: [34, 34] });
        didCenterRef.current = true;
      }
    };
    syncRef.current = syncLayers;

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

        // Give the map an initial view so tiles render before the first fix.
        const start0 = pointsRef.current[0];
        if (start0) map.setView(start0, live ? 16 : 15);
        else map.setView([0, 0], 2);

        // Soft glow underlay + crisp route line on top.
        glowRef.current = L.polyline([], {
          color: lineColor,
          weight: 12,
          opacity: 0.25,
          lineJoin: "round",
          lineCap: "round",
          className: "lw-route-glow",
        });
        glowRef.current.addTo(map);
        lineRef.current = L.polyline([], {
          color: lineColor,
          weight: live ? 5 : 4,
          opacity: 0.95,
          lineJoin: "round",
          lineCap: "round",
        });
        lineRef.current.addTo(map);

        readyRef.current = true;
        // First population pass now that the layers exist.
        syncLayers(L, pointsRef.current);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      readyRef.current = false;
      glowRef.current = null;
      lineRef.current = null;
      posMarkerRef.current = null;
      accuracyRef.current = null;
      startRef.current = null;
      endRef.current = null;
      syncRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // Rebuild only when basemap/mode/colour identity changes — NOT on coords.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle, lineColor, startColor, endColor, hideWordmark, live]);

  // ---- Update effect: feed new points into the existing map (no teardown).
  useEffect(() => {
    if (!readyRef.current) return;
    const L = (window as unknown as { L?: LeafletStatic }).L;
    if (L && syncRef.current) syncRef.current(L, points);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, follow, accuracyM]);

  // Static mode with no usable route: branded empty state.
  if (!live && points.length < 2 && !error) {
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
