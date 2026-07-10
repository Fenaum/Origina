import { AppLayout } from "@/components/app/AppLayout";
import { RoleDashboard } from "@/components/dashboard/RoleDashboard";
import { ManagerDashboardContent } from "@/components/dashboard/manager/ManagerDashboardContent";

export default function ManagerDashboardPage() {
  return (
    <AppLayout allowedRoles={["manager", "admin", "account_manager"]}>
      <RoleDashboard role="manager">
        <ManagerDashboardContent />
      </RoleDashboard>
    </AppLayout>
  );
}
