import { getSBConfig } from "./supabase";

// Lightweight Supabase Auth (GoTrue) client built on plain fetch — no SDK, so
// the single-file PWA bundle stays lean and we keep the same dependency-free
// pattern as the sync layer. Email + password only, for now.

const SESSION_KEY = "pawpal_auth";
// Refresh a little before the token actually expires to avoid racing the clock.
const REFRESH_SKEW_SECONDS = 60;

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** Epoch seconds at which the access token expires. */
  expiresAt: number;
  user: AuthUser;
}

export interface SignUpResult {
  session: AuthSession | null;
  /** True when Supabase requires the user to confirm their email first. */
  needsConfirmation: boolean;
}

interface GoTrueTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email: string };
}

// GoTrue returns a session-less user object when email confirmation is on.
interface GoTrueSignUpResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  id?: string;
  email?: string;
  user?: { id: string; email: string };
}

let cached: AuthSession | null | undefined;

function readSession(): AuthSession | null {
  if (cached !== undefined) return cached;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    cached = raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    cached = null;
  }
  return cached;
}

function writeSession(session: AuthSession | null): void {
  cached = session;
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage unavailable — keep the in-memory copy.
  }
  window.dispatchEvent(new CustomEvent("pawpal:auth", { detail: session?.user ?? null }));
}

function toSession(res: GoTrueTokenResponse): AuthSession {
  return {
    accessToken: res.access_token,
    refreshToken: res.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + res.expires_in,
    user: { id: res.user.id, email: res.user.email },
  };
}

// GoTrue surfaces errors under a few different keys depending on the endpoint.
async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      error_description?: string;
      error?: string;
      msg?: string;
      message?: string;
    };
    return (
      body.error_description || body.msg || body.message || body.error || `Error ${res.status}`
    );
  } catch {
    return `Error ${res.status}`;
  }
}

export function getSession(): AuthSession | null {
  return readSession();
}

export function getCurrentUserId(): string | null {
  return readSession()?.user.id ?? null;
}

export function getCurrentUser(): AuthUser | null {
  return readSession()?.user ?? null;
}

export function isSignedIn(): boolean {
  return readSession() !== null;
}

export async function signUp(email: string, password: string): Promise<SignUpResult> {
  const { url, key } = getSBConfig();
  const res = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as GoTrueSignUpResponse;
  if (body.access_token && body.refresh_token && body.user) {
    const session = toSession(body as GoTrueTokenResponse);
    writeSession(session);
    return { session, needsConfirmation: false };
  }
  // No session returned → email confirmation is enabled on the project.
  return { session: null, needsConfirmation: true };
}

export async function signIn(email: string, password: string): Promise<AuthSession> {
  const { url, key } = getSBConfig();
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const session = toSession((await res.json()) as GoTrueTokenResponse);
  writeSession(session);
  return session;
}

// Trigger a password-reset email via GoTrue's recover endpoint. Resolves once
// the request is accepted; the user follows the emailed link to set a new one.
export async function requestPasswordReset(email: string): Promise<void> {
  const { url, key } = getSBConfig();
  const res = await fetch(`${url}/auth/v1/recover`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function signOut(): Promise<void> {
  const session = readSession();
  const { url, key } = getSBConfig();
  if (session) {
    try {
      await fetch(`${url}/auth/v1/logout`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${session.accessToken}` },
      });
    } catch {
      // Best-effort server logout — clear locally regardless.
    }
  }
  writeSession(null);
}

let refreshing: Promise<AuthSession | null> | null = null;

async function refreshSession(session: AuthSession): Promise<AuthSession | null> {
  const { url, key } = getSBConfig();
  const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });
  if (!res.ok) {
    // Refresh token revoked or expired — force a fresh sign-in.
    writeSession(null);
    return null;
  }
  const next = toSession((await res.json()) as GoTrueTokenResponse);
  writeSession(next);
  return next;
}

// Returns a currently-valid access token, transparently refreshing when the
// cached one is close to expiry. Null when the user is signed out.
export async function getValidAccessToken(): Promise<string | null> {
  const session = readSession();
  if (!session) return null;
  const now = Math.floor(Date.now() / 1000);
  if (session.expiresAt - REFRESH_SKEW_SECONDS > now) return session.accessToken;
  if (!refreshing) {
    refreshing = refreshSession(session).finally(() => {
      refreshing = null;
    });
  }
  const refreshed = await refreshing;
  return refreshed?.accessToken ?? null;
}
