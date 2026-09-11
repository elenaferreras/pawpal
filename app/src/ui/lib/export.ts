import type { Database } from "../types";

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function exportJSON(db: Database): void {
  const name = (db.profile.name || "pawpal").toLowerCase().replace(/\s+/g, "_");
  const date = new Date().toISOString().split("T")[0];
  download(`${name}_backup_${date}.json`, JSON.stringify(db, null, 2), "application/json");
}

export function exportCSV(db: Database): void {
  const headers = [
    "Date",
    "Time",
    "Walks",
    "Steps",
    "Location",
    "Weather",
    "Terrain",
    "Socialised",
    "Poops",
    "Notes",
  ];
  const rows = db.walks.map((w) => [
    w.date || "",
    w.time || "",
    String(w.walksCount ?? ""),
    String(w.steps || ""),
    (w.location || "").replace(/,/g, ";"),
    (w.weather || []).join("; "),
    (w.terrain || []).join("; "),
    w.friends ? "Yes" : "No",
    String(w.poops ?? ""),
    (w.notes || "").replace(/,/g, ";"),
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const name = (db.profile.name || "pawpal").toLowerCase();
  const date = new Date().toISOString().split("T")[0];
  download(`${name}_walks_${date}.csv`, csv, "text/csv");
}
