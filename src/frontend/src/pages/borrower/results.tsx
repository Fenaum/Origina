import Head from "next/head";
import Link from "next/link";
import { useEffect } from "react";
import { NoMatchState } from "@/components/borrower/results/NoMatchState";
import { ProgramCardList } from "@/components/borrower/results/ProgramCardList";
import { useIntakeStore } from "@/state/intakeStore";

export default function BorrowerResultsPage() {
  const { results, fetchResults } = useIntakeStore();

  useEffect(() => {
    if (!results) {
      void fetchResults();
    }
  }, [fetchResults, results]);

  return (
    <>
      <Head>
        <title>Program Matches | Origina</title>
      </Head>
      <main className="borrower-results-page">
        <nav className="borrower-welcome-nav">
          <Link href="/" className="borrower-wordmark">
            Origina
          </Link>
          <Link href="/borrower/intake" className="borrower-secondary-btn compact">
            Edit answers
          </Link>
        </nav>

        <header className="borrower-results-header">
          <span className="borrower-eyebrow">Program Matches</span>
          <h1>Loan programs that may fit your situation.</h1>
          <p>
            These results are educational and not a commitment to lend. Actual
            eligibility depends on creditworthiness, property details, market
            conditions, and full documentation review.
          </p>
        </header>

        {!results ? (
          <div className="borrower-results-loading" aria-live="polite" aria-label="Loading your program matches">
            <div />
            <div />
            <div />
          </div>
        ) : results.length > 0 ? (
          <>
            <ProgramCardList programs={results} />
            <p className="borrower-disclosure">
              Rate ranges are illustrative only and not a commitment to lend.
              Actual rates depend on creditworthiness, property, and market
              conditions.
            </p>
          </>
        ) : (
          <NoMatchState />
        )}
      </main>
    </>
  );
}
