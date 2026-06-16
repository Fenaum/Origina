-- 116_escrow.sql
-- Escrow/title company coordination, settlement, and closing fund tracking.

CREATE TABLE IF NOT EXISTS escrow_details (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    loan_id                 UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,

    -- Contact
    company_name            TEXT,
    officer_name            TEXT,
    officer_email           TEXT,
    officer_phone           TEXT,
    company_address         TEXT,

    -- Transaction
    escrow_number           TEXT,
    contract_date           DATE,
    closing_date            DATE,
    settlement_agent        TEXT,
    earnest_money_deposit   NUMERIC(14, 2),
    wire_instructions_status TEXT DEFAULT 'pending',  -- pending, received, verified

    -- Settlement amounts
    estimated_cash_to_close NUMERIC(14, 2),
    verified_cash_to_close  NUMERIC(14, 2),
    seller_credits          NUMERIC(14, 2),
    lender_credits          NUMERIC(14, 2),
    third_party_fees        NUMERIC(14, 2),
    escrow_balance          NUMERIC(14, 2),

    -- Checklist flags
    closing_protection_letter BOOLEAN DEFAULT FALSE,
    settlement_stmt_reviewed  BOOLEAN DEFAULT FALSE,
    wire_verified             BOOLEAN DEFAULT FALSE,

    notes                   TEXT,
    archived_at             TIMESTAMPTZ,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_escrow_details_loan
    ON escrow_details (loan_id) WHERE archived_at IS NULL;

CREATE TRIGGER trg_escrow_details_updated_at
    BEFORE UPDATE ON escrow_details
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_escrow_details
    AFTER INSERT OR UPDATE OR DELETE ON escrow_details
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();
