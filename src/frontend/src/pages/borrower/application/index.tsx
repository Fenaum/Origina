import { AppLayout } from "@/components/app/AppLayout";
import { ApplicationProgress } from "@/components/borrower/ApplicationProgress";
import { PageHeader } from "@/components/dashboard/PageHeader";

export default function BorrowerApplicationPage() {
  return (
    <AppLayout allowedRoles={["borrower", "broker"]}>
      <PageHeader
        eyebrow="Borrower Intake"
        title="Application Flow"
        description="Structured intake foundation for borrower profile, property, income, assets, declarations, and review."
      />
      <ApplicationProgress />
    </AppLayout>
  );
}
