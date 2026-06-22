import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { loginWithCredentials, fetchCurrentUser } from "@/services/authService";
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
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(getStoredToken()));
  const [previewRole, setPreviewRoleState] = useState<UserRole | null>(null);
  const hydratedRef = useRef(false);

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
