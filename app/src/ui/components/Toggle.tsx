interface ToggleProps {
  /** Accessible label (visually hidden — the switch is icon-only). */
  label: string;
  /** Present for API parity with the previous Astryx Switch; the label is always visually hidden. */
  isLabelHidden?: boolean;
  value: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const GREEN = "#34C759"; // accents/green (on track)
const OFF = "rgba(233,228,196,0.3)"; // stone #E9E4C4 @ 30% (off track)

/**
 * iOS-style toggle switch (Figma node 233:3492): a 64×28 rounded track — green
 * when on, translucent grey when off — with a wide white 39×24 pill knob that
 * slides between the ends.
 */
export function Toggle({
  label,
  value,
  onChange,
  disabled = false,
}: ToggleProps): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!value)}
      style={{
        width: 64,
        height: 28,
        flexShrink: 0,
        padding: 2,
        borderRadius: 100,
        border: "none",
        background: value ? GREEN : OFF,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        display: "flex",
        alignItems: "center",
        transition: "background-color 0.2s ease",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 39,
          height: 24,
          borderRadius: 100,
          background: "#fff",
          boxShadow: "0 2px 4px rgba(0,0,0,0.18)",
          transform: value ? "translateX(21px)" : "translateX(0)",
          transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </button>
  );
}
