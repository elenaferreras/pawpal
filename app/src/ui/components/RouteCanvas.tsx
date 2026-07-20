import { useEffect, useRef } from "react";
import type { GpsCoord } from "../types";

interface RouteCanvasProps {
  coords: GpsCoord[];
}

// Draws the live GPS route on a canvas, matching the original renderer.
export function RouteCanvas({ coords }: RouteCanvasProps): React.ReactElement {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const paint = (): void => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#E8F4F0";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (coords.length < 2) {
        ctx.fillStyle = "#2AA98B";
        ctx.font = "13px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Route will appear here as you walk", canvas.width / 2, canvas.height / 2);
        return;
      }
      const pad = 16;
      const W = canvas.width - pad * 2;
      const H = canvas.height - pad * 2;
      const lats = coords.map((c) => c.lat);
      const lngs = coords.map((c) => c.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const dLat = maxLat - minLat || 0.001;
      const dLng = maxLng - minLng || 0.001;
      const scale = Math.min(W / dLng, H / dLat);
      const toX = (lng: number): number => pad + (lng - minLng) * scale;
      const toY = (lat: number): number => pad + H - (lat - minLat) * scale;

      ctx.beginPath();
      ctx.moveTo(toX(coords[0].lng), toY(coords[0].lat));
      for (let i = 1; i < coords.length; i++) {
        ctx.lineTo(toX(coords[i].lng), toY(coords[i].lat));
      }
      ctx.strokeStyle = "#2AA98B";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(toX(coords[0].lng), toY(coords[0].lat), 5, 0, Math.PI * 2);
      ctx.fillStyle = "#0F6E56";
      ctx.fill();

      const last = coords[coords.length - 1];
      ctx.beginPath();
      ctx.arc(toX(last.lng), toY(last.lat), 7, 0, Math.PI * 2);
      ctx.fillStyle = "#F5A623";
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    paint();
  }, [coords]);

  return (
    <canvas
      ref={ref}
      width={380}
      height={180}
      className="map-ph"
      style={{ padding: 0, width: "100%", height: 180 }}
    />
  );
}
