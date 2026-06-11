import type { LoanSummary } from "@/types/loan";

type Props = { loan: LoanSummary };

const MESSAGES = [
  {
    id: "msg-1",
    author: "Morgan Lee",
    role: "Processor",
    time: "Today 9:18 AM",
    body: "Bank statements were uploaded. I linked the file to condition INC-004 for review.",
  },
  {
    id: "msg-2",
    author: "Avery Brooks",
    role: "Underwriter",
    time: "Today 10:02 AM",
    body: "Please confirm whether the business account deposits are net of transfers before final income sign-off.",
  },
  {
    id: "msg-3",
    author: "Jordan Kim",
    role: "Account Manager",
    time: "Today 10:27 AM",
    body: "Broker has been notified. Waiting on updated CPA letter and current asset statement.",
  },
];

export function WorkspaceConversation({ loan }: Props) {
  return (
    <div className="workspace-module workspace-module--wide">
      <div className="workspace-section-header">
        <span>Team</span>
        <h2>Conversation</h2>
        <p>Internal loan conversation, mentions, attachments, and linked activity for {loan.loanNumber}.</p>
      </div>

      <div className="conversation-layout">
        <section className="workspace-panel conversation-thread">
          {MESSAGES.map((message) => (
            <article key={message.id} className="conversation-message">
              <div className="conversation-avatar">{message.author.slice(0, 1)}</div>
              <div>
                <header>
                  <strong>{message.author}</strong>
                  <span>{message.role}</span>
                  <time>{message.time}</time>
                </header>
                <p>{message.body}</p>
              </div>
            </article>
          ))}

          <div className="conversation-composer">
            <textarea placeholder="Write an internal message. Mentions and attachments will be connected later." />
            <div>
              <button type="button">Attach</button>
              <button type="button" className="workspace-primary-button">Post Message</button>
            </div>
          </div>
        </section>

        <aside className="workspace-sticky-panel">
          <div className="workspace-panel-header">
            <span>Linked Activity</span>
            <strong>Live</strong>
          </div>
          <div className="workspace-timeline workspace-timeline--compact">
            <Activity label="Condition INC-004 opened" time="9:16 AM" />
            <Activity label="Document uploaded" time="9:18 AM" />
            <Activity label="UW review note added" time="10:02 AM" />
            <Activity label="Broker follow-up sent" time="10:27 AM" />
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
