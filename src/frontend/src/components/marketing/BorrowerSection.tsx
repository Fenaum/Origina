import Link from "next/link";
import { useInView } from "@/hooks/useInView";

const features = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="10" cy="10" r="1.2" fill="currentColor" />
      </svg>
    ),
    title: "Learn Your Options",
    description:
      "Understand the landscape of Non-QM mortgage products — from DSCR to bank statement loans — before making any decisions.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 8h6M7 11h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M7 2v4M13 2v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
    title: "Prepare for Homeownership",
    description:
      "Know what documents to gather, what timelines look like, and how to set yourself up for a smooth application process.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M5 3h7l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 3v5h5M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
    title: "Understand Documents",
    description:
      "Demystify what lenders actually need — bank statements, lease agreements, asset documentation — and why each one matters.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 14l4-4 3 3 4-5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
    title: "Explore Loan Programs",
    description:
      "Browse potential loan programs tailored to your income type, property goals, and financial profile. No commitment required.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 7l5 3-5 3V7z" fill="currentColor" />
      </svg>
    ),
    title: "Start a Guided Experience",
    description:
      "When you're ready, our step-by-step guided flow walks you through the process at your own pace — with clarity at every turn.",
  },
];

export function BorrowerSection() {
  const { ref, visible } = useInView<HTMLElement>();

  return (
    <section
      id="borrowers"
      className="mkt-section"
      ref={ref}
    >
      <div className="mkt-section-inner">
        <div className={`mkt-section-header mkt-reveal${visible ? " visible" : ""}`}>
          <span className="mkt-eyebrow-pill">For Borrowers</span>
          <h2>Navigate homeownership<br />with confidence.</h2>
          <p>
            Whether you&apos;re buying your first home, an investment property, or
            refinancing with a non-traditional income story — Origina gives you
            the clarity to move forward.
          </p>
          <Link
            href="/borrower/welcome"
            className="mkt-btn-primary"
          >
            Start Guided Experience →
          </Link>
        </div>

        <div className="mkt-feature-grid">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`mkt-feature-card mkt-reveal delay-${Math.min(i + 1, 4)}${visible ? " visible" : ""}`}
            >
              <div className="mkt-feature-icon" aria-hidden>
                {feature.icon}
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
