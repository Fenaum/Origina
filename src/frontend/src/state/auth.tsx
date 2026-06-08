import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { getMockUser } from "@/services/authService";
import type { SessionUser, UserRole } from "@/types/auth";

type AuthContextValue = {
  user: SessionUser | null;
  isAuthenticated: boolean;
  loginAs: (role: UserRole) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = "origina.mockSessionRole";
const STORAGE_EVENT = "origina:mock-session";

function getStoredRole(): UserRole | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(STORAGE_KEY) as UserRole | null;
}

function subscribeToSession(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_EVENT, callback);
  };
}

function notifySessionChanged() {
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const role = useSyncExternalStore(subscribeToSession, getStoredRole, () => null);
  const user = role ? getMockUser(role) : null;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      loginAs: (role) => {
        window.localStorage.setItem(STORAGE_KEY, role);
        notifySessionChanged();
      },
      logout: () => {
        window.localStorage.removeItem(STORAGE_KEY);
        notifySessionChanged();
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
