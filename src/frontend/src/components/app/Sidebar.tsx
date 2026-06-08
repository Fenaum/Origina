import Link from "next/link";
import { useRouter } from "next/router";
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
      <Link className="brand" href={roleDashboardPaths[user.role]}>
        <span className="brand-mark">O</span>
        <span>
          <strong>Origina</strong>
          <small>LOS / TPO</small>
        </span>
      </Link>

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
