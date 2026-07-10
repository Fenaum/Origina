# Origina — Configuration Platform & Decision Platform Architecture

> **Status:** Proposal (architecture blueprint, no implementation)
> **Date:** 2026-07-09
> **Scope:** Goal 1 — Safe tenant customization (Configuration Platform + Admin Studio). Goal 2 — Unified Guideline / Eligibility / Validation / Condition decisioning (Decision Platform).
> **Related:** [DECISIONS.md](DECISIONS.md) · [architecture/settings.md](architecture/settings.md) · [architecture/exceptions.md](architecture/exceptions.md) · [ROADMAP.md](ROADMAP.md) · [research/](research/README.md) (external validation: the SaaS-LOS deep-research report independently converges on this skeleton; its adoptable findings are folded in below, marked ⊕)

---

## 0. Executive Summary

Origina should build **one platform spine with two consumers**, not two platforms.

Both goals — tenant configuration and business rules — reduce to the same underlying problem: *tenant-scoped, versioned, validated, auditable definitions that the runtime resolves deterministically.* Branding, field behavior, workflow transitions, and eligibility guidelines are all "definitions." They differ in blast radius and authoring UX, not in lifecycle mechanics.

The architecture therefore has three planes:

```
┌─────────────────────────────────────────────────────────────────────┐
│ DEFINITION PLANE (authoring-time, slow-moving, admin-facing)        │
│   Canonical Field Registry · Config Namespaces · Rule Authoring     │
│   Releases (draft→validate→approve→publish) · Simulation            │
├─────────────────────────────────────────────────────────────────────┤
│ RUNTIME PLANE (request-time, read-mostly, deterministic)            │
│   Config Resolver (cached snapshots) · Rule Evaluator (pure)        │
│   Outcome Dispatcher (validations, conditions, exceptions, UI)      │
├─────────────────────────────────────────────────────────────────────┤
│ EVIDENCE PLANE (append-only, compliance-facing)                     │
│   Decision Records · Config Version History · audit_log             │
│   domain_events outbox → notifications, webhooks, analytics         │
└─────────────────────────────────────────────────────────────────────┘
```

### Positions taken (where this diverges from the brief)

The brief asked for challenges where warranted. These are the load-bearing disagreements; each is argued in its section:

| # | Brief says | This blueprint says | Why |
|---|---|---|---|
| 1 | Configuration Platform and Decision Platform as two designs | One versioning/release/audit spine; rules are just the highest-risk config namespace | Two lifecycles = two Admin Studios, two audit models, double maintenance |
| 2 | "No configuration should become active immediately after editing" — universal draft→approve lifecycle | **Tier ceremony to blast radius.** Branding/terminology publish directly (versioned + auditable + revertible). Fields/workspace get draft→publish. Workflow/rules/products get the full lifecycle with approval and simulation | A 7-stage release process for changing a logo trains admins to rubber-stamp; ceremony must be proportional to risk or it stops being a control |
| 3 | Environment promotion (dev→test→prod configs) | **No config environments.** One production; each tenant gets a *sandbox workspace* (draft config + simulation against real data, read-only). Promotion = publishing a release | You run one SaaS deployment. Config environments recreate the "works in staging" problem for data that never leaves the database |
| 4 | Rule inheritance resolved by the engine at evaluation time | **Resolve at publish time.** Publishing compiles the layer stack (base→investor→lender→product→program→overlay) into a flat, immutable *effective rule set* with per-rule provenance | Runtime layer-walking makes every evaluation slower, every replay ambiguous, and every bug a 6-layer archaeology dig. Compile-time flattening keeps explainability (provenance is stored) and makes replay trivial |
| 5 | Terminology renaming as a configuration domain | Terminology is a **presentation overlay only** — a label map applied at the UI/notification/document layer. Stored codes, APIs, rules, and analytics never see tenant labels | Already the `controlled_values` model (system code + tenant label). Letting renames penetrate deeper than display is how data corruption starts |
| 6 | (implied) a general-purpose rules engine | **Do not adopt a BRMS** (Drools, Camunda DMN, etc.) and do not build a general one. Build a small, typed expression evaluator over the field registry (~1–2k lines). The hard part is the data dictionary and lifecycle, not the evaluator | Off-the-shelf engines bring their own authoring model, versioning, and ops burden, and still need all the Origina-specific work (field registry, decision records, tenant isolation). The constrained grammar makes a bespoke evaluator small and testable |
| 7 | Field conditional visibility as its own configuration feature | Conditional visibility/required/readonly conditions **reuse the rule expression grammar**. One expression model everywhere | Two condition mini-languages is duplicated parsers, duplicated validation, duplicated simulation |
| 8 | Build the Admin Studio as the deliverable | The **field registry is the keystone and Phase 0**. Studio modules ship incrementally on top; Workspace Designer ships last | Every other component (rules, field config, validation, analytics) references field IDs. Get the registry wrong and everything above it is rework |

---

## 1. First Principles — What Origina Already Has

This is not greenfield. Several platform primitives exist and should be *promoted*, not replaced:

| Existing asset | Platform role it grows into |
|---|---|
| `controlled_value_sets` / `controlled_values` (tenant shadowing via `tenant_id IS NULL` default + tenant override) | The Tier-1 config pattern, and the terminology overlay. Becomes one namespace inside the Configuration Platform |
| TEXT + CHECK everywhere, no ENUMs (ADR, migrations 122–125) | Tenant-defined statuses/programs without schema change — the DB was already prepared for this platform |
| `loan_status_events` (append-only event sourcing) + audit triggers + `get_audited_db` actor propagation | The Evidence Plane pattern. Decision Records and Config Versions follow the same `AppendOnlyModel` discipline |
| `domain_events` transactional outbox (ADR, lands Sprint 4) | The delivery spine for rule-outcome side effects, analytics feed, and re-evaluation triggers |
| Exceptions module (`decide_exception()`, decisions, events, comments, authority rules) | The **manual predecessor** of the Decision Platform. Exceptions become one *outcome type* of rule evaluation; the human decisioning flow already built becomes the override/waiver workflow |
| `condition_lifecycle.py` state machine (Sprint 2) | Conditions become a rule *outcome*; the lifecycle machine is unchanged — rules only decide *when a condition is generated* |
| Settings module plan (`architecture/settings.md`, migrations 126–131 reserved) | The Admin Studio shell. Tier-2 `/admin/*` IA is already designed; Studio modules slot into it |
| `docs/Data-Dictionary/DATA_DICTIONARY.md` | Today a document; becomes **data** — the seed content for the canonical field registry |
| Loan split (`loans` / `loan_financials` / `loan_terms`) | Clean fact sources for the field registry (`loan.*`, `financials.*`, `terms.*` map to real columns) |

The strategic implication: Origina's platform bet was effectively placed with the TEXT+CHECK and controlled-values decisions. This blueprint is the second story of that building, not a new building.

---

## 2. Canonical Data Dictionary — the Keystone

Everything else references this. Build it first.

### 2.1 Field Registry

A `field_registry` table (system-scoped, *not* tenant-writable) where every field usable in configuration or rules is registered:

```
field_registry
  field_id          TEXT PK        -- stable dotted path: "borrower.fico_representative"
  domain            TEXT           -- loan | borrower | property | financials | terms | income | asset | document
  data_type         TEXT CHECK     -- number | integer | money | percent | text | code | boolean | date
  code_set          TEXT NULL      -- FK → controlled_value_sets when data_type = 'code'
  mismo_anchor      TEXT NULL      -- MISMO logical-data-model concept this field maps to, where one exists
  source_kind       TEXT CHECK     -- stored | computed | external
  source_ref        TEXT           -- table.column for stored; calculator id for computed; integration id for external
  nullable_meaning  TEXT           -- what NULL means: 'not_collected' | 'not_applicable' — drives UNKNOWN semantics
  security_class    TEXT CHECK     -- public | internal | pii | pii_restricted (SSN-class)
  configurable      BOOLEAN        -- may tenants change required/visible/default?
  rule_usable       BOOLEAN        -- may rules reference it?
  default_label     TEXT           -- system label; tenants override via terminology overlay
  since_version     INTEGER        -- registry versioning
  deprecated        BOOLEAN
```

Design rules:

- **Stable IDs, never labels.** Rules and config reference `borrower.fico_representative`. A tenant renaming it "Qualifying Credit Score" changes only the terminology overlay. Every rule keeps working — this is the exact requirement in the brief, satisfied structurally.
- ⊕ **Anchor to MISMO where a concept exists.** `mismo_anchor` maps registry fields to MISMO logical-data-model concepts (`borrower.fico_representative` → MISMO Borrower/Credit). Internal IDs stay product-friendly; the anchor is metadata. Costs one nullable column now; buys cheap investor/vendor integration mapping and eventual MISMO XML/JSON export later — every inbound integration translates into canonical vocabulary before decisioning. (Source: SaaS-LOS research report.)
- **Allowed operators derive from `data_type`**, not per-field lists: numbers get `= ≠ < ≤ > ≥ between`, codes get `in / not in` (validated against the field's `code_set`), booleans get `is`, dates get comparisons plus relative-date functions (`age_in_days`). Per-field operator lists are a maintenance trap; type-driven operators are one table smaller and always consistent.
- **Computed fields have exactly one owner.** `financials.ltv`, `income.dscr`, `asset.reserves_months` are registered with `source_kind = computed` and a `calculator_id`. Calculators are versioned code (a registry of pure Python functions), not tenant-authorable — this satisfies "customers cannot disable required calculations" structurally: there is no configuration surface that reaches a calculator. Rules consume computed values; they never re-derive them.
- **`nullable_meaning` powers three-valued logic.** The evaluator's UNKNOWN handling (§5.4) needs to know whether a missing FICO means "not yet collected" (→ UNKNOWN + suggested action "order credit") or "not applicable" (→ NOT_APPLICABLE).
- **`security_class` gates authoring.** Rule authoring UI and simulation output can reference `pii` fields by comparison but never display raw values for `pii_restricted` (SSN never appears in a rule, a decision record, or a simulation result — extend the existing SSN invariant into the platform).
- **`rule_usable` and `configurable` are explicit allowlists.** New fields default to `false/false`; exposing a field to tenants is a deliberate registry change, reviewed like code.

### 2.2 Governance

- The registry ships as **seed data in migrations** (like controlled-value seeds) — versioned in git, reviewed in PRs. Tenants never write to it.
- The existing `DATA_DICTIONARY.md` doc becomes generated *from* the registry, not maintained in parallel.
- Registry changes are additive-or-deprecate: fields are never deleted while any published rule or config version references them (dependency validation, §4.4, enforces this).

---

## 3. Overall Architecture & Service Boundaries

### 3.1 Modular monolith, real module boundaries

Stay in the FastAPI monolith. Introduce these as **modules with hard import discipline**, not deployed services:

```
src/backend/app/
  platform/                      ← new top-level package (the spine)
    registry/                    field registry, calculators
    config/                      namespaces, versions, releases, resolver
    rules/                       rule model, compiler, evaluator, outcomes
    simulation/                  batch evaluation, comparison, impact reports
  services/                      existing domain services — become CONSUMERS
    loan_repo.py                 calls rules.evaluate(context=submission)
    condition_lifecycle.py       receives generate-condition outcomes
    exception_repo.py            receives create-exception outcomes
```

Boundary rules (enforceable by import-linting later):

- `platform.rules` **never imports domain services** and never touches domain tables. It receives a *fact bag* (field values keyed by registry IDs) and returns *outcome declarations*. Pure input → output.
- Domain services own side effects. The **Outcome Dispatcher** (a thin application service) maps declared outcomes to domain calls: `generate_condition` → `condition_lifecycle`, `create_exception` → `exception_repo`, `block_transition` → raised HTTP 422 in `status.py`.
- `platform.config` is read through one **Config Resolver** interface (`resolve(tenant_id, namespace) → snapshot`). No domain code queries config tables directly. This is the single seam where caching, effective-dating, and fallback-to-default live.

Why not microservices: at current scale (single team, 202 seeded loans, one deployment), separate services buy network hops, distributed transactions across the outbox, and deploy orchestration — and the platform's correctness depends on evaluating rules *in the same transaction* as the state change they gate (e.g., blocking a status transition). The module boundaries above are exactly the seams you would cut if extraction is ever justified; the routers-thin/services-fat ADR already points this direction.

### 3.2 Domain model (conceptual)

```
FieldRegistry (system)
   ▲ references                    ▲ references
   │                               │
ConfigNamespace ──< ConfigVersion ──< ConfigRelease >── approvals
 (branding, terminology,           (immutable snapshots, effective dates)
  fields, workspace, workflow,
  notifications, products)

Guideline (business intent, prose + metadata)
   │ 1..n
RuleDefinition ──< RuleVersion (immutable AST + metadata)
   │                    │
   │                    ├──< RuleBinding (execution context → outcome mapping)
   │                    │
RuleLayer (base/investor/lender/product/program/overlay)
   │ compile on publish
EffectiveRuleSet (flattened, immutable, per tenant+product+program, versioned)
   │ evaluated against
FactBag (field values from loan graph, keyed by field_id)
   │ produces
DecisionRecord (append-only: inputs, rule set version, per-rule results, outcomes)
   │ emits
domain_events → conditions, exceptions, validations, notifications, analytics
```

---

## 4. Configuration Platform

### 4.1 Namespaces and risk tiers

Every configurable area is a **namespace** with a registered JSON Schema (structural validation) plus a semantic validator (referential validation against the field registry, controlled values, role table, etc.). Namespaces are assigned a **tier** that determines lifecycle ceremony:

| Tier | Namespaces | Lifecycle | Rationale |
|---|---|---|---|
| **1 — Cosmetic** | branding, terminology, personal/org display preferences | Edit → validate → publish immediately. Every publish is a version; one-click revert | Wrong logo colors hurt nobody; making an admin file a release to fix a typo teaches them to hate the platform |
| **2 — Behavioral** | field configuration, workspace layouts, dashboard config, notification templates | Draft → validate → publish. Optional preview-as-role. No approval gate by default (tenant may enable one) | Mistakes are visible and annoying but not compliance-relevant, and instantly revertible |
| **3 — Consequential** | workflow (transitions, approvals, SLAs), products/programs, business rules, condition templates, integration mappings | Full lifecycle: draft → validate → **simulate** → approve (four-eyes) → publish (effective-dated) → monitor → rollback | These change what loans are eligible and what compliance artifacts get produced |

All tiers share the same storage, versioning, audit, and rollback machinery — the tier only controls which lifecycle gates are mandatory. This satisfies the brief's full list of per-object capabilities (validation, versioning, draft, published, effective dates, audit, rollback, dependency validation, permissioned editing) without imposing maximum ceremony uniformly.

### 4.2 Storage model

```
config_namespaces      -- code PK, tier, json_schema (versioned), description
config_versions        -- id, tenant_id, namespace, version_no, document JSONB,
                          status (draft|validated|published|superseded|rolled_back),
                          effective_from, effective_to,
                          created_by, approved_by, published_at   [append-only]
config_releases        -- id, tenant_id, name, notes, status,
                          version_ids[] (a release bundles versions across namespaces
                          and publishes them atomically)
```

- **Documents are JSONB, contracts are JSON Schema + semantic validators.** This is the middle path between "scattered JSON config" (which the brief rightly rejects) and fully-relational config (a table per knob, which ossifies). The schema is the guardrail; the JSONB is just transport.
- **Versions are immutable.** Publishing writes a new row and supersedes the old; rollback publishes a *new* version whose document equals a prior one (history never rewrites — same discipline as `loan_status_events`).
- **Resolution order:** tenant published version (effective now) → system default document. Same shadowing semantics as `controlled_values`, generalized.
- **Releases** exist for Tier 3 and for implementation go-lives: bundle workflow + products + rules + condition templates and flip them atomically at an effective date. Tier 1/2 edits are single-version micro-releases under the hood, so the audit trail is uniform.

### 4.3 Runtime resolution and caching

One resolver, three properties:

1. **Snapshot semantics** — a request resolves config once at start; no mid-request config changes. (Pass the resolved snapshot down, don't re-query.)
2. **Cache with event invalidation** — in-process TTL cache keyed `(tenant_id, namespace)`, invalidated by a `config.published` domain event. At current scale this is a dict; the interface lets Redis replace it without touching consumers.
3. **Fallback is total** — a tenant with zero config rows gets a fully functional system-default platform. Config is always an *overlay*, never a prerequisite. This single rule prevents the classic implementation-project failure mode where a tenant can't log in until 400 settings are entered.

### 4.4 Dependency validation

Validators run at draft-save and again at publish:

- Structural: JSON Schema.
- Referential: every `field_id` exists in the registry and is `configurable`/`rule_usable`; every status code exists in the workflow config; every role exists; every condition template referenced by a rule exists.
- Cross-namespace: publishing a workflow version that deletes a status fails if any published rule, notification, or SLA references it. (This is why releases bundle namespaces — coordinated changes publish together.)
- Invariant guards (the "customers may NOT" list, §12): required compliance fields cannot be hidden or made optional; terminal-status transitions cannot be removed; audit-relevant behavior is not in the configurable surface at all.

### 4.5 Terminology — presentation overlay only

- A `terminology` namespace: map of `{registry field_id | controlled value code | UI term key} → tenant label`.
- Applied at render time (frontend label hook, notification template renderer, document generator). The API always returns codes + system labels + tenant labels, so integrations are never surprised.
- Guardrail: tenants rename *labels*, never *codes*. Rules, analytics, exports, and support tooling all speak codes. A support engineer's view can toggle tenant terminology off.

---

## 5. Decision Platform

### 5.1 The unification model — one policy, many behaviors

The brief's core insight is correct and is the architecture's center: **guidelines, eligibility, validation, and condition generation are one system observed from four angles.** The mechanism that unifies them:

```
Guideline (business intent, human-readable, cites investor doc section)
   └── RuleDefinition (the testable predicate, one or more per guideline)
         └── RuleVersion (immutable AST + effective dates)
               └── RuleBindings (context → severity → outcomes)
```

A **RuleBinding** declares *when* a rule runs and *what its result means there*:

| Context | FAIL means | UNKNOWN means |
|---|---|---|
| `field_change` (data entry) | inline warning | passive hint ("FICO required to determine eligibility") |
| `submission` | blocking validation error | blocking "missing required data" with next action |
| `eligibility_check` | program ineligible | eligibility = UNDETERMINED + missing-inputs list |
| `underwriting` | generate condition and/or exception | generate doc-request condition |
| `final_approval` | mark ineligible, block transition | block transition |

One rule version, five behaviors, zero duplicated logic — exactly the brief's FICO example. Severity and outcome live on the *binding*, not the rule, so the same predicate can warn early and block late.

### 5.2 Rule representation — typed AST, never code

Rules are stored as a JSON expression tree over registry field IDs:

```
{ "all": [
    {"field": "loan.program", "op": "eq", "value": "dscr_plus"},
    {"field": "property.occupancy", "op": "eq", "value": "investment"},
    {"field": "financials.ltv", "op": "gt", "value": 75}
  ],
  "require": {"field": "borrower.fico_representative", "op": "gte", "value": 680} }
```

- Grammar: `all` / `any` / `not` compositors; type-derived operators; a small allowlisted function set (`age_in_days`, `months_between`, `count_of`, arithmetic on numeric fields) — every function registered like a field, with typed signatures.
- **No JavaScript, no SQL, no string interpolation, ever.** The AST is data; the evaluator is the only interpreter. This is the structural answer to "customers cannot inject code."
- Depth/size limits enforced at validation (e.g., max depth 8, max 200 nodes) — guardrail against pathological authoring and evaluator abuse.
- The **same grammar** serves field conditional-visibility conditions, notification triggers, and SLA applicability conditions (position #7). One parser, one validator, one simulator.

### 5.3 The evaluator — pure and boring

`evaluate(effective_rule_set, fact_bag, context) → EvaluationResult`

- **Pure function.** No I/O, no DB, no side effects. The caller builds the FactBag (one loan-graph query + registered calculators); the dispatcher applies outcomes. Purity is what makes simulation, replay, and unit testing trivial — the evaluator is identical in production, simulation, and tests.
- **FactBag** = `{field_id → typed value | MISSING}` plus metadata (which inputs were available). Built by a `FactBagBuilder` that knows registry `source_ref` mappings; computed fields invoke calculators with their own dependencies resolved first (registry declares calculator inputs, so this is a small DAG).
- **Dependency index.** At compile time (§7), the platform records `field_id → [rule_ids]`. On `field_change`, only rules touching changed fields re-evaluate. This is what makes real-time evaluation cheap.

### 5.4 Multi-state evaluation

Per-rule result is one of:

- **PASS / FAIL** — predicate evaluated with complete inputs.
- **UNKNOWN** — a referenced field is MISSING with `nullable_meaning = not_collected`. Result carries `missing_inputs: [field_ids]` and suggested actions (from registry metadata: missing FICO → "order credit report"). Three-valued logic propagates Kleene-style: `all[...]` with one FALSE is FAIL regardless of unknowns; with no FALSE but an UNKNOWN it is UNKNOWN.
- **NOT_APPLICABLE** — the rule's applicability condition (the `all` block) didn't match, or a field is MISSING with `nullable_meaning = not_applicable`.
- **WAIVED / OVERRIDDEN** — never produced by the evaluator. These are *human dispositions* recorded against a decision record through the exceptions module's authority-checked flow (`decide_exception()` generalizes to `disposition_rule_result()`). The engine reports raw truth; humans annotate it. Keeping these out of the evaluator preserves purity and puts overrides where authority rules and audit already live.

### 5.5 Structured outcomes

Every evaluation persists a **DecisionRecord** (append-only):

```
decision_records
  id, tenant_id, loan_id (nullable — pre-file scenarios reuse the exceptions pattern),
  context, effective_rule_set_id (+ version), fact_bag JSONB (input snapshot,
  pii_restricted fields excluded), evaluated_at, actor
decision_rule_results
  decision_record_id, rule_id, rule_version, status, severity,
  explanation_data JSONB (resolved values for message templating),
  missing_inputs[], suggested_actions[], outcomes_emitted JSONB
```

- Explanations are **templates + data**, not baked strings: `"Minimum representative FICO {min} required for {program} investment properties above {ltv_threshold}% LTV; borrower has {actual}."` Rendered with tenant terminology at display time; the stored record stays terminology-neutral.
- Outcomes emitted (`generate_condition`, `create_exception`, `block`, `warn`, `display_requirement`) are recorded on the result — the audit answer to "why does this loan have this condition" is a foreign key, not a guess.
- Condition generation is **idempotent by key** (`rule_id + loan_id + condition_template`): re-evaluation never duplicates conditions; a rule flipping to PASS can auto-resolve a rule-generated condition (configurable per template).

---

## 6. Rule Authoring

- **Structured builder, not a text DSL.** The UI walks the registry: pick field → operators filtered by type → values validated by type/code-set → compose with ALL/ANY groups → attach bindings and outcomes. The WHEN/THEN experience in the brief maps 1:1 onto the AST; there is no free-text expression box to parse or to injection-audit.
- **Guideline-first authoring.** Authors create a *Guideline* (name, investor citation, prose summary, category) and attach rules to it. This keeps the business artifact primary — underwriters think in guidelines, and the explanation chain (decision → rule → guideline → investor doc section) is what an auditor asks for.
- **Templates.** Common Non-QM patterns ship as parameterized templates (min-FICO-by-LTV grid, max-LTV-by-occupancy, reserves-by-loan-amount, DSCR floor). A grid template compiles to N rules; most lender authoring is filling grids, not building trees. This is also the honest answer to authoring usability: raw boolean-tree builders are where BSAs go to suffer; grids are how rate sheets and eligibility matrices actually look.
- **Static analysis — advisory at authoring, ⊕ blocking at publish:** unreachable rules (applicability contradicts program config), overlapping/conflicting requirements on the same field, references to deprecated fields, rules that can never be UNKNOWN-safe (require fields never collected by the tenant's field config — cross-namespace validation again). The same checks that surface as inline lints while drafting re-run as hard gates in the Tier-3 publish pipeline (alongside schema/referential validation, §4.4) — a conflicting ruleset cannot ship even if the author dismissed every lint. This mirrors the decision-table verification literature: complexity control is a pipeline property, not an author courtesy.

---

## 7. Inheritance, Compilation, and Versioning

### 7.1 Layered inheritance, compile-time resolution

Layers, lowest to highest precedence: `origina_base → investor → lender → product → program → overlay (effective-dated temporary)`.

- Each layer contributes rule versions; higher layers may **override** (replace a rule keyed by the same guideline+parameter identity, e.g., min-FICO for a given cell), **add**, or **suppress** (with mandatory reason — suppression of base compliance rules is blocked by tier-3 invariants).
- **Publishing compiles.** The resolver walks the stack once and emits an `effective_rule_sets` row: a flat, immutable list of rule versions with per-rule **provenance** (`resolved_from: program_override; overrides: lender_rule v3; based_on: investor_rule v7`). The brief's explainability example is stored data, not runtime inference. ⊕ Each compiled set carries a **content hash** of its canonical serialization — audit reproducibility becomes "this byte-identical ruleset decided this loan," and set-equality checks (did this recompile actually change anything?) are a hash comparison.
- Runtime and simulation only ever see effective sets. Benefits: O(1) evaluation lookup, unambiguous replay (a decision references one effective-set ID), and layer bugs surface at *publish* (where a human is watching) instead of at *evaluation* (where a borrower is waiting).
- Cost acknowledged: publishing an investor-layer change fans out to recompiling dependent tenant sets. That is a background job (bounded, observable, uses the Sprint-4 job infra) — the right place to pay the cost.

### 7.2 Versioning and replay

- Rule versions and effective sets are immutable and effective-dated. Editing = new version.
- Every DecisionRecord stores `(effective_rule_set_id, fact_bag)` → **replay = re-run the pure evaluator on stored inputs.** Historical loans keep referencing the set that decided them; guideline changes never retroactively alter past decisions (the compliance requirement in the brief).
- Effective-dating handles "new guidelines apply to applications received after date X" — evaluation selects the set effective at the loan's anchor date (application date, lock date — anchor choice is itself a Tier-3 workflow config with a system default).

---

## 8. Rule Execution Lifecycle

```
Trigger (field change | save | status transition | submission | doc upload |
         scheduled reevaluation | integration update | manual "run eligibility")
  → select bindings matching (context, tenant, product/program)
  → FactBagBuilder loads loan graph + runs calculators
  → evaluate(effective_set, fact_bag, context)          [pure]
  → persist DecisionRecord + rule results               [same transaction as the
                                                         state change it gates]
  → Outcome Dispatcher:
      block/warn      → API response envelope (structured, renderable)
      conditions      → condition_lifecycle (idempotent keys)
      exceptions      → exception_repo (existing authority flow)
      ui_requirements → returned to workspace (eligibility panel)
  → write domain_events (rule.evaluated, eligibility.changed, condition.generated)
      → analytics, notifications, webhooks               [outbox, async]
```

- **Synchronous where it gates, asynchronous where it informs.** Submission/transition evaluations run in-transaction (a blocked transition must block atomically — same discipline as the status dual-write ADR). Field-change evaluations run on the request path but only over the dependency-index subset, returning advisory results. Portfolio-wide re-evaluation after a rule publish is a background job emitting `eligibility.changed` events, surfaced as workspace flags — never silent bulk status mutation.
- **Scheduled reevaluation** (doc expiration, lock expiry, overlay effective-date rollover) rides the same job infra; rules gain date-relative functions rather than a separate scheduler concept.

---

## 9. Simulation

Simulation is the Tier-3 publish gate and the enterprise differentiator; the pure evaluator makes it nearly free to build:

- **Inputs:** a draft effective set (compiled from draft layers) + a population: sample scenarios (hand-built FactBags), historical loans (FactBags rebuilt from current data), or **stored decision snapshots** (highest fidelity — replays exactly what the engine saw).
- **Engine:** the same `evaluate()`, fanned across the population as a background job (Sprint-4 job infra is a prerequisite).
- **Output — impact diff:** per-loan `(old_set_result, new_set_result)` pairs aggregated into the brief's report: N newly ineligible / M newly eligible / new validation volume / conditions that would generate / conflicting or unreachable rules / rules referencing uncollected fields. Drill-down to individual loans with side-by-side explanations.
- **Version comparison and what-if** are the same mechanism with different set pairs.
- Guardrail: simulation results are advisory artifacts attached to the release for the approver to review — the four-eyes approval sees the blast radius before publish.

---

## 10. Admin Studio

### 10.1 Position within the existing plan

The Studio is **Tier 2 of the settings architecture already designed** (`architecture/settings.md`), extended — not a separate portal. `/admin/*` grows these modules, reusing `SettingsLayout`, SaveBar, slide-over, and dirty-state patterns:

| Module | Namespace/engine it fronts | Tier |
|---|---|---|
| Branding | `branding` | 1 |
| Terminology | `terminology` | 1 |
| Roles & Permissions | existing RBAC + `permissions` namespace | 3 |
| Field Configuration | `fields` (per-context: intake, workspace, submission) | 2 |
| Workspace Designer | `workspace` layouts | 2 |
| Workflow Designer | `workflow` (transitions, approvals, SLAs) | 3 |
| Products & Programs | `products` | 3 |
| Guidelines & Rules | Decision Platform authoring | 3 |
| Condition Templates | `condition_templates` | 3 |
| Notification Templates | `notifications` | 2 |
| Integration Mapping | `integrations` | 3 |
| Testing & Simulation | simulation module | — |
| Releases | `config_releases` | — |
| Audit History | existing `audit_log` + config/decision history | — |

New roles: `implementation_admin` (Origina staff — cross-tenant, all modules), `tenant_config_admin` (lender BSA — tier 1–2 + rule drafting), `tenant_approver` (publishes tier 3; must differ from author — four-eyes enforced in data, `approved_by ≠ created_by`).

### 10.2 Workspace Designer — server-driven layout over registered components

- The frontend registers a **component catalog**: card components with stable IDs (`borrower_card`, `loan_terms_card`, `eligibility_card`, …), each declaring which layout zones it may occupy, its data dependencies (registry field IDs / hook names), and role visibility defaults.
- A layout document (per role, per page) arranges catalog entries in **registered zones** (`summary_zone`, `rail`, `main`) with order and visibility. Validation rejects unknown components, zone violations, and removal of required components (e.g., audit/compliance cards are `required: true` in the catalog).
- The renderer maps the document to real React components. **There is no arbitrary UI composition, no custom components, no injected markup** — admins rearrange approved cards in approved zones, exactly the brief's guardrail. New cards ship via code deploy into the catalog; configuration only arranges what engineering approved.
- The existing workspace (`workspaceSections.ts`, 20+ section components) is the natural first catalog — it is already a data-driven section registry.

---

## 11. Database Strategy

All new tables follow house rules: raw SQL migrations (next available block after the settings module's 126–131), `tenant_id` scoping, TEXT + CHECK statuses, `AppendOnlyModel` for versions/records, audit triggers where rows are mutable.

| Group | Tables | Notes |
|---|---|---|
| Registry | `field_registry`, `calculators` | System-scoped, seeded via migrations, tenant-read-only |
| Config | `config_namespaces`, `config_versions`, `config_releases`, `config_release_approvals` | Versions append-only; JSONB documents; GIN indexes when query patterns emerge |
| Rules | `guidelines`, `rule_definitions`, `rule_versions`, `rule_bindings`, `rule_layers`, `effective_rule_sets`, `effective_rule_set_members` | Versions/sets immutable; AST as JSONB; provenance on members; ⊕ content hash on sets |
| Evidence | `decision_records`, `decision_rule_results`, `rule_dispositions` (waive/override, FK to exceptions flow) | Append-only; partition-ready by `evaluated_at` (high volume) |
| Simulation | `simulation_runs`, `simulation_results` | Results prunable (retention config), unlike decision records |

Storage positions:

- **JSONB for documents and ASTs, relational for identity, versioning, and search.** Everything you filter or join on (tenant, namespace, status, effective dates, rule↔guideline links) is a real column; the variable-shape payload is JSONB. Consistent with the existing JSONB ADR.
- **`decision_records` is the one genuine volume risk** (every field-change evaluation on every loan). Mitigations: persist full records only for gating contexts (submission, transitions, eligibility checks, underwriting); advisory field-change evaluations return results without persisting (or sample). Declare `evaluated_at` range partitioning readiness in the initial migration.
- No new datastore. Postgres handles all of this at any plausible scale for years; the analytics read-model split (§13) is the eventual pressure valve.

---

## 12. Security

- **Tenant isolation:** every config/rule/decision table carries `tenant_id`, enforced at the query layer like everything else; `tenant_id` never accepted from request bodies. System-scoped tables (`field_registry`, base rule layers) are read-only to tenant-scoped roles at the RBAC layer. Cross-tenant reads exist only for `implementation_admin` and are themselves audited.
- ⊕ **Row-level security as the second line.** Query-layer filtering assumes application code is bug-free; once tenant admins hold publish power, that assumption is too thin. Enable PostgreSQL RLS on config/rule/decision tables with the tenant set via a session variable (the `SET LOCAL app.current_user_id` plumbing in `get_audited_db` is the exact pattern — add `app.current_tenant_id` beside it). Authorization is not isolation; a missed `WHERE tenant_id` then returns zero rows instead of another lender's guidelines. Sequence with the Sprint-5 hardening work; warrants its own ADR (RLS on platform tables first vs. all tables, and its interaction with `implementation_admin` cross-tenant access).
- **No executable content anywhere:** ASTs and config documents are data validated against closed grammars/schemas. No eval, no template engines executing tenant strings (notification templates use a merge-field allowlist, not arbitrary template code). Branding assets are content-type-validated and served from storage, never inlined as markup; terminology labels are rendered as text (React's default escaping), never `dangerouslySetInnerHTML`.
- **The "customers may NOT" list is enforced structurally, not by validation alone:** schema, SQL, code, APIs, audit behavior, and tenant isolation are simply *not in the configurable surface* — there is no config namespace that reaches them. What *is* in the surface (fields, workflow, rules) has invariant guards: compliance-required fields flagged `configurable = false`; workflow validation preserves reachability of terminal states and cannot remove required approvals marked system-mandatory; calculators are not configuration.
- **Authoring is privileged and audited:** config/rule writes go through `get_audited_db`; four-eyes on Tier 3; version history is append-only so no admin can rewrite what was live when.
- **PII in the platform:** `security_class` gates rule authoring display, decision-record fact bags exclude `pii_restricted` values (store presence, not value), simulation output aggregates before it displays.
- Existing debt still applies: JWT→httpOnly cookie (Sprint 5) matters more once tenant admins wield publish power.

## 13. Scalability & Analytics

- **Evaluation:** pure evaluator over an in-memory effective set (cached like config, invalidated by publish events) — microseconds per rule; FactBag construction is one loan-graph query (LATERAL pattern already proven). Field-change latency is bounded by the dependency index.
- **Publish-time compilation** moves the O(layers × rules × tenants) work to background jobs at publish, keeping the hot path flat.
- **Analytics:** every evaluation, publish, override, and simulation emits `domain_events` — the rule engine becomes an analytics *producer*, not a system analytics scrapes. Start by querying `decision_rule_results` directly (the existing `analytics_repo.py` pattern); when volume demands, consume the outbox into rollup tables (`rule_failure_stats`, daily grain) — the brief's dashboards (top failing rules, override rates, missing docs, bottlenecks) are group-bys over structured results either way. No warehouse until a customer asks.
- **Multi-tenant blast radius:** per-tenant cache keys, per-tenant compiled sets, per-tenant job queues for recompilation — one tenant's 5,000-rule ruleset cannot degrade another's evaluations beyond shared DB capacity.

## 14. Extensibility & API Design

- **Everything the Studio does is API-first** under `/api/v1/config/*`, `/api/v1/rules/*`, `/api/v1/decisions/*`, `/api/v1/simulations/*` — the Studio is a client, which is what makes the platform consumable by CRMs/external LOS later (the stated long-term direction). `PaginatedResponse[T]` envelope throughout.
- Key surfaces: namespace CRUD + publish/rollback; rule authoring + compile-preview; `POST /decisions/evaluate` (context + loan ref → structured results — also the external-consumer eligibility API someday); decision record queries; simulation run lifecycle.
- **New extension points are code-registered catalogs:** fields (registry), calculators, operators/functions, outcome types, workspace components, notification merge fields. Extending the platform = engineering adds a catalog entry; configuring = tenants arrange catalog entries. That line is the whole safety model, restated.
- **Events as integration surface:** `config.published`, `rules.published`, `decision.recorded`, `eligibility.changed`, `condition.generated` in the outbox → future webhooks get platform events for free.

---

## 15. Risks, Tradeoffs, Recommendations

### Top risks

1. **Inner-platform effect** — the platform becomes a worse programming language. Mitigation is discipline in the catalogs: when a tenant need doesn't fit the grammar, the answer is *engineering adds a typed capability*, never "make the grammar general-purpose." Review every proposed operator/function like an API commitment, because it is one.
2. **Building for N tenants at N=1.** The biggest genuine risk in this plan. Mitigation: the phasing below front-loads only what current sprints need anyway (registry, eligibility at submission, decision records) and defers speculation (inheritance layers beyond base+lender, Workspace Designer, integration mapping) until a second real tenant forces the questions.
3. **Registry governance burden.** Every field is now a contract. Accept it — it is the same burden as an API schema, and mortgage compliance demands it anyway. The lint tooling (§6) reduces it.
4. **Authoring UX difficulty.** Boolean-tree builders fail with BSAs. The grid/template layer (§6) is not a nice-to-have; treat it as the primary authoring surface and the tree builder as the escape hatch.
5. **Decision-record volume.** Addressed in §11; decide the persist-vs-advisory split before the first field-change binding ships, not after the table hits 100M rows.
6. **Sequencing dependency:** simulation and recompilation need the Sprint-4 outbox + job infra. Do not start Phase 3 before it lands.

### Deliberate tradeoffs

- Compile-time inheritance costs publish-time fan-out; buys runtime speed, replayability, and debuggability. Right trade for a compliance system.
- Bespoke evaluator costs ~1–2k lines of owned code; buys zero BRMS ops burden and a grammar exactly as large as the safety model allows.
- Tiered ceremony costs a tier taxonomy; buys admin trust and real (not rubber-stamp) approvals where they matter.
- Modular monolith costs discipline (import boundaries); buys transactional gating and one deployment. Revisit only with a scale reason, not an aesthetic one.

### Phasing (maps onto the sprint cadence after Sprint 5)

| Phase | Deliverable | Why this order |
|---|---|---|
| **0** | Field registry + calculators + FactBagBuilder; generate DATA_DICTIONARY.md from it | Keystone; everything references it; useful immediately for API/type consistency |
| **1** | Rule model + evaluator + `submission` and `eligibility_check` contexts + decision records; base + lender layers only; rules seeded by engineering (no authoring UI yet) | Proves the unification on the highest-value context; replaces inline submission validation via strangler pattern |
| **2** | Config spine (namespaces/versions/releases) at Tier 1–2: branding, terminology, field configuration; fold `controlled_values` reads behind the resolver | Ships visible tenant value early; exercises the versioning machinery on low-risk namespaces first |
| **3** | Authoring UI (templates/grids first), simulation, four-eyes releases, `underwriting` + `field_change` contexts, condition generation | Requires Sprint-4 outbox/jobs; this is where Tier 3 lifecycle turns on |
| **4** | Workflow Designer, products/programs as config, full inheritance stack (investor/product/program/overlay), Workspace Designer, integration mapping | Deferred until a second tenant and investor-guideline ingestion make the requirements concrete |

### Bottom line

Adopt the brief's two goals as **one platform**: a canonical field registry at the base, a tiered configuration spine above it, and a pure, versioned, evidence-producing decision engine as its most consequential namespace. Origina's existing decisions (TEXT+CHECK, controlled values, event sourcing, outbox, exceptions authority flow) already point here — this blueprint mostly finishes sentences the codebase has started.
