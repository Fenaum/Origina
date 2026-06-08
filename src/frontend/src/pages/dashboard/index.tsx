import { useRouter } from "next/router";
import { useEffect } from "react";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { useAuth } from "@/state/auth";
import { roleDashboardPaths } from "@/types/auth";

export default function DashboardRouterPage() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      void router.replace(roleDashboardPaths[user.role]);
    }
  }, [router, user]);

  return (
    <ProtectedRoute>
      <div className="centered-screen">Routing to dashboard...</div>
    </ProtectedRoute>
  );
}
