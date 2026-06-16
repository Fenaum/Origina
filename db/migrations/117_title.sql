-- 117_title.sql
-- Title order, vesting, lien/exception grid, legal review, and clearance tracking.

CREATE TABLE IF NOT EXISTS title_orders (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    loan_id                 UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,

    -- Title company
    company_name            TEXT,
    officer_name            TEXT,
    officer_email           TEXT,
    officer_phone           TEXT,

    -- Order tracking
    ordered_date            DATE,
    commitment_received_date DATE,
    title_status            TEXT DEFAULT 'not_ordered', -- not_ordered, ordered, received, cleared, exception
    external_ref            TEXT,

    -- Vesting
    borrower_vesting        TEXT,
    ownership_type          TEXT,   -- sole_ownership, joint_tenants, tenants_in_common, community_property, trust, entity
    entity_vesting          TEXT,
    vesting_notes           TEXT,

    -- Clearance
    cleared_date            DATE,
    cleared_by              UUID REFERENCES users(id) ON DELETE SET NULL,
    funding_blocked         BOOLEAN DEFAULT FALSE,
    funding_block_reason    TEXT,

    -- Legal review
    legal_review_required   BOOLEAN DEFAULT FALSE,
    legal_reviewer          TEXT,
    legal_review_status     TEXT,   -- pending, in_review, approved, exception
    legal_review_notes      TEXT,

    notes                   TEXT,
    archived_at             TIMESTAMPTZ,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS title_exceptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    loan_id             UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    title_order_id      UUID REFERENCES title_orders(id) ON DELETE CASCADE,

    exception_type      TEXT NOT NULL,  -- lien, judgment, tax_lien, ucc, easement, covenant, other
    description         TEXT,
    holder_name         TEXT,
    amount              NUMERIC(14, 2),
    exception_status    TEXT DEFAULT 'open',  -- open, subordinated, payoff_required, cleared, waived
    resolution          TEXT,
    cleared_date        DATE,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_title_orders_loan
    ON title_orders (tenant_id, loan_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_title_exceptions_order
    ON title_exceptions (title_order_id) WHERE exception_status != 'cleared';

CREATE TRIGGER trg_title_orders_updated_at
    BEFORE UPDATE ON title_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_title_exceptions_updated_at
    BEFORE UPDATE ON title_exceptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_title_orders
    AFTER INSERT OR UPDATE OR DELETE ON title_orders
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();
CREATE TRIGGER trg_audit_title_exceptions
    AFTER INSERT OR UPDATE OR DELETE ON title_exceptions
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();
