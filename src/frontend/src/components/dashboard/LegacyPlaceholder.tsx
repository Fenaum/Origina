import { AppLayout } from "@/components/app/AppLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";

export function LegacyPlaceholder({ title }: { title: string }) {
  return (
    <AppLayout>
      <PageHeader
        eyebrow="Prototype"
        title={title}
        description="This legacy placeholder is preserved while the new frontend foundation is built out."
      />
      <section className="panel">
        <div className="panel-heading">
          <h3>Planned Screen</h3>
        </div>
        <p className="muted">
          The route is available for navigation and can be connected to backend
          APIs as the workflow is implemented.
        </p>
      </section>
    </AppLayout>
  );
}
