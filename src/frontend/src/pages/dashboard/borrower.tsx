import { AppLayout } from "@/components/app/AppLayout";
import { ApplicationProgress } from "@/components/borrower/ApplicationProgress";
import { RoleDashboard } from "@/components/dashboard/RoleDashboard";

export default function BorrowerDashboardPage() {
  return (
    <AppLayout allowedRoles={["borrower"]}>
      <RoleDashboard role="borrower" />
      <ApplicationProgress />
    </AppLayout>
  );
}
