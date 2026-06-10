import Link from "next/link";
import { useRouter } from "next/router";
import { OriginaLogo } from "@/components/brand/OriginaLogo";
import { roleDashboardPaths, roleLabels, type UserRole } from "@/types/auth";
import { useAuth } from "@/state/auth";

type NavItem = {
  label: string;
  href: string;
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
    label: "Application",
    href: "/borrower/application",
    roles: ["borrower", "broker"],
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
              key={item.href}
              className={isActive ? "nav-link active" : "nav-link"}
              href={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <small>Signed in as</small>
        <strong>{roleLabels[user.role]}</strong>
      </div>
    </aside>
  );
}
