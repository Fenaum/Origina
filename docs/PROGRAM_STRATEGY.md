# Origina Program — Executive Architecture Strategy

> **Status:** Draft for adoption · **Date:** 2026-07-08 · **Horizon:** 2026–2031
> **Audience:** Program leadership, architecture board, product leadership
> **Related docs:** [PMO.md](PMO.md) | [ROADMAP.md](ROADMAP.md) | [DECISIONS.md](DECISIONS.md) | [ARCHITECTURE.md](ARCHITECTURE.md) | [CURRENT_SPRINT.md](CURRENT_SPRINT.md)
> **Companion artifact:** [Operational Excellence & Automation Strategy](https://claude.ai/code/artifact/9ad5f00c-9f6b-41ad-9ddb-00b7b7702b4f) (published 2026-07-08) — the operational deep-dive behind §11: Non-QM wholesale value stream (9 phases), role/handoff/bottleneck analysis, fee-sheet + document-intelligence + condition-automation designs, the 14-day KPI/SLA clock, and sprint amendments. Where it and this document conflict on sequencing, this document (as amended at quarterly reviews) governs.

This document defines the long-term structure of the Origina **Program**. It is not implementation guidance. It establishes how Origina evolves from a single Loan Origination System into a modular mortgage operating platform whose services can power the Origina LOS, broker portals, mobile applications, third-party LOS systems, CRMs, internal lender tools, public APIs, AI services, and partner integrations.

Where this document and [DECISIONS.md](DECISIONS.md) conflict, the ADR wins until a superseding ADR is written.

---

## 1. Executive Summary

**The vision is sound. The sequencing is the risk.** Origina's ambition — a mortgage operating platform rather than a monolithic LOS — is the correct long-term position. The Non-QM wholesale niche is underserved by legacy LOS vendors (Encompass, Byte, Calyx) whose architectures cannot expose clean domain APIs, and the platform play (eligibility-as-API, document intelligence, partner integrations) is where durable, differentiated value accrues. But every failed platform company failed the same way: it built platform surfaces before it had a product anyone depended on. The single most important governance rule of this program is already written in [ROADMAP.md](ROADMAP.md) and is reaffirmed here: **no platform initiative starts before Phase 1 (Pilot-Ready) closes with a real lender running real loans.**

**Key findings of this review:**

1. **The current architecture does not block the platform vision — it enables it.** The decisions already made (tenant-scoped everything, TEXT+CHECK with controlled values, event sourcing for loan status, transactional outbox for domain events, thin routers with service-layer logic, raw SQL migrations) are precisely the substrate a multi-product platform needs. Nothing built to date requires a rewrite to reach the vision.

2. **The proposed 15-initiative portfolio is too fragmented for the program's current scale.** This document consolidates it to **13 initiatives** — twelve consolidated from the proposed list plus **Operational Intelligence (I-14)**, elevated to first-class by program direction on 2026-07-08 (§11). Most materially, Eligibility Engine, Guideline Engine, and Rules Engine are one initiative (**Decisioning Platform**) with three internal layers, and AWS Platform + Shared Infrastructure merge into **Platform Engineering & Cloud Foundation**. A standalone "generic rules engine" initiative is explicitly rejected as an anti-pattern (see §3.5).

3. **The target architecture is a modular monolith with enforced domain boundaries, not microservices.** Every initiative below is a *logical* domain service: an independently testable module with a published internal contract, its own tables, and events as its integration surface. Physical extraction into separately deployed services happens only when a concrete trigger fires (independent scaling, different runtime, security isolation, or team boundary). This keeps optionality without paying distributed-systems tax years before it is warranted.

4. **Three "load-bearing" investments unlock almost everything else:** (a) the **domain events outbox** (already an accepted ADR, lands Sprint 4) — notifications, webhooks, SLA timers, AI triggers, analytics invalidation, audit feeds, and operational telemetry (§11) all ride on it; (b) **real document storage (S3)** — the prerequisite for the entire Document Intelligence and AI portfolio; (c) the **adapter/provider-registry pattern** — the single mechanism for vendor abstraction across OCR, pricing, credit, title, appraisal, and compliance vendors.

5. **Build vs Buy resolves consistently:** buy commodity capability (OCR/extraction models, pricing data feeds, credit/title/appraisal connectivity, e-sign, email/SMS delivery, auth protocols), build the orchestration, workflow, decisioning logic, and Non-QM domain knowledge that constitute Origina's IP. Every "buy" goes behind an adapter so it remains a replaceable component.

6. **Origina is designed as a system of intelligence, not merely a system of record.** Every feature must answer three questions before it is built: what business process does it support, how do we know it is succeeding, and what telemetry does it emit. Observability is designed into every module from the start — never bolted on. The telemetry architecture, measurement model, KPI framework, and privacy guardrails are defined in §11; the three-questions rule is enforced through the Definition of Ready (§12.2).

**Recommended immediate posture:** finish Sprints 2–5 exactly as planned; treat this document as the map for what comes after; and adopt the governance cadence in §12 so the program stays honest as it scales.

---

## 2. Program Vision Assessment

### 2.1 Is "platform, not LOS" the right frame?

Yes, with two qualifications.

**Why it is right:**
- **The wholesale Non-QM segment structurally demands multi-party software.** Brokers, AEs, processors, underwriters, and investors all touch the same loan from different systems. A platform whose domain services (status, conditions, documents, eligibility) are consumable by broker portals and CRMs matches how the market actually works. A closed LOS does not.
- **The moat is in the engines, not the screens.** Pipeline grids and workspaces are table stakes; every competitor has them. Codified Non-QM guideline knowledge, explainable eligibility decisions, investor overlay management, and document intelligence tuned to bank-statement/DSCR files are scarce. Engines are only monetizable beyond your own UI if they are built as services from the start.
- **The architecture cost of platform-readiness is near zero when paid early** (events, tenancy, API discipline) **and near total when paid late** (retrofitting events under live consumers, untangling business logic from routes).

**Qualifications:**
1. **The platform is earned, not declared.** Until one lender funds loans through Origina, the "program" is one product plus infrastructure. Portfolio language in this document must not be used to justify starting horizontal initiatives ahead of the pilot. The PMO's "Enterprise Platform Readiness" risk note — *building platform surfaces before core lender workflow is proven* — remains the program's #1 strategic risk.
2. **"Every capability becomes an independent domain service" means independent in contract, not in deployment.** At current team scale (a founder plus AI engineering agents), operating a fleet of deployed microservices would consume the entire capacity of the program. Domain independence is achieved with module boundaries, table ownership, and events inside one deployable — the same properties, a fraction of the cost.

### 2.2 Alignment check against enterprise architecture principles

| Principle | Current state | Verdict |
|---|---|---|
| Modular design | Layered backend, one router/service per domain; boundaries by convention only | On track — needs module contract discipline (§4.8) |
| Domain-driven boundaries | Domains identifiable (loans, conditions, exceptions, intake, users) but share one schema without ownership rules | Needs formalization (§4) |
| API-first | 167 routes under `/api/v1/`, Pydantic contracts, but designed for one consumer (the frontend) | Partially — public API discipline is Phase 3 work (§7) |
| Event-driven | `loan_status_events` precedent; outbox ADR accepted, not yet built | Correctly sequenced — Sprint 4 |
| Multi-tenancy | Query-level isolation, tenant-scoped controlled values, tenant_id never from request body | Strong foundation; needs onboarding flow + isolation test coverage |
| Extensibility | Controlled values (18 sets) is a genuine extensibility mechanism | Ahead of stage |
| Replaceable components | No vendor coupling exists yet (nothing integrated yet) | Preserve via adapter pattern before first vendor lands |
| Vendor abstraction | Not yet needed; §5 and §7 define the pattern | Design now, build with first integration |
| Cloud readiness | Local docker-compose only; no CI, no IaC | Largest gap — §9 |
| AI augmentation | Deferred-not-excluded ADR with prerequisite chain | Correctly sequenced |
| Human-in-the-loop | `ai_annotations` pattern (reviewed_by, confidence) specified in ADR; exceptions module already models human approval chains | Correctly designed |
| Operational intelligence *(added 2026-07-08)* | `loan_status_events`, `audit_log` diffs, and audited writes already capture the raw material; no interaction telemetry or KPI registry yet | New first-class principle — §11 |

**Assessment:** the vision and the codebase are unusually well aligned for this stage. The gaps are operational (cloud, CI, coverage) rather than architectural.

---

## 3. Program Portfolio (Section 1)

### 3.1 Portfolio structure

The proposed portfolio is evaluated below. Effort/complexity scale: **S** (< 1 sprint), **M** (1–3 sprints), **L** (1–2 quarters), **XL** (multi-quarter, multi-phase). Roadmap phases refer to §10.

**Consolidation decisions:**

| Proposed initiative | Disposition |
|---|---|
| Origina LOS | **Keep** — anchor product |
| Workflow Engine | **Keep**, scoped as domain workflow (state machines, tasks, SLA, routing) — *not* a generic BPM engine |
| Pricing Engine | **Keep**, gated on a build-vs-buy ADR (per existing roadmap Phase 5 rule) |
| Eligibility Engine | **Merge** → Decisioning Platform (the product layer) |
| Guideline Engine | **Merge** → Decisioning Platform (the content layer) |
| Rules Engine | **Merge** → Decisioning Platform (the mechanism layer). No standalone generic rules engine — see §3.5 |
| Document Intelligence Platform | **Split**: Document Platform (storage/versioning — near-term) + Document Intelligence (OCR/extraction — later) |
| Public API Platform | **Keep** — Phase 3 |
| Admin Platform | **Keep** — already in build |
| Notification Platform | **Keep** as a thin service on domain events; not a standalone product until Phase 5+ |
| Analytics Platform | **Keep** — evolves from current analytics surface |
| AI Platform | **Keep** — governed by the AI Scope ADR |
| Integration Platform | **Keep** — the adapter framework + connector portfolio |
| AWS Platform | **Merge** → Platform Engineering & Cloud Foundation |
| Shared Infrastructure | **Merge** → Platform Engineering & Cloud Foundation |
| *(not in proposed list)* Operational Intelligence | **Add** — elevated from a sub-concern of Analytics to a first-class initiative (I-14) by program direction, 2026-07-08 |

Result: **13 initiatives** in four tiers plus one cross-cutting:

- **Tier 1 — Anchor product:** Origina LOS
- **Tier 2 — Platform substrate:** Platform Engineering & Cloud Foundation, Workflow Engine, Document Platform, Notification Service, Admin Platform
- **Tier 3 — Differentiating engines:** Decisioning Platform, Pricing Engine, Document Intelligence, Analytics Platform
- **Tier 4 — Ecosystem:** Public API Platform, Integration Platform, AI Platform *(AI spans tiers 3–4)*
- **Cross-cutting:** Operational Intelligence *(measurement substrate from Phase 0; differentiating product surface from Phase 3 — §11)*

### 3.2 Initiative details

#### I-01 · Origina LOS (anchor product)

| Field | Assessment |
|---|---|
| Business purpose | The wholesale Non-QM loan origination workspace: intake → submission → processing → underwriting → conditions → decision → funding → post-closing. |
| Business value | The revenue product; every other initiative exists to make this product better or to resell its capabilities. Proof point for the entire platform thesis. |
| Primary users | AEs/account managers, brokers, processors, underwriters, lender admins. |
| Dependencies | All Tier 2 substrate; consumes every engine as it matures. |
| Strategic importance | **Critical** — the program dies without it; nothing else may be prioritized above pilot-readiness. |
| Complexity | L (remaining scope to pilot-ready is well-specified in Sprints 2–5). |
| Effort | Sprints 2–5 (Q3 2026) to pilot; operational-depth work through Q4 2026. |
| Critical risks | Workspace sections uneven (real vs placeholder); condition lifecycle not yet server-enforced; role vocabulary drift. |
| Potential APIs | Loan CRUD, pipeline, status timeline, conditions, documents metadata — these become the Public API surface later. |
| Monetization | Per-seat and/or per-funded-loan SaaS pricing; the standard LOS model. |
| Roadmap phase | Phase 0–1 (active now). |

#### I-02 · Platform Engineering & Cloud Foundation *(merges AWS Platform + Shared Infrastructure)*

| Field | Assessment |
|---|---|
| Business purpose | Everything the program runs on: CI/CD, IaC, containers, secrets, observability, environments, backup/DR, cost controls. |
| Business value | Converts a demo into an operable product; precondition for pilots, SLAs, SOC 2, and every paid contract. |
| Primary users | Engineering (internal); indirectly every customer via reliability. |
| Dependencies | None inbound — it is the root dependency of the portfolio. |
| Strategic importance | **Critical** — the largest current gap (§9). |
| Complexity | M–L (well-trodden patterns; complexity is discipline, not invention). |
| Effort | R0 (CI + containers) inside Sprint 5; R1 (pilot deploy) ~1 quarter alongside Phase 1. |
| Critical risks | Solo-operator burden; secrets sprawl; skipping IaC "just to get the pilot up" and never recovering. |
| Potential APIs | None external. Internal: health, metrics, feature-flag evaluation. |
| Monetization | None directly; enables uptime SLAs that enterprise contracts price in. |
| Roadmap phase | Phase 0 (CI) → Phase 1 (pilot deploy) → Phase 2 (hardening/DR). |

#### I-03 · Workflow Engine

| Field | Assessment |
|---|---|
| Business purpose | Server-enforced state machines (loan status, condition lifecycle, exception lifecycle), task management, SLA timers, assignment/routing, and approval chains — the "operating" in operating platform. |
| Business value | Correctness (invalid transitions impossible), compliance (every transition evented and audited), and later, tenant-configurable process without code. |
| Primary users | All LOS operational roles; tenant admins (configuration); downstream, any app that drives a loan through its lifecycle via API. |
| Dependencies | Domain events outbox (SLA timers, routing triggers); RBAC (authority rules); audit infrastructure. |
| Strategic importance | **High** — it is the LOS's spine and the hardest thing for a partner app to replicate. |
| Complexity | M now (hardcoded state machines) growing to L (tenant-configurable workflow rules, Phase 2+). |
| Effort | `condition_lifecycle.py` is Sprint 2; status-transition enforcement Sprint 3; SLA engine on events Phase 2; configurable workflows Phase 3+. |
| Critical risks | Building a generic BPM engine instead of domain state machines (the classic over-abstraction trap); PATCH endpoints bypassing lifecycle rules. |
| Potential APIs | Transition endpoints, task APIs, SLA status, workflow-definition API (later). |
| Monetization | Bundled in LOS pricing; configurable-workflow tier for enterprise plans. |
| Roadmap phase | Phase 0 (state machines) → Phase 2 (SLA) → Phase 3+ (configurability). |

**Board guidance:** start with *hardcoded, tested, evented* state machines per domain. Only generalize to data-driven workflow definitions when at least two tenants demonstrably need different flows. Generic workflow engines built speculatively are the most common source of dead complexity in enterprise software.

#### I-04 · Document Platform *(storage layer — split from Document Intelligence)*

| Field | Assessment |
|---|---|
| Business purpose | Durable, secure, versioned, tenant-isolated document storage: upload, metadata, categorization, condition-linking, retention, and access audit. No AI. |
| Business value | Unblocks the real lending workflow (today upload is simulated); prerequisite for Document Intelligence, AI, and investor delivery. |
| Primary users | Processors, underwriters, brokers, borrowers (upload); compliance (retention/audit). |
| Dependencies | S3 + IAM (I-02); audit triggers; controlled values (document types already have `retention_years` metadata). |
| Strategic importance | **High** — most-cited blocker across the portfolio. |
| Complexity | M. Pre-signed URL upload/download, metadata tables, versioning, virus scanning, encryption at rest. |
| Effort | ~1 sprint backend + workspace UI, Phase 1 (matches existing "Operational Depth" plan). |
| Critical risks | Security (PII documents are the crown jewels); doing it before cloud IAM exists; retention/deletion compliance. |
| Potential APIs | Document upload/download (pre-signed), metadata, document-package export — an early Public API candidate for broker portals. |
| Monetization | Storage tiers; per-package investor delivery later. |
| Roadmap phase | Phase 1. |

#### I-05 · Notification Service

| Field | Assessment |
|---|---|
| Business purpose | Fan-out of domain events to email, in-app, and later SMS/webhook channels, with per-tenant/per-user preference rules and templates. |
| Business value | Loan velocity depends on parties learning about state changes without polling; also the first proof that the events architecture works. |
| Primary users | All loan parties; tenant admins (rules/templates). |
| Dependencies | **Domain events outbox (hard dependency)**; template storage (Admin Platform); email vendor adapter (Integration Platform pattern). |
| Strategic importance | Medium as a feature; **high as the events pathfinder**. |
| Complexity | S–M. Deliberately thin: consume events, evaluate rules, render template, call channel adapter. |
| Effort | Sprint 4 (per existing plan). |
| Critical risks | Building notification logic into route handlers (explicitly rejected by ADR); template sprawl without versioning. |
| Potential APIs | Notification preferences, notification history; webhook delivery shares this machinery in Phase 3. |
| Monetization | None standalone; SMS pass-through cost recovery. |
| Roadmap phase | Phase 0 (Sprint 4). |

#### I-06 · Admin Platform

| Field | Assessment |
|---|---|
| Business purpose | Tenant self-service configuration: users/roles, products, controlled values, workflow settings, templates, branding, feature flags, integrations, audit visibility. |
| Business value | Every configuration a tenant can perform themselves is support cost avoided and an enterprise-sales requirement ("can we configure X without you?"). |
| Primary users | Tenant IT admins, operations managers; Origina staff (system scope). |
| Dependencies | Controlled values architecture (built); RBAC; settings persistence (in progress); feature-flag service (new). |
| Strategic importance | **High** — multi-tenant adoption gate. |
| Complexity | M–L across many small surfaces. |
| Effort | Incremental: user admin Sprint 2; settings persistence Phase 1; migrations 126–131 planned; full configurability through Phase 3. |
| Critical risks | UI implying configurability the backend doesn't persist (already flagged in PMO); admin paths without strict RBAC; config changes without audit/versioning. |
| Potential APIs | Tenant provisioning API (Phase 3+ for resellers), config export/import. |
| Monetization | Enterprise tier gating (custom roles, SSO, branding, custom fields). |
| Roadmap phase | Phase 0 (user admin) → Phase 1–3 (progressive). |

#### I-07 · Decisioning Platform *(merges Eligibility + Guideline + Rules engines)*

| Field | Assessment |
|---|---|
| Business purpose | Codified Non-QM lending knowledge as an explainable decision service. Three layers: **guideline corpus** (versioned content: programs, matrices, citations), **rules mechanism** (evaluation engine, rules-as-data), **eligibility product** (scenario in → pass/fail/warning/missing-data out, with citations and compensating factors). |
| Business value | This is the differentiating IP. Non-QM eligibility is genuinely hard (DSCR ratios, bank-statement income analysis, overlay stacking) and poorly served. As an API it is sellable to brokers, CRMs, and even competing LOSs. |
| Primary users | Underwriters and AEs (decision support); brokers (pre-qual); later, external API consumers. |
| Dependencies | Guideline corpus as versioned data (also an AI prerequisite per ADR); controlled values; loan data model; Admin Platform (overlay configuration). |
| Strategic importance | **Critical to the 5-year thesis** — the #1 monetization candidate beyond LOS seats. |
| Complexity | XL end-to-end; deliberately staged (§6). |
| Effort | Phase 4 flagship (Q3 2027 per existing roadmap), with the corpus data model started earlier as content work. |
| Critical risks | Fair-lending exposure if it auto-decisions (mitigated: advisory-first, human override always); guideline content maintenance burden; correctness liability (mitigated: ≥95% agreement gate before any auto mode, citations on every finding). |
| Potential APIs | `POST /eligibility/evaluate` (scenario → findings), guideline search/citation API, overlay management API. |
| Monetization | **Highest ceiling in the portfolio:** per-decision API pricing, broker-portal pre-qual licensing, investor overlay subscription. |
| Roadmap phase | Corpus: Phase 2 (content). Engine: Phase 4. Public API: Phase 5+. |

#### I-08 · Pricing Engine

| Field | Assessment |
|---|---|
| Business purpose | Scenario pricing (rate/price/points across programs), rate sheets, lock management, margin/comp management. |
| Business value | Brokers shop by price; an LOS without credible pricing forces a swivel-chair workflow to Optimal Blue/Loansifter and leaks the point of sale. |
| Primary users | Brokers, AEs (scenario pricing); secondary/capital markets (rate sheets, locks); lock desk. |
| Dependencies | Loan/product data model; investor rate-sheet sources; Integration Platform (if vendor-sourced). |
| Strategic importance | High commercially; **medium as build-IP** — pricing *data* is a commodity feed; pricing *engines* (PPE) are a mature vendor market. |
| Complexity | L (integrate) / XL (build native). |
| Effort | Gated on a build-vs-buy ADR (existing Phase 5 rule — reaffirmed). Recommended: integrate a PPE vendor or ingest investor rate sheets behind a `PricingProvider` adapter first; consider a native Non-QM engine only if vendor coverage of Non-QM proves inadequate (it often is — this is the one place "build" may win). |
| Critical risks | Stale rate sheets → mispriced locks (financial liability); hardcoded demo scenarios leaking into real workflows (current state — must be clearly fenced). |
| Potential APIs | Scenario pricing, rate-sheet retrieval, lock request/confirm. |
| Monetization | PPE seat pricing or per-lock fees if native; bundled if vendor pass-through. |
| Roadmap phase | Adapter + vendor: Phase 2–3. Native engine decision: Phase 4 ADR. |

#### I-09 · Document Intelligence *(the AI layer over the Document Platform)*

| Field | Assessment |
|---|---|
| Business purpose | Classification, OCR, extraction, validation, and condition automation over stored documents, with a human review queue. Full strategy in §5. |
| Business value | The dominant labor cost in Non-QM ops is document handling (bank-statement analysis especially). Minutes-saved-per-file is directly measurable and sellable. |
| Primary users | Processors, underwriters (review queue); indirectly all parties via faster files. |
| Dependencies | Document Platform (hard), domain events, async jobs, `ai_annotations` pattern — exactly the AI Scope ADR prerequisite chain. |
| Strategic importance | High — the most commercially legible AI capability in mortgage. |
| Complexity | L–XL depending on provider mix (§5). |
| Effort | Phase 5, sequenced classification → extraction → validation → condition automation. |
| Critical risks | Provider lock-in (mitigated by §5 architecture); accuracy liability (mitigated by confidence gating + mandatory review); cost run-away on per-page vendor pricing (mitigated by cost tracking, §5.4). |
| Potential APIs | Classify/extract endpoints, review-queue API, per-document intelligence status. |
| Monetization | Per-page or per-file processing fees; premium tier. |
| Roadmap phase | Phase 5 (per AI Scope ADR). |

#### I-10 · Analytics Platform

| Field | Assessment |
|---|---|
| Business purpose | Operational analytics (pipeline KPIs, drilldowns — live today) growing into a reporting layer: manager dashboards, funnel conversion, forecasting, exports, and eventually an Operational Data Store (ODS) that also serves partner reporting. |
| Business value | Visibility is a stated differentiator vs legacy LOS; manager reporting drives the enterprise sale. |
| Primary users | Managers/executives at tenants; ops leads; later, partner apps via reporting API. |
| Dependencies | Data quality from workflow engine; domain events (fact stream); read-model/ODS infra when query load demands it (I-02). |
| Strategic importance | Medium-high; grows with tenant count. |
| Complexity | M now (query-on-OLTP with LATERAL joins is fine at current scale) → L when a read model becomes necessary. |
| Effort | Continuous; ODS decision deferred until measured query pressure (see §7.2). |
| Critical risks | Reporting outgrowing the OLTP query strategy (already flagged in PMO) — the mitigation is the events stream feeding read models, not heroic SQL. |
| Potential APIs | Reporting API, saved-view API, export API, embedded-dashboard tokens. |
| Monetization | Analytics/reporting premium tier; benchmark data products much later (with explicit consent/anonymization governance). |
| Roadmap phase | Continuous; read-model/ODS in Phase 3–4 as needed. |

#### I-11 · Public API Platform

| Field | Assessment |
|---|---|
| Business purpose | Externalized, versioned, documented APIs: machine auth (API keys/OAuth client-credentials), webhooks, rate limiting, changelog, SDK generation, partner sandbox. |
| Business value | The literal instantiation of the platform vision — what lets CRMs, broker portals, and third-party LOSs consume Origina services. |
| Primary users | Partner developers; tenant IT; eventually Origina's own mobile/portal apps (dogfooding rule: new first-party apps consume the public API). |
| Dependencies | Domain events (webhooks), stable internal contracts, cloud/observability (rate limiting, usage metering), Admin Platform (key management). |
| Strategic importance | **Critical to the thesis, deliberately late in sequence.** |
| Complexity | M for read-only v1; L for full write APIs with idempotency and versioning discipline. |
| Effort | Phase 3 (Q2 2027 per existing roadmap): read-only status/audit API first, one CRM integration, generated TypeScript SDK. |
| Critical risks | Freezing immature internal contracts into public commitments (mitigated: read-only first, explicit versioning policy before v1); operating an API SLO without on-call maturity. |
| Potential APIs | The platform surface itself: loans (read), status timeline, webhooks, documents, then eligibility and pricing as the engines mature. |
| Monetization | Usage-metered API pricing; partner certification; marketplace rev-share (Phase 6). |
| Roadmap phase | Phase 3, expanding through Phase 6. |

#### I-12 · Integration Platform

| Field | Assessment |
|---|---|
| Business purpose | The framework and connector portfolio for consuming external vendors: credit, title, appraisal, compliance, document providers, pricing sources, e-sign, CRM sync, MISMO import/export. |
| Business value | An LOS is judged by its integrations; each connector removes a swivel-chair workflow and deepens lock-in. |
| Primary users | Ops roles (transparently); tenant admins (credentials/config); Origina engineering (adapter SDK). |
| Dependencies | Adapter pattern + provider registry (§5/§7); credential vault (I-02 secrets); domain events (async callbacks); Admin Platform (tenant vendor config). |
| Strategic importance | High; also the discipline that keeps every vendor replaceable. |
| Complexity | M per connector; the framework itself is M. |
| Effort | Framework lands with the *first* real integration (recommend: email delivery in Sprint 4, then credit in Phase 2); connectors added by tenant demand thereafter. |
| Critical risks | Vendor APIs are the flakiest part of any LOS — retries, idempotency, and circuit breakers must be framework features, not per-connector afterthoughts; per-tenant vendor credentials are a security-critical store. |
| Potential APIs | Connector status/config APIs; inbound webhook receivers per vendor. |
| Monetization | Per-transaction pass-through with margin (standard LOS practice); premium connectors. |
| Roadmap phase | Framework Phase 0–1; connectors Phase 2 onward by demand. |

#### I-13 · AI Platform

| Field | Assessment |
|---|---|
| Business purpose | Shared AI substrate per the AI Scope ADR: async job infrastructure, `ai_annotations` storage (confidence, model_version, reviewed_by), model/provider abstraction, evaluation harness, and the feature sequence classification → extraction → missing-doc detection → summaries → guideline Q&A → risk scoring (last). |
| Business value | Labor compression across processing and underwriting; guideline Q&A leverages the Decisioning corpus; long-term product differentiation. |
| Primary users | Processors, underwriters (assisted); all users (summaries, Q&A). |
| Dependencies | The ADR's prerequisite chain: S3 → domain events → async jobs → annotations pattern → guideline corpus. Also Document Intelligence (I-09) as its first consumer. |
| Strategic importance | High long-term; **strictly sequenced** — the deferred-not-excluded ADR is reaffirmed without modification. |
| Complexity | XL across the horizon. |
| Effort | Phase 5 (Q4 2027) onward. |
| Critical risks | Fair-lending/regulatory exposure (mitigated: advisory-only, human review in every deliverable, risk scoring last); competitive pressure forcing premature re-sequencing (the ADR itself flags this — resist unless a pilot customer contractually requires it). |
| Potential APIs | Annotation retrieval, summary API, guideline Q&A API. |
| Monetization | AI premium tier; per-file processing; eligibility copilot for brokers. |
| Roadmap phase | Phase 5–6. |

#### I-14 · Operational Intelligence Platform *(added 2026-07-08)*

| Field | Assessment |
|---|---|
| Business purpose | Continuously measure how work flows through the platform: telemetry collection standards, the KPI/metric registry, SLA tracking, workflow and bottleneck analytics, user-behavior analytics, automation and AI ROI measurement, executive dashboards, and (later) predictive operations. Full strategy: §11. |
| Business value | Converts Origina from a system of record into a system of intelligence: lenders see where time and money leak in their operation; Origina's own roadmap becomes data-driven ("what to automate next" is a query, not a debate); every feature's value becomes provable. A durable enterprise differentiator — legacy LOS vendors cannot retrofit this. |
| Primary users | Tenant ops managers and executives (dashboards, SLAs, bottlenecks); Origina product/engineering (feature ROI, UX telemetry); every other initiative (its success metrics are reported by this one). |
| Dependencies | Domain events outbox (hard — telemetry rides the same backbone); Admin Platform (SLA targets as data, per-tenant kill switch); Analytics Platform (shared read-model infrastructure); AI Platform for the predictive layer only. |
| Strategic importance | High and cross-cutting — it is how every other initiative proves its success metric (§11.5). |
| Complexity | S at OI-0 (views over event tables that already exist) growing to L at OI-4 (predictive). |
| Effort | OI-0 is near-free in Phase 0–1; ladder through Phase 5 (§11.7). |
| Critical risks | Telemetry perceived as employee surveillance (mitigated: §11.6 guardrails); collection without consumption (dashboards nobody reads); performance drag from interaction telemetry (fail-open, sampled, budgeted); metric sprawl without a registry. |
| Potential APIs | Metrics API, SLA-status API, benchmark API (consent-gated, Phase 7 at earliest). |
| Monetization | Operations-intelligence premium tier for lenders; anonymized industry benchmarks much later (consent-governed, §15). |
| Roadmap phase | OI-0 in Phase 0–1 → OI-4 (predictive) in Phase 5+; maturity ladder in §11.7. |

### 3.3 Portfolio dependency graph

```
I-02 Platform Eng/Cloud ──┬─→ I-04 Document Platform ──→ I-09 Document Intelligence ─┐
                          ├─→ I-11 Public API                                        ├─→ I-13 AI Platform
I-01 LOS (anchor) ────────┤                                                          │
                          ├─→ I-03 Workflow ──→ SLA / routing / approval chains      │
Domain events outbox ─────┼─→ I-05 Notifications ──→ webhooks (I-11)                 │
(Sprint 4, ADR)           ├─→ I-10 Analytics read models                             │
                          ├─→ I-14 Operational Intelligence (all event classes)      │
                          └─→ I-12 Integration callbacks                             │
Guideline corpus (data) ──→ I-07 Decisioning ──→ eligibility API (I-11) ──→ Q&A ─────┘
I-06 Admin Platform ──→ tenant config consumed by nearly everything
I-08 Pricing ──→ behind I-12 adapter until build-vs-buy ADR
```

The chokepoints are visible: **cloud foundation, the events outbox, and document storage** gate most of the portfolio. They are also the three cheapest items on the list relative to what they unlock.

### 3.4 What is deliberately *not* in the portfolio

- **Servicing, secondary-market delivery, closing-doc generation** — adjacent products; revisit at Phase 6.
- **Retail/consumer-direct channel** — the wholesale focus is a strength; don't dilute it before the pilot proves out.
- **Mobile apps** — a *consumer of* the Public API platform (Phase 3+), not an initiative that shapes architecture now.

### 3.5 Why no standalone Rules Engine initiative

A generic rules engine ("tenants author arbitrary rules evaluated everywhere") is the most seductive and most dangerous item on the proposed list. Rejected as a standalone initiative because:

1. **Rules without a domain are unownable.** Eligibility rules belong to Decisioning; validation rules to Admin Platform custom fields; workflow rules to the Workflow Engine; notification rules to Notifications. Each has different authoring UX, evaluation context, and failure semantics.
2. **A shared *mechanism* is fine; a shared *initiative* is not.** The internal predicate-evaluation library (conditions-as-data, JSONB predicates, safe evaluation, versioning) should be one shared, boring module that the domain initiatives consume — an implementation detail, not a program line-item.
3. **History:** enterprise platforms that shipped "the rules engine" as a product grew unmaintainable rule sprawl that no one could audit. Mortgage compliance demands the opposite: every rule attributable, versioned, and explainable — which domain-scoped rule sets provide naturally.

---

## 4. Domain Decomposition & Service Boundaries (Section 2)

### 4.1 Decomposition principles

1. **A domain owns its tables.** No other module writes them; reads across domains go through the owning module's interface (or, later, its API/read model).
2. **Events are the integration surface between domains.** Synchronous cross-domain calls are allowed inside the monolith but must go through the owning service module, never raw SQL against another domain's tables.
3. **Decompose on paper before decomposing in deployment.** Every subdomain below is a module (Python package with a public service interface) first; a deployable service only when an extraction trigger fires (§4.8).
4. **Satellite data stays with its aggregate.** `loan_financials`/`loan_terms` belong to the Loan domain regardless of which feature reads them.

### 4.2 Document Intelligence decomposition *(per the prompt's example — validated with amendments)*

| Subdomain | Owner | Notes |
|---|---|---|
| Upload | Document Platform (I-04) | Pre-signed URL flow; no intelligence involved |
| Storage | Document Platform | S3 + metadata tables; tenant-prefixed keys, encryption |
| Versioning | Document Platform | Immutable versions; supersede, never overwrite |
| Search | Document Platform (metadata) / AI Platform (semantic, later) | Two different problems; don't conflate |
| OCR | Document Intelligence (I-09) | Behind provider adapter (§5) |
| Classification | Document Intelligence | First AI feature per ADR sequence |
| Extraction | Document Intelligence | Field-level, with confidence per field |
| Validation | Document Intelligence | Cross-checks extracted data vs loan file data |
| Review Queue | Document Intelligence (service) + LOS workspace (UI) | The human-in-the-loop surface; annotations pattern |
| Condition Automation | **Workflow Engine**, consuming DI events | Amendment: auto-satisfying conditions is a workflow decision triggered by DI events — it must live with condition lifecycle authority rules, not inside DI |

**Boundary ruling:** Upload/Storage/Versioning/metadata-Search ship in Phase 1 with zero AI. Everything below the line is Phase 5. This split is the single most important decomposition in the portfolio because it un-gates the lending workflow from the AI timeline.

### 4.3 Pricing Engine decomposition

| Subdomain | Notes |
|---|---|
| Product & program catalog | Shared with Decisioning; the canonical definition of what Origina can price/decide. Already partially exists (controlled values, program data). |
| Rate-sheet ingestion | Per-investor adapters (parse XLSX/PDF/API feeds); versioned, effective-dated |
| Scenario pricing | Scenario in → eligible programs × rate/price/points out; the broker-facing product |
| Lock desk | Lock request/confirm/extend/void; financial state machine with audit |
| Margin & compensation | Lender margins, broker comp plans — tenant-configured (Admin Platform) |

Scenario pricing depends on eligibility ("what programs qualify?") — pricing and decisioning must share the program catalog but remain separate services: eligibility answers *whether*, pricing answers *at what price*.

### 4.4 Decisioning Platform decomposition

| Layer | Subdomain | Notes |
|---|---|---|
| Content | Guideline corpus | Versioned, effective-dated guideline documents + structured matrices; citation-addressable. Also the AI Q&A substrate |
| Content | Overlay management | Investor overlays as diffs on base guidelines; tenant-scoped |
| Mechanism | Rule authoring & storage | Rules-as-data (JSONB predicates), versioned, attributable |
| Mechanism | Evaluation engine | Deterministic, side-effect-free, explainable (§6) |
| Product | Eligibility service | Scenario evaluation API: findings with pass/fail/warning/missing-data + citations |
| Product | Explanation service | Human-readable "why" with guideline citations and compensating-factor math |
| Product | Override & audit | Manual override with reason, approval authority, full history — reuses the exceptions-module patterns already built |

### 4.5 Workflow Engine decomposition

| Subdomain | Notes |
|---|---|
| Status state machines | Loan, condition, exception, task lifecycles; server-enforced, evented (loan_status_events precedent) |
| Task management | Exists (full CRUD); grows assignment/routing |
| Assignment & routing | Who gets the file/task; rule-driven later (Phase 3+) |
| SLA timers | Event-driven timers → escalation events; Phase 2 |
| Approval chains | Multi-step authority flows; the exceptions module's decide/authority model is the in-house prototype to generalize *from*, not before |

### 4.6 Admin Platform decomposition

| Subdomain | Notes |
|---|---|
| Identity & access | Users, roles, custom roles (Phase 2), SSO (Phase 2) |
| Tenant configuration | Settings persistence, branding, preferences |
| Controlled values management | Admin UI over the existing tables — highest-leverage, mostly built |
| Custom fields | JSONB-based, schema-per-tenant defined in data (§8) |
| Feature flags | Per-tenant capability toggles; also the DI/engine kill-switch mechanism (§5.3) |
| Templates | Notification, condition, task, document-request templates; versioned |
| Integration config | Vendor selection + credentials per tenant (secret storage via I-02) |
| Audit & compliance views | Read-only surfaces over audit_log/events; retention config |

### 4.7 Integration & Analytics decomposition

**Integration Platform:** adapter SDK (retry/idempotency/circuit-breaker/logging as framework features) · connector registry (which vendors exist, per-tenant enablement) · credential vault interface · inbound webhook gateway · MISMO import/export (a *format* module used by many connectors, not a connector itself).

**Analytics Platform:** operational queries (today: LATERAL-join on OLTP — fine) · saved views (exists) · export service · read models fed by domain events (when query pressure demands) · ODS (only if/when partner-facing reporting or cross-tenant benchmarking justifies it — see §7.2).

### 4.8 Extraction triggers (when a module becomes a deployed service)

A module earns physical extraction only when one of these fires:

1. **Runtime divergence** — needs GPUs, long-running jobs, or a different language (Document Intelligence workers will likely be first).
2. **Scaling divergence** — its load profile forces scaling the whole monolith wastefully (Public API rate-limited edge is a candidate).
3. **Security isolation** — blast-radius reduction justifies a boundary (credential vault / document access paths).
4. **Team boundary** — a dedicated team owns it end-to-end (not applicable at current scale).

Until then: one deployable, many modules, contracts enforced by convention + tests + code review. This is the explicit ruling against premature microservices.

---

## 5. Document Intelligence Strategy (Section 3)

### 5.1 Architecture: provider-agnostic by construction

The non-negotiable requirement — **the LOS must operate fully with Document Intelligence disabled or unavailable** — dictates the architecture: DI is an *asynchronous annotator* of documents, never a synchronous participant in any workflow.

```
Document uploaded (Document Platform)
  → domain event: document.uploaded
    → DI orchestrator (async job) — only if tenant flag enabled
        → Provider Registry resolves tenant's configured provider chain
        → Adapter call (internal engine | third-party OCR | customer-provided)
        → Results written as ai_annotations (confidence, model_version, provider, cost)
            → confidence ≥ threshold: annotation surfaced as "suggested"
            → confidence < threshold OR validation conflict: Review Queue
                → human accepts/corrects (reviewed_by recorded)
                    → domain event: document.classified / data.extracted
                        → downstream consumers (condition automation, etc.)
```

**Structural guarantees:**
- **Feature-flagged per tenant** (Admin Platform). Flag off → the event fires, no consumer picks it up, workflow proceeds manually. Zero code paths change.
- **Annotations, never mutations.** DI output lands in `ai_annotations` alongside — never overwriting — human-entered data (per the AI Scope ADR). A human acceptance is what promotes a suggestion into loan data, and that promotion is itself audited.
- **Provider Registry + Adapter pattern.** One `DocumentIntelligenceProvider` port (classify, extract, health, cost-estimate); adapters per provider; registry maps tenant → ordered provider chain with fallback. Adding a provider is an adapter + registry row, no orchestrator changes.
- **Customer-provided providers** are just another adapter whose credentials live in tenant integration config — architecturally free once the registry exists.
- **Fallback ladder:** primary provider → secondary provider → review queue (human) → fully manual. Every rung degrades gracefully; the bottom rung is the pre-DI workflow, which always works.
- **Audit & compliance:** every DI invocation logs provider, model version, input document version, output, confidence, cost, latency, and eventual human disposition. This is both the compliance record and the training-feedback dataset.
- **Cost & usage tracking:** per-call cost attribution by tenant/provider/document-type, aggregated for margin management and tenant billing. Built into the adapter framework from day one — retrofitting cost attribution is miserable.

### 5.2 Build vs Buy

| Capability | Verdict | Rationale |
|---|---|---|
| Raw OCR / layout parsing | **Buy** (AWS Textract; Azure Document Intelligence as second adapter) | Commodity; hyperscaler accuracy on standard forms is unbeatable at Origina's volume; per-page pricing scales from zero |
| Standard-form extraction (W-2, 1040, bank statements) | **Buy first** | Vendors (incl. mortgage-specific: Ocrolus) have trained models; validate the workflow before owning models |
| Classification for Non-QM doc taxonomy | **Buy, then build** | Start with vendor/LLM classification; Origina's review-queue corrections become training data for an in-house model when volume justifies |
| Non-QM-specific analysis (bank-statement income calc, DSCR doc analysis) | **Build (later)** | This is domain IP vendors do poorly; highest-value build target once the pipeline is proven |
| Orchestration, review queue, confidence gating, annotations, audit, cost tracking | **Build (always)** | This is the actual product; it is provider-independent by design and where the workflow value lives |

**Economic note:** at pilot volume (hundreds of loans/quarter, ~100–300 pages/file), vendor per-page pricing is trivially cheaper than owning models. The "build" option only becomes economically interesting at scale — which is exactly when the review-queue corrections corpus (owned data) makes an internal model feasible. The architecture makes that switch a registry configuration change.

### 5.3 Governance rules for DI

1. No DI output enters loan data without a confidence threshold or explicit human acceptance; thresholds are tenant-configurable with conservative defaults.
2. The kill switch (tenant feature flag) must be tested as a first-class scenario: DI-off is a supported permanent mode, not a degraded one.
3. Provider adapters may not leak provider-specific types past the port interface — enforced in review.
4. Every extraction field carries provenance (provider, model version, document version) forever.

---

## 6. Eligibility & Guideline Engine Strategy (Section 4)

### 6.1 Governing principle

**Decision support before decision automation.** The engine's job for its first several maturity levels is to make a human underwriter faster and more consistent — never to block the workflow. A loan can always proceed past an engine finding with a recorded human override. This is simultaneously the right product posture (underwriters won't adopt a tool that fights them), the right liability posture (fair-lending), and the right engineering posture (the engine earns trust incrementally against real files).

### 6.2 Maturity ladder

| Level | Capability | Workflow posture | Target phase |
|---|---|---|---|
| M0 | **Manual references** — guideline corpus stored, versioned, searchable, citation-addressable | Reference only | Phase 2 (content work; also the AI Q&A prerequisite) |
| M1 | **Checklist validation** — program checklists rendered from corpus data; UW checks manually, system records | Advisory | Phase 2–3 |
| M2 | **Rules engine** — structured rules evaluate the loan scenario automatically; findings = pass / fail / **warning** / **missing data**, each with guideline citation | Advisory; findings displayed, never blocking | Phase 4 |
| M3 | **Investor overlays** — overlay rule-sets stack on base guidelines per tenant/investor; conflicts surfaced explicitly | Advisory | Phase 4 |
| M4 | **Explainable decision engine** — full findings report: compensating-factor math, near-miss analysis ("fails DSCR 1.15 by 0.03; compensates with 6mo additional reserves"), override + approval-chain integration (reusing exception-module authority patterns) | Advisory by default; tenants may opt specific hard-fail rules into blocking, each opt-in audited | Phase 4–5 |
| M5 | **Public eligibility API** — scenario-in/findings-out for broker portals, CRMs, third parties | External product | Phase 5+ |

**Gate (reaffirmed from the existing roadmap):** the engine must agree with manual underwriter determinations ≥95% on a measured sample before *any* finding is allowed to block *anything*, per-rule.

### 6.3 Required decision semantics

Every evaluation returns a findings set, not a verdict. Each finding carries:

- **Status:** `pass | fail | warning | missing_data` — `missing_data` is a first-class outcome, not an error; early-stage scenarios are always incomplete, and "what's missing to decide" is itself valuable output.
- **Citation:** guideline document + section + version (the corpus is citation-addressable for exactly this reason).
- **Compensating factors:** which apply, whether they were exercised, and the resulting adjusted determination — Non-QM lending *is* compensating-factor lending; an engine without this is useless for the segment.
- **Override affordance:** any finding can be overridden by a user with authority; override requires reason; override + approval recorded in the same event/audit pattern as exception decisions.
- **Full audit history:** every evaluation snapshot retained (rules version + input scenario + findings), so "why did the engine say X on March 3rd" is always answerable — a regulatory requirement, and the same snapshot pattern already used by `exceptions.loan_snapshot`.

### 6.4 Rules-as-data, versioned, explainable

Rules are stored as data (structured predicates with parameters, JSONB), not code: tenant-customizable overlays without deploys (consistent with the controlled-values philosophy), effective-dated (guidelines change; evaluations must use the rules in force at evaluation time), attributable (who authored/changed each rule), and mechanically explainable (a predicate tree renders to English; arbitrary code does not). The evaluation engine itself is deliberately boring: deterministic, side-effect-free, exhaustively unit-tested against golden scenario files.

**AI enhancement (Phase 5+, per AI Scope ADR):** AI assists rule *authoring* (drafting structured rules from guideline PDFs, human-reviewed) and powers guideline *Q&A* over the corpus. AI does not perform eligibility *evaluation* — evaluation stays deterministic and explainable forever. This division is a standing architectural commitment.

### 6.5 Workflow independence guarantee

Structurally identical to DI: the engine is a consumer of loan data and a producer of advisory findings. It has no write authority over loan status. If it is down, disabled, or immature, the loan workflow is exactly what it is today. Findings surface in the underwriting workspace as decision support; the human decision (with or without engine input) is what drives status transitions — and at M4+, tenants opting rules into blocking mode do so per-rule, reversibly, and auditable.

---

## 7. Integration Strategy (Section 5)

### 7.1 The three integration surfaces

Origina has three distinct integration surfaces that must not be conflated:

1. **Outbound (Origina consumes vendors)** — credit, title, appraisal, compliance, document providers, pricing sources, e-sign, email/SMS. **These are adapters, never core.** Framework: one port interface per vendor *category* (e.g., `CreditProvider`), adapters per vendor, registry for tenant-level vendor selection, credentials in the vault. Retries, idempotency keys, circuit breakers, request/response logging, and cost attribution are adapter-framework features. Async vendor callbacks enter through an inbound webhook gateway and become domain events.

2. **Inbound (partners consume Origina)** — the Public API Platform (I-11): API keys/OAuth client-credentials, versioned REST, webhooks, rate limits, usage metering, docs, SDKs. Sequencing (reaffirmed from roadmap): **read-only first** (status timeline + audit for CRM sync) → document APIs → write APIs (loan creation for broker portals/point-of-sale) → engine APIs (eligibility, pricing) as they mature. First-party rule: new Origina-built apps (mobile, broker portal) consume the public API — dogfooding is the API quality program.

3. **Internal (module-to-module)** — domain events on the outbox, per the accepted ADR. The outbox *is* the event bus for the foreseeable future; it can feed SNS/SQS or Kafka later with zero producer changes (explicitly anticipated in the ADR). Do not introduce a broker before a measured need exists.

### 7.2 Core vs adapter — the placement test

A capability belongs **inside the core platform** when Origina owns the domain semantics (loan lifecycle, conditions, eligibility findings, document metadata, tenancy, audit). It belongs **in an adapter** when the semantics are defined by an external party (a vendor's API, a wire format, a delivery channel). Applying the test:

| Concern | Placement |
|---|---|
| Loan/condition/status semantics | Core |
| MISMO import/export | Core *format module* (a mortgage lingua franca, used by many adapters), but each counterparty connection is an adapter |
| Credit/title/appraisal/compliance vendors | Adapters, one port per category |
| Email/SMS delivery | Adapter (SES/Twilio behind a `NotificationChannel` port); notification *rules* are core |
| Pricing data feeds | Adapters; scenario-pricing semantics core (pending build-vs-buy ADR) |
| OCR/extraction providers | Adapters (§5) |
| CRM sync | Partner-side via Public API + webhooks — Origina should *not* build per-CRM connectors; publish events and let partners/middleware integrate. Exception: one flagship CRM integration built in-house in Phase 3 to prove the API |
| ODS (Operational Data Store) | **Deferred.** An ODS is justified when (a) partner reporting load threatens OLTP, or (b) cross-source analytics demands consolidation. Until then the events stream + targeted read models suffice. Decide by measurement, not architecture fashion |
| GraphQL | **Deferred indefinitely.** Revisit only if partner developers demonstrably need query flexibility REST can't serve (likely never for this domain). REST + webhooks + generated SDKs is the boring, right answer |

### 7.3 Webhook delivery (Phase 3)

Webhooks are the Notification Service's machinery pointed outward: consume domain events → filter per subscription → sign (HMAC) → deliver with retries/backoff → dead-letter with replay UI → per-endpoint health visible to the tenant admin. One delivery system, two audiences (humans and machines).

---

## 8. Admin Platform Strategy (Section 6)

### 8.1 Governing principle: configuration over customization

Tenants get **parameters, values, rules-as-data, and flags** — never code, scripts, or arbitrary expressions. Every configurable surface is: schema-validated on write, versioned, audited (who/when/before/after), effective-dated where it affects loans in flight, and revertible. The platform's integrity is protected by *what kind* of flexibility is offered, not by reviewing what tenants do with it.

### 8.2 Capability disposition

| Capability | Mechanism | Guardrail | Phase |
|---|---|---|---|
| Controlled vocabulary (statuses, doc types, programs…) | Controlled values (built) — tenant rows shadow system rows | System codes cannot be deactivated if referenced by workflow logic | Now — admin UI over existing tables |
| Custom fields | Tenant field definitions (name, type, validation, placement) stored as data; values in JSONB on the owning entity | Typed field kit only (text/number/date/select/money); no computed fields v1; per-entity field cap; custom fields never drive core workflow logic | Phase 2–3 |
| Validation rules | Declarative constraints on fields (required-if, range, regex from vetted library) | Predicate schema, not expressions; dry-run against existing data before activation | Phase 3 |
| Business/automation rules | Trigger (domain event) → condition (predicate on payload) → action (from a **vetted action catalog**: create task, send notification, assign, flag) | Actions cannot transition loan status past state-machine rules; loop protection (automation-triggered events don't retrigger automations beyond depth 1); per-tenant rate limits; full execution log | Phase 3–4 |
| Workflow rules | Parameterization first (SLA durations, required-conditions-per-program, assignment defaults); custom state machines much later, if ever | Custom statuses map onto canonical statuses so cross-tenant analytics/API semantics survive | Phase 3+ |
| Approval chains | Chain definitions as data (role sequences, thresholds) — generalized from the exception module's authority model | Chains attach only where the workflow engine exposes approval points | Phase 3 |
| Notification rules & templates | Event → audience → channel → template; versioned templates with typed variable slots | Sandboxed rendering (no arbitrary logic in templates); test-send required before activation | Phase 1–2 |
| Feature flags | Per-tenant capability toggles (also the DI/engine kill switches) | Flag inventory reviewed quarterly — flags are debt with a purpose | Phase 1 |
| Branding | Logo, colors, email identity | Asset validation; no custom CSS/JS injection | Phase 2 |
| Integrations | Vendor selection per category + credential entry | Credentials to vault, never to app DB; connection test required; enablement audited | Phase 2+ |
| Permissions & custom roles | v1: fixed roles (current five). v2: custom roles composed from a **permission catalog** | Tenants compose permissions; they cannot invent them. Admin-role changes are the highest-sensitivity audit events; last-admin lockout prevention | Phase 2 |

### 8.3 Platform-integrity invariants

1. **Tenant config can extend and parameterize; it can never bypass** — state machines, RBAC floors, audit, and tenancy isolation are not configurable.
2. **Every config change is an audited event** on the same infrastructure as loan events — an admin's action trail is a compliance surface.
3. **Config is exportable/importable** (tenant provisioning from templates, config-as-artifact for support reproduction).
4. **A broken config must fail safe:** a malformed rule disables itself with an admin notification; it never blocks loan workflow.

---

## 9. AWS Readiness (Section 7)

### 9.1 Honest current state

Local-only: docker-compose PostgreSQL, uvicorn dev server, Next.js dev server, `.env` files, no CI, no IaC, no observability beyond app logs, no backups beyond the developer's machine. This is appropriate for the current phase and is the program's largest gap relative to Phase 1 (a pilot lender cannot run on a laptop).

**Positives already banked:** the app is 12-factor-friendly (config via env — JWT secret and CORS origins already env-driven), stateless API (JWT), PostgreSQL-only persistence (RDS-ready), S3 already the designated document backend, and the outbox pattern is queue-ready by design.

### 9.2 Readiness assessment by area

| Area | State | Required before pilot (R1) | Required before enterprise (R2/R3) |
|---|---|---|---|
| Infrastructure as Code | None | Terraform from the first resource — no console-built infra, ever | Multi-env (staging/prod), module reuse |
| Containers | Postgres only | Dockerfile for backend + frontend; ECR; ECS Fargate (recommended over EKS — no cluster to operate at this team size) | Task autoscaling policies |
| CI/CD | None (Sprint 5 planned) | GitHub Actions: `run_tests.sh` on every PR (blocking), image build, deploy to staging; manual gate to prod | Migration-check job, coverage gates, canary or blue/green deploys |
| IAM | N/A | Least-privilege task roles; no long-lived keys in app; humans via SSO/Identity Center | Permission boundaries, separate prod account (AWS Organizations) |
| Secrets | `.env` files | AWS Secrets Manager (JWT secret, DB creds, vendor keys); injected at task launch | Rotation policies; tenant vendor-credential vault |
| Observability | App logs | Structured JSON logs → CloudWatch; error tracking (Sentry); basic dashboards + alarms (5xx, latency, DB connections, **outbox dispatch lag**) | Tracing (OTel), SLO definitions, on-call runbooks |
| Scaling | N/A | Single Fargate service ×2 tasks behind ALB is ample for pilot | Read replicas if analytics demands; worker service for jobs |
| Redis | Not used | **Not needed — do not add.** Sessions are JWT; queues are the outbox; cache pressure doesn't exist yet | Add only against a measured need (rate-limiting counters for Public API is the likely first real one, Phase 3) |
| Queues | Outbox table (Sprint 4) | Outbox + in-process dispatcher is sufficient | SQS fed by the outbox when consumers multiply (webhooks, DI jobs); DLQs + replay |
| RDS | docker-compose | RDS PostgreSQL, Multi-AZ, encrypted, automated backups, private subnet | Performance Insights; partitioning ADR for audit_log before ~10M rows (already flagged in ROADMAP) |
| S3 | Designated, unbuilt | Buckets with tenant-prefixed keys, SSE, versioning, lifecycle rules, access logging; pre-signed URL flows (this *is* the Document Platform, I-04) | Object Lock/retention for compliance classes; replication for DR |
| Backups / DR | None | RDS automated backups + tested restore procedure. **Define RPO/RTO now** (proposed pilot targets: RPO ≤ 1h, RTO ≤ 4h) | Cross-region snapshot copies; DR runbook + annual game-day; documented for SOC 2 |
| Cost management | N/A | Budgets + alerts from day one; tag everything via IaC | Per-tenant cost attribution (esp. DI per-page vendor costs, §5) |
| Cloud security | N/A | Private subnets for data plane, ALB-only ingress, WAF (basic managed rules), TLS everywhere, no public DB, httpOnly-cookie auth (Sprint 5 — a cloud-readiness item, not just app hardening) | GuardDuty, CloudTrail org-wide, Config rules, vulnerability scanning in CI, pen test before SOC 2 Type 1 |

### 9.3 AWS readiness roadmap

- **R0 — CI & containers** *(inside Sprint 5, Phase 0):* Dockerfiles, GitHub Actions test gate on every PR, image builds. No cloud spend yet.
- **R1 — Pilot deployment** *(Phase 1, ~1 quarter, parallel to Operational Depth):* Terraform baseline → VPC, RDS Multi-AZ, ECS Fargate + ALB, S3 (Document Platform lands here), Secrets Manager, CloudWatch + Sentry, staging + prod, backup/restore tested, budgets. **Exit test: pilot lender uses Origina in production; a restore drill has actually been run.**
- **R2 — Operational hardening** *(Phase 2):* SQS consumers off the outbox, worker service for async jobs, WAF/GuardDuty/CloudTrail posture, DR runbook + game-day, audit_log partitioning ADR executed, SOC 2 Type 1 groundwork (the roadmap already schedules this Q1 2027).
- **R3 — Platform scale** *(Phase 3+):* separate prod account, API edge (rate limiting, usage metering — first legitimate Redis candidate), tracing/SLOs, per-tenant cost attribution, DI worker fleet prep (Phase 5).

**Standing rule:** infrastructure follows the initiative that needs it. No Kubernetes, no service mesh, no Kafka, no Redis "because platforms have them." Every infrastructure component enters through a named initiative's requirement and a line in this document or an ADR.

---

## 10. Program Roadmap (Section 8)

Extends the existing Long-Term Phase Roadmap ([ROADMAP.md](ROADMAP.md)) to the 5-year horizon. Phases 0–5 keep their committed targets; 6–7 are directional.

### Phase 0 — Foundation *(now → Q3 2026)* — matches "Pilot-Ready"

- **Objectives:** Sprints 2–5: RBAC + user creation, condition lifecycle state machine, workspace wiring, **domain events outbox + notifications**, httpOnly cookies, CI, tenant onboarding.
- **Dependencies:** none — this phase *is* the dependency of everything else.
- **Critical path:** Sprint 2 RBAC → Sprint 4 events outbox → Sprint 5 CI + security. The outbox is the single most load-bearing deliverable of the year.
- **Success metrics:** pilot lender onboarded; CI blocking red PRs; zero P0 bugs in a 2-week pilot window; all B/C-gate tests green.
- **Business value:** converts demo into product; first revenue conversation possible.
- **Risks:** scope creep from this very document (mitigation: this document authorizes *nothing* before Phase 0 closes); single-developer throughput.
- **Expected outcome:** one real lender running real loans end-to-end.

### Phase 1 — Operational Excellence *(Q4 2026)* — matches "Operational Depth" + AWS R1

- **Objectives:** URLA (1003) model + editor; processing milestones; funding worksheet; decisioning as first-class object; **Document Platform (S3, I-04)**; document→condition linking; **AWS R1 production deployment**.
- **Dependencies:** Phase 0 closed; events outbox live.
- **Critical path:** AWS R1 (pilot can't be on a laptop) and Document Platform (gates the most downstream work).
- **Success metrics:** pilot lender processes a loan start-to-fund without leaving Origina, in the cloud; restore drill passed.
- **Business value:** retention of pilot; reference customer; documents = the biggest "what is mock" item eliminated.
- **Risks:** URLA scope is deceptively large (mitigate: Non-QM-relevant subset first); first production ops burden.
- **Expected outcome:** Origina is someone's system of record.

### Phase 2 — Enterprise Foundations *(Q1 2027)* — matches "Enterprise" + AWS R2

- **Objectives:** org hierarchy; SLA engine (on events); custom roles; SSO (SAML/OIDC); audit retention/export; SOC 2 groundwork; first vendor connectors (credit; email already live); **guideline corpus data model (content work begins)**; AWS R2 hardening.
- **Dependencies:** events (SLA), Admin Platform maturity, R1 infra.
- **Critical path:** SSO + SOC 2 groundwork (enterprise sales gates); Integration Platform framework with the credit connector.
- **Success metrics:** 3+ tenants; SSO live; SOC 2 Type 1 scheduled; one vendor integration in production use.
- **Business value:** multi-lender revenue; enterprise pipeline unblocked.
- **Risks:** multi-tenant isolation defects surface under real concurrency (mitigate: the skipped multi-tenant tests must be unskipped and expanded *before* tenant #2, not after).
- **Expected outcome:** Origina sells to lenders who ask hard questions and gets acceptable answers.

### Phase 3 — Platform Services *(Q2–Q3 2027)* — matches "Platform"

- **Objectives:** Public API v1 (read-only: status timeline + audit), API keys, webhooks, versioning policy + changelog, generated TypeScript SDK, one flagship CRM integration, partner sandbox; pricing vendor adapter; automation rules (vetted action catalog).
- **Dependencies:** stable internal contracts (earned in Phases 0–2), events, R2/R3 infra (rate limiting, metering).
- **Critical path:** versioning policy *before* first external consumer — a public API without one is a liability, not an asset.
- **Success metrics:** one partner integration in production; API uptime SLO met for a full quarter; SDK downloaded/used outside Origina.
- **Business value:** the platform thesis gets its first external proof; API usage is a new metered revenue line.
- **Risks:** public contracts freezing immature domains (mitigate: read-only first — already the standing rule).
- **Expected outcome:** Origina's backend demonstrably powers something Origina didn't build.

### Phase 4 — Decisioning Engines *(Q3 2027 → Q1 2028)* — matches "Engines"

- **Objectives:** eligibility rules engine on the guideline corpus (M2–M4 of §6.2); investor overlays; explainable findings with citations and compensating factors; condition auto-generation on submission; pricing build-vs-buy ADR decided and executed.
- **Dependencies:** guideline corpus (Phase 2 content), exception-module authority patterns, Admin Platform rules infrastructure.
- **Critical path:** corpus quality — the engine is only as good as its content; content work must not start in this phase (it starts in Phase 2).
- **Success metrics:** ≥95% agreement with manual UW determinations on a measured sample; underwriters voluntarily using findings (adoption, not just availability).
- **Business value:** the differentiating IP goes live; per-decision monetization becomes possible.
- **Risks:** fair-lending exposure (mitigate: advisory-only default, per-rule opt-in blocking, full audit); content maintenance burden underestimated.
- **Expected outcome:** Origina knows Non-QM in a way competitors can't copy from screenshots.

### Phase 5 — AI Platform *(Q4 2027 → 2028)* — matches "AI" per the AI Scope ADR

- **Objectives:** async jobs + `ai_annotations` infrastructure; Document Intelligence (classification → extraction → validation → missing-doc detection, per §5); loan summaries; guideline Q&A over the corpus; eligibility API opens to external consumers (M5).
- **Dependencies:** the full ADR prerequisite chain — S3 ✓(P1), events ✓(P0), async jobs (here), annotations (here), corpus ✓(P2/P4).
- **Critical path:** review-queue UX — AI features live or die on whether the human loop is fast and trusted.
- **Success metrics:** classification ≥95% acceptance in review UI; measurable minutes-saved per file; DI cost per file < value of time saved.
- **Business value:** labor compression = quantifiable ROI story; AI premium tier.
- **Risks:** provider cost at scale (mitigate: §5 cost tracking + provider swap); accuracy trust erosion from one bad rollout (mitigate: confidence gating, staged tenant enablement).
- **Expected outcome:** processing a Non-QM file in Origina is measurably faster than anywhere else.

### Phase 6 — Partner Ecosystem *(2028–2029)*

- **Objectives:** write APIs (loan creation for broker portals / point-of-sale); document APIs; eligibility + pricing APIs GA; partner certification program; broker-portal product (first-party, built on the public API); webhook marketplace patterns; possibly white-label.
- **Dependencies:** Phase 3 API maturity + Phase 4/5 engines worth consuming.
- **Success metrics:** N partners in production; API revenue meaningful (target: ≥10% of revenue); a partner builds something Origina didn't anticipate.
- **Business value:** ecosystem lock-in; revenue decoupled from Origina-built screens.
- **Risks:** support burden of external developers; abuse/security surface of write APIs.
- **Expected outcome:** "mortgage operating platform" is a description, not an aspiration.

### Phase 7 — Enterprise Expansion *(2029–2031, directional)*

- **Objectives:** adjacent-market options exercised by evidence: additional channels (correspondent; retail if demanded), servicing-adjacent handoffs, investor delivery, benchmark data products (consent-governed), possible geographic/regulatory expansion; SOC 2 Type II sustained; scale re-architecture only where measured (service extraction per §4.8 triggers).
- **Success metrics:** revenue diversification across LOS seats / API usage / engines / data; retention through at least one rate-cycle downturn.
- **Risks:** the Non-QM market is rate-cycle sensitive — the platform's multi-product surface is itself the hedge.

---

## 11. Operational Intelligence & Success Metrics *(added 2026-07-08)*

### 11.1 The principle: system of intelligence, not system of record

Most LOS products store data and execute workflows. Origina additionally **measures how work flows through the organization and uses that measurement to improve operations** — identifying bottlenecks, explaining where time is lost, and recommending what to improve next. This is adopted as a first-class architecture principle, peer to modularity and multi-tenancy.

**The three-questions rule — every feature must answer, before it is built:**

1. **What business process does this support?**
2. **How do we know if it is successful?**
3. **What telemetry should it emit?**

The rule is enforced through the Definition of Ready (§12.2): a sprint item without a named process, a success signal, and a telemetry plan is not Ready. Observability is designed in, never bolted on — because telemetry not collected is gone forever, *emission discipline* is the part that must exist from the start, even while dashboards and registries follow the maturity ladder (§11.7).

### 11.2 The head start: Origina is already OI-shaped

Several existing decisions were unknowingly operational-intelligence infrastructure:

- **`loan_status_events`** (event sourcing ADR) already yields entered/exited/duration per status — the status-duration table (*status, entered, exited, duration, target SLA*) is a **SQL view over data already collected**, not a new system.
- **`audit_log` JSONB diffs** already support field-stability analytics (which fields change, how often, after which events) without ever exposing field values.
- **`ai_annotations`** (AI Scope ADR) was designed with `confidence`, `model_version`, `reviewed_by` — the AI measurement loop (acceptance/correction/time-saved) is pre-wired.
- **The domain events outbox** (Sprint 4 ADR) is the telemetry backbone; OI adds consumers, not a second pipeline.

This is why OI-0 (§11.7) costs days, not quarters.

### 11.3 Telemetry architecture

Three event classes, one backbone:

| Class | Examples | Producer | Transport | Guarantee |
|---|---|---|---|---|
| **Domain events** (business facts) | `loan.submitted`, `condition.cleared`, `exception.decided` | Services, same-transaction | Outbox (per ADR) | Never sampled, never dropped — these are business records |
| **System events** (machine work) | Job runs; automation executions (duration, outcome, corrections); AI invocations (provider, cost, confidence, disposition); vendor calls (latency, result) | Workers, adapters, dispatcher | Outbox or direct telemetry sink | At-least-once; adapters emit cost/outcome as a framework feature (§5.1) |
| **Interaction events** (UX) | Screen view/dwell, action clicks, form abandonment, field edit counts | Frontend batch beacon | Dedicated ingestion endpoint → telemetry store | Sampled, batched, sheddable |

**Collection rules (non-negotiable):**

1. **Fail-open, never blocking.** A telemetry failure must never fail or slow business work. Frontend beacons batch and drop on backpressure; backend emission is async off the request path (except domain events, which are transactional by design).
2. **Metadata only, never values.** Field telemetry records *that* `income` was edited 3 times and *what class of event preceded the edit* — never the contents. No PII in any telemetry payload, ever. This single rule removes most privacy risk by construction.
3. **Tenant-scoped** like every other row in the platform.
4. **Versioned envelope:** `event_type`, entity refs, `tenant_id`, actor *role* (actor id only where §11.6 permits), `occurred_at`, `schema_version`.
5. **Sampling policy per class:** interaction events may be sampled; domain and system events may not.

**Storage evolution** (per the §9 rule that infrastructure follows measured need): telemetry tables + SQL views (Phases 0–2) → event-fed read models/marts (Phase 3) → dedicated pipeline (e.g., Firehose → S3 + Athena) only when volume demands it.

**Boundary with Analytics (I-10):** Analytics answers *"what is my pipeline?"* (business state, tenant-facing). Operational Intelligence answers *"how does work flow?"* (process performance — tenant-facing *and* Origina-facing product feedback). They share the backbone and read-model infrastructure; they differ in question, audience, and ownership — OI owns the metric registry and KPI definitions.

### 11.4 The measurement model: measure the loan, the status, the handoff

**A loan is not a row with a status — it is a bundle of timelines:**

| Timeline | Source | Status |
|---|---|---|
| Status timeline | `loan_status_events` | Exists today |
| Activity timeline | Domain events (tasks, notes, edits) | Sprint 4 outbox onward |
| Decision timeline | Exception/decision events; Decisioning findings later | Exceptions portion exists |
| Document timeline | Document Platform events (requested → received → reviewed → satisfied) | Phase 1 |
| Communication timeline | Notification events | Sprint 4 |
| Performance timeline | **Derived** — durations, waits, touches computed from all of the above | OI views |

**Measure every status:** duration in status vs a target SLA, where SLA targets are *data* (tenant-configurable via Admin Platform) — the same targets the Phase 2 SLA engine enforces. One definition, two consumers.

**Measure every handoff:** decompose cycle time into **touch time vs wait time**. Mortgage files spend the large majority of their life waiting (for the appraisal, for broker docs, for the next queue); the wait:touch ratio per handoff (e.g., processor → underwriter: avg wait 1.8 days vs a 4-hour goal, dominant reason: missing appraisal) is the single most actionable operations metric the platform can produce.

**Measure bottlenecks:** a standing top-delays report (appraisal 2.7d, broker docs 1.8d, conditions 1.2d, title 0.9d) turns the automation roadmap into a query result instead of a debate.

**Measurement domains, with guardrails:**

| Domain | What is collected | What is derived | Phase | Guardrail |
|---|---|---|---|---|
| Statuses | Already collected | Durations, SLA attainment, idle time | OI-0 | — |
| Workflow/handoffs | Domain events | Wait vs touch, queue depths, top delays | OI-1 | — |
| Human work | Task/action events | Files per role, touch time, turnaround, reopen rate | OI-2 | Aggregate-first (§11.6) |
| Screens | Interaction events | Dwell, visits, abandonment, dead screens | OI-2 | Sampled; no PII |
| Fields | Edit metadata from audit diffs + interaction events | Edit frequency, stability, "usually changes after X" | OI-3 | Metadata only, never values |
| Automations | System events per execution | Time saved, accuracy, correction rate, ROI — **no automation ships unmeasured** | OI-3 (standard from first automation) | — |
| AI features | `ai_annotations` dispositions | Acceptance %, correction %, ignored %, minutes saved | With each AI feature (Phase 5) | Already mandated by AI Scope ADR |

Field-stability analytics deserve emphasis: knowing that `income` averages 3.2 edits and usually changes after VOE/paystub/tax-return events directly drives better validation, smarter UI ordering, AI suggestion targeting, and document-request sequencing — it is the feedback loop between OI and every other engine.

### 11.5 KPI framework and per-initiative success metrics

**Metric registry as data** (consistent with rules-as-data and controlled values): every KPI has an id, a definition/formula, source events, an owner, a target, and a version. A metric not in the registry is an anecdote. The registry is what makes "average underwriting time" mean the same thing on every dashboard, in every tenant, in every board deck.

**Platform KPI tree:**

- **North star:** submit→fund cycle time (median and p90)
- **Flow:** per-status duration, wait:touch ratio, SLA attainment, WIP per role/queue
- **Quality:** conditions per loan, first-pass clear rate, condition reopen rate, exception rate
- **Conversion:** pull-through funnel (submitted → approved → funded)
- **Leverage:** automation coverage %, minutes saved per file, AI acceptance %
- **Platform health:** outbox dispatch lag, API SLO, job failure rate

**Per-initiative success metrics (binding — reviewed at every milestone review, §12.2):**

| Initiative | Success metric |
|---|---|
| I-01 LOS | Pilot lender funds loans end-to-end; submit→fund cycle time measured and improving quarter over quarter |
| I-02 Platform Eng | CI blocks red PRs; restore drill passed; deploy lead time < 1 day |
| I-03 Workflow | Zero invalid transitions accepted; ≥30% reduction in average status wait time within two quarters of SLA rollout |
| I-04 Document Platform | 100% of documents durable/versioned/audited; upload success ≥99.9% |
| I-05 Notifications | ≥90% of routine status communications sent automatically (no manual email) |
| I-06 Admin Platform | New tenant configured without code changes or deploys |
| I-07 Decisioning | ≥95% agreement with manual UW determination (existing gate); 100% of findings carry a guideline citation |
| I-08 Pricing | Scenario priced in <5s; zero lock-desk pricing errors from stale sheets |
| I-09 Document Intelligence | ≥95% extraction accuracy on supported doc types; measurable minutes saved per file; correction rate <5% |
| I-10 Analytics | Tenant managers run weekly business reviews self-serve (zero ad-hoc SQL requests) |
| I-11 Public API | New partner from sandbox to first successful call in <1 day; SLO met every quarter |
| I-12 Integration | New vendor connector shipped in ≤2 weeks on the framework; vendor outage never blocks the loan workflow |
| I-13 AI | ≥80% suggestion acceptance in review UI; time saved measured per feature; zero auto-decisioning incidents |
| I-14 OI | Every initiative above reports its metric **from the platform itself**, not from spreadsheets |

### 11.6 Privacy, ethics, and performance guardrails

1. **Measure processes first, people carefully.** Human-work metrics default to team-level aggregates. Individual-level metrics are a tenant-admin opt-in, role-gated, and disclosed to affected users; Origina never surfaces individual productivity across tenants. This is ethics and enterprise pragmatism at once — HR and works-council sensitivities are real sale-blockers.
2. **No PII, no field values in telemetry** (rule 2 of §11.3) — structural metadata only, by construction.
3. **Tenant owns its telemetry.** Cross-tenant benchmarking exists only under the consent-governed data-products track (§15), anonymized and aggregate.
4. **Performance budget.** Interaction telemetry is batched, sampled, and sheddable; a per-tenant OI kill switch (feature flag) exists like every optional subsystem. Telemetry that slows the product destroys more value than it measures.
5. **Predictions are about loans and process, never about borrowers' protected characteristics.** Any predictive model's feature list gets fair-lending review (ties to §13 risk #4 and the AI Scope ADR's advisory-only rule).

### 11.7 Maturity ladder (mapped to roadmap phases)

| Level | Capability | Phase | Cost |
|---|---|---|---|
| **OI-0** | Status-duration views over `loan_status_events`; outbox dispatch-lag metric; audit-derived field-change statistics | Phase 0–1 | Days — data already exists |
| **OI-1** | SLA targets as data + attainment dashboards; wait/touch decomposition per handoff; standing top-bottlenecks report | Phase 1–2 (with SLA engine) | Small — rides Sprint 4 events |
| **OI-2** | Interaction telemetry (screen usage, abandonment); aggregated human-work metrics; metric registry v1; executive dashboards | Phase 2–3 | Medium |
| **OI-3** | Field-stability analytics; automation-ROI instrumentation as a shipping standard; internal benchmarking | Phase 3–4 | Medium |
| **OI-4** | Predictive: delay-risk flags, cycle-time forecasts, workload-balancing suggestions; AI measurement loop closed | Phase 5+ | Large — but trains on data collected since OI-0 |

### 11.8 What predictive analytics become possible

Once OI-1 through OI-3 data accumulates, the following are straightforward modeling problems rather than data-collection projects: **cycle-time prediction** per file (expected fund date ± confidence); **delay-risk scoring** (which files will miss SLA, and the dominant cause); **bottleneck forecasting** (queue load vs capacity next week); **condition prediction** (which conditions this file profile will attract — feeding Decisioning and document-request sequencing); **staffing models** (workload vs throughput). All advisory, all explainable-first, all consuming events already emitted. This is the compounding return of emission discipline: the Phase 5 AI platform trains on data OI began collecting in Phase 0. A platform that skips this step spends Phase 5 building collection instead of intelligence.

---

## 12. Program Governance (Section 9)

The program already practices real governance (ADRs with honest consequences, a PMO portfolio, sprint specs, B-gate testing, a quarterly architecture review that produced two ADRs). Codify and extend:

### 12.1 Decision governance
- **ADRs** ([DECISIONS.md](DECISIONS.md)) remain the decision record. Threshold: *any decision that would surprise a new developer, bind a vendor, or freeze a contract.* Deprecate, never delete. **New rule:** every "buy" decision and every public-API surface requires an ADR before implementation.
- **Quarterly architecture reviews** (established 2026-07-07 — continue): portfolio phase check against this document, debt tracker triage, ADR review, extraction-trigger check (§4.8), flag inventory review. This document is re-ratified or amended at each review.
- **This document** is reviewed quarterly and substantially revised at each phase boundary.

### 12.2 Delivery governance
- **Sprint cadence** with build specs (current practice — keep). Sprint scope must trace to a portfolio initiative and phase; work that traces to nothing is rejected or the portfolio is amended first.
- **Definition of Ready** (new): a sprint item is Ready when it has a build spec section, named acceptance tests (B-gate style), identified ADR needs, no unresolved dependency on an unbuilt substrate — and answers the three operational-intelligence questions (§11.1): the business process it supports, its success signal, and the telemetry it emits.
- **Definition of Done** (exists in [ROADMAP.md](ROADMAP.md) — reaffirmed): feature shipped + named tests green + test paths linked + zero skipped tests referencing the item.
- **Testing gates:** B/C-gate pattern continues; coverage gates (70% API, 90% state machines) enforced in CI from Sprint 5; multi-tenant isolation tests are release-blocking from tenant #2 onward.
- **Release gates** (from Phase 1, when production exists): CI green + migrations rehearsed on staging + rollback noted + security-sensitive changes flagged for review. Phase 2 adds: SLO check, audit of config/permission changes.
- **Milestone reviews** at each phase boundary: success metrics evaluated honestly against §10; a phase that misses its exit metric does not roll into the next phase by momentum.

### 12.3 Risk & debt governance
- **Technical debt reviews:** the debt tracker ([ROADMAP.md](ROADMAP.md)) is triaged at each quarterly review; every accepted debt gets an owner-phase; debt older than two phases is either paid or explicitly re-accepted with reasoning.
- **Risk register:** §13 of this document seeds it; reviewed quarterly; each Critical risk carries a named mitigation that appears somewhere in a sprint plan or phase objective — a risk with no scheduled mitigation is a decision to accept it, and must say so.
- **Documentation standards** (current practice — keep): PMO for portfolio state, ROADMAP for plan + debt, DECISIONS for ADRs, sprint specs for execution detail, architecture docs per domain. Each doc's maintenance rules stay in its footer.

---

## 13. Critical Risks

Ranked by (impact × likelihood), with mitigations:

1. **Platform-before-product sequencing failure.** The perennial killer. *Mitigation:* the standing rule (no platform work before Phase 0/1 closes) is repeated in three documents including this one; quarterly review enforces it.
2. **Single-operator concentration (bus factor = 1).** A founder + AI agents builds fast but everything — architecture, ops, content, sales — funnels through one person; production on-call makes it acute at Phase 1. *Mitigation:* ruthless boring-technology choices (§9's "no Kubernetes" rule), runbooks as a Phase 1 deliverable, managed services everywhere, and honest phase pacing.
3. **Multi-tenant isolation defect in production.** Query-level isolation is convention-enforced; one missed `tenant_id` filter is a breach with regulatory consequences. *Mitigation:* unskip and expand multi-tenant tests before tenant #2 (Phase 2 gate); consider PostgreSQL RLS as defense-in-depth (ADR candidate for Phase 2); isolation tests release-blocking.
4. **Compliance/regulatory exposure ahead of controls.** PII (SSNs, financials, documents) + fair lending + state licensing regimes. *Mitigation:* SOC 2 groundwork on the committed Phase 2 timeline; advisory-only decisioning; the annotations/audit patterns; httpOnly-cookie auth in Sprint 5; documents encrypted with access audit from day one of I-04.
5. **Test coverage lagging feature velocity.** Already flagged as PMO risk; refactor risk compounds each phase. *Mitigation:* CI gates in Sprint 5 are non-negotiable; DoD enforcement; coverage gates in Phase 1 CI.
6. **Guideline corpus quality/maintenance underinvestment.** The Phase 4 engine is content-bound, and content is unglamorous work that starts in Phase 2. *Mitigation:* treat corpus authoring as a tracked initiative deliverable with its own success metrics, not a side task.
7. **Vendor lock-in via expedient integration.** The first vendor integrated without an adapter becomes load-bearing forever. *Mitigation:* the adapter framework lands *with* the first integration (Sprint 4 email), not after; ADR per vendor.
8. **Non-QM market cyclicality.** Rate cycles can halve the segment. *Mitigation:* the platform strategy itself (engines and APIs sell into more weather than seats do); watch Phase 6 diversification options.
9. **Contract freeze on an immature domain.** A public API published too early ossifies mistakes. *Mitigation:* read-only-first rule; versioning policy as a Phase 3 entry gate.
10. **audit_log / events growth without a partitioning strategy.** Known debt. *Mitigation:* partitioning ADR before ~10M rows (tracked; execute in Phase 2 R2 work).

---

## 14. Technical Debt Considerations

The debt tracker in [ROADMAP.md](ROADMAP.md) remains authoritative. Program-level observations:

- **Debt that blocks the platform thesis (pay first):** business logic inline in routers (violates the thin-router platform boundary — the migration rule "opportunistically when touching each domain" is correct, but Phase 3's public API is the hard deadline: no route goes public with inline logic); role vocabulary split (Sprint 2, correctly); bare `list[X]` endpoints (Sprint 2 — envelope consistency is an API-platform prerequisite, not cosmetics).
- **Debt that blocks enterprise (pay by Phase 2):** JWT in localStorage (Sprint 5, committed); multi-tenant test seeds (before tenant #2); audit_log partitioning ADR.
- **Debt to hold deliberately:** mixed data-fetching idioms (the "new code uses React Query" rule is the right amortization); `@shadcn/ui` dummy; bcrypt pin; `getLoanById` limit-1000 smell (Sprint 3 touch rule).
- **Debt this document creates knowingly:** modular-monolith boundaries enforced by convention rather than tooling — acceptable now; if module-boundary violations recur in review, adopt import-linting (a one-day fix, deferred until evidence demands it).

---

## 15. Future Expansion Opportunities

Beyond the committed horizon, in rough order of adjacency: **broker point-of-sale** (first-party portal on the public API — Phase 6 flagship); **eligibility-as-a-service** for CRMs/pricing sites (the widest-funnel monetization of the Decisioning Platform); **investor delivery/marketplace** (matching Non-QM loans to investor appetite — a two-sided play that the overlay engine naturally seeds); **correspondent channel support**; **benchmark analytics products** (consent-governed, anonymized market intelligence from cross-tenant data — governance-heavy, revisit at scale); **white-label LOS** for banks/credit unions entering Non-QM; **servicing handoff integrations** (not servicing itself).

None of these are authorized by this document; each requires a phase-boundary portfolio amendment.

---

## 16. Recommended Next Initiatives

In order, and deliberately boring:

1. **Finish Sprint 2 exactly as specified** (RBAC/user creation, role vocabulary, condition lifecycle, pagination envelopes). Nothing in this document changes the active sprint.
2. **Sprints 3–5 as planned**, with two emphases elevated by this review: the **Sprint 4 outbox** is the program's most load-bearing deliverable of 2026 — build it with the dispatcher observable (lag metric) from day one; and **Sprint 5 CI** is the governance keystone — no phase advances without it.
3. **AWS R0/R1** (containers + CI inside Sprint 5; pilot deployment in Phase 1) — start the Terraform baseline as soon as Sprint 5 closes.
4. **Document Platform (I-04)** immediately after R1 exists — it un-gates more of the portfolio than anything else its size.
5. **Adopt this document's governance additions** at the next quarterly architecture review (Definition of Ready with the three OI questions, release gates, risk register, buy-decision ADR rule) and ratify the consolidated 13-initiative portfolio — including Operational Intelligence (I-14) — into [PMO.md](PMO.md).
6. **Begin guideline corpus design as a Phase 2 content workstream** — the longest-lead-time input to the Phase 4/5 differentiators.
7. **Stand up OI-0** (§11.7): status-duration views over `loan_status_events`, the outbox dispatch-lag metric, and audit-derived field-change statistics — days of work over data already collected, and the first concrete proof of the operational-intelligence principle.

---

## 17. Open Questions

Decisions the program must make, none of which block Phases 0–1:

1. **Pricing build-vs-buy** — the standing ADR gate. Leading question: is any PPE vendor's Non-QM coverage adequate, or is native Non-QM pricing actually the moat? (Decide Phase 4; gather vendor evidence during Phase 2–3.)
2. **Hosting model at enterprise scale** — pooled multi-tenant only, or will a large lender demand dedicated/single-tenant deployment? Affects Terraform module design (cheap to keep optional now, expensive to retrofit).
3. **PostgreSQL RLS as tenancy defense-in-depth** — worth the operational complexity? (ADR candidate, Phase 2.)
4. **MISMO commitment depth** — import convenience only, or full bidirectional MISMO 3.x as a platform citizen (investor delivery implies the latter)? (Decide by Phase 3.)
5. **Who operates production** — at what phase does the program need its first non-founder operator/engineer, and which competency first (ops, backend, or guideline content)?
6. **Monetization architecture** — seats vs per-funded-loan vs API metering will shape usage-tracking requirements; billing infrastructure has lead time. (Decide pricing model during Phase 1 pilot; build metering hooks into the Public API from v1.)
7. **SOC 2 Type II timing and auditor selection** — Type 1 is scheduled (Phase 2); Type II's observation window means the clock starts earlier than intuition suggests.
8. **Guideline corpus licensing** — are investor guidelines redistributable as engine content, or must the corpus be tenant-supplied for licensing reasons? (Legal question with architectural consequences for the Decisioning Platform; resolve before Phase 4.)
9. **First flagship CRM** for the Phase 3 integration — pick by pilot-lender demand, not market share.
10. **Fair-lending review process for engine rules** — who signs off that a rule set is compliant before a tenant enables blocking mode? (Process question; must be answered before M4.)
11. **Individual-level performance metrics policy** — §11.6 proposes team aggregates by default with tenant-admin opt-in and disclosure for per-person metrics; ratify that posture (and its HR/sales implications) before OI-2 ships human-work dashboards.

---

*Maintenance: this document is owned by the architecture board, reviewed at each quarterly architecture review, and substantially revised at each phase boundary. Portfolio state lives in [PMO.md](PMO.md); execution detail lives in sprint specs; decisions live in [DECISIONS.md](DECISIONS.md). When this document and an ADR conflict, the ADR wins until superseded.*
