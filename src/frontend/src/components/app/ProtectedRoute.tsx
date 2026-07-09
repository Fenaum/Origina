import { useRouter } from "next/router";
import { useEffect } from "react";
import { roleDashboardPaths, type UserRole } from "@/types/auth";
import { useAuth } from "@/state/auth";

type ProtectedRouteProps = {
  allowedRoles?: UserRole[];
  children: React.ReactNode;
};

// Sprint 2: admin role vocabulary was reconciled — the canonical backend name is
// `it_admin`. The legacy `admin` alias is still accepted. Both should be
// treated as superusers here so an admin who's preview-as-someone-else (or
// just looking around the platform) can still see every dashboard.
const ADMIN_ROLES: UserRole[] = ["it_admin", "admin"];

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, effectiveRole } = useAuth();

  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);
  const roleAllowed = !allowedRoles || !effectiveRole || isAdmin || allowedRoles.includes(effectiveRole);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      void router.replace("/login");
      return;
    }

    if (!roleAllowed && effectiveRole) {
      const target = roleDashboardPaths[effectiveRole];
      // Don't redirect to a page we'd also be denied on — that creates an
      // infinite /dashboard/account-executive → /dashboard/account-executive
      // loop when an it_admin (or admin) lands on a page their role doesn't
      // own. Bail out instead of redirecting into a denied page.
      if (target && target !== router.pathname) {
        void router.replace(target);
      }
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
