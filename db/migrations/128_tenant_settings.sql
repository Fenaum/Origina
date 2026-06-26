-- Migration 128: Extend tenants table with workspace/org settings fields
-- Adds: logo_url, primary_color, support_email, business_hours JSONB,
--        audit_retention_days, password_policy JSONB, mfa_required,
--        sso_config JSONB, defaults JSONB
BEGIN;

ALTER TABLE tenants
  ADD COLUMN logo_url              TEXT,
  ADD COLUMN primary_color        TEXT        NOT NULL DEFAULT '#4ade80',
  ADD COLUMN support_email        TEXT,
  ADD COLUMN business_hours       JSONB       NOT NULL DEFAULT '{"timezone":"America/Chicago","monday":"09:00-17:00","tuesday":"09:00-17:00","wednesday":"09:00-17:00","thursday":"09:00-17:00","friday":"09:00-17:00","saturday":null,"sunday":null}',
  ADD COLUMN audit_retention_days INTEGER     NOT NULL DEFAULT 2555,  -- ~7 years
  ADD COLUMN password_policy      JSONB       NOT NULL DEFAULT '{"min_length":12,"require_uppercase":true,"require_lowercase":true,"require_digit":true,"require_special":true,"max_age_days":90}',
  ADD COLUMN mfa_required          BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN sso_config           JSONB       NOT NULL DEFAULT '{"enabled":false,"provider":"","domain":""}',
  ADD COLUMN defaults              JSONB       NOT NULL DEFAULT '{}';

COMMENT ON COLUMN tenants.logo_url             IS 'URL to organization logo';
COMMENT ON COLUMN tenants.primary_color       IS 'Brand primary color (hex)';
COMMENT ON COLUMN tenants.support_email       IS 'Support contact email';
COMMENT ON COLUMN tenants.business_hours      IS 'Business hours per day of week (IANA timezone in object)';
COMMENT ON COLUMN tenants.audit_retention_days IS 'Days to retain audit log entries';
COMMENT ON COLUMN tenants.password_policy     IS 'Password requirements: min_length, require_uppercase, require_lowercase, require_digit, require_special, max_age_days';
COMMENT ON COLUMN tenants.mfa_required        IS 'Require all users to have MFA enabled';
COMMENT ON COLUMN tenants.sso_config          IS 'SSO/OIDC config: enabled, provider, domain, client_id, issuer_url';
COMMENT ON COLUMN tenants.defaults            IS 'Tenant-wide defaults: default_pipeline_view, default_loan_program, etc.';

COMMIT;
