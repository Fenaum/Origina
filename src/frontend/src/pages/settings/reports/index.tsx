import { SettingsHub, type SettingsHubCard } from "@/components/settings/SettingsHub";
import { ReportIcon } from "@/components/settings/settingsNav";

export default function ReportsIndex() {
  const cards: SettingsHubCard[] = [
    {
      id: "commission",
      label: "Commission Reports",
      href: "/settings/reports",
      meta: "Compensation",
      description:
        "Broker and account executive commission tracking, calculation breakdowns, and payout summaries by period.",
      icon: ReportIcon.commission,
      badge: "Coming soon",
    },
    {
      id: "agent-performance",
      label: "Agent Performance",
      href: "/settings/reports",
      meta: "Production",
      description:
        "Production metrics, pull-through rates, pipeline velocity, and activity per loan officer or broker.",
      icon: ReportIcon.agentPerformance,
      badge: "Coming soon",
    },
    {
      id: "underwriting-performance",
      label: "Underwriting Performance",
      href: "/settings/reports",
      meta: "Credit operations",
      description:
        "Decision timelines, approval and denial rates, exception volume, and conditions-per-file trends.",
      icon: ReportIcon.underwritingPerformance,
      badge: "Coming soon",
    },
    {
      id: "funding-performance",
      label: "Funding Performance",
      href: "/settings/reports",
      meta: "Closing & funding",
      description:
        "Funding timelines, wire disbursement accuracy, post-close outcomes, and warehouse line utilization.",
      icon: ReportIcon.fundingPerformance,
      badge: "Coming soon",
    },
  ];

  return <SettingsHub cards={cards} />;
}
