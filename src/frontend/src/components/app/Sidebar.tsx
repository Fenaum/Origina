import type { ReactElement } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { OriginaLogo } from "@/components/brand/OriginaLogo";
import {
  isAdminRole,
  LOAN_TEAM_ROLES,
  roleDashboardPaths,
  roleLabels,
  type UserRole,
} from "@/types/auth";
import { useAuth } from "@/state/auth";
import { useRecentLoansStore } from "@/state/recentLoansStore";

type NavItem = {
  label: string;
  href: string;
  isCreateAction?: boolean;
  roles?: UserRole[];
};

type SettingsSubItem = {
  label: string;
  href: string;
  adminOnly?: boolean;
  icon: ReactElement;
};

function IconUser() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconSliders() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
      <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconGear() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="12" width="5" height="9" rx="1" />
      <rect x="9.5" y="7" width="5" height="14" rx="1" />
      <rect x="16" y="3" width="5" height="18" rx="1" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 4 6v5.5C4 16.2 7.6 20.5 12 22c4.4-1.5 8-5.8 8-10.5V6L12 2z" />
      <polyline points="9,12 11,14 15,10" />
    </svg>
  );
}

type RoleList = UserRole[];

const READ_ONLY_AE: RoleList = [
  "account_manager", "manager", "funder",
];

const FRONT_OFFICE: RoleList = [
  "loan_officer", "broker", "account_manager", "manager",
];

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  {
    label: "Loan Pipeline",
    href: "/loans",
    roles: [...LOAN_TEAM_ROLES],
  },
  {
    label: "Analytics",
    href: "/analytics",
    roles: [...LOAN_TEAM_ROLES, ...READ_ONLY_AE.filter(r => !LOAN_TEAM_ROLES.includes(r))],
  },
  {
    label: "Exceptions",
    href: "/exceptions",
    roles: FRONT_OFFICE,
  },
  {
    label: "New Submission",
    href: "/loans/new",
    isCreateAction: true,
    roles: ["loan_officer", "broker", "account_manager", "manager"],
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
    // Reuse the existing broker dashboard until a dedicated loan-officer
    // page file is added (one-liner future work).
    label: "Loan Officer Dashboard",
    href: "/dashboard/broker",
    roles: ["loan_officer", "broker"],
  },

  // ── Capital Markets (CM) — Sprint 7 PoC ────────────────────────────────────
  {
    label: "CM Cockpit",
    href: "/dashboard/capital-markets",
    roles: ["capital_markets"],
  },
  {
    label: "CM Pipeline",
    href: "/cm/pipeline",
    roles: ["capital_markets"],
  },
  {
    label: "Lock Queue",
    href: "/cm/locks",
    roles: ["capital_markets"],
  },
  {
    label: "Allocation & Pools",
    href: "/cm/pools",
    roles: ["capital_markets"],
  },
  {
    label: "Alerts",
    href: "/cm/alerts",
    roles: ["capital_markets"],
  },
];


const SETTINGS_SUB_ITEMS: SettingsSubItem[] = [
  { label: "Account", href: "/settings/account", icon: <IconUser /> },
  { label: "User Preferences", href: "/settings/preferences", icon: <IconSliders /> },
  { label: "Configuration", href: "/settings/configuration", icon: <IconGear /> },
  { label: "Reporting", href: "/settings/reports", icon: <IconChart /> },
  { label: "Admin", href: "/settings/admin", adminOnly: true, icon: <IconShield /> },
];

export function Sidebar() {
  const router = useRouter();
  const { user, effectiveRole, isPreviewMode } = useAuth();
  const recentLoans = useRecentLoansStore((state) => state.recent);

  if (!user || !effectiveRole) {
    return null;
  }

  const visibleItems = navItems
    .map((item) =>
      item.href === "/dashboard"
        ? { ...item, href: roleDashboardPaths[effectiveRole] }
        : item,
    )
    .filter((item) => !item.roles || item.roles.includes(effectiveRole) || (isAdminRole(user.role) && !isPreviewMode));

  const showAdminSubnav = isAdminRole(user.role) && !isPreviewMode;

  const visibleSettingsItems = SETTINGS_SUB_ITEMS.filter(
    (item) => !item.adminOnly || showAdminSubnav,
  );

  return (
    <aside className="app-sidebar">
      <OriginaLogo href={roleDashboardPaths[effectiveRole]} subtitle="LOS / TPO" />

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
        <p className="sidebar-section-label">Settings</p>
        <nav className="sidebar-section-nav" aria-label="Settings">
          {visibleSettingsItems.map((item) => {
            const isActive = router.pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`sidebar-section-link${isActive ? " active" : ""}`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="sidebar-footer">
        <small>Signed in as</small>
        <strong>{roleLabels[effectiveRole]}</strong>
      </div>
    </aside>
  );
}
