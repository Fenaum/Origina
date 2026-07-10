/**
 * WorkspaceActivityRail — sticky right-rail for the loan workspace.
 *
 * UX principles in play (docs/UX_PRINCIPLES.md):
 *  - "Origina is a beautiful loan command center, not a module directory." The
 *    rail is a contextual surface INSIDE the loan file, not a separate dest.
 *  - Timeline metaphor (vertical spine + node dots) communicates chronology
 *    instantly without having to read timestamps.
 *  - Avatar monogram circles replace the plain "Actor · 28d ago" text so the
 *    eye lands on the person, not the timestamp.
 *  - Composer is a first-class action: clear focus state, primary CTA with
 *    icon, character counter when nearing the cap, Cmd+Enter shortcut hint.
 *  - Every screen must answer four questions (status / blocker / owner /
 *    next action). The composer + event body surfaces those answers.
 */
import { useState } from "react";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import type { ActivityEventOut, ActivityEventType } from "@/types/api";

type Props = {
  loanId: string;
  onClose: () => void;
};

const MAX_NOTE_LENGTH = 1000;

/** ── time formatting ─────────────────────────────────────────────────── */
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`;
}

function absoluteTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const dStart = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
  ).getTime();
  const diff = Math.round((todayStart - dStart) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) {
    return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(d);
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(d);
}

/** ── actor monogram ──────────────────────────────────────────────────── */
function initials(name: string | null): string {
  if (!name) return "•";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hashHue(name: string | null): number {
  // Stable color per actor: hash name to a hue so the same person always
  // gets the same monogram color across pages.
  const s = name ?? "system";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** ── event icons (real SVG, not single letters) ─────────────────────── */
function EventIcon({ type }: { type: ActivityEventType }) {
  const cls = `activity-event-icon activity-event-icon--${type}`;
  if (type === "note") {
    return (
      <span className={cls} aria-hidden>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </span>
    );
  }
  if (type === "status_change") {
    return (
      <span className={cls} aria-hidden>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    );
  }
  if (type === "condition_change") {
    return (
      <span className={cls} aria-hidden>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      </span>
    );
  }
  return (
    <span className={cls} aria-hidden>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    </span>
  );
}

/** ── day grouping ───────────────────────────────────────────────────── */
function groupByDay(events: ActivityEventOut[]) {
  const groups: { day: string; items: ActivityEventOut[] }[] = [];
  for (const e of events) {
    const day = dayLabel(e.occurred_at);
    const last = groups[groups.length - 1];
    if (last?.day === day) {
      last.items.push(e);
    } else {
      groups.push({ day, items: [e] });
    }
  }
  return groups;
}

/** ── main component ──────────────────────────────────────────────────── */
export function WorkspaceActivityRail({ loanId, onClose }: Props) {
  const { events, loading, error, postNote } = useActivityFeed(loanId);
  const [noteBody, setNoteBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const groups = events ? groupByDay(events) : [];
  const eventCount = events?.length ?? 0;

  async function handlePost() {
    const trimmed = noteBody.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    setPostError(null);
    try {
      await postNote(trimmed);
      setNoteBody("");
    } catch (e) {
      setPostError(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  }

  const trimmedLength = noteBody.trim().length;
  const isNearLimit = trimmedLength > MAX_NOTE_LENGTH * 0.85;

  return (
    <aside className="loan-workspace-activity-rail" aria-label="Loan activity">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="activity-rail-header">
        <div className="activity-rail-title-group">
          <h3 className="activity-rail-title">
            Activity
            {eventCount > 0 && (
              <span className="activity-rail-count" aria-label={`${eventCount} events`}>
                {eventCount}
              </span>
            )}
          </h3>
          <p className="activity-rail-subtitle">
            What happened on this loan
          </p>
        </div>
        <button
          type="button"
          className="activity-rail-close"
          onClick={onClose}
          aria-label="Close activity rail"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>

      {/* ── Feed ───────────────────────────────────────────────── */}
      <div className="activity-rail-feed" aria-live="polite" aria-busy={loading}>
        {loading && (
          <div className="activity-rail-state activity-rail-state--loading">
            <span className="activity-state-spinner" aria-hidden />
            <p>Loading activity…</p>
          </div>
        )}
        {error && !loading && (
          <div className="activity-rail-state activity-rail-state--error">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p>{error}</p>
            <p className="activity-state-help">Try refreshing the page.</p>
          </div>
        )}
        {!loading && !error && groups.length === 0 && (
          <div className="activity-rail-state activity-rail-state--empty">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="7" x2="12" y2="12" />
              <line x1="12" y1="15.5" x2="12" y2="15.51" />
            </svg>
            <p className="activity-state-title">No activity yet</p>
            <p className="activity-state-help">
              Be the first to leave a note for the team.
            </p>
          </div>
        )}

        {!loading && !error && groups.length > 0 && (
          <ol className="activity-timeline" role="list">
            {groups.map(({ day, items }) => (
              <li className="activity-day-group" key={day}>
                <div className="activity-day-label">
                  <span className="activity-day-pill">{day}</span>
                  <span className="activity-day-rule" aria-hidden />
                </div>
                <ul className="activity-day-events" role="list">
                  {items.map((e, idx) => {
                    const isLast = idx === items.length - 1;
                    const hue = hashHue(e.actor_name);
                    return (
                      <li className="activity-event" key={e.id}>
                        <div className="activity-event-spine" aria-hidden>
                          <span
                            className="activity-event-node"
                            data-type={e.event_type}
                            style={{
                              backgroundColor: `hsl(${hue} 65% 92%)`,
                              color: `hsl(${hue} 60% 28%)`,
                              borderColor: `hsl(${hue} 55% 78%)`,
                            }}
                            aria-hidden
                          >
                            <EventIcon type={e.event_type} />
                          </span>
                          {!isLast && <span className="activity-event-line" aria-hidden />}
                        </div>
                        <div className="activity-event-body">
                          <div className="activity-event-head">
                            <span
                              className="activity-event-avatar"
                              style={{
                                backgroundColor: `hsl(${hue} 55% 92%)`,
                                color: `hsl(${hue} 50% 28%)`,
                              }}
                              title={e.actor_name ?? "System"}
                              aria-hidden
                            >
                              {initials(e.actor_name)}
                            </span>
                            <span className="activity-event-detail">{e.detail}</span>
                          </div>
                          {e.body && (
                            <blockquote className="activity-event-quote">
                              {e.body}
                            </blockquote>
                          )}
                          <div className="activity-event-meta">
                            {e.actor_name && (
                              <span className="activity-event-actor">{e.actor_name}</span>
                            )}
                            <span
                              className="activity-event-time"
                              title={absoluteTime(e.occurred_at)}
                            >
                              {timeAgo(e.occurred_at)}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* ── Composer ──────────────────────────────────────────── */}
      <div
        className={
          "activity-composer" +
          (isFocused ? " activity-composer--focused" : "") +
          (isNearLimit ? " activity-composer--near-limit" : "")
        }
      >
        <label htmlFor="activity-composer-textarea" className="activity-composer-label">
          <span className="activity-composer-label-title">Add a note</span>
          <span className="activity-composer-label-hint">
            Visible to your team on this loan
          </span>
        </label>
        <textarea
          id="activity-composer-textarea"
          className="activity-composer-input"
          placeholder="Share an update, a blocker, or a question…"
          value={noteBody}
          maxLength={MAX_NOTE_LENGTH}
          onChange={(e) => setNoteBody(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handlePost();
            }
          }}
          aria-label="New note"
        />
        {postError && (
          <p className="activity-composer-error" role="alert">
            {postError}
          </p>
        )}
        <div className="activity-composer-footer">
          <span
            className={
              "activity-composer-counter" +
              (isNearLimit ? " activity-composer-counter--warn" : "")
            }
            aria-live="polite"
          >
            {noteBody.length} / {MAX_NOTE_LENGTH}
          </span>
          <button
            type="button"
            className="activity-composer-submit"
            onClick={() => void handlePost()}
            disabled={trimmedLength === 0 || posting}
          >
            {posting ? (
              <>
                <span className="activity-state-spinner activity-state-spinner--inline" aria-hidden />
                Posting…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                Post note
              </>
            )}
            <kbd className="activity-composer-kbd">Cmd+Enter</kbd>
          </button>
        </div>
      </div>
    </aside>
  );
}