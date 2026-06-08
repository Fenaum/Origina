import { AppLayout } from "@/components/app/AppLayout";
import { RoleDashboard } from "@/components/dashboard/RoleDashboard";

export default function AccountExecutiveDashboardPage() {
  return (
    <AppLayout allowedRoles={["account_executive"]}>
      <RoleDashboard role="account_executive" />
    </AppLayout>
  );
}
