import { useEffect, useRef, useState } from "react";
import { NotificationBell } from "@/components/app/NotificationBell";
import { roleLabels, PREVIEW_ROLES, type UserRole } from "@/types/auth";
import { useAuth } from "@/state/auth";

export function TopHeader() {
  const { user, effectiveRole, isPreviewMode, setPreviewRole, clearPreviewRole, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  if (!user || !effectiveRole) {
    return null;
  }

  const initials = user.name
    .split(" ")
    .map((p: string) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const workspaceLabel = isPreviewMode
    ? `${roleLabels[effectiveRole]} Workspace`
    : `${roleLabels[effectiveRole]} Workspace`;

  function handleSelectRole(role: UserRole) {
    setPreviewRole(role);
    setDropdownOpen(false);
  }

  function handleResetRole() {
    clearPreviewRole();
    setDropdownOpen(false);
  }

  return (
    <>
      {isPreviewMode && (
        <div className="preview-banner" role="alert" aria-live="polite">
          <span className="preview-banner-icon" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </span>
          Viewing as <strong>{roleLabels[effectiveRole]}</strong> — this is a preview only. Backend permissions remain unchanged.
          <button
            type="button"
            className="preview-banner-reset"
            onClick={clearPreviewRole}
          >
            Return to Admin View
          </button>
        </div>
      )}

      <header className="top-header">
        <div>
          <p className="eyebrow">{user.tenantName}</p>
          <h1>{workspaceLabel}</h1>
        </div>

        <div className="user-block">
          <NotificationBell />

          {user.role === "admin" && (
            <div className="role-switcher" ref={dropdownRef}>
              <button
                type="button"
                className={`role-switcher-trigger${isPreviewMode ? " is-active" : ""}`}
                onClick={() => setDropdownOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={dropdownOpen}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {isPreviewMode ? `Viewing as ${roleLabels[effectiveRole]}` : "Preview Role"}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="role-switcher-dropdown" role="listbox" aria-label="Preview role">
                  <div className="role-switcher-header">Preview Role</div>

                  {PREVIEW_ROLES.map((role) => (
                    <button
                      key={role}
                      type="button"
                      role="option"
                      aria-selected={effectiveRole === role}
                      className={`role-switcher-option${effectiveRole === role && isPreviewMode ? " selected" : ""}`}
                      onClick={() => handleSelectRole(role)}
                    >
                      {roleLabels[role]}
                    </button>
                  ))}

                  {isPreviewMode && (
                    <>
                      <div className="role-switcher-divider" />
                      <button
                        type="button"
                        className="role-switcher-option role-switcher-reset"
                        onClick={handleResetRole}
                      >
                        Return to Admin View
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="user-avatar" aria-label={user.name} title={user.name}>
            {initials}
          </div>
          <span className="user-name">{user.name}</span>
          <button className="ghost-button" type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
    </>
  );
}
