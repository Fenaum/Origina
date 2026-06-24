import { AppLayout } from "@/components/app/AppLayout";
import { RoleDashboard } from "@/components/dashboard/RoleDashboard";

export default function FunderDashboardPage() {
  return (
    <AppLayout allowedRoles={["funder", "admin"]}>
      <RoleDashboard role="funder" />
    </AppLayout>
  );
}
