import { useEffect, useMemo, useState } from "react";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { DashboardPageSkeleton } from "@/components/dashboard/DashboardPageSkeleton";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusList } from "@/components/dashboard/StatusList";
import { dashboardMetrics, dashboardStatusItems } from "@/data/mockDashboard";
import { roleLabels, type UserRole } from "@/types/auth";
import { useAuth } from "@/state/auth";

type DashboardCopy = {
  title: string;
  description: string;
  statusHint: string;
  statusHref?: string;
};

const dashboardCopy: Record<UserRole, DashboardCopy> = {
  admin: {
    title: "Admin Dashboard",
    description: "Platform-wide view of all activity, users, and pipeline health.",
    statusHint: "High-priority items across the platform",
    statusHref: "/loans?actionNeeded=true",
  },
  it_admin: {
    title: "IT Admin Dashboard",
    description: "Tenants, uptime, security events, and infrastructure health at a glance.",
    statusHint: "Operational signals to triage",
    statusHref: "/settings",
  },
  account_manager: {
    title: "Account Manager Dashboard",
    description: "Partner relationships, pipeline progress, and outreach priorities.",
    statusHint: "Partner activity to follow up on",
    statusHref: "/loans?actionNeeded=true",
  },
  account_executive: {
    title: "Account Executive Dashboard",
    description: "Monitor partner activity, submission flow, and files needing follow-up.",
    statusHint: "Files needing your attention today",
    statusHref: "/loans?actionNeeded=true",
  },
  broker: {
    title: "Broker Dashboard",
    description: "Track borrower files, open conditions, recent submissions, and approvals.",
    statusHint: "What your borrowers need from you",
    statusHref: "/loans?actionNeeded=true",
  },
  processor: {
    title: "Processor Dashboard",
    description: "Manage active files, track outstanding conditions, and package loans for underwriting.",
    statusHint: "Files moving through processing",
    statusHref: "/loans?actionNeeded=true",
  },
  underwriter: {
    title: "Underwriter Dashboard",
    description: "Review queue health, condition submissions, approvals, and exceptions.",
    statusHint: "Items waiting on underwriting",
    statusHref: "/loans?status=submitted",
  },
  funder: {
    title: "Funder Dashboard",
    description: "Track approved files, coordinate final docs, and confirm wire disbursements.",
    statusHint: "Files ready to clear and fund",
    statusHref: "/loans?status=approved",
  },
  manager: {
    title: "Manager Dashboard",
    description: "Team pipeline overview, SLA tracking, exception management, and production targets.",
    statusHint: "Items that need your eyes today",
    statusHref: "/loans?actionNeeded=true",
  },
  borrower: {
    title: "Borrower Portal",
    description: "Complete the application, upload documents, and track file progress.",
    statusHint: "Steps in your application",
  },
};

// (unused helper removed; greeting is computed inline below)
function formatToday(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function RoleDashboard({ role }: { role: UserRole }) {
  const copy = dashboardCopy[role];
  const [isLoading, setIsLoading] = useState(process.env.NODE_ENV !== "production");
  const { user } = useAuth();

  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    if (!isLoading) return;
    const timeoutId = window.setTimeout(() => setIsLoading(false), 160);
    return () => window.clearTimeout(timeoutId);
  }, [isLoading]);

  const greeting = useMemo(() => {
    const firstName = user?.name?.split(" ")[0];
    const hour = today.getHours();
    let stem: string;
    if (hour < 5) stem = "Burning the midnight oil";
    else if (hour < 12) stem = "Good morning";
    else if (hour < 17) stem = "Good afternoon";
    else if (hour < 21) stem = "Good evening";
    else stem = "Wrapping up the day";
    return firstName ? `${stem}, ${firstName}.` : `${stem}.`;
  }, [today, user?.name]);

  return (
    <>
      <PageHeader
        variant="hero"
        eyebrow={roleLabels[role]}
        greeting={greeting}
        title={copy.title}
        description={copy.description}
        trailing={
          <div className="dashboard-hero-meta">
            <span className="dashboard-hero-date">{formatToday(today)}</span>
            <span className="dashboard-hero-pill">
              <span className="dashboard-hero-pill-dot" aria-hidden />
              Live data
            </span>
          </div>
        }
      />
      {isLoading ? (
        <DashboardPageSkeleton />
      ) : (
        <>
          <DashboardGrid metrics={dashboardMetrics[role]} />
          <StatusList
            title="Work Requiring Attention"
            hint={copy.statusHint}
            viewAllHref={copy.statusHref}
            items={dashboardStatusItems[role]}
          />
        </>
      )}
    </>
  );
}