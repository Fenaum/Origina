// Header notification menu for workspace-level alerts.
// The store is mocked for now; this component already models unread state,
// mark-read behavior, and the dropdown layout expected from a live feed.
import { useEffect, useRef, useState } from "react";
import { useNotificationsStore, type AppNotification, type NotificationType } from "@/state/notificationsStore";

const TYPE_ICONS: Record<NotificationType, string> = {
  condition:  "CN",
  assignment: "AS",
  document:   "DC",
  status:     "ST",
  mention:    "@",
  ctc:        "CTC",
};

function timeAgo(iso: string): string {
  // Small relative timestamp helper for the compact notification list.
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotificationRow({ n, onRead }: { n: AppNotification; onRead: (id: string) => void }) {
  return (
    <div
      className={`notif-row${n.read ? "" : " notif-row--unread"}`}
      onClick={() => !n.read && onRead(n.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && !n.read && onRead(n.id)}
    >
      <span className="notif-icon" aria-hidden>{TYPE_ICONS[n.type]}</span>
      <div className="notif-content">
        <p className="notif-title">{n.title}</p>
        <p className="notif-body">{n.body}</p>
        {n.loanNumber && <span className="notif-loan">{n.loanNumber}</span>}
        <span className="notif-time">{timeAgo(n.createdAt)}</span>
      </div>
      {!n.read && <span className="notif-dot" aria-label="Unread" />}
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, markRead, markAllRead, clearAll } = useNotificationsStore();
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="notif-wrap" ref={ref}>
      <button
        type="button"
        className={`notif-bell${open ? " notif-bell--active" : ""}`}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="notif-badge" aria-hidden>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-panel-header">
            <span className="notif-panel-title">Notifications</span>
            <div className="notif-panel-actions">
              {unread > 0 && (
                <button type="button" className="notif-action-btn" onClick={markAllRead}>
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button type="button" className="notif-action-btn notif-action-btn--muted" onClick={clearAll}>
                  Clear all
                </button>
              )}
            </div>
          </div>

          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <span aria-hidden>NT</span>
                <p>No new notifications</p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationRow key={n.id} n={n} onRead={markRead} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
