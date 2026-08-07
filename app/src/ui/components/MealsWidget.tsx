interface MealsWidgetProps {
  /** Meals eaten so far today. */
  eaten: number;
  /** Total meals planned per day. */
  total: number;
}

/** Pacman marker — sits at the frontier between eaten and to-eat dots. */
function Pacman(): React.ReactElement {
  return (
    <svg
      width={36}
      height={36}
      viewBox="0 0 36 36"
      aria-hidden="true"
      style={{ flexShrink: 0, display: "block" }}
    >
      {/* Circle with a wedge cut on the right for the mouth. */}
      <path d="M18 18 L33.6 9 A18 18 0 1 0 33.6 27 Z" fill="var(--color-pawpal-fab)" />
    </svg>
  );
}

function Dot({ eaten }: { eaten?: boolean }): React.ReactElement {
  return (
    <div
      style={{
        flex: "1 0 0",
        minWidth: 0,
        aspectRatio: "1",
        borderRadius: "50%",
        background: "var(--color-meal-dot)",
        opacity: eaten ? 0.3 : 1,
      }}
    />
  );
}

/**
 * Meals widget (Figma node 12:659).
 *
 * Dark rounded pill: eaten meals shown as faded dots, a pacman at the eating
 * frontier, remaining meals as bright dots, and an "N of total meals" label.
 * Colours come from theme tokens (pacman reuses --color-pawpal-fab).
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
        gap: 16,
        padding: "8px 16px",
        borderRadius: 24,
        background: "var(--color-meal-widget-bg)",
      }}
    >
      {Array.from({ length: done }, (_, i) => (
        <Dot key={`eaten-${i}`} eaten />
      ))}
      <Pacman />
      {Array.from({ length: remaining }, (_, i) => (
        <Dot key={`toeat-${i}`} />
      ))}
      <p
        aria-hidden="true"
        style={{
          margin: 0,
          fontSize: 24,
          fontWeight: 900,
          lineHeight: "normal",
          color: "var(--color-on-dark)",
          whiteSpace: "nowrap",
          textAlign: "right",
        }}
      >
        {done} of {total} meals
      </p>
    </div>
  );
}
