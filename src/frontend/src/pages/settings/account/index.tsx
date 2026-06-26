import { useCallback, useMemo, useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { SettingsLayout } from "@/components/settings/SettingsLayout";
import { SectionCard } from "@/components/settings/SectionCard";
import {
  useChangePassword,
  useRevokeAllSessions,
  useRevokeSession,
  useUpdateUserMe,
  useUserMe,
  useUserSessions,
} from "@/services/settingsService";
import { formatDate } from "@/lib/utils";
import { LockIcon, LogoutIcon, RefreshIcon } from "@/components/settings/icons";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Puerto_Rico",
];

const LOCALES = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "es-US", label: "Español (US)" },
  { code: "es-MX", label: "Español (MX)" },
];

const ACCOUNT_SECTIONS = [
  {
    id: "identity",
    label: "Identity",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    meta: "Name and title",
  },
  {
    id: "contact",
    label: "Contact",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.32h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
    meta: "Email and phone",
  },
  {
    id: "location",
    label: "Location",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    meta: "Locale and timezone",
  },
  {
    id: "about",
    label: "About",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <polyline points="13 2 13 9 20 9" />
      </svg>
    ),
    meta: "Bio",
  },
  {
    id: "password",
    label: "Password",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    meta: "Change password",
  },
  {
    id: "sessions",
    label: "Active Sessions",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    meta: "Devices and browsers",
  },
];

type AccountForm = {
  full_name: string;
  email: string;
  phone: string;
  title: string;
  locale: string;
  timezone: string;
  bio: string;
};

function formFromUser(user: { full_name?: string | null; email?: string | null; phone?: string | null; title?: string | null; locale?: string | null; timezone?: string | null; bio?: string | null } | undefined): AccountForm {
  return {
    full_name: user?.full_name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    title: user?.title ?? "",
    locale: user?.locale ?? "en-US",
    timezone: user?.timezone ?? "America/Chicago",
    bio: user?.bio ?? "",
  };
}

export default function AccountPage() {
  const { data, isLoading, error } = useUserMe();
  const { data: sessions, isLoading: sessionsLoading } = useUserSessions();
  const updateMutation = useUpdateUserMe();
  const revokeMutation = useRevokeSession();
  const revokeAllMutation = useRevokeAllSessions();
  const pwMutation = useChangePassword();

  // Track only user edits; the rendered form merges edits over server data.
  const [edits, setEdits] = useState<Partial<AccountForm>>({});
  const form = useMemo(() => ({ ...formFromUser(data), ...edits }), [data, edits]);
  const baseline = useMemo(() => formFromUser(data), [data]);
  const isDirty = JSON.stringify(form) !== JSON.stringify(baseline);

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");

  const handleSave = useCallback(async () => {
    const payload: AccountForm = {
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
      title: form.title,
      locale: form.locale,
      timezone: form.timezone,
      bio: form.bio,
    };
    await updateMutation.mutateAsync(payload);
    setEdits({});
  }, [form, updateMutation]);

  const handleChange = (field: keyof AccountForm, value: string) => {
    setEdits((prev) => ({ ...prev, [field]: value }));
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    if (pwForm.next !== pwForm.confirm) {
      setPwError("New passwords do not match.");
      return;
    }
    if (pwForm.next.length < 8) {
      setPwError("Password must be at least 8 characters.");
      return;
    }
    try {
      await pwMutation.mutateAsync({
        current_password: pwForm.current,
        new_password: pwForm.next,
      });
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : "Failed to change password.");
    }
  };

  const activeSessions = sessions?.filter((s) => !s.revoked_at) ?? [];

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
          <p>Failed to load your account. <button type="button" className="link-button" onClick={() => window.location.reload()}>Retry</button></p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <SettingsLayout
        title="Account"
        description={`Signed in as ${form.email} · Member since ${formatDate(data.created_at)}`}
        sections={ACCOUNT_SECTIONS}
        isSaving={updateMutation.isPending}
        onSave={handleSave}
        isDirty={isDirty}
      >
        <SectionCard title="Identity" description="Your name as it appears in Origina.">
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="full_name" className="form-label">Full name</label>
              <input
                id="full_name"
                type="text"
                className="form-input"
                value={form.full_name}
                onChange={(e) => handleChange("full_name", e.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="form-field">
              <label htmlFor="title" className="form-label">Job title</label>
              <input
                id="title"
                type="text"
                className="form-input"
                placeholder="e.g. Senior Loan Officer"
                value={form.title}
                onChange={(e) => handleChange("title", e.target.value)}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Contact" description="How lenders and partners reach you.">
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="email" className="form-label">Email address</label>
              <input
                id="email"
                type="email"
                className="form-input"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                autoComplete="email"
                readOnly
              />
              <p className="form-hint">Contact your administrator to change your email address.</p>
            </div>
            <div className="form-field">
              <label htmlFor="phone" className="form-label">Phone number</label>
              <input
                id="phone"
                type="tel"
                className="form-input"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                autoComplete="tel"
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Location" description="Used for date formatting and business hour calculations.">
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="locale" className="form-label">Locale</label>
              <select
                id="locale"
                className="form-select"
                value={form.locale}
                onChange={(e) => handleChange("locale", e.target.value)}
              >
                {LOCALES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="timezone" className="form-label">Timezone</label>
              <select
                id="timezone"
                className="form-select"
                value={form.timezone}
                onChange={(e) => handleChange("timezone", e.target.value)}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="About" description="A short bio shown to teammates and partners.">
          <div className="form-field">
            <label htmlFor="bio" className="form-label">Bio</label>
            <textarea
              id="bio"
              className="form-textarea"
              rows={3}
              maxLength={300}
              value={form.bio}
              onChange={(e) => handleChange("bio", e.target.value)}
              placeholder="Tell your team a little about yourself…"
            />
            <p className="form-hint">{form.bio.length}/300</p>
          </div>
        </SectionCard>

        <SectionCard title="Password" description="Choose a strong, unique password that you don't use elsewhere.">
          <form onSubmit={handlePasswordSubmit} className="form-stack">
            <div className="form-field">
              <label htmlFor="current-pw" className="form-label">Current password</label>
              <input
                id="current-pw"
                type="password"
                className="form-input"
                value={pwForm.current}
                onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="new-pw" className="form-label">New password</label>
              <input
                id="new-pw"
                type="password"
                className="form-input"
                value={pwForm.next}
                onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="confirm-pw" className="form-label">Confirm new password</label>
              <input
                id="confirm-pw"
                type="password"
                className="form-input"
                value={pwForm.confirm}
                onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
                autoComplete="new-password"
                required
              />
            </div>
            {pwError && <p className="form-error" role="alert">{pwError}</p>}
            <div className="form-actions">
              <button type="submit" className="primary-button" disabled={pwMutation.isPending}>
                {pwMutation.isPending ? <RefreshIcon size={14} /> : <LockIcon size={14} />}
                {pwMutation.isPending ? "Updating…" : "Update password"}
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title="Active Sessions"
          description="Devices and browsers currently signed into your account."
          footer={
            activeSessions.length > 1 ? (
              <button
                type="button"
                className="ghost-button danger"
                onClick={async () => {
                  if (!confirm("This will sign out all other devices. Continue?")) return;
                  await revokeAllMutation.mutateAsync();
                }}
                disabled={revokeAllMutation.isPending}
              >
                <LogoutIcon size={14} />
                Sign out all other devices
              </button>
            ) : undefined
          }
        >
          {sessionsLoading ? (
            <div className="skeleton-list">
              {[1, 2].map((i) => (
                <div key={i} className="skeleton skeleton-row" />
              ))}
            </div>
          ) : activeSessions.length === 0 ? (
            <p className="empty-state-hint">No active sessions found.</p>
          ) : (
            <ul className="session-list" role="list">
              {activeSessions.map((session) => (
                <li key={session.id} className="session-item">
                  <div className="session-icon" aria-hidden>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  </div>
                  <div className="session-details">
                    <p className="session-device">
                      {session.user_agent
                        ? session.user_agent.split(" ").slice(0, 2).join(" ")
                        : "Unknown device"}
                    </p>
                    <p className="session-meta">
                      {session.ip_address ?? "Unknown IP"} · Last active {formatDate(session.last_active_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ghost-button danger small"
                    onClick={() => revokeMutation.mutate(session.id)}
                    disabled={revokeMutation.isPending}
                    aria-label={`Sign out session from ${session.ip_address ?? "unknown device"}`}
                  >
                    <LogoutIcon size={12} />
                    Sign out
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </SettingsLayout>
    </AppLayout>
  );
}
