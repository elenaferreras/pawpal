import { useLayoutEffect, useRef } from "react";

interface FitTextProps {
  children: React.ReactNode;
  /** Base (largest) font size in px. */
  max: number;
  /** Smallest font size the text is allowed to shrink to, in px. */
  min: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Single-line text that shrinks its font size to fit the available width
 * instead of truncating with an ellipsis. Scales between `max` and `min` and
 * re-fits whenever the text or the container size changes.
 */
export function FitText({ children, max, min, className, style }: FitTextProps): React.ReactElement {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = (): void => {
      // Grow to max, then binary-search the largest size that fits on one line.
      el.style.fontSize = `${max}px`;
      if (el.scrollWidth <= el.clientWidth) return;
      let lo = min;
      let hi = max;
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        el.style.fontSize = `${mid}px`;
        if (el.scrollWidth <= el.clientWidth) lo = mid;
        else hi = mid;
      }
      el.style.fontSize = `${lo}px`;
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children, max, min]);

  return (
    <span ref={ref} className={className} style={{ ...style, fontSize: max }}>
      {children}
    </span>
  );
}
