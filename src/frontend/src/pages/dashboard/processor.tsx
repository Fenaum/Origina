import { AppLayout } from "@/components/app/AppLayout";
import { RoleDashboard } from "@/components/dashboard/RoleDashboard";

export default function ProcessorDashboardPage() {
  return (
    <AppLayout allowedRoles={["loan_processor", "processor"]}>
      <RoleDashboard role="processor" />
    </AppLayout>
  );
}
