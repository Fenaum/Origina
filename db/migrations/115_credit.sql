-- 115_credit.sql
-- Credit report, scores, liabilities, and credit events per loan.
-- Supports multiple report pulls; is_active marks the current report.

CREATE TABLE IF NOT EXISTS credit_reports (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    loan_id             UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,

    report_date         DATE,
    vendor              TEXT,
    reference_number    TEXT,
    external_ref        TEXT,

    -- Bureau scores
    equifax_score       INTEGER,
    experian_score      INTEGER,
    transunion_score    INTEGER,
    middle_score        INTEGER,
    rep_score           INTEGER,    -- representative / qualifying score

    is_active           BOOLEAN DEFAULT FALSE,
    archived_at         TIMESTAMPTZ,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_liabilities (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    loan_id             UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    credit_report_id    UUID REFERENCES credit_reports(id) ON DELETE SET NULL,

    tradeline_type      TEXT,   -- mortgage, auto, revolving, installment, student, other
    creditor_name       TEXT,
    account_number_last4 TEXT,
    balance             NUMERIC(14, 2),
    monthly_payment     NUMERIC(14, 2),
    credit_limit        NUMERIC(14, 2),
    is_excluded         BOOLEAN DEFAULT FALSE,
    paid_at_closing     BOOLEAN DEFAULT FALSE,
    omit_reason         TEXT,

    archived_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    loan_id             UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    credit_report_id    UUID REFERENCES credit_reports(id) ON DELETE SET NULL,

    event_type          TEXT NOT NULL, -- bankruptcy, foreclosure, short_sale, mortgage_late, consumer_late, collection, charge_off
    event_date          DATE,
    discharged_date     DATE,
    months_since        INTEGER,
    explanation         TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_reports_loan
    ON credit_reports (tenant_id, loan_id);
CREATE INDEX IF NOT EXISTS idx_credit_reports_active
    ON credit_reports (loan_id, is_active) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_credit_liabilities_loan
    ON credit_liabilities (tenant_id, loan_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_credit_events_loan
    ON credit_events (tenant_id, loan_id);

CREATE TRIGGER trg_credit_reports_updated_at
    BEFORE UPDATE ON credit_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_credit_liabilities_updated_at
    BEFORE UPDATE ON credit_liabilities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_credit_events_updated_at
    BEFORE UPDATE ON credit_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_credit_reports
    AFTER INSERT OR UPDATE OR DELETE ON credit_reports
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER trg_audit_credit_liabilities
    AFTER INSERT OR UPDATE OR DELETE ON credit_liabilities
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();
