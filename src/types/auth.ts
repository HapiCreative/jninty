export interface AuthUser {
  id: string;
  email: string;
  plan: string;
  subscriptionStatus: "active" | "cancelled" | "expired";
  subscriptionEndsAt: string | null;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  /** @deprecated Token is now stored in an HttpOnly cookie. This field is kept for migration only. */
  token: string | null;
  isLoading: boolean;
}

export type AuthAction =
  | { type: "LOGIN"; payload: { user: AuthUser; token?: string } }
  | { type: "LOGOUT" }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "UPDATE_USER"; payload: Partial<AuthUser> };
