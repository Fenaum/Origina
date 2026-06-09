import { useRouter } from "next/router";
import { useEffect } from "react";
import { useAuth } from "@/state/auth";
import { roleDashboardPaths } from "@/types/auth";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated && user) {
      void router.replace(roleDashboardPaths[user.role]);
      return;
    }

    void router.replace("/login");
  }, [isAuthenticated, isLoading, router, user]);

  return <div className="centered-screen">Loading Origina...</div>;
}
