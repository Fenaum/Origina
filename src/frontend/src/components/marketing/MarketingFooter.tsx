import Link from "next/link";
import { OriginaLogo } from "@/components/brand/OriginaLogo";

export function MarketingFooter() {
  return (
    <footer className="mkt-footer">
      <div className="mkt-footer-inner">
        <OriginaLogo className="mkt-footer-brand" subtitle="LOS" />
        <nav className="mkt-footer-links">
          <Link href="/product">Products</Link>
          <Link href="/guideline">Guidelines</Link>
          <Link href="/about">About</Link>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Contact</a>
          <Link href="/login">Sign In</Link>
        </nav>
      </div>
      <p className="mkt-footer-disclaimer">
        Origina is a mortgage technology platform. All loan products are subject
        to credit approval, underwriting guidelines, and lender eligibility
        requirements. This page does not constitute a loan offer or guarantee of
        financing. Rates and programs are subject to change without notice.
        Licensed in applicable states.
      </p>
    </footer>
  );
}
