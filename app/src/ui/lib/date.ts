// Date/formatting helpers ported from the original app.

const todayISO = (): string => new Date().toISOString().split("T")[0];

export function today(): string {
  return todayISO();
}

export function fmtDate(d?: string): string {
  if (!d) return "";
  const dt = new Date(d + "T12:00:00");
  const t = todayISO();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  if (d === t) return "Today";
  if (d === yesterday) return "Yesterday";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function calcAge(birthday?: string): string | null {
  if (!birthday) return null;
  const birth = new Date(birthday + "T12:00:00");
  const now = new Date();
  const totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (totalMonths < 1) {
    const days = Math.floor((now.getTime() - birth.getTime()) / 86400000);
    return `${days} day${days !== 1 ? "s" : ""} old`;
  }
  if (totalMonths < 24) {
    return `${totalMonths} month${totalMonths !== 1 ? "s" : ""} old`;
  }
  const years = Math.floor(totalMonths / 12);
  const remMonths = totalMonths % 12;
  let str = `${years} year${years !== 1 ? "s" : ""}`;
  if (remMonths > 0) str += ` ${remMonths} month${remMonths !== 1 ? "s" : ""}`;
  return str + " old";
}

export const WEATHER_MAP: Record<string, string> = {
  sunny: "☀️",
  cloudy: "☁️",
  rainy: "🌧️",
  windy: "💨",
  snowy: "❄️",
  hot: "🥵",
  foggy: "🌫️",
  stormy: "⛈️",
};

export function nowTime(): string {
  const now = new Date();
  return (
    now.getHours().toString().padStart(2, "0") +
    ":" +
    now.getMinutes().toString().padStart(2, "0")
  );
}
