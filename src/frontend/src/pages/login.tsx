import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { OriginaLogo } from "@/components/brand/OriginaLogo";
import { useAuth } from "@/state/auth";
import { roleDashboardPaths } from "@/types/auth";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user, effectiveRole, login } = useAuth();
  const [email, setEmail] = useState("admin@origina.dev");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user && effectiveRole && !authLoading) {
      void router.replace(roleDashboardPaths[effectiveRole]);
    }
  }, [isAuthenticated, authLoading, router, user, effectiveRole]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div>
          <OriginaLogo className="login-logo" mode="with-title" />
          <p className="eyebrow">Origina LOS / TPO</p>
          <h1>Sign in to your workspace</h1>
        </div>

        <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="muted">
          Dev account: admin@origina.dev / TestPass123!
        </p>
      </section>
    </main>
  );
}
