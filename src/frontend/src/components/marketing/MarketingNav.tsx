import Link from "next/link";
import { OriginaLogo } from "@/components/brand/OriginaLogo";
import { useAuth } from "@/state/auth";
import { roleDashboardPaths } from "@/types/auth";

export function MarketingNav() {
  const { isAuthenticated, user } = useAuth();

  return (
    <nav className="mkt-nav">
      <OriginaLogo href="/" className="mkt-nav-brand" />

      <div className="mkt-nav-links">
        <a href="#borrowers">For Borrowers</a>
        <a href="#brokers">For Brokers</a>
        <a href="#how-it-works">How It Works</a>
        <Link href="/product">Products</Link>
        <Link href="/guideline">Guidelines</Link>
        <Link href="/about">About</Link>
      </div>

      <div>
        {isAuthenticated && user ? (
          <Link
            href={roleDashboardPaths[user.role]}
            className="mkt-nav-dashboard"
          >
            Go to Dashboard
          </Link>
        ) : (
          <Link href="/login" className="mkt-nav-sign-in">
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
