/**
 * Alerts inbox — Module 6 (part 2) of the Capital Markets Workspace PoC.
 *
 * Per §6.2 ("Alerts & tasks"): unified inbox of CM alerts. Filters by
 * status (open / ack / resolved). Acknowledge action wires to
 * `POST /cm/alerts/{id}/acknowledge`.
 *
 * Out of scope (per §14.1): notification fan-out beyond in-app list.
 */
import Link from "next/link";
import { useMemo, useState } from "react";

import { AppLayout } from "@/components/app/AppLayout";
import { ErrorState } from "@/components/feedback/ErrorState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useAcknowledgeAlert, useAlerts } from "@/hooks/useCm";
import type { UserRole } from "@/types/auth";
import type { CMAlertOut } from "@/types/api";

const CM_ALLOWED_ROLES: UserRole[] = ["capital_markets", "it_admin"];

const STATUS_TABS: Array<{ value: "open" | "ack" | "resolved"; label: string }> = [
  { value: "open", label: "Open" },
  { value: "ack", label: "Acknowledged" },
  { value: "resolved", label: "Resolved" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
}

export default function CMAlertsPage() {
  const [tab, setTab] = useState<"open" | "ack" | "resolved">("open");
  const alerts = useAlerts(tab);
  const ackMut = useAcknowledgeAlert();
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => alerts.data ?? [], [alerts.data]);

  async function onAck(a: CMAlertOut) {
    setError(null);
    try {
      await ackMut.mutateAsync(a.id);
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    }
  }

  return (
    <AppLayout allowedRoles={CM_ALLOWED_ROLES}>
      <PageHeader
        eyebrow="Capital Markets"
        title="Alerts"
        description="Unified CM alerts inbox — reprice-required, eligibility-lost, below-margin-floor."
      />

      <section className="panel" aria-label="Status selector">
        <header className="panel-heading">
          <h3>By status</h3>
          <span>{alerts.data?.length ?? 0} shown</span>
        </header>
        <div style={{ padding: "1rem 1.15rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={tab === t.value ? "nav-link active" : "nav-link"}
              style={{
                border: "1px solid var(--line)",
                borderRadius: "999px",
                padding: "0.25rem 0.75rem",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {error ? <ErrorState title="Action failed" description={error} /> : null}
      {alerts.isError ? (
        <ErrorState
          title="Could not load alerts"
          description={String((alerts.error as Error)?.message ?? alerts.error)}
        />
      ) : null}

      <section className="panel" aria-label="Alerts list">
        <header className="panel-heading">
          <h3>{tab.replace(/^./, (c) => c.toUpperCase())} alerts</h3>
          <span>{rows.length} entries</span>
        </header>
        <div className="status-list">
          {rows.map((a) => (
            <div key={a.id} className="status-row">
              <div className="status-row-main">
                <strong>{a.alert_type.replace(/_/g, " ")}</strong>
                <span>{a.message}</span>
                <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                  Raised {formatDate(a.raised_at)}
                  {a.acknowledged_at ? ` · ack ${formatDate(a.acknowledged_at)}` : ""}
                </span>
              </div>
              <div className="status-row-aside">
                {a.loan_id ? (
                  <Link
                    href={`/cm/loans/${a.loan_id}`}
                    className="nav-link"
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: "999px",
                      padding: "0.2rem 0.6rem",
                    }}
                  >
                    Open loan →
                  </Link>
                ) : null}
                {a.status === "open" ? (
                  <button
                    type="button"
                    onClick={() => onAck(a)}
                    disabled={ackMut.isPending}
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: "999px",
                      padding: "0.2rem 0.6rem",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    Acknowledge
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {rows.length === 0 && !alerts.isLoading ? (
            <div className="status-row" style={{ color: "var(--muted)" }}>
              <div className="status-row-main">
                <span>No {tab} alerts.</span>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </AppLayout>
  );
}
