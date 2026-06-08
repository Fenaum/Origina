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
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      void router.replace("/login");
      return;
    }

    if (user && allowedRoles && !allowedRoles.includes(user.role)) {
      void router.replace(roleDashboardPaths[user.role]);
    }
  }, [allowedRoles, isAuthenticated, router, user]);

  if (!isAuthenticated || !user) {
    return <div className="centered-screen">Checking session...</div>;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <div className="centered-screen">Redirecting...</div>;
  }

  return <>{children}</>;
}
