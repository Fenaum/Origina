-- Migration 126: Extend users table with profile/preferences/notification fields
-- Adds: phone, title, avatar_url, locale, timezone, preferences JSONB,
--        notification_preferences JSONB, mfa_enabled, signature, bio
BEGIN;

ALTER TABLE users
  ADD COLUMN phone               TEXT,
  ADD COLUMN title               TEXT,
  ADD COLUMN avatar_url          TEXT,
  ADD COLUMN locale              TEXT        NOT NULL DEFAULT 'en-US',
  ADD COLUMN timezone            TEXT        NOT NULL DEFAULT 'America/Chicago',
  ADD COLUMN preferences         JSONB       NOT NULL DEFAULT '{}',
  ADD COLUMN notification_preferences JSONB  NOT NULL DEFAULT '{"email_digest":"daily","mention_alerts":true,"escalation_alerts":true,"quiet_hours_enabled":false}',
  ADD COLUMN mfa_enabled         BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN signature           TEXT,
  ADD COLUMN bio                 TEXT;

COMMENT ON COLUMN users.phone                   IS 'User phone number';
COMMENT ON COLUMN users.title                   IS 'Job title (e.g. Senior Loan Officer)';
COMMENT ON COLUMN users.avatar_url              IS 'URL to avatar image';
COMMENT ON COLUMN users.locale                   IS 'IETF BCP 47 locale string';
COMMENT ON COLUMN users.timezone                IS 'IANA timezone string';
COMMENT ON COLUMN users.preferences             IS 'Generic UI preferences: density, default_view, reduced_motion, etc.';
COMMENT ON COLUMN users.notification_preferences IS 'Notification delivery preferences: email_digest, slack_webhook, quiet_hours, etc.';
COMMENT ON COLUMN users.mfa_enabled             IS 'Whether MFA is enabled for this user';
COMMENT ON COLUMN users.signature               IS 'Email/document signature text';
COMMENT ON COLUMN users.bio                     IS 'Short user bio';

CREATE INDEX idx_users_locale          ON users (locale);
CREATE INDEX idx_users_timezone        ON users (timezone);
CREATE INDEX idx_users_mfa_enabled     ON users (mfa_enabled);

COMMIT;
