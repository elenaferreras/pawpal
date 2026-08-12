interface MealsWidgetProps {
  /** Meals eaten so far today. */
  eaten: number;
  /** Total meals planned per day. */
  total: number;
}

/**
 * Pixel-art pacman facing right (Figma node 58:2146). Rendered as one crisp
 * rect per pixel row so it keeps its retro, aliased edges at any size.
 */
function Pacman(): React.ReactElement {
  // [startCol, endCol] filled run per row on a 12×12 pixel grid. The right edge
  // recedes toward the centre at the vertical middle to cut the mouth wedge.
  const rows: [number, number][] = [
    [4, 7],
    [3, 9],
    [2, 10],
    [1, 11],
    [1, 9],
    [0, 7],
    [0, 7],
    [1, 9],
    [1, 11],
    [2, 10],
    [3, 9],
    [4, 7],
  ];
  return (
    <svg
      width={20}
      height={22}
      viewBox="0 0 12 12"
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{ flexShrink: 0, display: "block" }}
    >
      {rows.map(([s, e], y) => (
        <rect key={y} x={s} y={y} width={e - s + 1} height={1} fill="var(--color-pawpal-fab)" />
      ))}
    </svg>
  );
}

/** Small square meal marker: hollow (white border) when eaten, solid white when still to eat. */
function Marker({ eaten }: { eaten?: boolean }): React.ReactElement {
  return (
    <div
      style={{
        width: 8,
        height: 8,
        flexShrink: 0,
        boxSizing: "border-box",
        background: eaten ? "transparent" : "#fff",
        border: eaten ? "2px solid #fff" : "none",
      }}
    />
  );
}

/**
 * Meals widget (Figma node 58:2149).
 *
 * Dark rounded row: eaten meals shown as hollow white squares, a pacman at the
 * eating frontier, and remaining meals as solid white squares — spread edge to
 * edge with no label.
 */
export function MealsWidget({ eaten, total }: MealsWidgetProps): React.ReactElement {
  const done = Math.max(0, Math.min(eaten, total));
  const remaining = Math.max(0, total - done);

  return (
    <div
      role="img"
      aria-label={`${done} of ${total} meals eaten`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "16px 32px",
        borderRadius: 24,
        background: "var(--color-meal-widget-bg)",
      }}
    >
      {Array.from({ length: done }, (_, i) => (
        <Marker key={`eaten-${i}`} eaten />
      ))}
      <Pacman />
      {Array.from({ length: remaining }, (_, i) => (
        <Marker key={`toeat-${i}`} />
      ))}
    </div>
  );
}
