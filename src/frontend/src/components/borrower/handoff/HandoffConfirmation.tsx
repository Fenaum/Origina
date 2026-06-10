import Link from "next/link";

export function HandoffConfirmation() {
  return (
    <section className="borrower-empty-state success">
      <span className="borrower-eyebrow">Request Sent</span>
      <h1>A specialist will review your situation.</h1>
      <p>
        We have your request. The next step is a human review of your goals,
        income profile, and likely documentation path.
      </p>
      <Link href="/" className="borrower-secondary-btn">
        Back to Origina
      </Link>
    </section>
  );
}
