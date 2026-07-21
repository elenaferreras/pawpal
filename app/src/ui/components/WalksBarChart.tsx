import { useLayoutEffect, useRef, useState } from "react";

export interface WalksBar {
  /** Short label exposed for accessibility. */
  label: string;
  /** Normalised height, 0..1 of the chart height. */
  fraction: number;
  /** Bar fill colour (CSS colour or var()). */
  color: string;
}

interface WalksBarChartProps {
  /** One entry per column (real walks and/or mock placeholders). */
  data: readonly WalksBar[];
  /** Max chart height in px — a bar with fraction 1 fills this. */
  height?: number;
  /** Gap between bars in px. */
  gap?: number;
}

/**
 * Walks bar chart — one pill per column.
 *
 * - Widths flex to fit the container.
 * - Height is `fraction × chart height`; the tallest walk uses fraction 1.
 * - Bars are centred vertically (matching Figma).
 * - Minimum bar height equals the bar's own width, so a short walk renders as a
 *   perfect circle rather than a squished pill.
 *
 * Pure CSS — no charting library. Colours are supplied per-bar via theme tokens.
 */
export function WalksBarChart({ data, height = 172, gap = 16 }: WalksBarChartProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = data.length;
  // Each bar shares the row equally (flex:1), so its rendered width is:
  const barWidth = n > 0 && containerWidth > 0 ? (containerWidth - gap * (n - 1)) / n : 0;

  return (
    <div ref={ref} style={{ display: "flex", alignItems: "center", gap, height, width: "100%" }}>
      {data.map((d, i) => {
        const scaled = Math.max(0, Math.min(1, d.fraction)) * height;
        // Minimum height = bar width → a perfect circle.
        const barHeight = Math.max(barWidth, scaled);
        return (
          <div
            key={i}
            aria-label={d.label}
            style={{
              flex: 1,
              height: barHeight,
              borderRadius: 9999,
              background: d.color,
            }}
          />
        );
      })}
    </div>
  );
}
