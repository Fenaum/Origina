import Head from "next/head";
import Link from "next/link";
import { EmailCaptureForm } from "@/components/borrower/handoff/EmailCaptureForm";
import { HandoffConfirmation } from "@/components/borrower/handoff/HandoffConfirmation";
import { useIntakeStore } from "@/state/intakeStore";

export default function BorrowerHandoffPage() {
  const status = useIntakeStore((state) => state.status);
  const submitHandoff = useIntakeStore((state) => state.submitHandoff);

  return (
    <>
      <Head>
        <title>Talk to a Specialist | Origina</title>
      </Head>
      <main className="borrower-handoff-page">
        <nav className="borrower-welcome-nav">
          <Link href="/" className="borrower-wordmark">
            Origina
          </Link>
          <Link href="/borrower/results" className="borrower-secondary-btn compact">
            Back to results
          </Link>
        </nav>

        {status === "submitted" ? (
          <HandoffConfirmation />
        ) : (
          <section className="borrower-handoff-card">
            <span className="borrower-eyebrow">Specialist Handoff</span>
            <h1>Connect with a licensed specialist.</h1>
            <p>
              Share your contact information and the Origina team can review
              your likely program path. This is still pre-application and does
              not require a credit pull.
            </p>
            <EmailCaptureForm
              onSubmit={async (name, email) => {
                await submitHandoff(email, name);
              }}
            />
          </section>
        )}
      </main>
    </>
  );
}
