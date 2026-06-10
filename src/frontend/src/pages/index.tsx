import Head from "next/head";
import { BorrowerSection } from "@/components/marketing/BorrowerSection";
import { BrokerSection } from "@/components/marketing/BrokerSection";
import { FinalCtaSection } from "@/components/marketing/FinalCtaSection";
import { HeroSection } from "@/components/marketing/HeroSection";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingNav } from "@/components/marketing/MarketingNav";

export default function MarketingHomePage() {
  return (
    <>
      <Head>
        <title>Origina — Non-QM Mortgage Platform</title>
        <meta
          name="description"
          content="Origina helps borrowers explore Non-QM loan options and gives mortgage brokers a modern TPO platform for streamlined submission, pricing, and loan tracking."
        />
      </Head>

      <div className="mkt-page">
        <MarketingNav />
        <HeroSection />
        <BorrowerSection />
        <BrokerSection />
        <HowItWorksSection />
        <FinalCtaSection />
        <MarketingFooter />
      </div>
    </>
  );
}
