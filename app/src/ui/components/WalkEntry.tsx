import { Icon } from "@astryxdesign/core/Icon";
import { Icons } from "../lib/icons";
import { DogFace } from "../avatar/DogAvatar";
import { walkerAvatar } from "../lib/walkers";
import type { Walk } from "../types";

/** Terrain value → icon name, mirroring the picker in WalkTrackSheet. Used as
 * the thumbnail glyph for walks logged without a GPS route. */
const TERRAIN_ICON: Record<string, keyof typeof Icons> = {
  city: "building",
  park: "trees",
  forest: "treePine",
  mountain: "mountain",
  beach: "waves",
  trail: "footprints",
};

/** A single walk row: thumbnail (GPS route or terrain glyph), a two-line
 * steps/walks label, and the pet + assignee avatars. Shared by the owner's
 * Walks screen and the sitter feed. When `onOpenMap` is omitted the GPS
 * thumbnail renders as a static tile instead of a button. */
export function WalkEntry({
  walk,
  avatar,
  onOpenMap,
}: {
  walk: Walk;
  avatar: Parameters<typeof DogFace>[0]["avatar"];
  onOpenMap?: (walk: Walk) => void;
}): React.ReactElement {
  const hasRoute = Array.isArray(walk.gpsRoute) && walk.gpsRoute.length > 1;
  const stepsNum = parseInt(String(walk.steps)) || 0;
  const walksCount = walk.walksCount ?? 1;
  const assignee = walk.assignee ? walkerAvatar(walk.assignee) : undefined;
  // No GPS route → show the first selected terrain's glyph, falling back to a paw.
  const terrain0 = walk.terrain?.[0];
  const fallbackIcon =
    terrain0 && TERRAIN_ICON[terrain0] ? Icons[TERRAIN_ICON[terrain0]] : Icons.pawPrint;

  const thumbStyle: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: "hidden",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#A9E7A7",
    color: "var(--color-pawpal-page)",
  };

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", height: 72, boxSizing: "border-box", padding: "0 16px" }}>
      {/* Thumbnail: tap the route map to view it full-size; else a green paw tile. */}
      {hasRoute && walk.gpsRoute ? (
        onOpenMap ? (
          <button
            type="button"
            aria-label="View walk route on map"
            onClick={(e) => {
              e.stopPropagation();
              onOpenMap(walk);
            }}
            style={{ ...thumbStyle, border: "none", padding: 0, cursor: "pointer" }}
          >
            <RouteThumb coords={walk.gpsRoute} size={40} />
          </button>
        ) : (
          <div style={thumbStyle}>
            <RouteThumb coords={walk.gpsRoute} size={40} />
          </div>
        )
      ) : (
        <div style={thumbStyle}>
          <Icon icon={fallbackIcon} width={24} height={24} color="inherit" />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontFamily: "var(--font-ui)",
            fontWeight: 600,
            fontSize: 16,
            color: "var(--color-pawpal-hero)",
          }}
        >
          {stepsNum > 0
            ? `${stepsNum.toLocaleString("de-DE")} steps`
            : `${walksCount} walk${walksCount === 1 ? "" : "s"}`}
        </span>
        {stepsNum > 0 && (
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontWeight: 400,
              fontSize: 16,
              color: "var(--color-pawpal-hero)",
              opacity: 0.8,
            }}
          >
            {`${walksCount} walk${walksCount === 1 ? "" : "s"}`}
          </span>
        )}
      </div>

      {/* Walkers: the pet plus (optionally) the assignee. */}
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            overflow: "hidden",
            background: "#EDD4FD",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
            position: "relative",
          }}
        >
          <DogFace avatar={avatar} size={32} />
        </div>
        {assignee && (
          <div
            style={{
              width: 32,
              height: 32,
              marginLeft: -4,
              borderRadius: "50%",
              background: assignee.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-ui)",
              fontWeight: 600,
              fontSize: 14,
              color: "var(--color-pawpal-page)",
              zIndex: 1,
            }}
          >
            {assignee.initials}
          </div>
        )}
      </div>
    </div>
  );
}

/** Miniature SVG polyline of a GPS route, sized to a square thumbnail. */
export function RouteThumb({ coords, size }: { coords: Walk["gpsRoute"]; size: number }): React.ReactElement | null {
  const pts = coords ?? [];
  if (pts.length < 2) return null;
  const pad = 6;
  const span = size - pad * 2;
  const lats = pts.map((c) => c.lat);
  const lngs = pts.map((c) => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const dLat = maxLat - minLat || 0.0001;
  const dLng = maxLng - minLng || 0.0001;
  const scale = Math.min(span / dLng, span / dLat);
  // Centre the route within the square.
  const offX = pad + (span - dLng * scale) / 2;
  const offY = pad + (span - dLat * scale) / 2;
  const toX = (lng: number): number => offX + (lng - minLng) * scale;
  const toY = (lat: number): number => offY + (maxLat - lat) * scale;
  const d = pts.map((c, i) => `${i === 0 ? "M" : "L"}${toX(c.lng).toFixed(1)} ${toY(c.lat).toFixed(1)}`).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <path
        d={d}
        fill="none"
        stroke="var(--color-pawpal-page)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
