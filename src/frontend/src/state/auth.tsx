import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/router";
import {
  loginWithCredentials,
  fetchCurrentUser,
} from "@/services/authService";
import {
  setAuthToken,
  setUnauthorizedHandler,
} from "@/services/apiClient";
import type { SessionUser, UserRole } from "@/types/auth";

type AuthContextValue = {
  user: SessionUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  effectiveRole: UserRole | null;
  isPreviewMode: boolean;
  setPreviewRole: (role: UserRole) => void;
  clearPreviewRole: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const TOKEN_KEY = "origina.token";
const PREVIEW_ROLE_KEY = "origina.preview_role";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function getStoredPreviewRole(): UserRole | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PREVIEW_ROLE_KEY) as UserRole | null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(getStoredToken()));
  const [previewRole, setPreviewRoleState] = useState<UserRole | null>(null);
  const hydratedRef = useRef(false);

  // Keep the apiClient's module-level token in sync with auth state so any
  // service that calls apiRequest without threading the token through still
  // gets an Authorization header.
  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  // Register a single 401 handler that clears the token and bounces the
  // user to /login. This is the safety net for stale tokens left over from
  // a previous session.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      window.localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
      const onLogin = router.pathname === "/login";
      if (!onLogin) {
        const next = router.asPath && router.asPath !== "/" ? `?next=${encodeURIComponent(router.asPath)}` : "";
        void router.replace(`/login${next}`);
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const stored = getStoredToken();
    if (!stored) return;

    fetchCurrentUser(stored)
      .then((profile) => {
        setUser(profile);
        if (profile.role === "admin") {
          const savedPreview = getStoredPreviewRole();
          if (savedPreview) setPreviewRoleState(savedPreview);
        }
      })
      .catch(() => {
        window.localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token, user: profile } = await loginWithCredentials(
      email,
      password,
    );
    window.localStorage.setItem(TOKEN_KEY, access_token);
    setToken(access_token);
    setUser(profile);
    if (profile.role === "admin") {
      const savedPreview = getStoredPreviewRole();
      if (savedPreview) setPreviewRoleState(savedPreview);
    }
  }, []);

  const logout = useCallback(() => {
    // Best-effort: tell the backend to clear the httpOnly cookie. If the
    // request fails (offline, expired session) we still wipe local state.
    void fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1"}/auth/logout`,
      { method: "POST", credentials: "include" },
    ).catch(() => undefined);
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(PREVIEW_ROLE_KEY);
    setToken(null);
    setUser(null);
    setPreviewRoleState(null);
  }, []);

  const setPreviewRole = useCallback((role: UserRole) => {
    window.localStorage.setItem(PREVIEW_ROLE_KEY, role);
    setPreviewRoleState(role);
  }, []);

  const clearPreviewRole = useCallback(() => {
    window.localStorage.removeItem(PREVIEW_ROLE_KEY);
    setPreviewRoleState(null);
  }, []);

  const effectiveRole: UserRole | null = useMemo(() => {
    if (!user) return null;
    if (user.role === "admin" && previewRole) return previewRole;
    return user.role;
  }, [user, previewRole]);

  const isPreviewMode = Boolean(
    user?.role === "admin" && previewRole !== null,
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user),
      isLoading,
      effectiveRole,
      isPreviewMode,
      setPreviewRole,
      clearPreviewRole,
      login,
      logout,
    }),
    [user, token, isLoading, effectiveRole, isPreviewMode, setPreviewRole, clearPreviewRole, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
