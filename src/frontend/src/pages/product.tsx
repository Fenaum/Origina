import Head from "next/head";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { useInView } from "@/hooks/useInView";
import Link from "next/link";

const products = [
  {
    id: "dscr",
    name: "DSCR Loans",
    tagline: "Investment Property Financing",
    description:
      "Debt Service Coverage Ratio (DSCR) loans are designed for real estate investors who want to qualify based on the cash flow of their investment properties rather than personal income.",
    highlights: [
      "Qualify using rental income only",
      "No personal income documentation required",
      "DSCR as low as 1.0 accepted",
      "Cash-out refinances available",
      "Up to 20-unit properties",
      "Foreign national borrowers accepted",
    ],
    details: {
      minLoan: "$100,000",
      maxLoan: "$10,000,000",
      maxLTV: "85%",
      minCredit: "620",
      terms: ["Interest Only", "Fixed Rate", "ARM"],
    },
    accentColor: "#1fa463",
  },
  {
    id: "bank-statement",
    name: "Bank Statement Loans",
    tagline: "Self-Employment Made Simple",
    description:
      "Bank statement loans allow self-employed borrowers to qualify using their business and personal bank statements, eliminating the need for traditional income verification.",
    highlights: [
      "12 or 24-month statement options",
      "No tax returns required",
      "Business or personal statements accepted",
      "CPA letter option for verification",
      "Primary and investment properties",
      "Foreign nationals eligible",
    ],
    details: {
      minLoan: "$100,000",
      maxLoan: "$8,000,000",
      maxLTV: "85%",
      minCredit: "620",
      terms: ["Interest Only", "Fixed Rate", "ARM"],
    },
    accentColor: "#2563eb",
  },
  {
    id: "asset-depletion",
    name: "Asset Depletion",
    tagline: "Leverage Your Assets",
    description:
      "Asset depletion loans allow high-net-worth borrowers to qualify based on their accumulated assets, making it ideal for retirees, business owners, and those with complex income situations.",
    highlights: [
      "Use retirement and investment accounts",
      "No income documentation required",
      "70% asset valuation for depletion",
      "Primary and secondary homes",
      "No minimum employment history",
      "High loan amounts available",
    ],
    details: {
      minLoan: "$150,000",
      maxLoan: "$10,000,000",
      maxLTV: "80%",
      minCredit: "620",
      terms: ["Interest Only", "Fixed Rate"],
    },
    accentColor: "#7c3aed",
  },
  {
    id: "interest-only",
    name: "Interest Only",
    tagline: "Maximized Cash Flow",
    description:
      "Interest-only loans provide lower monthly payments during the initial period, allowing borrowers to optimize cash flow for investment, business, or personal financial strategies.",
    highlights: [
      "5, 7, or 10-year interest-only periods",
      "Lower initial payments",
      "Preserve capital for other investments",
      "Flexible exit strategies",
      "Fixed rate during IO period",
      "Principal due at maturity",
    ],
    details: {
      minLoan: "$200,000",
      maxLoan: "$15,000,000",
      maxLTV: "85%",
      minCredit: "660",
      terms: ["Interest Only", "Fixed Rate"],
    },
    accentColor: "#db2777",
  },
  {
    id: "jumbo-non-qm",
    name: "Jumbo Non-QM",
    tagline: "Luxury Property Solutions",
    description:
      "Jumbo Non-QM loans finance high-value properties that exceed conventional loan limits, offering flexible underwriting for borrowers who need larger loan amounts.",
    highlights: [
      "Loan amounts up to $15,000,000",
      "No loan limit constraints",
      "Flexible income qualification",
      "Second homes and investment",
      "Asset-based qualification options",
      "Complex income scenarios welcome",
    ],
    details: {
      minLoan: "$1,000,000",
      maxLoan: "$15,000,000",
      maxLTV: "80%",
      minCredit: "680",
      terms: ["Interest Only", "Fixed Rate", "ARM"],
    },
    accentColor: "#ea580c",
  },
  {
    id: " Foreign nationals",
    name: "Foreign National",
    tagline: "International Borrowers Welcome",
    description:
      "Designed for non-U.S. citizens and foreign nationals purchasing U.S. real estate, these loans offer competitive terms without the complexity of traditional foreign buyer financing.",
    highlights: [
      "No U.S. credit history required",
      "Passport and visa documentation",
      "ITIN holders accepted",
      "Investment and vacation properties",
      "Competitive rates available",
      "Streamlined documentation process",
    ],
    details: {
      minLoan: "$100,000",
      maxLoan: "$5,000,000",
      maxLTV: "70%",
      minCredit: "620",
      terms: ["Interest Only", "Fixed Rate"],
    },
    accentColor: "#0891b2",
  },
];

export default function ProductPage() {
  const { ref: headerRef, visible: headerVisible } = useInView<HTMLElement>();
  const { ref: productsRef, visible: productsVisible } = useInView<HTMLElement>();

  return (
    <>
      <Head>
        <title>Products — Origina Non-QM Platform</title>
        <meta
          name="description"
          content="Explore Origina's Non-QM loan products including DSCR, Bank Statement, Asset Depletion, Interest Only, and Jumbo Non-QM loans designed for diverse borrower situations."
        />
      </Head>

      <div className="mkt-page">
        <MarketingNav />

        <header className="mkt-section tinted" ref={headerRef}>
          <div className="mkt-section-inner" style={{ maxWidth: "900px", textAlign: "center" }}>
            <div className={`mkt-section-header mkt-reveal${headerVisible ? " visible" : ""}`}>
              <span className="mkt-eyebrow-pill">Our Products</span>
              <h1>Non-QM Loan Products</h1>
              <p style={{ fontSize: "1.125rem", maxWidth: "700px", margin: "0 auto" }}>
                Origina offers a comprehensive suite of Non-Qualified Mortgage products designed
                for borrowers who don't fit traditional lending boxes. From self-employed
                professionals to real estate investors, we have solutions for complex income
                situations.
              </p>
            </div>
          </div>
        </header>

        <section className="mkt-section" ref={productsRef}>
          <div className="mkt-section-inner">
            {products.map((product, index) => (
              <div
                key={product.id}
                id={product.id}
                className={`mkt-reveal delay-${(index % 3) + 1}${productsVisible ? " visible" : ""}`}
                style={{
                  marginBottom: "4rem",
                  paddingBottom: "4rem",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3rem", alignItems: "start" }}>
                  <div>
                    <span
                      className="mkt-eyebrow-pill"
                      style={{
                        background: `${product.accentColor}18`,
                        color: product.accentColor,
                        marginBottom: "1rem",
                        display: "inline-block",
                      }}
                    >
                      {product.tagline}
                    </span>
                    <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1rem" }}>
                      {product.name}
                    </h2>
                    <p style={{ fontSize: "1.0625rem", lineHeight: 1.7, marginBottom: "1.5rem" }}>
                      {product.description}
                    </p>
                    <ul style={{ listStyle: "none", padding: 0, margin: "1.5rem 0" }}>
                      {product.highlights.map((highlight) => (
                        <li
                          key={highlight}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "0.75rem",
                            marginBottom: "0.75rem",
                            fontSize: "0.9375rem",
                          }}
                        >
                          <span style={{ color: product.accentColor, flexShrink: 0 }}>✓</span>
                          {highlight}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/loans/new"
                      className="mkt-btn-primary"
                      style={{ display: "inline-flex", background: product.accentColor }}
                    >
                      Submit a {product.name} Loan
                    </Link>
                  </div>

                  <div
                    style={{
                      background: "var(--surface)",
                      borderRadius: "var(--radius)",
                      padding: "2rem",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <h3 style={{ fontSize: "1.125rem", marginBottom: "1.5rem", color: "var(--foreground)" }}>
                      Program Details
                    </h3>
                    <div style={{ display: "grid", gap: "1.25rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.75rem", borderBottom: "1px solid var(--line)" }}>
                        <span style={{ color: "var(--muted)" }}>Minimum Loan</span>
                        <strong style={{ color: "var(--foreground)" }}>{product.details.minLoan}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.75rem", borderBottom: "1px solid var(--line)" }}>
                        <span style={{ color: "var(--muted)" }}>Maximum Loan</span>
                        <strong style={{ color: "var(--foreground)" }}>{product.details.maxLoan}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.75rem", borderBottom: "1px solid var(--line)" }}>
                        <span style={{ color: "var(--muted)" }}>Maximum LTV</span>
                        <strong style={{ color: "var(--foreground)" }}>{product.details.maxLTV}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.75rem", borderBottom: "1px solid var(--line)" }}>
                        <span style={{ color: "var(--muted)" }}>Minimum Credit</span>
                        <strong style={{ color: "var(--foreground)" }}>{product.details.minCredit}</strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--muted)", display: "block", marginBottom: "0.5rem" }}>
                          Available Terms
                        </span>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          {product.details.terms.map((term) => (
                            <span
                              key={term}
                              style={{
                                background: "var(--bg-muted)",
                                padding: "0.375rem 0.75rem",
                                borderRadius: "999px",
                                fontSize: "0.8125rem",
                                color: "var(--foreground)",
                              }}
                            >
                              {term}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mkt-section tinted">
          <div className="mkt-section-inner" style={{ maxWidth: "800px", textAlign: "center" }}>
            <div className="mkt-section-header">
              <h2>Not Sure Which Product Fits?</h2>
              <p>
                Our product specialists can help you match the right loan to your borrower's
                unique situation. Get personalized recommendations based on income, assets, and
                property type.
              </p>
            </div>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <Link href="/guideline" className="mkt-btn-primary" style={{ display: "inline-flex" }}>
                View Full Guidelines
              </Link>
              <Link href="/contact" className="mkt-btn-ghost" style={{ display: "inline-flex" }}>
                Talk to a Specialist
              </Link>
            </div>
          </div>
        </section>

        <MarketingFooter />
      </div>
    </>
  );
}
