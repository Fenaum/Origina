import { useRouter } from "next/router";
import { useEffect } from "react";
import { useAuth } from "@/state/auth";
import { roleDashboardPaths } from "@/types/auth";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      void router.replace(roleDashboardPaths[user.role]);
      return;
    }

    void router.replace("/login");
  }, [isAuthenticated, router, user]);

  return <div className="centered-screen">Loading Origina...</div>;
}
