import { SettingsHub, type SettingsHubCard } from "@/components/settings/SettingsHub";
import { ConfigIcon } from "@/components/settings/settingsNav";

export default function ConfigurationIndex() {
  const cards: SettingsHubCard[] = [
    {
      id: "loan-programs",
      label: "Loan Programs",
      href: "/settings/configuration",
      meta: "Non-QM products",
      description:
        "DSCR, Bank Statement, Asset Depletion, Interest Only, and Jumbo Non-QM products available to your channel.",
      icon: ConfigIcon.loanPrograms,
      badge: "Workspace",
    },
    {
      id: "fee-schedules",
      label: "Fee Schedules",
      href: "/settings/configuration",
      meta: "Compensation",
      description:
        "Broker and account executive fee schedules, lender fees, and per-product adjustments.",
      icon: ConfigIcon.feeSchedules,
      badge: "Workspace",
    },
    {
      id: "pipeline-defaults",
      label: "Pipeline Defaults",
      href: "/settings/configuration",
      meta: "Workflow",
      description:
        "Default views, stage thresholds, and SLA timers for underwriting and funding teams.",
      icon: ConfigIcon.pipelineDefaults,
      badge: "Workspace",
    },
    {
      id: "documents",
      label: "Document Checklists",
      href: "/settings/configuration",
      meta: "Per product",
      description:
        "Required document checklists for each Non-QM product and borrower type.",
      icon: ConfigIcon.documentChecklists,
      badge: "Workspace",
    },
    {
      id: "integrations",
      label: "Integrations",
      href: "/settings/configuration",
      meta: "Third party",
      description:
        "Credit bureaus, asset verification, pricing engines, and warehouse providers.",
      icon: ConfigIcon.integrations,
      badge: "Workspace",
    },
  ];

  return <SettingsHub cards={cards} />;
}
