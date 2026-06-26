# Integrations and Scalability

> Part of [Architecture Index](README.md)

---

## Current Integrations

| System | Status | Notes |
|---|---|---|
| PostgreSQL | Live | Docker in dev, AWS RDS in prod |
| JWT auth | Live | python-jose + bcrypt 4.0.1 (pinned — passlib incompatible with 4.1+) |
| S3 document storage | Planned | Simulated with setTimeout in dev |
| MISMO XML parsing | Stub | Frontend placeholder, backend not implemented |
| Pricing engine | None | Hardcoded rate scenarios in frontend |
| Email notifications | None | Tables exist, no send mechanism yet |

---

## Planned Integrations

- AWS S3 — real document upload via presigned URLs
- Email via SES — handoff notifications, status change alerts
- Plaid-style asset/income verification (Phase 3+)
- eSign / eDisclosures (Phase 3+)

---

## Scalability Considerations

### What needs attention before scale

| Item | When | Solution |
|---|---|---|
| Pagination on all list endpoints | Before > 500 loans | `skip`/`limit` params + `total` count in response |
| JWT → httpOnly cookie | Before production | Server-side session; eliminates XSS token theft vector |
| CORS `allow_origins=["*"]` | Before any external access | Lock to actual frontend domain |
| JWT secret in code | Before staging | Load from environment variable |

### Multi-tenant SaaS

The `controlled_values` architecture was designed for this. Adding a new lender tenant requires:
1. `INSERT INTO tenants`
2. `INSERT INTO users` with `tenant_id`
3. Optionally: `INSERT INTO controlled_values` rows to override labels or add custom values

No migrations, no deploys, no code changes needed for tenant customization.

### Database Scaling Path

- All list queries have partial indexes on `(tenant_id, status)` and similar
- LATERAL JOIN pipeline query scales linearly
- `loan_financials` and `loan_terms` satellite tables allow column-level partitioning if needed
- `audit_log` will become the largest table — archiving strategy needed at scale (partition by `created_at`)
