import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { NotificationBell } from "@/components/app/NotificationBell";
import { roleLabels, PREVIEW_ROLES, type UserRole } from "@/types/auth";
import { useAuth } from "@/state/auth";
import { useTheme } from "@/state/theme";

export function TopHeader() {
  const { user, effectiveRole, isPreviewMode, setPreviewRole, clearPreviewRole, logout } = useAuth();
  const { preference, resolvedTheme, cycle } = useTheme();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (userMenuOpen && userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
      if (roleMenuOpen && roleMenuRef.current && !roleMenuRef.current.contains(target)) {
        setRoleMenuOpen(false);
      }
    }
    if (userMenuOpen || roleMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen, roleMenuOpen]);

  if (!user || !effectiveRole) {
    return null;
  }

  const initials = user.name
    .split(" ")
    .map((p: string) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const workspaceLabel = `${roleLabels[effectiveRole]} Workspace`;

  function handleSelectRole(role: UserRole) {
    setPreviewRole(role);
    setRoleMenuOpen(false);
  }

  function handleResetRole() {
    clearPreviewRole();
    setRoleMenuOpen(false);
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
            <div className="role-switcher" ref={roleMenuRef}>
              <button
                type="button"
                className={`role-switcher-trigger${isPreviewMode ? " is-active" : ""}`}
                onClick={() => setRoleMenuOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={roleMenuOpen}
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

              {roleMenuOpen && (
                <div className="role-switcher-dropdown" role="listbox" aria-label="Preview as role">
                  <div className="role-switcher-header">
                    Preview as another role
                  </div>
                  {PREVIEW_ROLES.map((role) => {
                    const isSelected = effectiveRole === role && isPreviewMode;
                    return (
                      <button
                        key={role}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`role-switcher-option${isSelected ? " selected" : ""}`}
                        onClick={() => handleSelectRole(role)}
                      >
                        <span>{roleLabels[role]}</span>
                        {isSelected && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                  {isPreviewMode && (
                    <>
                      <div className="role-switcher-divider" />
                      <button
                        type="button"
                        className="role-switcher-reset"
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

          <div className="user-menu" ref={userMenuRef}>
            <button
              type="button"
              className="user-menu-trigger"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              aria-label={`Account menu for ${user.name}`}
            >
              <div className="user-avatar" aria-hidden>{initials}</div>
              <span className="user-name">{user.name}</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {userMenuOpen && (
              <div className="user-menu-dropdown" role="menu">
                <div className="user-menu-header">
                  <p className="user-menu-name">{user.name}</p>
                  <p className="user-menu-email">{user.email}</p>
                </div>
                <div className="user-menu-divider" />

                <p className="user-menu-section-label">Account</p>
                <Link href="/settings/account" className="user-menu-item" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Profile
                </Link>
                <Link href="/settings/account#sessions" className="user-menu-item" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Security
                </Link>
                <Link href="/settings/preferences" className="user-menu-item" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
                  </svg>
                  Preferences
                </Link>

                {user.role === "admin" && (
                  <Link href="/settings/admin" className="user-menu-item" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    Admin
                  </Link>
                )}

                <button
                  type="button"
                  className="user-menu-theme"
                  onClick={() => { cycle(); setUserMenuOpen(false); }}
                  aria-label={`Switch color theme (current: ${preference})`}
                >
                  <span className="user-menu-theme-icon" aria-hidden>
                    {resolvedTheme === "dark" ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                      </svg>
                    )}
                  </span>
                  <span className="user-menu-theme-body">
                    <span className="user-menu-theme-label">
                      {resolvedTheme === "dark" ? "Dark" : "Light"} mode
                    </span>
                    <span className="user-menu-theme-current">
                      Preference: {preference === "system" ? "Match system" : preference === "dark" ? "Dark" : "Light"}
                    </span>
                  </span>
                  <span className="user-menu-theme-action">
                    {preference === "light" ? "Dark" : preference === "dark" ? "Auto" : "Light"}
                  </span>
                </button>

                <div className="user-menu-divider" />
                <button
                  type="button"
                  className="user-menu-item danger"
                  role="menuitem"
                  onClick={() => { logout(); setUserMenuOpen(false); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
