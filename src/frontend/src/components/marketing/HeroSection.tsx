const programs = [
  "DSCR",
  "Bank Statement",
  "Asset Depletion",
  "Interest Only",
  "Jumbo Non-QM",
];

export function HeroSection() {
  return (
    <section className="mkt-hero">
      <div className="mkt-hero-glow-a" aria-hidden />
      <div className="mkt-hero-glow-b" aria-hidden />

      <div className="mkt-hero-content">
        <span className="mkt-eyebrow-pill">Non-QM Mortgage Platform</span>

        <h1 className="mkt-hero-headline">
          Your path to homeownership,{" "}
          <span className="mkt-hero-accent">simplified.</span>
        </h1>

        <p className="mkt-hero-sub">
          Origina helps borrowers explore potential loan options and gives
          mortgage brokers a modern, transparent platform to manage the entire
          submission lifecycle — from pricing to funding.
        </p>

        <div className="mkt-hero-ctas">
          <button
            className="mkt-btn-primary"
            type="button"
            onClick={() => {
              document
                .getElementById("borrowers")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            I&apos;m a Borrower
          </button>
          <button
            className="mkt-btn-ghost"
            type="button"
            onClick={() => {
              document
                .getElementById("brokers")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            I&apos;m a Broker →
          </button>
        </div>

        <div className="mkt-program-pills">
          {programs.map((p) => (
            <span key={p} className="mkt-pill">
              {p}
            </span>
          ))}
        </div>

        <p className="mkt-hero-scroll-hint">Scroll to explore ↓</p>
      </div>
    </section>
  );
}
