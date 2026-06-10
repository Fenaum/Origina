-- Borrower intake sessions, answers, and handoff leads.
-- Anonymous pre-application flow. Keep these records disposable and low-PII.

CREATE TABLE IF NOT EXISTS intake_sessions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    ip_address   INET,
    user_agent   TEXT
);

CREATE TABLE IF NOT EXISTS intake_answers (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   UUID NOT NULL REFERENCES intake_sessions(id) ON DELETE CASCADE,
    question_key TEXT NOT NULL,
    value        TEXT NOT NULL,
    answered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, question_key)
);

CREATE TABLE IF NOT EXISTS intake_handoffs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   UUID NOT NULL REFERENCES intake_sessions(id),
    name         TEXT NOT NULL,
    email        TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    contacted_at TIMESTAMPTZ,
    outcome      TEXT
);

CREATE INDEX IF NOT EXISTS idx_intake_answers_session
    ON intake_answers(session_id);

CREATE INDEX IF NOT EXISTS idx_intake_handoffs_email
    ON intake_handoffs(email);

CREATE INDEX IF NOT EXISTS idx_intake_sessions_tenant
    ON intake_sessions(tenant_id, created_at DESC);
