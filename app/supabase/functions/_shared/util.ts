// Shared helpers for the PawPal sitter Edge Functions (Deno runtime).
//
// Required function secrets (set via `supabase secrets set` or the dashboard):
//   • SUPABASE_URL                — your project URL (auto-provided by Supabase)
//   • SUPABASE_SERVICE_ROLE_KEY   — service role key (server-only, bypasses RLS)
//   • SUPABASE_ANON_KEY           — publishable/anon key (auto-provided)

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
export const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

export const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export function preflight(): Response {
  return new Response("ok", { headers: CORS });
}

/** Crockford base32 (no I, L, O, U) — unambiguous, human-typeable codes. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export function generateCode(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out; // display grouped client-side, e.g. XXXX-XXXX
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Service-role REST call against PostgREST (bypasses RLS). */
export async function sb(
  path: string,
  init: RequestInit & { prefer?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    "Content-Type": "application/json",
    ...(init.prefer ? { Prefer: init.prefer } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
}

/** Resolve the caller's auth user from their access token, or null. */
export async function getUser(
  authHeader: string | null,
): Promise<{ id: string; email?: string } | null> {
  if (!authHeader) return null;
  // Authenticate the validation request with the service-role key: it is always
  // a valid API key, whereas the legacy anon key may be disabled on projects
  // that use the new publishable/secret key system. The bearer token in
  // `authHeader` is still what GoTrue decodes into the user.
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE, Authorization: authHeader },
  });
  if (!res.ok) return null;
  const u = (await res.json()) as { id?: string; email?: string };
  return u?.id ? { id: u.id, email: u.email } : null;
}

export function durationToExpiry(
  preset: string,
  customExpiresAt?: string,
): string | null {
  const now = new Date();
  switch (preset) {
    case "tonight": {
      // 23:59 local-ish (server UTC) today; if already past, +1 day.
      const end = new Date(now);
      end.setHours(23, 59, 0, 0);
      if (end <= now) end.setDate(end.getDate() + 1);
      return end.toISOString();
    }
    case "24h":
      return new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
    case "3d":
      return new Date(now.getTime() + 3 * 24 * 3600 * 1000).toISOString();
    case "custom": {
      if (!customExpiresAt) return null;
      const d = new Date(customExpiresAt);
      if (isNaN(d.getTime()) || d <= now) return null;
      // Cap custom windows at 30 days.
      const cap = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
      return (d > cap ? cap : d).toISOString();
    }
    default:
      return null;
  }
}
