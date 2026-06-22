import { useRouter } from "next/router";
import { useEffect } from "react";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { useAuth } from "@/state/auth";
import { roleDashboardPaths } from "@/types/auth";

export default function DashboardRouterPage() {
  const router = useRouter();
  const { user, effectiveRole } = useAuth();

  useEffect(() => {
    if (user && effectiveRole) {
      void router.replace(roleDashboardPaths[effectiveRole]);
    }
  }, [router, user, effectiveRole]);

  return (
    <ProtectedRoute>
      <div className="centered-screen">Routing to dashboard...</div>
    </ProtectedRoute>
  );
}
