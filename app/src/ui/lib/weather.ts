// Auto-detect a walk's weather from GPS + a free forecast API (Open-Meteo).
export type WeatherKey =
  | "sunny"
  | "cloudy"
  | "foggy"
  | "rainy"
  | "snowy"
  | "stormy"
  | "windy"
  | "hot";

// WMO weather interpretation code → PawPal sky category (open-meteo.com/en/docs).
function skyFromCode(code: number): WeatherKey {
  if (code === 0) return "sunny"; // clear
  if (code <= 3) return "cloudy"; // partly cloudy → overcast
  if (code === 45 || code === 48) return "foggy";
  if (code >= 51 && code <= 67) return "rainy"; // drizzle + rain (incl. freezing)
  if (code >= 71 && code <= 77) return "snowy"; // snow fall / grains
  if (code >= 80 && code <= 82) return "rainy"; // rain showers
  if (code === 85 || code === 86) return "snowy"; // snow showers
  if (code >= 95) return "stormy"; // thunderstorm (incl. hail)
  return "cloudy";
}

const HOT_C = 28; // °C
const WINDY_KPH = 30; // km/h (Open-Meteo default wind unit)

// The "feel" categories aren't WMO codes — derive them from temp/wind, and only
// let them override a calm, clear sky so precipitation is never masked.
export function weatherFromReport(code: number, tempC: number, windKph: number): WeatherKey {
  const sky = skyFromCode(code);
  if (sky === "sunny" || sky === "cloudy") {
    if (tempC >= HOT_C) return "hot";
    if (windKph >= WINDY_KPH) return "windy";
  }
  return sky;
}

// Open-Meteo: free, no API key, CORS-enabled — safe to call straight from the PWA.
export async function autoWeather(lat: number, lng: number): Promise<WeatherKey | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}` +
      `&longitude=${lng.toFixed(3)}&current=weather_code,temperature_2m,wind_speed_10m`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const c = (await res.json())?.current;
    if (!c) return null;
    return weatherFromReport(Number(c.weather_code), Number(c.temperature_2m), Number(c.wind_speed_10m));
  } catch {
    return null;
  }
}

export function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("no geolocation"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { maximumAge: 600_000, timeout: 8000 });
  });
}
