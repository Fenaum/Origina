# Sprint 13 — Build Spec (DRAFT — refine at M2 gate)
## SSO & Security Round 2

> **Status:** rolling-wave draft. Promote during Sprint 12.
> **Milestone:** [M3 — Enterprise-Ready](MILESTONES.md) (sprint 3 of 5)
> **Sprint goal:** Enterprise lenders bring their own identity: OIDC login works alongside password auth, and the password path gets enterprise-grade policy (lockout, complexity, expiry, session management).

## Planned phases

- **13.1 OIDC:** per-tenant IdP config (issuer, client id/secret, domain hint) under Settings → Admin; authorization-code flow endpoints; JIT user provisioning with role mapping from IdP claims (mapped to Sprint 11 role bundles); the existing `origina_token` cookie session issued on successful OIDC login — downstream auth unchanged. SAML explicitly deferred (ADR) — OIDC covers Okta/Entra/Google; add SAML only when a real prospect requires it.
- **13.2 Password-path hardening:** configurable lockout after N failures (DB-backed, complements the per-IP rate limit), password policy (length/complexity/expiry per tenant), forced-reset flow, session inventory + revoke-all under Settings → Security.
- **13.3 Secrets & headers:** move `ADMIN_SECRET`/SMTP/S3 creds handling to a documented secrets story (env in dev, manager in prod — ADR); security headers middleware (CSP, HSTS, X-Frame-Options); dependency audit in CI (`pip-audit`, `npm audit` gate at high severity).

## Key decisions (ADRs)

SAML deferral · JIT provisioning vs pre-invite (probably JIT with domain allowlist) · session store (JWT-only today; revoke-all requires a token-version claim or server-side session table — decide here).

## B-gates (draft)

OIDC round-trip against a mock IdP in tests · lockout triggers and clears correctly · revoked sessions actually die · headers present on every response · CI dependency gate red on planted vuln fixture.
