// Account settings landing page.
// Each card represents a future settings module; the grid gives users a clear
// map of what can be configured without exposing unfinished controls yet.
import { AppLayout } from "@/components/app/AppLayout";
import { useAuth } from "@/state/auth";

const SECTIONS = [
  {
    id: "profile",
    label: "Profile",
    icon: "PR",
    description: "Your name, email address, and contact information.",
    meta: "Account identity",
  },
  {
    id: "preferences",
    label: "Preferences",
    icon: "WF",
    description: "Default views, date formats, and workflow preferences.",
    meta: "Workspace defaults",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: "NT",
    description: "Control which events send you notifications and how.",
    meta: "Alerts and delivery",
  },
  {
    id: "security",
    label: "Security",
    icon: "SC",
    description: "Password, two-factor authentication, and active sessions.",
    meta: "Access control",
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: "UI",
    description: "Theme, density, and display options.",
    meta: "Interface",
  },
];

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <AppLayout>
      <div className="settings-wrapper">
        <div className="settings-page-header">
          <p className="eyebrow">Account</p>
          <h2>Settings</h2>
          {user && <p className="settings-user-hint">Signed in as {user.email}</p>}
        </div>

        <div className="settings-grid">
          {SECTIONS.map((s) => (
            <div key={s.id} className="settings-section-card">
              <div className="settings-card-header">
                <div className="settings-section-icon" aria-hidden>{s.icon}</div>
                <div className="settings-section-body">
                  <h3 className="settings-section-title">{s.label}</h3>
                  <p className="settings-section-meta">{s.meta}</p>
                </div>
              </div>
              <p className="settings-section-desc">{s.description}</p>
              <div className="settings-section-footer">
                <span className="settings-section-coming">Coming soon</span>
                <span className="settings-section-arrow" aria-hidden>→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
