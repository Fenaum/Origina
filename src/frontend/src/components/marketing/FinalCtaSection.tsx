import { useInView } from "@/hooks/useInView";

export function FinalCtaSection() {
  const { ref, visible } = useInView<HTMLElement>();

  return (
    <section className="mkt-final-cta" ref={ref}>
      <div className="mkt-final-cta-glow" aria-hidden />

      <div className="mkt-cta-grid">
        <div className={`mkt-cta-card borrower-card mkt-reveal${visible ? " visible" : ""}`}>
          <span className="mkt-eyebrow-pill">For Borrowers</span>
          <h2>Start your guided borrower experience.</h2>
          <p>
            Explore potential loan options at your own pace. No credit pull,
            no pressure — just clarity on what may be possible for you.
          </p>
          <button
            className="mkt-btn-white"
            type="button"
            onClick={() => console.log("Borrower intake — coming soon")}
          >
            Start Borrower Experience →
          </button>
        </div>

        <div className={`mkt-cta-card broker-card mkt-reveal delay-1${visible ? " visible" : ""}`}>
          <span className="mkt-eyebrow-pill">For Brokers</span>
          <h2>Explore the broker portal.</h2>
          <p>
            Join Origina&apos;s growing network of wholesale Non-QM mortgage
            brokers. Streamlined submission, real-time tracking, and a
            platform that respects your time.
          </p>
          <button
            className="mkt-btn-dark"
            type="button"
            onClick={() => console.log("Broker onboarding — coming soon")}
          >
            Explore Broker Portal →
          </button>
        </div>
      </div>
    </section>
  );
}
