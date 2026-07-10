import Head from "next/head";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { useInView } from "@/hooks/useInView";
import Link from "next/link";

const values = [
  {
    icon: "🎯",
    title: "Borrower-Focused",
    description:
      "We believe every borrower deserves access to fair financing regardless of their income source. Our platform serves those who don't fit traditional boxes.",
  },
  {
    icon: "⚡",
    title: "Speed & Efficiency",
    description:
      "Our streamlined processes reduce approval times from weeks to days. Real-time status tracking means no more guessing where your loan stands.",
  },
  {
    icon: "🤝",
    title: "Broker Partnership",
    description:
      "We're built for mortgage professionals by mortgage professionals. Our tools help brokers win more business and serve their clients better.",
  },
  {
    icon: "📊",
    title: "Transparency",
    description:
      "Clear pricing, upfront guidelines, and honest communication. No hidden fees, no surprises—just straightforward lending.",
  },
  {
    icon: "🔒",
    title: "Compliance First",
    description:
      "Every loan on our platform meets federal, state, and local regulatory requirements. We handle the complexity so brokers can focus on clients.",
  },
  {
    icon: "🌱",
    title: "Sustainable Growth",
    description:
      "We build lasting relationships with brokers and borrowers, not one-time transactions. Our success is measured by yours.",
  },
];

const team = [
  {
    name: "Sarah Chen",
    role: "Chief Executive Officer",
    bio: "Former mortgage executive with 20+ years in wholesale lending. Built Origina to solve the Non-QM access gap she witnessed firsthand.",
    image: "/team/sarah-chen.jpg",
  },
  {
    name: "Marcus Williams",
    role: "Chief Technology Officer",
    bio: "Tech veteran from fintech and proptech sectors. Led platform development at two successful mortgage SaaS companies before joining Origina.",
    image: "/team/marcus-williams.jpg",
  },
  {
    name: "Jennifer Rodriguez",
    role: "VP of Underwriting",
    bio: "30-year mortgage industry veteran specializing in alternative documentation and investor property financing. Leads our underwriting excellence program.",
    image: "/team/jennifer-rodriguez.jpg",
  },
  {
    name: "David Park",
    role: "VP of Sales & Partnerships",
    bio: "Former top-producing wholesale account executive. Built broker relationships across 15 states before moving to platform leadership.",
    image: "/team/david-park.jpg",
  },
];

const milestones = [
  {
    year: "2019",
    title: "Company Founded",
    description:
      "Origina launched with a mission to expand access to Non-QM lending for underserved borrowers and independent mortgage brokers.",
  },
  {
    year: "2020",
    title: "Platform Launch",
    description:
      "Our digital origination platform goes live, enabling brokers to submit, track, and manage loans entirely online for the first time.",
  },
  {
    year: "2021",
    title: "Product Expansion",
    description:
      "Expanded from DSCR products to offer Bank Statement, Asset Depletion, Interest Only, and Jumbo Non-QM options.",
  },
  {
    year: "2022",
    title: "Nationwide Expansion",
    description:
      "Received licenses in all 50 states, enabling brokers across the country to access our Non-QM products.",
  },
  {
    year: "2023",
    title: "1 Billion in Loans Funded",
    description:
      "Crossed the $1 billion milestone in total loan originations, serving thousands of borrowers and hundreds of broker partners.",
  },
  {
    year: "2024",
    title: "Platform 2.0",
    description:
      "Launched our next-generation origination platform with enhanced workflow automation, real-time pricing, and improved broker dashboards.",
  },
];

export default function AboutPage() {
  const { ref: headerRef, visible: headerVisible } = useInView<HTMLElement>();
  const { ref: storyRef, visible: storyVisible } = useInView<HTMLElement>();
  const { ref: valuesRef, visible: valuesVisible } = useInView<HTMLElement>();
  const { ref: teamRef, visible: teamVisible } = useInView<HTMLElement>();
  const { ref: timelineRef, visible: timelineVisible } = useInView<HTMLElement>();

  return (
    <>
      <Head>
        <title>About Us — Origina Non-QM Platform</title>
        <meta
          name="description"
          content="Learn about Origina's mission to expand access to Non-QM lending, our leadership team, company values, and our commitment to serving borrowers and mortgage brokers."
        />
      </Head>

      <div className="mkt-page">
        <MarketingNav />

        <header className="mkt-section tinted" ref={headerRef}>
          <div className="mkt-section-inner" style={{ maxWidth: "900px", textAlign: "center" }}>
            <div className={`mkt-section-header mkt-reveal${headerVisible ? " visible" : ""}`}>
              <span className="mkt-eyebrow-pill">Our Story</span>
              <h1>About Origina</h1>
              <p style={{ fontSize: "1.125rem", maxWidth: "700px", margin: "0 auto" }}>
                We&apos;re on a mission to democratize access to mortgage financing. Origina
                was built for the millions of creditworthy borrowers who don&apos;t fit traditional
                lending boxes—and the brokers who serve them.
              </p>
            </div>
          </div>
        </header>

        <section className="mkt-section" ref={storyRef}>
          <div className="mkt-section-inner">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "4rem",
                alignItems: "center",
              }}
            >
              <div className={`mkt-reveal${storyVisible ? " visible" : ""}`}>
                <span className="mkt-eyebrow-pill" style={{ marginBottom: "1rem", display: "inline-block" }}>
                  Who We Are
                </span>
                <h2 style={{ fontSize: "1.75rem", marginBottom: "1.25rem" }}>
                  Built by Lenders, for Lenders
                </h2>
                <p style={{ fontSize: "1.0625rem", lineHeight: 1.8, marginBottom: "1.25rem" }}>
                  Origina was founded by mortgage industry veterans who witnessed firsthand the gap
                  in financing options for self-employed professionals, real estate investors, and
                  borrowers with complex income situations.
                </p>
                <p style={{ fontSize: "1.0625rem", lineHeight: 1.8, marginBottom: "1.25rem" }}>
                  Traditional banks turned away qualified borrowers because their income didn&apos;t fit
                  standard W-2 templates. We saw an opportunity to build something better—a platform
                  that understands how people actually earn, build wealth, and manage their
                  finances.
                </p>
                <p style={{ fontSize: "1.0625rem", lineHeight: 1.8 }}>
                  Today, Origina partners with thousands of mortgage brokers across the country,
                  funding over $1 billion in Non-QM loans and helping borrowers achieve their
                  homeownership goals.
                </p>
              </div>
              <div
                className={`mkt-reveal delay-1${storyVisible ? " visible" : ""}`}
                style={{
                  background: "linear-gradient(135deg, var(--brand-dark) 0%, #0d3520 100%)",
                  borderRadius: "var(--radius)",
                  padding: "3rem",
                  color: "white",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "3rem", fontWeight: 700, color: "var(--brand)" }}>$1B+</div>
                    <div style={{ fontSize: "0.9375rem", color: "rgba(255,255,255,0.7)" }}>
                      Loans Funded
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "3rem", fontWeight: 700, color: "var(--brand)" }}>50</div>
                    <div style={{ fontSize: "0.9375rem", color: "rgba(255,255,255,0.7)" }}>
                      States Licensed
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "3rem", fontWeight: 700, color: "var(--brand)" }}>5K+</div>
                    <div style={{ fontSize: "0.9375rem", color: "rgba(255,255,255,0.7)" }}>
                      Broker Partners
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "3rem", fontWeight: 700, color: "var(--brand)" }}>6</div>
                    <div style={{ fontSize: "0.9375rem", color: "rgba(255,255,255,0.7)" }}>
                      Loan Products
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mkt-section dark" ref={valuesRef}>
          <div className="mkt-section-inner">
            <div className={`mkt-section-header mkt-reveal${valuesVisible ? " visible" : ""}`} style={{ textAlign: "center", marginBottom: "3rem" }}>
              <span className="mkt-eyebrow-pill">Our Values</span>
              <h2>What We Stand For</h2>
            </div>
            <div className="mkt-feature-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {values.map((value, index) => (
                <div
                  key={value.title}
                  className={`mkt-reveal delay-${(index % 3) + 1}${valuesVisible ? " visible" : ""}`}
                  style={{ background: "rgba(255,255,255,0.04)", padding: "2rem", borderRadius: "var(--radius)" }}
                >
                  <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>{value.icon}</div>
                  <h3 style={{ fontSize: "1.125rem", color: "white", marginBottom: "0.75rem" }}>
                    {value.title}
                  </h3>
                  <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.9375rem", lineHeight: 1.6 }}>
                    {value.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mkt-section tinted" ref={teamRef}>
          <div className="mkt-section-inner">
            <div className={`mkt-section-header mkt-reveal${teamVisible ? " visible" : ""}`} style={{ textAlign: "center", marginBottom: "3rem" }}>
              <span className="mkt-eyebrow-pill">Leadership</span>
              <h2>Meet Our Team</h2>
              <p>
                Industry veterans committed to transforming Non-QM lending through technology,
                expertise, and genuine partnership.
              </p>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "2rem",
              }}
            >
              {team.map((member, index) => (
                <div
                  key={member.name}
                  className={`mkt-reveal delay-${(index % 4) + 1}${teamVisible ? " visible" : ""}`}
                  style={{
                    background: "var(--surface)",
                    borderRadius: "var(--radius)",
                    padding: "2rem",
                    textAlign: "center",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div
                    style={{
                      width: "100px",
                      height: "100px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%)",
                      margin: "0 auto 1.25rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "2.5rem",
                      color: "white",
                      fontWeight: 600,
                    }}
                  >
                    {member.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <h3 style={{ fontSize: "1.125rem", marginBottom: "0.25rem", color: "var(--foreground)" }}>
                    {member.name}
                  </h3>
                  <p style={{ fontSize: "0.8125rem", color: "var(--brand)", fontWeight: 600, marginBottom: "1rem" }}>
                    {member.role}
                  </p>
                  <p style={{ fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.6 }}>
                    {member.bio}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mkt-section" ref={timelineRef}>
          <div className="mkt-section-inner" style={{ maxWidth: "900px" }}>
            <div className={`mkt-section-header mkt-reveal${timelineVisible ? " visible" : ""}`} style={{ textAlign: "center", marginBottom: "3rem" }}>
              <span className="mkt-eyebrow-pill">Our Journey</span>
              <h2>Company Timeline</h2>
            </div>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "2px",
                  height: "100%",
                  background: "var(--line)",
                }}
              />
              {milestones.map((milestone, index) => (
                <div
                  key={milestone.year}
                  className={`mkt-reveal delay-${(index % 3) + 1}${timelineVisible ? " visible" : ""}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "3rem",
                    marginBottom: "2.5rem",
                    position: "relative",
                  }}
                >
                  <div style={{ textAlign: "right", paddingRight: "2rem" }}>
                    {index % 2 === 0 && (
                      <>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--brand)" }}>
                          {milestone.year}
                        </div>
                        <h3 style={{ fontSize: "1.125rem", marginBottom: "0.5rem", color: "var(--foreground)" }}>
                          {milestone.title}
                        </h3>
                        <p style={{ color: "var(--muted)", fontSize: "0.9375rem", lineHeight: 1.6 }}>
                          {milestone.description}
                        </p>
                      </>
                    )}
                  </div>
                  <div style={{ textAlign: "left", paddingLeft: "2rem" }}>
                    {index % 2 === 1 && (
                      <>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--brand)" }}>
                          {milestone.year}
                        </div>
                        <h3 style={{ fontSize: "1.125rem", marginBottom: "0.5rem", color: "var(--foreground)" }}>
                          {milestone.title}
                        </h3>
                        <p style={{ color: "var(--muted)", fontSize: "0.9375rem", lineHeight: 1.6 }}>
                          {milestone.description}
                        </p>
                      </>
                    )}
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                      width: "16px",
                      height: "16px",
                      borderRadius: "50%",
                      background: "var(--brand)",
                      border: "4px solid var(--surface)",
                      boxShadow: "0 0 0 2px var(--brand)",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mkt-section tinted">
          <div className="mkt-section-inner" style={{ maxWidth: "800px", textAlign: "center" }}>
            <div className="mkt-section-header">
              <h2>Join the Origina Network</h2>
              <p>
                Partner with us to offer your borrowers more financing options and grow your
                mortgage business. Our team is ready to help you get started.
              </p>
            </div>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <Link href="/contact" className="mkt-btn-primary" style={{ display: "inline-flex" }}>
                Contact Us
              </Link>
              <Link href="/product" className="mkt-btn-ghost" style={{ display: "inline-flex" }}>
                View Our Products
              </Link>
            </div>
          </div>
        </section>

        <MarketingFooter />
      </div>
    </>
  );
}
