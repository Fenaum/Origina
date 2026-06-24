import { AppLayout } from "@/components/app/AppLayout";
import { RoleDashboard } from "@/components/dashboard/RoleDashboard";

export default function ProcessorDashboardPage() {
  return (
    <AppLayout allowedRoles={["processor", "admin"]}>
      <RoleDashboard role="processor" />
    </AppLayout>
  );
}
