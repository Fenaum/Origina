import { useRouter } from "next/router";
import { useEffect } from "react";
import { useAuth } from "@/state/auth";
import { roleDashboardPaths, roleLabels, type UserRole } from "@/types/auth";

const roles: UserRole[] = [
  "account_executive",
  "broker",
  "underwriter",
  "borrower",
];

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, loginAs, user } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      void router.replace(roleDashboardPaths[user.role]);
    }
  }, [isAuthenticated, router, user]);

  return (
    <main className="login-page">
      <section className="login-panel">
        <div>
          <span className="brand-mark large">O</span>
          <p className="eyebrow">Origina LOS / TPO</p>
          <h1>Sign in to your workspace</h1>
          <p>
            Mock role selection is active until FastAPI authentication is wired
            into the frontend session layer.
          </p>
        </div>

        <div className="role-picker">
          {roles.map((role) => (
            <button
              key={role}
              className="role-button"
              type="button"
              onClick={() => loginAs(role)}
            >
              <strong>{roleLabels[role]}</strong>
              <span>Open dashboard</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
