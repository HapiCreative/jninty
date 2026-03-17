import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
  type Dispatch,
} from "react";
import { isCloudEnabled, apiUrl } from "../config/cloud";
import type { AuthState, AuthAction } from "../types/auth";
import {
  normalizeUser,
  logoutFromServer,
  clearLegacyToken,
  clearLoggedInCookie,
  hasLoggedInCookie,
  getLegacyToken,
} from "../lib/apiClient";

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  isLoading: true,
};

/** Pure reducer — no side effects. */
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "LOGIN":
      return {
        isAuthenticated: true,
        user: action.payload.user,
        token: action.payload.token ?? null,
        isLoading: false,
      };
    case "LOGOUT":
      return {
        isAuthenticated: false,
        user: null,
        token: null,
        isLoading: false,
      };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "UPDATE_USER":
      if (!state.user) return state;
      return { ...state, user: { ...state.user, ...action.payload } };
  }
}

interface AuthContextValue {
  state: AuthState;
  dispatch: Dispatch<AuthAction>;
  /** Perform a full logout: clear cookies, localStorage, call server, update state. */
  performLogout: () => void;
}

const noopState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  isLoading: false,
};

const AuthContext = createContext<AuthContextValue>({
  state: noopState,
  dispatch: () => undefined,
  performLogout: () => undefined,
});

function AuthProviderInner({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  /**
   * Full logout with side effects — used for explicit user sign-out.
   * Clears companion cookie (synchronous), legacy localStorage, calls server,
   * and dispatches LOGOUT to update state.
   */
  const performLogout = useCallback(() => {
    clearLoggedInCookie();
    clearLegacyToken();
    void logoutFromServer();
    dispatch({ type: "LOGOUT" });
  }, []);

  /**
   * Silent logout — used when session validation fails (401 from /auth/me).
   * Clears local state but does NOT call logoutFromServer() since the server
   * already knows the session is invalid.
   */
  const silentLogout = useCallback(() => {
    clearLoggedInCookie();
    clearLegacyToken();
    dispatch({ type: "LOGOUT" });
  }, []);

  const fetchingRef = useRef(false);
  useEffect(() => {
    // Primary: check for the non-HttpOnly companion cookie
    const hasCookie = hasLoggedInCookie();
    // Migration fallback: check localStorage for a legacy token
    const legacyToken = getLegacyToken();

    if ((!hasCookie && !legacyToken) || !apiUrl) {
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    const headers: Record<string, string> = {};
    // Migration: if we have a legacy token but no cookie yet, send it as Bearer
    if (!hasCookie && legacyToken) {
      headers["Authorization"] = `Bearer ${legacyToken}`;
    }

    fetch(`${apiUrl}/auth/me`, {
      headers,
      credentials: "include", // send HttpOnly cookie
    })
      .then((res) => {
        if (!res.ok) throw new Error("unauthorized");
        return res.json();
      })
      .then((raw: Record<string, unknown>) => {
        // /auth/me may return the user directly or wrapped in { user: ... }
        const userData = (raw["user"] ?? raw) as Record<string, unknown>;
        dispatch({ type: "LOGIN", payload: { user: normalizeUser(userData) } });
        // If we validated a legacy token, the server should now have set
        // the HttpOnly cookie. Clean up localStorage.
        if (legacyToken) {
          clearLegacyToken();
        }
        fetchingRef.current = false;
      })
      .catch(() => {
        silentLogout();
        fetchingRef.current = false;
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{ state, dispatch, performLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!isCloudEnabled) {
    return (
      <AuthContext.Provider
        value={{ state: noopState, dispatch: () => undefined, performLogout: () => undefined }}
      >
        {children}
      </AuthContext.Provider>
    );
  }
  return <AuthProviderInner>{children}</AuthProviderInner>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useIsAuthenticated(): boolean {
  const { state } = useAuth();
  return state.isAuthenticated;
}
