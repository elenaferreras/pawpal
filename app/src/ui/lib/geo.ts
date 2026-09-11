// GPS distance helper (kilometres) — Haversine great-circle distance.
export function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Reverse-geocode coordinates to a human place name. Open-Meteo's geocoding is
// forward-only (name → coords), so we use BigDataCloud's free, keyless,
// CORS-enabled client endpoint. Returns the locality/city, or null on failure.
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url =
      `https://api.bigdatacloud.net/data/reverse-geocode-client` +
      `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&localityLanguage=en`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = (await res.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
    };
    const name = j.city || j.locality || j.principalSubdivision;
    return name ? name.trim() || null : null;
  } catch {
    return null;
  }
}
