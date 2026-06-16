-- 114_appraisal.sql
-- Appraisal order tracking, valuation, and review per loan.
-- Supports multiple appraisal orders; is_primary marks the active one.

CREATE TABLE IF NOT EXISTS appraisal_orders (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    loan_id          UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,

    -- Order
    ordered_date     DATE,
    ordered_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    vendor_name      TEXT,
    appraiser_name   TEXT,
    external_ref     TEXT,
    due_date         DATE,
    inspection_date  DATE,
    received_date    DATE,

    -- Valuation
    appraised_value  NUMERIC(14, 2),
    purchase_price   NUMERIC(14, 2),
    appraisal_type   TEXT,                 -- full, drive-by, desktop, avm
    property_condition TEXT,              -- excellent, good, average, fair, poor

    -- Review
    review_status    TEXT DEFAULT 'pending',  -- pending, in_review, cleared, reconsideration
    reviewed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    review_date      DATE,
    has_rov          BOOLEAN DEFAULT FALSE,   -- reconsideration of value
    second_appraisal BOOLEAN DEFAULT FALSE,
    review_notes     TEXT,

    is_primary       BOOLEAN DEFAULT FALSE,
    archived_at      TIMESTAMPTZ,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appraisal_orders_loan
    ON appraisal_orders (tenant_id, loan_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_orders_primary
    ON appraisal_orders (loan_id, is_primary) WHERE archived_at IS NULL;

CREATE TRIGGER trg_appraisal_orders_updated_at
    BEFORE UPDATE ON appraisal_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_appraisal_orders
    AFTER INSERT OR UPDATE OR DELETE ON appraisal_orders
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();
