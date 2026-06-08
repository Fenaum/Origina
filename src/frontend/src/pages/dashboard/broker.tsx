import { AppLayout } from "@/components/app/AppLayout";
import { RoleDashboard } from "@/components/dashboard/RoleDashboard";

export default function BrokerDashboardPage() {
  return (
    <AppLayout allowedRoles={["broker"]}>
      <RoleDashboard role="broker" />
    </AppLayout>
  );
}
