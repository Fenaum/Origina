import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { useIntakeStore } from "@/state/intakeStore";

export default function BorrowerWelcomePage() {
  const router = useRouter();
  const startSession = useIntakeStore((state) => state.startSession);
  const [isStarting, setIsStarting] = useState(false);

  async function handleStart() {
    setIsStarting(true);
    try {
      await startSession();
      await router.push("/borrower/intake");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Borrower Experience | Origina</title>
        <meta
          name="description"
          content="Answer a few simple questions and see which Non-QM loan programs may fit your situation."
        />
      </Head>
      <main className="borrower-welcome-page premium-intro">
        <nav className="borrower-welcome-nav intro-nav">
          <Link href="/" className="borrower-wordmark">
            Origina
          </Link>
          <Link href="/" className="borrower-secondary-btn compact">
            Back to site
          </Link>
        </nav>

        <section className="borrower-welcome-hero">
          <h1 className="intro-headline">Find your path to homeownership.</h1>
          <div className="intro-support">
            <span className="borrower-eyebrow">Borrower Experience</span>
            <p>
              Answer a few questions about your situation and we&apos;ll show you
              which loan programs may fit. No credit pull, no commitment.
            </p>
            <button
              className="borrower-primary-btn"
              type="button"
              disabled={isStarting}
              onClick={handleStart}
            >
              {isStarting ? "Starting..." : "Let\u2019s get started"}
            </button>
            <div className="borrower-reassurance">
              <span>3 minutes</span>
              <span>No SSN required</span>
              <span>No credit check</span>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
