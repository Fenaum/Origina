import Link from "next/link";

export function NoMatchState() {
  return (
    <section className="borrower-empty-state">
      <span className="borrower-eyebrow">Specialist Review Recommended</span>
      <h1>Standard Non-QM programs may not be the right fit yet.</h1>
      <p>
        Mortgage eligibility is nuanced. A licensed specialist can often find
        paths that automated tools miss.
      </p>
      <Link href="/borrower/handoff" className="borrower-primary-btn">
        Talk to a Specialist
      </Link>
    </section>
  );
}
