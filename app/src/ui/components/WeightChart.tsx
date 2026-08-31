import { useId, useLayoutEffect, useRef, useState } from "react";

interface WeightPoint {
  date: string;
  kg: number;
}

interface WeightChartProps {
  /** Chronological (ascending) weight points. */
  data: readonly WeightPoint[];
  height?: number;
  color?: string;
  /** Show dashed value gridlines (right-hand labels) and day labels along the bottom. */
  showAxis?: boolean;
}

const MUTED = "var(--color-pawpal-muted)";
const GRID = "rgba(255,255,255,0.09)";

function dayLabel(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return String(d.getDate()).padStart(2, "0");
}

/** Smooth the points into a Catmull-Rom → cubic-bezier path for a flowing line. */
function smoothPath(pts: readonly (readonly [number, number])[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0][0]} ${pts[0][1]}`;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/**
 * Weight-evolution chart — pure SVG, smooth area line in PawPal's palette.
 *
 * Measures its container width, maps each dated weight to an evenly spaced
 * point, smooths the line, and fills a soft gradient beneath it. `showAxis`
 * adds dashed value gridlines with right-hand labels and day labels along the
 * bottom, for a clean analytics-card look.
 */
export function WeightChart({
  data,
  height = 160,
  color = "var(--color-track-meds)",
  showAxis = false,
}: WeightChartProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const gradientId = useId();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setW(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = data.length;
  const kgs = data.map((d) => d.kg);
  const min = kgs.length ? Math.min(...kgs) : 0;
  const max = kgs.length ? Math.max(...kgs) : 1;
  // Pad the range so the line doesn't kiss the top/bottom edges.
  const pad = (max - min) * 0.15 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const range = hi - lo || 1;

  const gutterR = showAxis ? 38 : 0;
  const gutterB = showAxis ? 20 : 0;
  const padTop = showAxis ? 8 : 4;
  const padL = showAxis ? 6 : 3;
  const innerW = Math.max(0, w - padL - gutterR);
  const innerH = Math.max(0, height - padTop - gutterB);

  const x = (i: number): number => (n <= 1 ? padL + innerW / 2 : padL + (innerW * i) / (n - 1));
  const y = (kg: number): number => padTop + innerH - ((kg - lo) / range) * innerH;

  const points = data.map((d, i) => [x(i), y(d.kg)] as const);
  const linePath = smoothPath(points);
  const baseline = padTop + innerH;
  const areaPath =
    points.length > 1
      ? `${linePath} L${points[points.length - 1][0].toFixed(1)} ${baseline} L${points[0][0].toFixed(1)} ${baseline} Z`
      : "";

  const ticks = showAxis ? [max, (max + min) / 2, min] : [];
  const xLabelCount = Math.min(n, 5);
  const xLabelIdx =
    showAxis && n > 1
      ? Array.from({ length: xLabelCount }, (_, k) => Math.round((k * (n - 1)) / (xLabelCount - 1)))
      : [];
  const fmtKg = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(1));

  return (
    <div ref={ref} style={{ width: "100%", height }}>
      {w > 0 && n > 0 && (
        <svg width={w} height={height} role="img" aria-label="Weight over time">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          {ticks.map((v, i) => {
            const gy = y(v);
            return (
              <g key={i}>
                <line x1={padL} y1={gy} x2={padL + innerW} y2={gy} stroke={GRID} strokeWidth={1} strokeDasharray="2 4" />
                <text x={padL + innerW + 6} y={gy + 3} fill={MUTED} fontSize={10} fontFamily="var(--font-ui)">
                  {fmtKg(v)}
                </text>
              </g>
            );
          })}

          {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {points.length > 0 && (
            <circle
              cx={points[points.length - 1][0]}
              cy={points[points.length - 1][1]}
              r={3.5}
              fill={color}
              stroke="var(--color-dash-surface)"
              strokeWidth={2}
            />
          )}

          {xLabelIdx.map((idx, k) => (
            <text
              key={k}
              x={x(idx)}
              y={height - 4}
              fill={MUTED}
              fontSize={10}
              fontFamily="var(--font-ui)"
              textAnchor="middle"
            >
              {dayLabel(data[idx].date)}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

