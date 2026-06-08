import { useEffect, useState } from "react";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { DashboardPageSkeleton } from "@/components/dashboard/DashboardPageSkeleton";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusList } from "@/components/dashboard/StatusList";
import { dashboardMetrics, dashboardStatusItems } from "@/data/mockDashboard";
import { roleLabels, type UserRole } from "@/types/auth";

const dashboardCopy: Record<UserRole, { title: string; description: string }> = {
  account_executive: {
    title: "Account Executive Dashboard",
    description:
      "Monitor partner activity, submission flow, and files needing follow-up.",
  },
  broker: {
    title: "Broker Dashboard",
    description:
      "Track borrower files, open conditions, recent submissions, and approvals.",
  },
  underwriter: {
    title: "Underwriter Dashboard",
    description:
      "Review queue health, condition submissions, approvals, and exceptions.",
  },
  borrower: {
    title: "Borrower Portal",
    description:
      "Complete the application, upload documents, and track file progress.",
  },
};

export function RoleDashboard({ role }: { role: UserRole }) {
  const copy = dashboardCopy[role];
  const [isLoading, setIsLoading] = useState(process.env.NODE_ENV !== "production");

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    const timeoutId = window.setTimeout(() => setIsLoading(false), 160);
    return () => window.clearTimeout(timeoutId);
  }, [isLoading]);

  return (
    <>
      <PageHeader
        eyebrow={roleLabels[role]}
        title={copy.title}
        description={copy.description}
      />
      {isLoading ? (
        <DashboardPageSkeleton />
      ) : (
        <>
          <DashboardGrid metrics={dashboardMetrics[role]} />
          <StatusList
            title="Work Requiring Attention"
            items={dashboardStatusItems[role]}
          />
        </>
      )}
    </>
  );
}
