# Origina Program Plan — Milestones & Sprint Map

> **Owner (Technical PM):** Raymond · **Program/Product framing:** this document
> **Cadence:** a milestone every 5 sprints, closed by an owner-run UAT + go/no-go gate.
> **Sources:** [ROADMAP.md — Long-Term Phase Roadmap](../ROADMAP.md#long-term-phase-roadmap), [PROGRAM_STRATEGY.md](../PROGRAM_STRATEGY.md), [DECISIONS.md](../DECISIONS.md).
> Sprint-level detail lives in `sprint-N-build-spec.md`. Specs for the *current* milestone are implementable; specs for the *next* milestone are rolling-wave drafts refined at the preceding gate.

---

## Milestone map

| Milestone | Sprints | Theme | One-line objective | Gate (owner UAT + exit criteria) | Status |
|---|---|---|---|---|---|
| **M1 — Pilot-Ready** | 1–5 | Foundation | One real lender can run loans end-to-end on secure, tested rails | UAT-1 (in progress): demo flow clean, CI green on every PR, zero P0s | ✅ Built · 🔄 UAT |
| **M2 — Operational Depth** | 6–10 | The daily workflows | A pilot lender processes a loan **start-to-fund without leaving Origina** | UAT-2: full loan lifecycle (intake → URLA → docs → processing → decision → funding) executed by a non-developer | 📋 Planned |
| **M3 — Enterprise-Ready** | 11–15 | Multi-lender confidence | Three tenants can run concurrently with org structure, SLAs, SSO, and audit exports | UAT-3: 3-tenant simulation, SSO login, SLA alerts firing, audit export delivered | 📋 Outlined |

Beyond M3 (per the phase roadmap, not yet sprint-planned): **M4 — Platform** (public API, webhooks, first CRM integration) and **M5 — Engines & AI** (eligibility/pricing rules-as-data, then the AI ladder). Standing rules: first external API is read-only; AI stays advisory; no platform work before a paying pilot exists.

---

## M1 — Pilot-Ready (Sprints 1–5) ✅ built, UAT in progress

**Focus:** could a real lender *touch* it without it breaking or leaking?
Shipped: auth security (httpOnly cookie + rate limiting), RBAC with real users, condition lifecycle state machine, full workspace (notes, status transitions, documents, underwriting, audit log), manager analytics + domain-events outbox, CI with coverage gates, tenant bootstrap. Archives: `sprint-1-…` through `sprint-5-…`.

**Gate — UAT-1 (owner, running now):**
- Walk `END_USER_TEST_SCRIPTS.md` end-to-end for each role (AE, processor, underwriter, manager, IT admin)
- Log every finding as a `BUG-YYYY-MM-DD-NNN` entry in BUILD_HISTORY.md — severity + repro steps; **P0/P1 findings are auto-scoped into Sprint 6 Phase 6.1**
- Exit: zero P0 open, CI green on `main`, branch protection enabled

## M2 — Operational Depth (Sprints 6–10)

**Focus:** the workflows a lender lives in daily. M1 proved the shell works; M2 makes every day-in-the-life task real: the full application record (URLA), real document storage, the processing checklist, the funding worksheet, and decisions as first-class auditable objects. Success metric: **a pilot lender processes one loan start-to-fund without leaving Origina or asking for a workaround.**

| Sprint | Name | Focus | Spec |
|---|---|---|---|
| 6 | **Closeout & UAT Response** | Audit debts (RBAC matrix, test infra), UAT-1 P0/P1 burn-down, workspace data gaps (borrower/property panels, `GET /loans/{id}`) | [sprint-6-build-spec.md](sprint-6-build-spec.md) |
| 7 | **Document Platform v1** | S3-compatible storage behind a `StorageBackend` interface, document→condition auto-linking, versioning — also the #1 AI prerequisite | [sprint-7-build-spec.md](sprint-7-build-spec.md) |
| 8 | **URLA (1003) Foundation** | Full application data model (migrations), section-by-section editor, `/loans/new/manual` becomes real, intake flow merges in | [sprint-8-build-spec.md](sprint-8-build-spec.md) |
| 9 | **Processing & Funding** | Processing milestone checklist, funding worksheet (escrow/title/appraisal wired to migrations 114–117), pipeline priority | [sprint-9-build-spec.md](sprint-9-build-spec.md) |
| 10 | **Decisioning + M2 Gate** | Decision as first-class object (issue/rescind/history), condition auto-generation from templates, hardening, UAT-2 | [sprint-10-build-spec.md](sprint-10-build-spec.md) |

**Gate — UAT-2 (owner):** a scripted full-lifecycle run — create loan via URLA editor → upload docs (auto-linked to conditions) → processor completes milestone checklist → underwriter issues decision with auto-generated conditions → conditions cleared → funding worksheet completed → status `funded`. Exit: script completes with zero workarounds; all M2 B-gates green in CI; coverage ≥ 70% held.

## M3 — Enterprise-Ready (Sprints 11–15)

**Focus:** from "one pilot lender" to "multiple lenders would trust this." Org structure inside a tenant, time-based automation (SLA engine on the domain-events outbox), enterprise auth (SSO), and the audit/compliance story (retention, export, SOC 2 groundwork). Ends with a read-only public API preview — the on-ramp to M4 Platform.

| Sprint | Name | Focus | Spec |
|---|---|---|---|
| 11 | **Org Hierarchy & Custom Roles** | Branches/teams, team-scoped pipeline visibility, tenant-defined roles over the permission set | [sprint-11-build-spec.md](sprint-11-build-spec.md) |
| 12 | **SLA Engine & Real-Time Notifications** | SLA timers as outbox consumers, escalation rules, in-app notification center (SSE) | [sprint-12-build-spec.md](sprint-12-build-spec.md) |
| 13 | **SSO & Security Round 2** | OIDC first (SAML later), session management, password/lockout policy, secrets hygiene | [sprint-13-build-spec.md](sprint-13-build-spec.md) |
| 14 | **Audit, Retention & SOC 2 Groundwork** | Audit export, retention policy, `audit_log` partitioning ADR, access-review tooling, control checklist | [sprint-14-build-spec.md](sprint-14-build-spec.md) |
| 15 | **Read-Only API Preview + M3 Gate** | API keys (machine auth), read-only status/audit endpoints, first webhook, UAT-3 | [sprint-15-build-spec.md](sprint-15-build-spec.md) |

**Gate — UAT-3 (owner):** three tenants seeded and exercised concurrently (isolation verified at the UI, API, and audit level); SSO login round-trip; an SLA breach alert fires from a real timer; an audit export lands as a file; an API key reads loan status externally. Exit: roadmap Phase-3 success metrics ("3+ tenants; SSO live; SOC 2 Type 1 scheduled") achievable on demand.

---

## Operating rules (how the TPM ↔ PM loop works)

1. **Rolling-wave planning.** At each milestone gate, the next milestone's draft specs are promoted to implementable detail using what UAT taught us. Do not deep-spec more than ~2 sprints ahead — fake precision is worse than a labeled draft.
2. **UAT findings are first-class scope.** Every UAT logs bugs to BUILD_HISTORY.md; the first sprint of the next milestone reserves a phase for the burn-down. Unfixed P2s go to the tech-debt table, never into silence.
3. **Every sprint keeps the Sprint 1–5 discipline:** B-gate checklist (test file names + what they prove), green CI run URL in the completion summary, "what slipped" recorded at close, push at phase boundaries.
4. **Sequencing invariants:** S3 before any document AI; decisioning object before any rules engine; read-only API before any write API; org hierarchy before SLA escalation (escalation needs someone to escalate *to*).
5. **Scope pressure valve:** if a sprint overruns, cut scope, not quality gates. The milestone absorbs one sprint of slip before the gate date moves.
