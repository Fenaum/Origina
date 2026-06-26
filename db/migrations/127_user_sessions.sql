-- Migration 127: user_sessions — tracks active browser/app sessions per user
-- Used by the Security settings page to show "active sessions" and "revoke".
BEGIN;

CREATE TABLE user_sessions (
    id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    ip_address      TEXT,
    user_agent      TEXT,
    last_active_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_sessions_user_id      ON user_sessions (user_id);
CREATE INDEX idx_user_sessions_tenant_id   ON user_sessions (tenant_id);
CREATE INDEX idx_user_sessions_revoked_at  ON user_sessions (revoked_at) WHERE revoked_at IS NULL;

COMMENT ON TABLE user_sessions IS 'Tracks active sessions for the Security settings page.';

COMMIT;
