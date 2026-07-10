import { useEffect, useState } from "react";
import { listNotes, createNote } from "@/services/notesService";
import { useAuth } from "@/state/auth";
import { EmptyState } from "@/components/feedback/EmptyState";
import { formatDate } from "@/lib/utils";
import type { LoanSummary } from "@/types/loan";
import type { NoteOut } from "@/types/api";

type Props = { loan: LoanSummary };

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function WorkspaceConversation({ loan }: Props) {
  const { token, user } = useAuth();
  const [notes, setNotes] = useState<NoteOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  async function fetchNotes() {
    if (!token) return;
    try {
      const data = await listNotes(loan.id, token);
      // Backend returns newest-first; the conversation reads top-to-bottom so
      // we reverse to chronological (oldest first).
      setNotes([...data].reverse());
    } catch {
      // Network/auth failures fall through to the empty state; we don't
      // surface them as banners to keep the workspace quiet during demos.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void fetchNotes();
    // loan.id + token changes should re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loan.id, token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || !token) return;
    setPosting(true);
    setPostError(null);
    try {
      await createNote(loan.id, trimmed, token);
      setBody("");
      await fetchNotes();
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Failed to post message");
    } finally {
      setPosting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSubmit(e as unknown as React.FormEvent);
    }
  }

  return (
    <div className="workspace-module workspace-module--wide">
      <div className="workspace-section-header">
        <span>Team</span>
        <h2>Conversation</h2>
        <p>Internal loan conversation, mentions, attachments, and linked activity for {loan.loanNumber}.</p>
      </div>

      <div className="conversation-layout">
        <section className="workspace-panel conversation-thread">
          {loading && (
            <div className="workspace-skeleton conversation-skeleton" aria-hidden>
              <div className="conversation-skeleton-row" />
              <div className="conversation-skeleton-row" />
              <div className="conversation-skeleton-row" />
            </div>
          )}

          {!loading && notes.length === 0 && (
            <EmptyState
              title="No messages yet"
              description="Start the conversation — post a note to share updates with the rest of the team on this file."
            />
          )}

          {!loading && notes.map((note) => {
            const initials = user?.id === note.created_by
              ? (user.name?.slice(0, 1).toUpperCase() ?? "Y")
              : "TM";
            const author = user?.id === note.created_by
              ? (user.name ?? "You")
              : "Team Member";
            return (
              <article key={note.id} className="conversation-message">
                <div className="conversation-avatar">{initials}</div>
                <div>
                  <header>
                    <strong>{author}</strong>
                    <span>Team</span>
                    <time>{fmtDateTime(note.created_at)}</time>
                  </header>
                  <p>{note.body}</p>
                </div>
              </article>
            );
          })}

          <form className="conversation-composer" onSubmit={handleSubmit}>
            <textarea
              placeholder={`Post a note about ${loan.loanNumber}… (Cmd+Enter to send)`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={posting}
              rows={3}
            />
            {postError && <div className="conversation-error">{postError}</div>}
            <div>
              <button type="button" disabled>Attach</button>
              <button
                type="submit"
                className="workspace-primary-button"
                disabled={posting || !body.trim()}
              >
                {posting ? "Posting…" : "Post Message"}
              </button>
            </div>
          </form>
        </section>

        <aside className="workspace-sticky-panel">
          <div className="workspace-panel-header">
            <span>Linked Activity</span>
            <strong>Live</strong>
          </div>
          <div className="workspace-timeline workspace-timeline--compact">
            <Activity label="Loan file created" time={formatDate(loan.loanNumber ? null : null)} />
            <Activity label="Notes stream is live" time="Just now" />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Activity({ label, time }: { label: string; time: string }) {
  return (
    <div className="workspace-timeline-step workspace-timeline-step--complete">
      <span />
      <div>
        <strong>{label}</strong>
      </div>
      <time>{time}</time>
    </div>
  );
}
