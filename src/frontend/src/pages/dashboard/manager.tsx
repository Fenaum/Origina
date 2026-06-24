import { AppLayout } from "@/components/app/AppLayout";
import { RoleDashboard } from "@/components/dashboard/RoleDashboard";

export default function ManagerDashboardPage() {
  return (
    <AppLayout allowedRoles={["manager", "admin"]}>
      <RoleDashboard role="manager" />
    </AppLayout>
  );
}
