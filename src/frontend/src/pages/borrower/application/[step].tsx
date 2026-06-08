import { useRouter } from "next/router";
import { AppLayout } from "@/components/app/AppLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";

export default function BorrowerApplicationStepPage() {
  const router = useRouter();
  const step = String(router.query.step ?? "step");

  return (
    <AppLayout allowedRoles={["borrower", "broker"]}>
      <PageHeader
        eyebrow="Borrower Intake"
        title={`Application Step: ${step}`}
        description="This placeholder is ready for form sections, validation, save/resume behavior, and backend persistence."
      />
      <section className="panel">
        <div className="panel-heading">
          <h3>Step Form Placeholder</h3>
        </div>
        <p className="muted">
          Form fields should be connected through service files once borrower
          intake APIs are finalized.
        </p>
      </section>
    </AppLayout>
  );
}
