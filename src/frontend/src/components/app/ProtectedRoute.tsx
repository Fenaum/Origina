import { useRouter } from "next/router";
import { useEffect } from "react";
import { isAdminRole, roleDashboardPaths, type UserRole } from "@/types/auth";
import { useAuth } from "@/state/auth";

type ProtectedRouteProps = {
  allowedRoles?: UserRole[];
  children: React.ReactNode;
};

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, effectiveRole, isPreviewMode } = useAuth();

  // A real admin bypasses UI route guards in the normal admin workspace. In
  // preview mode we intentionally apply the selected role's guard so the UI
  // behaves like that role. Backend RBAC still evaluates the real admin.
  const hasAdminUiAccess = isAdminRole(user?.role) && !isPreviewMode;
  const roleAllowed = !allowedRoles || !effectiveRole || hasAdminUiAccess || allowedRoles.includes(effectiveRole);

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
