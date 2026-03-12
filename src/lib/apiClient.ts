import { apiUrl } from "../config/cloud";
import type { AuthUser } from "../types/auth";

const AUTH_TOKEN_KEY = "jninty_auth_token";

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

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!apiUrl) {
    throw new ApiError("API URL not configured", 0);
  }

  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers,
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
    localStorage.removeItem(AUTH_TOKEN_KEY);
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
): Promise<{ token: string; user: AuthUser }> {
  const data = await request<{ token: string; user: Record<string, unknown> }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return { token: data.token, user: normalizeUser(data.user) };
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
