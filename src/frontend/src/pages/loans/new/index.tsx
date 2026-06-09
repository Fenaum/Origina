import { useRouter } from "next/router";
import { AppLayout } from "@/components/app/AppLayout";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { useLoanSubmissionStore } from "@/state/submissionStore";

export default function PathwayChooserPage() {
  const router = useRouter();
  const startNewDraft = useLoanSubmissionStore((state) => state.startNewDraft);
  const saveStatus = useLoanSubmissionStore((state) => state.saveStatus);

  async function startManual() {
    const loanId = await startNewDraft("manual");
    void router.push(`/loans/${loanId}/edit/setup`);
  }

  return (
    <AppLayout allowedRoles={["account_executive", "broker"]}>
      <section className="pathway-page fade-slide-in">
        <div className="page-header">
          <p className="eyebrow">New Loan</p>
          <h2>Choose how to start</h2>
          <p>Import 1003 is the recommended path for cleaner data upfront.</p>
        </div>
        <div className="pathway-grid">
          <PathwayCard
            title="Import 1003 / MISMO XML"
            description="Already have a file from Encompass, Calyx, or BytePro? Upload it and we'll pre-fill the application."
            action="Upload File"
            recommended
            onClick={() => void router.push("/loans/new/import")}
          />
          <PathwayCard
            title="Start Manually"
            description="Build the application field by field. Takes about 12 minutes."
            action={saveStatus === "saving" ? "Starting..." : "Start Application"}
            onClick={() => void startManual()}
            busy={saveStatus === "saving"}
          />
          <PathwayCard
            title="Quick Pricing"
            description="Get rate scenarios without submitting a full application."
            action="Price a Loan"
            onClick={() => void router.push("/loans/new/manual")}
          />
        </div>
      </section>
    </AppLayout>
  );
}

function PathwayCard({
  title,
  description,
  action,
  recommended = false,
  busy = false,
  onClick,
}: {
  title: string;
  description: string;
  action: string;
  recommended?: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <article className={recommended ? "pathway-card recommended" : "pathway-card"}>
      {recommended ? <span className="recommended-badge">Default</span> : null}
      <h3>{title}</h3>
      <p>{description}</p>
      <button className="primary-button" type="button" onClick={onClick}>
        {busy ? <LoadingSpinner label="Starting" /> : null}
        {action}
      </button>
    </article>
  );
}
