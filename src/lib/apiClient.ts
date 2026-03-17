import { apiUrl } from "../config/cloud";
import type { AuthUser } from "../types/auth";

/**
 * localStorage key — kept temporarily for migration. Existing sessions that
 * still have a token in localStorage will continue to work until the fallback
 * is removed (~7 days after deploy).
 */
const LEGACY_TOKEN_KEY = "jninty_auth_token";

/** Maps API user shape (_id from CouchDB) to the AuthUser shape (id). */
export function normalizeUser(raw: Record<string, unknown>): AuthUser {
  return {
    id: (raw["id"] ?? raw["_id"]) as string,
    email: raw["email"] as string,
    plan: raw["plan"] as string,
    subscriptionStatus: raw["subscriptionStatus"] as AuthUser["subscriptionStatus"],
    subscriptionEndsAt: (raw["subscriptionEndsAt"] as string | null) ?? null,
  };
}

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Store a reference to the auth dispatch so we can trigger logout on 401
let logoutCallback: (() => void) | null = null;

export function setLogoutCallback(cb: () => void): void {
  logoutCallback = cb;
}

/**
 * Read the legacy localStorage token if it exists.
 * Used as a fallback during migration so existing sessions aren't invalidated.
 * TODO: Remove after migration period (~7 days post-deploy).
 */
export function getLegacyToken(): string | null {
  try {
    return localStorage.getItem(LEGACY_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Remove the legacy localStorage token. */
export function clearLegacyToken(): void {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // ignore
  }
}

/** Check whether the non-HttpOnly companion cookie is set. */
export function hasLoggedInCookie(): boolean {
  return document.cookie.split(";").some((c) => c.trim().startsWith("jninty_logged_in="));
}

/**
 * Clear the jninty_logged_in companion cookie client-side.
 * This is a synchronous guarantee — even if logoutFromServer() fails (offline),
 * the app won't enter a login-check loop on the next page load.
 */
export function clearLoggedInCookie(): void {
  document.cookie = "jninty_logged_in=; Path=/; Max-Age=0";
  // Production: also clear with domain scope
  document.cookie = "jninty_logged_in=; Domain=.jninty.com; Path=/; Max-Age=0";
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!apiUrl) {
    throw new ApiError("API URL not configured", 0);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  // Migration fallback: only send Bearer header when the companion cookie
  // is absent (i.e., user hasn't been migrated to cookie auth yet).
  if (!hasLoggedInCookie()) {
    const legacyToken = getLegacyToken();
    if (legacyToken) {
      headers["Authorization"] = `Bearer ${legacyToken}`;
    }
  }

  const res = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers,
    credentials: "include", // send HttpOnly cookie
  });

  if (res.status === 401) {
    let message = "Unauthorized";
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      // ignore parse error
    }
    clearLegacyToken();
    logoutCallback?.();
    throw new ApiError(message, 401);
  }

  if (!res.ok) {
    let message = `Request failed (${String(res.status)})`;
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      // ignore parse error
    }
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<T>;
}

export async function login(
  email: string,
  password: string,
): Promise<{ user: AuthUser }> {
  const data = await request<{ token?: string; user: Record<string, unknown> }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  // The server now sets the auth cookie via Set-Cookie. No need to store the token.
  return { user: normalizeUser(data.user) };
}

export function register(
  email: string,
  password: string,
  priceId: string,
): Promise<{ checkoutUrl: string }> {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, priceId }),
  });
}

export async function getMe(): Promise<AuthUser> {
  const raw = await request<Record<string, unknown>>("/auth/me");
  return normalizeUser(raw);
}

/**
 * Call the server to clear auth cookies (jninty_auth_token + jninty_logged_in).
 * The server should respond with Set-Cookie headers that expire both cookies.
 */
export async function logoutFromServer(): Promise<void> {
  if (!apiUrl) return;
  try {
    await fetch(`${apiUrl}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Best-effort — cookies may already be expired or network offline
  }
}

export function getSubscriptionPortalUrl(): Promise<{ url: string }> {
  return request("/billing/portal");
}

export async function cancelSubscription(): Promise<AuthUser> {
  const raw = await request<Record<string, unknown>>("/billing/cancel", {
    method: "POST",
  });
  return normalizeUser(raw);
}

export async function reactivateSubscription(): Promise<AuthUser> {
  const raw = await request<Record<string, unknown>>("/billing/reactivate", {
    method: "POST",
  });
  return normalizeUser(raw);
}

export async function changePlan(priceId: string): Promise<AuthUser> {
  const raw = await request<Record<string, unknown>>("/billing/change-plan", {
    method: "POST",
    body: JSON.stringify({ priceId }),
  });
  return normalizeUser(raw);
}
