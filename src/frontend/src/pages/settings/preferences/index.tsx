import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { SettingsLayout } from "@/components/settings/SettingsLayout";
import { SectionCard } from "@/components/settings/SectionCard";
import { useTheme, type ThemePreference } from "@/state/theme";

const PREF_SECTIONS = [
  {
    id: "display",
    label: "Display",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    meta: "Theme and density",
  },
  {
    id: "pipeline",
    label: "Pipeline",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
    meta: "Default views",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    meta: "Alerts and delivery",
  },
];

type ThemeOption = {
  value: ThemePreference;
  label: string;
  description: string;
  icon: React.ReactNode;
};

const SunIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

const MoonIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SystemIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: "light",
    label: "Light",
    description: "Bright surfaces, always.",
    icon: SunIcon,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Dim surfaces, easier on the eyes in low light.",
    icon: MoonIcon,
  },
  {
    value: "system",
    label: "Match system",
    description: "Follow your operating system setting.",
    icon: SystemIcon,
  },
];

type DisplayForm = {
  theme: ThemePreference;
  density: "comfortable" | "compact";
};

const DENSITY_FORM: DisplayForm = { theme: "system", density: "comfortable" };

function formFromUser(): DisplayForm {
  // Display prefs are client-only for now — server has no preferences column yet.
  return DENSITY_FORM;
}

export default function PreferencesPage() {
  const { preference, setPreference } = useTheme();

  // Local edits overlayed on top of the user's saved values.
  const [edits, setEdits] = useState<Partial<DisplayForm>>({});
  const form = useMemo<DisplayForm>(() => ({ ...formFromUser(), ...edits, theme: preference }), [edits, preference]);
  const baseline = useMemo<DisplayForm>(() => ({ ...formFromUser(), theme: preference }), [preference]);
  const isDirty = JSON.stringify(form) !== JSON.stringify(baseline);

  const [status, setStatus] = useState<"idle" | "saved" | "saving">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hide the temporary "Saved" indicator after a couple of seconds.
  useEffect(() => {
    if (status !== "saved") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setStatus("idle"), 1800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [status]);

  const handleSelectTheme = useCallback(
    (next: ThemePreference) => {
      setPreference(next);
      setEdits((prev) => ({ ...prev, theme: next }));
      setStatus("saved");
    },
    [setPreference],
  );

  const handleChange = <K extends keyof DisplayForm>(field: K, value: DisplayForm[K]) => {
    setEdits((prev) => ({ ...prev, [field]: value }));
    setStatus("saved");
  };

  return (
    <AppLayout>
      <SettingsLayout
        title="User Preferences"
        description="Personal defaults that change how Origina looks and behaves for you."
        sections={PREF_SECTIONS}
        isDirty={isDirty}
        lastSavedAt={status === "saved" ? new Date() : null}
        isSaving={status === "saving"}
      >
        <SectionCard
          title="Display"
          description="Choose how Origina looks on this device."
        >
          <fieldset className="theme-picker">
            <legend className="form-label">Theme</legend>
            <div className="theme-picker-options" role="radiogroup" aria-label="Color theme">
              {THEME_OPTIONS.map((opt) => {
                const isActive = form.theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={`theme-picker-option${isActive ? " is-active" : ""}`}
                    onClick={() => handleSelectTheme(opt.value)}
                  >
                    <span className="theme-picker-icon" aria-hidden>{opt.icon}</span>
                    <span className="theme-picker-body">
                      <span className="theme-picker-label">{opt.label}</span>
                      <span className="theme-picker-desc">{opt.description}</span>
                    </span>
                    <span className="theme-picker-check" aria-hidden>
                      {isActive && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="form-field">
            <label className="form-label" htmlFor="density">Density</label>
            <select
              id="density"
              className="form-select"
              value={form.density}
              onChange={(e) => handleChange("density", e.target.value as DisplayForm["density"])}
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </div>
        </SectionCard>

        <SectionCard
          title="Pipeline"
          description="Set the default landing view when you open the loan pipeline."
        >
          <div className="form-stack">
            <div className="form-field">
              <label className="form-label" htmlFor="default-stage">Default stage filter</label>
              <select id="default-stage" className="form-select" defaultValue="all">
                <option value="all">All loans</option>
                <option value="mine">My loans</option>
                <option value="submitted">Submitted</option>
                <option value="conditions_review">Conditions review</option>
                <option value="approved_pending">Approved pending</option>
              </select>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Notifications"
          description="Choose which Origina events send you an alert."
        >
          <div className="form-stack">
            {[
              { id: "n-submitted", label: "A loan is submitted to underwriting" },
              { id: "n-conditions", label: "Conditions are added to one of my loans" },
              { id: "n-decision", label: "An underwriting decision is issued" },
              { id: "n-funding", label: "A loan is funded" },
            ].map((n) => (
              <label key={n.id} className="toggle-label">
                <input type="checkbox" className="form-checkbox" defaultChecked />
                <span className="toggle-text">{n.label}</span>
              </label>
            ))}
          </div>
        </SectionCard>
      </SettingsLayout>
    </AppLayout>
  );
}
