import Link from "next/link";
import { useRouter } from "next/router";
import { OriginaLogo } from "@/components/brand/OriginaLogo";
import { roleDashboardPaths, roleLabels, type UserRole } from "@/types/auth";
import { useAuth } from "@/state/auth";
import { useRecentLoansStore } from "@/state/recentLoansStore";

type NavItem = {
  label: string;
  href: string;
  isCreateAction?: boolean;
  roles?: UserRole[];
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  {
    label: "Loan Pipeline",
    href: "/loans",
    roles: ["account_executive", "broker", "underwriter"],
  },
  {
    label: "Analytics",
    href: "/analytics",
    roles: ["account_executive", "broker", "underwriter"],
  },
  {
    label: "New Submission",
    href: "/loans/new",
    isCreateAction: true,
    roles: ["account_executive", "broker"],
  },
  {
    label: "Application",
    href: "/borrower/application",
    roles: ["borrower"],
  },
  {
    label: "Underwriting Queue",
    href: "/dashboard/underwriter",
    roles: ["underwriter"],
  },
  {
    label: "Broker Dashboard",
    href: "/dashboard/broker",
    roles: ["broker"],
  },
];

export function Sidebar() {
  const router = useRouter();
  const { user } = useAuth();
  const recentLoans = useRecentLoansStore((state) => state.recent);

  if (!user) {
    return null;
  }

  const visibleItems = navItems
    .map((item) =>
      item.href === "/dashboard"
        ? { ...item, href: roleDashboardPaths[user.role] }
        : item,
    )
    .filter((item) => !item.roles || item.roles.includes(user.role));

  return (
    <aside className="app-sidebar">
      <OriginaLogo href={roleDashboardPaths[user.role]} subtitle="LOS / TPO" />

      <nav className="nav-list" aria-label="Primary navigation">
        {visibleItems.map((item) => {
          const isActive =
            router.pathname === item.href ||
            (item.href !== "/" && router.pathname.startsWith(item.href));

          return (
            <Link
              key={item.label}
              className={[
                "nav-link",
                item.isCreateAction ? "nav-link-create" : "",
                isActive ? "active" : "",
              ].filter(Boolean).join(" ")}
              href={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {recentLoans.length > 0 && (
        <div className="sidebar-recent">
          <p className="sidebar-recent-label">Recent Files</p>
          {recentLoans.map((loan) => (
            <Link
              key={loan.id}
              href={`/loans/${loan.id}`}
              className={`sidebar-recent-item${router.query.loanId === loan.id ? " active" : ""}`}
            >
              <span className="sidebar-recent-borrower">{loan.borrowerName}</span>
              <span className="sidebar-recent-number">{loan.loanNumber}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="sidebar-bottom">
        <Link
          href="/settings"
          className={`sidebar-settings-link${router.pathname.startsWith("/settings") ? " active" : ""}`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </Link>
      </div>

      <div className="sidebar-footer">
        <small>Signed in as</small>
        <strong>{roleLabels[user.role]}</strong>
      </div>
    </aside>
  );
}
