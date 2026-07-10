import Head from "next/head";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { useInView } from "@/hooks/useInView";

const guidelines = [
  {
    category: "Eligibility Guidelines",
    items: [
      {
        title: "Credit Requirements",
        description:
          "Non-QM loans typically require a minimum credit score of 620, though some products may accept lower scores with compensating factors. Credit history, payment patterns, and outstanding debts are evaluated holistically.",
      },
      {
        title: "Income Documentation",
        description:
          "We accept alternative income documentation including bank statements (12 or 24 months), asset depletion schedules, CPA-certified income letters, and DSCR (Debt Service Coverage Ratio) calculations for investment properties.",
      },
      {
        title: "Property Types",
        description:
          "Eligible properties include single-family residences, 1-4 unit properties, condos, townhomes, warrantable and non-warrantable condos, second homes, and investment properties. Owner-occupied and non-owner-occupied properties accepted.",
      },
      {
        title: "Loan Amounts",
        description:
          "Loan amounts range from $100,000 to $10,000,000 depending on the product type. Jumbo Non-QM products extend to $15,000,000 for high-value properties with appropriate documentation requirements.",
      },
    ],
  },
  {
    category: "Documentation Standards",
    items: [
      {
        title: "Bank Statement Loans",
        description:
          "12 or 24 months consecutive bank statements required. Business accounts require business tax returns or a CPA letter verifying self-employment. Large deposits must be sourced and explained.",
      },
      {
        title: "Asset Depletion",
        description:
          "Two months of most recent asset statements required. Assets must be owned by the borrower or spouse. Retirement accounts typically valued at 70% of stated balance for depletion calculations.",
      },
      {
        title: "DSCR Requirements",
        description:
          "Debt Service Coverage Ratio calculated as monthly rental income divided by monthly mortgage payment. Minimum DSCR of 1.0 required; 1.25+ preferred for better rate options.",
      },
      {
        title: "Interest Only Products",
        description:
          "Interest-only periods range from 5-10 years depending on product. Full documentation including income verification required. Exit strategy documentation may be requested.",
      },
    ],
  },
  {
    category: "Loan Terms",
    items: [
      {
        title: "Fixed Rate Options",
        description:
          "Fixed rate periods of 5, 7, 10, 15, and 30 years available. Rates locked at submission and honored through funding. ARM products available with initial fixed periods of 3, 5, 7, or 10 years.",
      },
      {
        title: "Interest Only Periods",
        description:
          "Interest-only periods of 5-10 years available on select products. Monthly payments during IO period cover interest only, with principal balance due at maturity or refinancing.",
      },
      {
        title: "Prepayment Penalties",
        description:
          "Some products include prepayment penalties for early payoff. Terms vary by product and lender. Negotiated prepayment penalty windows typically range from 6 months to 5 years.",
      },
      {
        title: "Balloon Provisions",
        description:
          "Some loan products include balloon provisions. Balloon terms range from 3-10 years with remaining principal due at maturity. Refinancing options available prior to balloon date.",
      },
    ],
  },
  {
    category: "Broker Responsibilities",
    items: [
      {
        title: "Disclosure Requirements",
        description:
          "Brokers must provide all required disclosures including TILA, RESPA, and state-specific forms within applicable timeframes. NMLS licensing must be current and verified.",
      },
      {
        title: "Condition Fulfillment",
        description:
          "All loan conditions must be satisfied before funding. Conditions can be uploaded through the platform. Condition deadlines must be met or extensions requested through the system.",
      },
      {
        title: "Rate Locks",
        description:
          "Rate locks are available for 30, 45, 60, or 90 days depending on product. Lock extensions available at prevailing rates. Locks expire if loan not submitted within lock period.",
      },
      {
        title: "Compliance Standards",
        description:
          "All loans must comply with federal, state, and local regulations. Anti-predatory lending guidelines apply. Broker must maintain required licensing in originating state.",
      },
    ],
  },
];

export default function GuidelinePage() {
  const { ref: headerRef, visible: headerVisible } = useInView<HTMLElement>();
  const { ref: contentRef, visible: contentVisible } = useInView<HTMLElement>();

  return (
    <>
      <Head>
        <title>Guidelines — Origina Non-QM Platform</title>
        <meta
          name="description"
          content="Review Origina's comprehensive guidelines for Non-QM loan products including eligibility requirements, documentation standards, and broker responsibilities."
        />
      </Head>

      <div className="mkt-page">
        <MarketingNav />

        <header className="mkt-section tinted" ref={headerRef}>
          <div className="mkt-section-inner" style={{ maxWidth: "800px", textAlign: "center" }}>
            <div className={`mkt-section-header mkt-reveal${headerVisible ? " visible" : ""}`}>
              <span className="mkt-eyebrow-pill">Resources</span>
              <h1>Lending Guidelines</h1>
              <p style={{ fontSize: "1.125rem", maxWidth: "640px", margin: "0 auto" }}>
                Comprehensive guidelines for Origina&apos;s Non-QM loan products. Review eligibility
                requirements, documentation standards, and program details to streamline your
                submissions.
              </p>
            </div>
          </div>
        </header>

        <section className="mkt-section" ref={contentRef}>
          <div className="mkt-section-inner">
            {guidelines.map((section, sectionIndex) => (
              <div
                key={section.category}
                className={`mkt-reveal delay-${(sectionIndex % 4) + 1}${contentVisible ? " visible" : ""}`}
                style={{ marginBottom: "4rem" }}
              >
                <h2
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 600,
                    marginBottom: "1.5rem",
                    color: "var(--foreground)",
                  }}
                >
                  {section.category}
                </h2>
                <div className="mkt-feature-grid" style={{ gap: "1.5rem" }}>
                  {section.items.map((item) => (
                    <div key={item.title} className="mkt-feature-card" style={{ padding: "1.5rem" }}>
                      <h3 style={{ fontSize: "1.125rem", marginBottom: "0.75rem" }}>{item.title}</h3>
                      <p style={{ fontSize: "0.9375rem", lineHeight: 1.6 }}>{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mkt-section tinted">
          <div className="mkt-section-inner" style={{ maxWidth: "800px", textAlign: "center" }}>
            <div className="mkt-section-header">
              <h2>Need Clarification?</h2>
              <p>
                Our team is available to discuss guideline questions and help determine the best
                product for your borrower&apos;s situation. Contact your account executive for
                personalized guidance.
              </p>
            </div>
            <a href="mailto:guidelines@origina.io" className="mkt-btn-primary" style={{ display: "inline-flex" }}>
              Contact Guidelines Team
            </a>
          </div>
        </section>

        <MarketingFooter />
      </div>
    </>
  );
}
