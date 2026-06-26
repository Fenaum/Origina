import { SettingsHub, type SettingsHubCard } from "@/components/settings/SettingsHub";
import { HubIcon } from "@/components/settings/settingsNav";
import { useAuth } from "@/state/auth";

export default function SettingsIndex() {
  const { user, effectiveRole } = useAuth();
  const isAdmin = effectiveRole === "it_admin" || effectiveRole === "admin";
  const showAdmin = isAdmin && user?.role === "admin";

  const cards: SettingsHubCard[] = [
    {
      id: "account",
      label: "Account",
      href: "/settings/account",
      meta: "Your profile",
      description: "Manage your name, email, contact details, and active sessions.",
      icon: HubIcon.account,
    },
    {
      id: "preferences",
      label: "User Preferences",
      href: "/settings/preferences",
      meta: "Personal defaults",
      description: "Default views, date and number formats, theme, and notifications.",
      icon: HubIcon.preferences,
    },
    {
      id: "configuration",
      label: "Configuration",
      href: "/settings/configuration",
      meta: "Workspace setup",
      description: "Loan programs, products, fee schedules, and pipeline defaults.",
      icon: HubIcon.configuration,
    },
    {
      id: "reports",
      label: "Reporting",
      href: "/settings/reports",
      meta: "Performance & ops",
      description: "Commission, production, underwriting, and funding reports.",
      icon: HubIcon.reports,
    },
  ];

  if (showAdmin) {
    cards.push({
      id: "admin",
      label: "Admin",
      href: "/settings/admin",
      meta: "Workspace admin",
      description: "Organization identity, branding, members, and security policy.",
      icon: HubIcon.admin,
      badge: "Admin",
    });
  }

  return <SettingsHub cards={cards} />;
}
