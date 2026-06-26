import Link from "next/link";
import { AppLayout } from "@/components/app/AppLayout";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export type SettingsHubCard = {
  id: string;
  label: string;
  href: string;
  description: string;
  meta: string;
  icon: React.ReactNode;
  badge?: string;
  adminOnly?: boolean;
};

const ChevronRight = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ArrowRight = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const GearIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

type Props = {
  cards: SettingsHubCard[];
};

export function SettingsHub({ cards }: Props) {
  const { data: currentUser, isLoading } = useCurrentUser();

  const displayName = currentUser?.full_name ?? currentUser?.email ?? null;
  const roleLabel = currentUser?.roles[0]?.replace(/_/g, " ") ?? null;

  return (
    <AppLayout>
      <div className="settings-wrapper">
        <div className="settings-page-header">
          <p className="eyebrow">Settings</p>
          <h2>Workspace</h2>
          {isLoading ? (
            <p className="settings-user-hint">Loading…</p>
          ) : displayName ? (
            <p className="settings-user-hint">
              {displayName}
              {roleLabel && <span className="settings-user-role"> · {roleLabel}</span>}
            </p>
          ) : null}
        </div>

        <div className="settings-grid">
          {cards.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              className="settings-section-card"
              aria-label={`${card.label} settings`}
            >
              <div className="settings-card-header">
                <div className="settings-section-icon" aria-hidden>{card.icon}</div>
                <div className="settings-section-body">
                  <h3 className="settings-section-title">{card.label}</h3>
                  <p className="settings-section-meta">{card.meta}</p>
                </div>
              </div>
              <p className="settings-section-desc">{card.description}</p>
              <div className="settings-section-footer">
                {card.badge ? (
                  <span className="settings-section-pill">
                    {card.badge.toLowerCase() === "admin" ? GearIcon : ChevronRight}
                    {card.badge}
                  </span>
                ) : (
                  <span className="settings-section-pill">{ChevronRight}Manage</span>
                )}
                <span className="settings-section-arrow" aria-hidden>{ArrowRight}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
