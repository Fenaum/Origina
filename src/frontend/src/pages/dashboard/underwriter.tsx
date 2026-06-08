import { AppLayout } from "@/components/app/AppLayout";
import { RoleDashboard } from "@/components/dashboard/RoleDashboard";

export default function UnderwriterDashboardPage() {
  return (
    <AppLayout allowedRoles={["underwriter"]}>
      <RoleDashboard role="underwriter" />
    </AppLayout>
  );
}
