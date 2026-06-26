import { useCallback, useMemo, useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { SettingsLayout } from "@/components/settings/SettingsLayout";
import { SectionCard } from "@/components/settings/SectionCard";
import { useOrganization, useUpdateOrganization } from "@/services/settingsService";
import { useAuth } from "@/state/auth";

const ADMIN_SECTIONS = [
  {
    id: "identity",
    label: "Organization Identity",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    meta: "Name and branding",
  },
  {
    id: "support",
    label: "Support",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    meta: "Contact and hours",
  },
  {
    id: "security",
    label: "Security Policy",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    meta: "MFA and password rules",
  },
];

type OrgForm = {
  name: string;
  logo_url: string;
  primary_color: string;
  support_email: string;
  mfa_required: boolean;
};

function formFromOrg(org: { name?: string | null; logo_url?: string | null; primary_color?: string | null; support_email?: string | null; mfa_required?: boolean | null } | undefined): OrgForm {
  return {
    name: org?.name ?? "",
    logo_url: org?.logo_url ?? "",
    primary_color: org?.primary_color ?? "#4ade80",
    support_email: org?.support_email ?? "",
    mfa_required: org?.mfa_required ?? false,
  };
}

export default function AdminSettingsPage() {
  const { user } = useAuth();
  // Gate on the real (server-authenticated) role — preview mode is UI-only
  // and must not lock an admin out of the admin sub-page.
  const isAdmin = user?.role === "admin";

  const { data, isLoading, error } = useOrganization();
  const updateMutation = useUpdateOrganization();

  const [edits, setEdits] = useState<Partial<OrgForm>>({});
  const form = useMemo(() => ({ ...formFromOrg(data), ...edits }), [data, edits]);
  const baseline = useMemo(() => formFromOrg(data), [data]);
  const isDirty = JSON.stringify(form) !== JSON.stringify(baseline);

  const handleSave = useCallback(async () => {
    await updateMutation.mutateAsync(form);
    setEdits({});
  }, [form, updateMutation]);

  const handleChange = <K extends keyof OrgForm>(field: K, value: OrgForm[K]) => {
    setEdits((prev) => ({ ...prev, [field]: value }));
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="settings-wrapper">
          <div className="settings-page-header">
            <p className="eyebrow">Settings</p>
            <h2>Admin</h2>
            <p className="settings-user-hint">
              You don&apos;t have permission to view this section.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="settings-page-loading">
          <div className="skeleton skeleton-text" style={{ width: "40%", height: 24 }} />
          <div className="skeleton skeleton-card" style={{ marginTop: 24 }} />
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout>
        <div className="settings-page-error">
          <p>Failed to load organization settings. <button type="button" className="link-button" onClick={() => window.location.reload()}>Retry</button></p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <SettingsLayout
        title="Admin"
        description="Manage your workspace's name, branding, and policies."
        sections={ADMIN_SECTIONS}
        isSaving={updateMutation.isPending}
        onSave={handleSave}
        isDirty={isDirty}
      >
        <SectionCard title="Organization Identity" description="How your workspace appears to lenders and partners.">
          <div className="form-stack">
            <div className="form-field">
              <label htmlFor="org-name" className="form-label">Workspace name</label>
              <input
                id="org-name"
                type="text"
                className="form-input"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                autoComplete="organization"
              />
            </div>
            <div className="form-field">
              <label htmlFor="org-logo" className="form-label">Logo URL</label>
              <input
                id="org-logo"
                type="url"
                className="form-input"
                placeholder="https://yourbrand.com/logo.png"
                value={form.logo_url}
                onChange={(e) => handleChange("logo_url", e.target.value)}
              />
              <p className="form-hint">Use a square image at least 256×256px.</p>
            </div>
            <div className="form-field">
              <label htmlFor="org-color" className="form-label">Brand color</label>
              <div className="color-input-group">
                <input
                  id="org-color"
                  type="color"
                  className="form-color"
                  value={form.primary_color}
                  onChange={(e) => handleChange("primary_color", e.target.value)}
                />
                <input
                  type="text"
                  className="form-input color-hex"
                  value={form.primary_color}
                  onChange={(e) => handleChange("primary_color", e.target.value)}
                  maxLength={7}
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
              <p className="form-hint">Used for status badges, links, and accents throughout Origina.</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Support" description="Contact information shown to lenders and brokers.">
          <div className="form-stack">
            <div className="form-field">
              <label htmlFor="support-email" className="form-label">Support email</label>
              <input
                id="support-email"
                type="email"
                className="form-input"
                placeholder="support@yourcompany.com"
                value={form.support_email}
                onChange={(e) => handleChange("support_email", e.target.value)}
                autoComplete="email"
              />
              <p className="form-hint">Shown in error messages and onboarding flows.</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Security Policy" description="Password and authentication requirements for all members.">
          <div className="form-stack">
            <div className="form-field">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={form.mfa_required}
                  onChange={(e) => handleChange("mfa_required", e.target.checked)}
                />
                <span className="toggle-text">
                  <strong>Require two-factor authentication</strong>
                  <span className="form-hint" style={{ display: "block" }}>
                    All members must enable MFA before accessing the workspace.
                    Requires MFA support to be activated first.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </SectionCard>
      </SettingsLayout>
    </AppLayout>
  );
}
