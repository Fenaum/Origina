import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useMemo } from "react";
import { CheckIcon, ChevronLeftIcon, RefreshIcon } from "./icons";

export type NavSection = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  meta?: string;
};

type Props = {
  children: React.ReactNode;
  title: string;
  description?: string;
  lastSavedAt?: Date | null;
  onSave?: () => void;
  onCancel?: () => void;
  isSaving?: boolean;
  isDirty?: boolean;
  sections?: NavSection[];
  actions?: React.ReactNode;
};

export function SettingsLayout({
  children,
  title,
  description,
  lastSavedAt,
  onSave,
  onCancel,
  isSaving,
  isDirty,
  sections = [],
  actions,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const activeSection = router.query.section as string | undefined;

  const filteredSections = useMemo(() => {
    if (!search) return sections;
    const q = search.toLowerCase();
    return sections.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.meta?.toLowerCase().includes(q)
    );
  }, [sections, search]);

  function handleSectionClick(id: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("section", id);
    router.push(url.pathname + url.search, undefined, { shallow: true });
  }

  return (
    <div className="settings-layout">
      {/* Page header */}
      <div className="settings-layout-header">
        <div className="settings-layout-header-left">
          <Link href="/settings" className="settings-breadcrumb">
            <ChevronLeftIcon size={12} />
            All settings
          </Link>
          <p className="eyebrow">Settings</p>
          <h1>{title}</h1>
          {description && <p className="settings-layout-description">{description}</p>}
        </div>
        {lastSavedAt && (
          <p className="settings-layout-saved">
            <span className={`save-dot ${isDirty ? "is-dirty" : "is-saved"}`} aria-hidden />
            Saved {formatRelative(lastSavedAt)}
          </p>
        )}
        {actions && <div className="settings-layout-header-actions">{actions}</div>}
      </div>

      {/* Two-column layout */}
      <div className="settings-layout-body">
        {/* In-page rail */}
        {sections.length > 0 && (
          <aside className="settings-rail" aria-label="Settings sections">
            {sections.length > 4 && (
              <div className="settings-rail-search">
                <input
                  type="search"
                  placeholder="Filter sections…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Filter settings sections"
                  className="settings-rail-search-input"
                />
              </div>
            )}
            <nav>
              <ul className="settings-rail-list" role="list">
                {filteredSections.map((section) => {
                  const isActive = section.id === activeSection || (!activeSection && section.id === sections[0]?.id);
                  return (
                    <li key={section.id}>
                      <button
                        type="button"
                        className={`settings-rail-item${isActive ? " is-active" : ""}`}
                        onClick={() => handleSectionClick(section.id)}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {section.icon && (
                          <span className="settings-rail-icon" aria-hidden>{section.icon}</span>
                        )}
                        <span className="settings-rail-label">{section.label}</span>
                        {section.meta && (
                          <span className="settings-rail-meta">{section.meta}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>
        )}

        {/* Content */}
        <main className="settings-content" id="main-content">
          {children}
        </main>
      </div>

      {/* Sticky save bar */}
      {isDirty && (onSave || onCancel) && (
        <div className="save-bar" role="status" aria-live="polite">
          <div className="save-bar-left">
            <span className="save-dot is-dirty" aria-hidden />
            <span>Unsaved changes</span>
          </div>
          <div className="save-bar-actions">
            {onCancel && (
              <button type="button" className="ghost-button" onClick={onCancel}>
                Cancel
              </button>
            )}
            {onSave && (
              <button
                type="button"
                className="primary-button"
                onClick={onSave}
                disabled={isSaving}
              >
                {isSaving ? <RefreshIcon size={14} /> : <CheckIcon size={14} />}
                {isSaving ? "Saving…" : "Save changes"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelative(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}
