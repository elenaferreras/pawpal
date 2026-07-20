import { useEffect, useRef } from "react";

interface FoodRingProps {
  done: number;
  total: number;
}

// Segmented progress ring for meals completed, drawn on a canvas.
export function FoodRing({ done, total }: FoodRingProps): React.ReactElement {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 56 * dpr;
    canvas.height = 56 * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const cx = 28;
    const cy = 28;
    const r = 22;
    const sw = 6;
    const segAngle = (Math.PI * 2) / total;
    const gap = 0.08;
    ctx.clearRect(0, 0, 56, 56);
    for (let i = 0; i < total; i++) {
      const startA = -Math.PI / 2 + i * segAngle + gap / 2;
      const endA = startA + segAngle - gap;
      ctx.beginPath();
      ctx.arc(cx, cy, r, startA, endA);
      ctx.strokeStyle = i < done ? "#3D8B6E" : "rgba(0,0,0,0.1)";
      ctx.lineWidth = sw;
      ctx.lineCap = "round";
      ctx.stroke();
    }
  }, [done, total]);

  return (
    <canvas ref={ref} style={{ width: 56, height: 56 }} />
  );
}
