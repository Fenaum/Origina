import { useState } from "react";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import type { ActivityEventOut, ActivityEventType } from "@/types/api";

type Props = {
  loanId: string;
  onClose: () => void;
};

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

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((todayStart - dStart) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

function iconLabel(type: ActivityEventType): string {
  if (type === "note") return "N";
  if (type === "status_change") return "S";
  if (type === "condition_change") return "C";
  return "D";
}

function iconMod(type: ActivityEventType): string {
  if (type === "note") return "note";
  if (type === "status_change") return "status";
  if (type === "condition_change") return "condition";
  return "document";
}

function groupByDay(events: ActivityEventOut[]): { day: string; items: ActivityEventOut[] }[] {
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

export function WorkspaceActivityRail({ loanId, onClose }: Props) {
  const { events, loading, error, postNote } = useActivityFeed(loanId);
  const [noteBody, setNoteBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  async function handlePost() {
    if (!noteBody.trim() || posting) return;
    setPosting(true);
    setPostError(null);
    try {
      await postNote(noteBody);
      setNoteBody("");
    } catch (e) {
      setPostError(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  }

  const groups = events ? groupByDay(events) : [];

  return (
    <aside className="loan-workspace-activity-rail" aria-label="Loan activity">
      <div className="activity-rail-header">
        <h3>Activity</h3>
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
      </div>

      <div className="activity-rail-feed" aria-live="polite">
        {loading && <p className="activity-rail-empty">Loading…</p>}
        {error && <p className="activity-rail-empty activity-rail-error">{error}</p>}
        {!loading && groups.length === 0 && !error && (
          <p className="activity-rail-empty">No activity yet.</p>
        )}

        {groups.map(({ day, items }) => (
          <div className="activity-day-group" key={day}>
            <p className="activity-day-label">{day}</p>
            {items.map((e) => (
              <div key={e.id} className="activity-event">
                <span
                  className={`activity-event-icon activity-event-icon--${iconMod(e.event_type)}`}
                  aria-hidden
                >
                  {iconLabel(e.event_type)}
                </span>
                <div className="activity-event-body">
                  <p className="activity-event-detail">{e.detail}</p>
                  {e.body && (
                    <p className="activity-event-text">{e.body}</p>
                  )}
                  <p className="activity-event-meta">
                    {e.actor_name ? `${e.actor_name} · ` : ""}
                    {timeAgo(e.occurred_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="activity-composer">
        <textarea
          className="activity-composer-input"
          placeholder="Post a note… (⌘↵ to send)"
          value={noteBody}
          onChange={(e) => setNoteBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              void handlePost();
            }
          }}
          aria-label="New note"
        />
        {postError && <p className="activity-post-error">{postError}</p>}
        <div className="activity-composer-footer">
          <button
            type="button"
            className="activity-post-button"
            onClick={() => void handlePost()}
            disabled={!noteBody.trim() || posting}
          >
            {posting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </aside>
  );
}
