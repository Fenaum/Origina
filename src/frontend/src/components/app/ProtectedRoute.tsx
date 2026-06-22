import { useRouter } from "next/router";
import { useEffect } from "react";
import { roleDashboardPaths, type UserRole } from "@/types/auth";
import { useAuth } from "@/state/auth";

type ProtectedRouteProps = {
  allowedRoles?: UserRole[];
  children: React.ReactNode;
};

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, effectiveRole } = useAuth();

  const isAdmin = user?.role === "admin";
  const roleAllowed = !allowedRoles || !effectiveRole || isAdmin || allowedRoles.includes(effectiveRole);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      void router.replace("/login");
      return;
    }

    if (!roleAllowed && effectiveRole) {
      void router.replace(roleDashboardPaths[effectiveRole]);
    }
  }, [allowedRoles, isAuthenticated, isLoading, router, roleAllowed, effectiveRole]);

  if (isLoading || !isAuthenticated || !user) {
    return <div className="centered-screen">Checking session...</div>;
  }

  if (!roleAllowed) {
    return <div className="centered-screen">Redirecting...</div>;
  }

  return <>{children}</>;
}
