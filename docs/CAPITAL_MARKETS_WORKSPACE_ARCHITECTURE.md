# Capital Markets Workspace — Architecture & Execution Plan

> **Status:** proposed blueprint (2026-07-25). Off-sprint initiative at CTO request; does not
> displace Sprint 7 (Document Platform v1) commitments — the PoC is scoped to be buildable in an
> off-sprint window. Related: [PRICING_DECISION_FUNDING_PLAN.md](PRICING_DECISION_FUNDING_PLAN.md)
> (pricing sheets, transition gates — this plan builds directly on it),
> [CONFIG_AND_DECISION_PLATFORM.md](CONFIG_AND_DECISION_PLATFORM.md) (field registry, rule
> versioning), [DECISIONS.md](DECISIONS.md), [sprints/MILESTONES.md](sprints/MILESTONES.md).
> Source research: internal deep-research report "Designing an Intuitive Capital Markets
> Workspace for Non-QM Lending" (2026-07).

**Labeling convention used throughout:** `[CONFIRMED]` requirement from CTO ask or existing
codebase · `[ASSUMPTION]` stated assumption needing validation · `[REC]` recommendation ·
`[OPEN]` open question · `[POC-SHORTCUT]` acceptable only for the off-sprint PoC ·
`[PROD-REQ]` required before production use.

---

## 1. Executive summary

Capital markets is the function that turns a wholesale Non-QM pipeline into executable prices,
dependable liquidity, and controlled margin. For a lender running DSCR, bank-statement, and
other Non-QM production, there is no agency takeout: every loan's exit — whole-loan sale,
bulk/AOT sale, or securitization contribution — must be *manufactured* through investor
eligibility, best-execution comparison, lock and pipeline risk management, and delivery
reconciliation. Today (in the market Origina targets, and in most mid-size Non-QM shops) this
work lives in spreadsheets bolted onto the LOS: rate sheets are PDFs, locks are emails, best-ex
is a weekly Excel model, and purchase advice reconciliation is manual.

**The thesis of this plan:** the LOS already owns the two assets capital markets needs most —
the *loan-level truth* and the *event stream of changes to it*. Origina should therefore build
the **origination-side capital-markets layer natively** (rate sheets, locks, pipeline exposure,
investor eligibility, best execution, allocation, commitments, delivery, gain-on-sale) and
**integrate, not build, the institutional analytics layer** (hedge advisory, OAS/prepayment/
severity models, MSR valuation, securitization waterfall math). No public vendor spans both
sides well; Origina's advantage is being the system of record that makes the origination side
*event-driven and reproducible* rather than spreadsheet-driven.

The plan lands in four moves:

1. **Reuse what's already designed.** The pricing-sheet artifact (migration 132), transition-gate
   registry, `domain_events` outbox, controlled values, and `input_hash` snapshot idiom from
   [PRICING_DECISION_FUNDING_PLAN.md](PRICING_DECISION_FUNDING_PLAN.md) are the foundation. A
   lock is a sibling artifact to a pricing sheet; a material-change reprice is the same staleness
   mechanic; every capital-markets event is another outbox row.
2. **Add four new first-class domains:** Rate Sheet (versioned, published), Lock (full lifecycle:
   request → confirm → extend → relock → expire, with worst-case pricing), Investor (programs,
   eligibility overlays, commitments), and Execution (best-ex result, allocation, pool, delivery,
   purchase advice).
3. **Ship a narrow off-sprint PoC** that walks one connected path — pipeline → loan → investor
   comparison → best execution → material change → reprice → allocate → audit — on the 202
   seeded loans, with mocked investor rate sheets and market data, and real lock/allocation/audit
   persistence.
4. **Defer hedge, MSR, and securitization analytics to integrations** (MCT-class hedge advisory,
   Intex/Yield Book-class deal analytics) behind clean API seams, exactly as the AI Scope ADR
   deferred AI: don't build now, don't block later.

**Smallest coherent proof:** the PoC proves that capital markets can be *native to the loan
record* — a lock that knows when its loan data changed, a best-ex table that re-ranks on
reprice, an allocation with a reproducible audit trail — which is precisely what no
spreadsheet-plus-PPE stack can do. It does not attempt to prove hedge math, and it should not.

---

## 2. Assumptions

| # | Assumption | Basis | Validation needed |
|---|---|---|---|
| A1 | `[ASSUMPTION]` Origina's target customers sell **servicing-released whole loans** (best-efforts and mandatory) to 3–10 Non-QM investors; securitization is an investor-side concern, not something the lender structures directly in v1 | Typical mid-size wholesale Non-QM shop; research report's issuer-side securitization tooling is for aggregators | Head of Capital Markets interview (Phase 0) |
| A2 | `[ASSUMPTION]` Hedging is done via **forward loan-sale commitments and (optionally) TBA proxy hedges managed by an external hedge advisor** — Origina records positions and coverage but does not compute hedge recommendations | Non-QM has imperfect TBA basis; hedge advisory (MCT-class) is a mature buy-not-build market | CTO + finance interview |
| A3 | `[ASSUMPTION]` Investor rate sheets arrive as spreadsheets/PDFs/portal downloads today; no investor offers a live pricing API to this segment yet | Market norm 2026 | Investor relations interview |
| A4 | `[ASSUMPTION]` The lender's own broker-facing rate sheet is currently produced manually (spreadsheet → PDF → email) on a daily cadence with intraday reprices on market moves | Market norm | Phase 0 process mapping |
| A5 | `[CONFIRMED]` Pricing-sheet artifact, transition gates, and `pricing_runs` from the pricing/decision/funding blueprint are the substrate this plan extends — not replaced | PRICING_DECISION_FUNDING_PLAN.md | — |
| A6 | `[CONFIRMED]` `domain_events` outbox (migration 131) + one-consumer-per-file pattern is the event backbone | Sprint 4 archive, CLAUDE.md | — |
| A7 | `[ASSUMPTION]` PoC audience is the CTO plus product; no external investor or auditor sees PoC output | CTO ask framing | — |
| A8 | `[ASSUMPTION]` Migration numbering for this domain starts at **135** (132–134 reserved by the pricing/decision/funding plan) | docs cross-check | — |
| A9 | `[ASSUMPTION]` Accounting/GL lives outside Origina (QuickBooks/NetSuite-class); Origina produces gain-on-sale and reconciliation *outputs*, the GL is the accounting system of record | Standard boundary | Finance interview |
| A10 | `[OPEN]` Whether any target customer retains servicing (MSR) at all in the first two years — determines if the MSR economics panel is ever more than a placeholder | — | CTO / design partner |

---

## 3. Capital markets capability map

### 3.1 The role in a wholesale Non-QM lender

Origination creates loans; capital markets makes them **fungible and profitable**. The chain of
linked decisions: set products and margins → publish executable prices to brokers → accept and
manage locks → watch the locked/floating pipeline as loan data and markets move → compare
investor exits → allocate, commit, deliver → reconcile purchase and recognize gain-on-sale →
feed realized results back into margins. Because Non-QM collateral is heterogeneous (doc type,
DSCR, occupancy, prepay penalty structure, investor overlays), each step prices *dispersion*
that an agency shop never sees — which is why loan-level data quality is the whole game, and why
the LOS is the right host for the origination side of the function.

### 3.2 Capability inventory

Owner key: **CM** = capital markets / secondary · **LD** = lock desk · **PR** = pricing analyst ·
**FIN** = finance/accounting · **OPS** = operations/post-closing · **UW** = underwriting ·
**EXEC** = executive.

| Capability | Owner | Trigger | Key inputs | Decision made | Outputs | Upstream deps | Downstream impact | Automatable manual work | Risk if wrong | Audit need |
|---|---|---|---|---|---|---|---|---|---|---|
| Product & rate-sheet management | CM/PR | Market open; market move; investor sheet change | Investor sheets, market rates, margin targets, product configs | Base prices + margins per product/lock period | Published versioned rate sheet | Product/guideline config, investor sheets | All broker pricing, all locks | Sheet assembly, LLPA transcription, PDF generation | Mispriced production for hours | Full version history, who published |
| Base-rate & margin management | CM | Margin review; competitive intel | Realized GoS, competitor sheets, volume targets | Margin per product/channel/branch | Margin table (versioned) | Rate-sheet mgmt | Gross/net margin on every lock | Margin variance reports | Margin leakage or lost volume | Versioned, approval on change |
| Loan-level price adjustments (LLPA) | PR | Rate-sheet build; loan pricing request | FICO/LTV/DSCR/doc-type/occupancy/state grids | Adjustment stack per loan | Ordered adjustment lines on price | Field registry, product config | Net price, margin | Grid transcription from investor sheets | Systematic mispricing of segments | Line-level provenance (which grid, which version) |
| Lock desk operations | LD | Broker lock request | Loan snapshot, active rate sheet, lock policy | Accept/reject/counter lock | Confirmed lock (rate, price, period, expiry) | Rate sheet, eligibility | Pipeline exposure, hedge, closing | Manual confirmation emails, re-keying | Locks at stale prices; unenforced policy | Immutable lock confirmation + snapshot |
| Lock confirmation & validation | LD | Lock accepted | Lock terms vs loan data vs eligibility | Confirm or flag discrepancy | Lock confirmation doc/event | Lock ops | Broker communication, audit | Eligibility re-check at confirm | Confirming an ineligible/mispriced lock | Confirmation artifact retained |
| Lock extensions | LD | Expiry approaching; closing slip | Extension policy (bps/day), lock age, prior extensions | Grant/deny/price extension | Extended lock + cost | Lock lifecycle | Margin (extension cost), closing date | Fee calc, approval routing | Free extensions = margin leakage | Extension event with cost + approver |
| Relocks | LD | Expired lock, borrower returns | Relock policy (worst-case vs current), fallout history | Relock price basis | New lock linked to prior | Lock lifecycle | Margin, fairness/consistency | Worst-case lookup across history | Gaming (let expire, relock lower) | Chain to prior lock, policy applied recorded |
| Renegotiations / float-downs | LD/CM | Market rallies; borrower/broker request | Current vs locked price, float-down policy, concession budget | Grant/deny; new terms | Amended lock + concession cost | Lock lifecycle, margin mgmt | Margin, pull-through (retention) | Cost calc + authority routing | Uncontrolled giveaways | Approval evidence, cost booked |
| Worst-case pricing | LD | Relock/renegotiation | Full price history for loan across sheets | Applicable worst-case price | Price basis for relock | Rate-sheet history | Relock pricing | Manual history search | Inconsistent policy application | Reproducible price-history query |
| Expiration management | LD | Daily | Expiry calendar, closing-date confidence | Extend / let expire / escalate | Work queue, broker notices | Lock + closing data | Fallout, extension revenue | Expiry report, notifications | Silent expiries → fallout surprises | Event per expiry |
| Pipeline exposure monitoring | CM | Continuous | Locked/floating balances, pull-through, durations | Hedge/coverage action needed? | Exposure report, alerts | Locks, loan statuses, forecasts | Hedge decisions | Daily position spreadsheet | Unhedged exposure on a rate move | Position snapshots retained |
| Pull-through assumptions | CM | Weekly/monthly calibration | Historical lock→fund outcomes by segment/status | Pull-through % by cohort | Assumption table (versioned) | Historical pipeline data | Exposure, hedge sizing, forecasts | Cohort regression in Excel | Over/under-hedging | Assumption versions + backtest |
| Interest-rate risk mgmt | CM (+ external advisor) | Continuous | Exposure, hedge positions, market data | Coverage adjustments | Hedge orders (external), coverage report | Exposure monitor, market data | P&L volatility | Position aggregation | Margin blown on rate move | Trade log, coverage history |
| Investor pricing comparison | CM/PR | Daily; per-loan at allocation | Normalized investor sheets, SRP, adjustments | Which investor prices best per segment | Comparison grid | Investor sheet ingestion | Best-ex, allocation | Sheet normalization (the big one) | Selling to second-best exit | Investor sheet versions retained |
| Best-execution analysis | CM | Loan approaching fundable; pool build | Eligible investors, net execution per path | Exit path per loan | Ranked executions + chosen | Eligibility, investor comparison | Allocation, GoS | Excel best-ex model | Systematic margin loss | Ranked result + rationale stored |
| Loan allocation | CM | Post-best-ex; commitment mgmt | Best-ex result, commitment capacity, concentration | Investor/pool assignment | Allocation record | Best-ex, commitments | Delivery, GoS realization | Manual assignment tracking | Breach commitments; suboptimal fills | Allocation event + approver |
| Investor eligibility | CM/UW | Pricing; lock; allocation; material change | Loan data vs program guidelines + overlays | Eligible programs per loan | Pass/fail matrix + reasons | Guideline engine, loan data | Pricing, lock validity, allocation | Overlay checking | Delivering ineligible loans → kicks | Result snapshot per evaluation |
| Loan sale execution | CM | Allocation complete | Trade terms, commitment | Execute sale / bulk bid | Trade ticket, commitments drawn | Allocation | Delivery, funding of proceeds | Confirmation matching | Failed trades | Trade record immutable |
| Pool construction | CM | Bulk sale/securitization contribution | Candidate loans, pool criteria, WA targets | Pool composition | Pool + eligibility result | Eligible funded loans | Delivery, bid process | Stratification, WA math | Ineligible pool → repricing at bid | Pool version history |
| Whole-loan vs bulk decision | CM | Volume accumulation | Flow vs bulk pricing, carry cost, capacity | Sale channel per cohort | Channel decision | Best-ex at cohort level | GoS, warehouse dwell | Scenario comparison | Carry cost erosion | Decision rationale |
| Commitment management | CM | Trade execution; monthly planning | Open commitments, fills, expiries | Draw/roll/pair-off | Commitment ledger | Trades | Allocation constraints, pair-off fees | Utilization tracking | Shortfall penalties / pair-offs | Ledger append-only |
| Hedge management | CM + external | Exposure change | Positions, coverage, advisor recs | Adjust hedges | Position updates | Exposure, market data | P&L | Position reconciliation | Basis/coverage error | Trade + position history |
| Gain-on-sale analysis | FIN/CM | Loan purchased; month-end | Purchase proceeds vs basis, fees, costs | Recognize GoS; margin attribution | GoS report by loan/segment | Purchase advice, accounting basis | Exec reporting, margin mgmt | Loan-level GoS calc | Misstated P&L | Calc reproducible from artifacts |
| Servicing released vs retained | CM/FIN | Execution choice | SRP vs MSR value, liquidity, ops capacity | Retain or release | Execution path input | MSR valuation (external) | Balance sheet, servicing ops | Comparison model | Illiquid MSR pile-up | Decision + valuation evidence |
| Investor delivery | OPS | Allocation/trade | Delivery conditions, data + doc package | Package complete? | Delivery file, condition clears | Docs platform, allocation | Purchase | Stip chasing, data file assembly | Purchase delays, kicks | Delivery timeline events |
| Purchase advice & reconciliation | FIN/OPS | Investor purchase | Purchase advice vs expected proceeds | Accept/dispute variances | Reconciliation record, suspense items | Delivery, expected-proceeds calc | GL, GoS realization | Line-item matching | Silent price leakage | Variance log per loan |
| Pricing exceptions | CM/LD | Broker/AE request | Requested vs sheet price, authority matrix | Grant/deny/escalate | Exception record + cost | Rate sheet, authority rules | Margin, consistency | Routing + cost booking | Uncontrolled concessions; fair-lending optics | Dual-approval evidence |
| Margin exceptions | CM/EXEC | Below-floor pricing | Margin floors, business case | Approve below-floor sale | Exception record | Margin config | Net margin | Routing | Floor erosion by exception | Approval chain immutable |
| Competitive pricing analysis | PR | Weekly; on share loss | Competitor sheets/surveys | Reposition margins? | Positioning report | External data | Margin mgmt | Sheet scraping/normalization | Blind spots on share | Source + date stamped |
| Executive reporting | EXEC/FIN | Daily/weekly/monthly | All above | Strategy, capacity, margin posture | Scorecard | Everything | Company decisions | Deck assembly | Decisions on stale numbers | Metric lineage |

### 3.3 Ownership boundaries (who does what)

| Function | Capital markets | Secondary mktg | Lock desk | Pricing | Finance | Ops | UW | Exec |
|---|---|---|---|---|---|---|---|---|
| Rate sheet & margins | **Own** | Support | Consume | **Build** | — | — | — | Approve posture |
| Locks & exceptions | Policy | — | **Own** | Support | — | — | — | Escalation tier |
| Pipeline risk / hedge | **Own** | **Own** | Feed | — | Review | — | — | Review |
| Best-ex / allocation / pools | **Own** | **Own** | — | Support | — | — | Eligibility input | — |
| Delivery / purchase | Oversee | Support | — | — | **Reconcile** | **Own** | — | — |
| GoS / margin reporting | Attribute | — | — | — | **Own** | — | — | **Consume** |

In a mid-size shop these are 2–6 people wearing several hats — the workspace must support
role *composition*, not assume eight distinct users. `[ASSUMPTION]`

---

## 4. Personas and role responsibilities

| Persona | Frequent tasks | Key decisions | Needs immediately | Can do | Alerts needed | Reports | Authority / cannot change | Success metrics |
|---|---|---|---|---|---|---|---|---|
| **Head of Capital Markets** | Review exposure, margins, best-ex outcomes; approve exceptions; set margin posture | Margin levels, hedge posture, investor mix, exception approvals | Locked/floating balances, coverage, margin trend, expiring commitments, exception queue | Publish rate sheets, approve margin exceptions, set policy rules, approve allocations above threshold | Exposure breach, coverage gap, commitment shortfall, large exception requests, stale market data | Daily position, weekly margin attribution, monthly GoS | Full CM authority; **cannot** edit loan data, cannot self-approve own exceptions (SoD) | Net margin, hedge effectiveness, GoS vs plan |
| **Secondary Marketing Analyst** | Best-ex runs, allocation, pool building, trade tickets, commitment tracking | Exit path per loan/cohort, pool composition | Fundable loan queue, investor prices, commitment capacity, pool WA stats | Run best-ex, allocate, build pools, record trades | Allocation blocked (eligibility/commitment), pool WA drift, delivery deadline | Allocation log, commitment utilization | Cannot change margins or lock policy; allocation above $ threshold needs approval | Execution variance vs best-ex, commitment utilization |
| **Pricing Analyst** | Build/publish rate sheets, maintain LLPA grids, ingest investor sheets, competitive analysis | Base price + adjustment changes | Investor sheet diffs, market rates, margin table, prior sheet | Draft sheets, stage LLPA changes | Investor sheet changed, market move beyond reprice threshold | Sheet change log, competitive position | Publishes only via approval workflow; cannot approve own sheet `[REC]` | Reprice latency, pricing error rate |
| **Lock Desk Analyst** | Confirm locks, extensions, relocks, exception intake | Accept/deny lock actions per policy | Lock queue, expiry calendar, loan snapshot vs lock, worst-case history | Confirm/deny/extend/relock within policy; route exceptions | New lock request, expiring locks (72/48/24h), material change on locked loan | Daily lock activity, extension/relock cost | Policy-bound; overrides require CM approval | Lock turnaround time, policy adherence |
| **Investor Delivery Analyst** | Assemble delivery packages, track conditions, chase purchase | Package readiness, dispute variances | Allocated-loan queue, delivery conditions, purchase advice inbox | Mark delivery milestones, log purchase advice, flag variances | Delivery SLA at risk, purchase variance above tolerance, investor kick | Delivery aging, kick/suspense report | Cannot alter allocation or pricing | Days-to-purchase, kick rate, suspense aging |
| **CFO / Finance** | Reconcile purchases, book GoS, margin review | Accept variances, P&L sign-off | GoS by segment, variance ledger, suspense, warehouse carry | Approve reconciliations, close periods | Variance > tolerance, suspense aging, GoS deviation from plan | Monthly GoS, purchase-price variance | Read-only on pricing/locks; owns reconciliation acceptance | Reconciliation completeness, unexplained variance ≈ 0 |
| **Executive** | Consume scorecard | Capacity, growth, risk appetite | Volume, margin, pull-through, exposure summary | Read-only + drill-down | Major exposure/margin events only | Executive scorecard | No operational actions | — |
| **System Administrator** | Configure rules, roles, investor records, thresholds | Rule promotion | Config change queue, audit log | Stage + publish rules via approval workflow | Failed integration, config drift | Admin activity log | **Cannot** price, lock, allocate, or approve exceptions (SoD) | Config error rate, audit completeness |

Maps to Origina RBAC: add roles `capital_markets` and `lock_desk` to the `roles` table;
Head-of-CM authority is `capital_markets` + approval-threshold attributes, not a separate role.
`[REC]` Finance read-access reuses a `finance` role added when reconciliation ships.

## 5. Current-state vs target-state workflow

**Current state `[ASSUMPTION — validate in Phase 0]`:** rate sheets built in Excel from investor
PDFs, published as PDF email; locks requested by email/portal form and confirmed manually;
pipeline position is a daily spreadsheet export from the LOS; best-ex is a periodic Excel model
over a stale tape; allocation tracked in a shared sheet; purchase advices reconciled by hand;
nothing is reproducible after the fact.

**Target state:** every step is a first-class artifact in Origina, produced and consumed through
the event backbone:

| # | Lifecycle stage | System of record | Role | Key business rules | Events produced | Approvals | Exception path | Timestamps measured |
|---|---|---|---|---|---|---|---|---|
| 1 | Product creation | Origina product config (admin/products) | PR/Admin | Versioned, effective-dated | `product.published` | CM approves | — | config→publish |
| 2 | Guideline configuration | Guideline Engine (future) / controlled values now | PR/UW | Versioned rule sets | `guideline.published` | UW+CM | — | — |
| 3 | Investor eligibility config | Investor Program + overlays | CM | Overlay shadows base guideline (same idiom as controlled-value tenant shadowing) | `investor_program.updated` | CM | — | — |
| 4 | Pricing configuration | Rate Sheet draft (margins, LLPA grids) | PR | Draft → approved → published; immutable once published | `rate_sheet.drafted` | CM approval to publish | — | draft→publish latency |
| 5 | Rate-sheet publication | Rate Sheet version | PR | Supersedes prior; broker-visible subset | `rate_sheet.published` | Yes | Emergency reprice fast-path (single approver + post-hoc review) | publish→first-lock |
| 6 | Broker/AE pricing | Pricing run against active sheet | Broker/AE | Quote = sheet + LLPAs + comp; quote is not a lock | `pricing.completed` | — | — | quote latency |
| 7 | Loan registration | Loan (exists today) | Broker/OPS | — | `loan.submitted` (exists) | — | — | — |
| 8 | Lock request | Lock (new) | Broker→LD | Must reference active sheet version + loan snapshot | `lock.requested` | — | Price exception route | request→decision |
| 9 | Lock approval/confirm | Lock | LD | Eligibility pass + sheet still active + within authority | `lock.confirmed` / `lock.denied` | Auto within policy; LD outside | Exception w/ CM approval | request→confirm (SLA) |
| 10 | Lock maintenance | Lock events | LD | Extension fee schedule; relock worst-case rule; float-down policy | `lock.extended` `lock.relocked` `lock.float_down` `lock.expired` | Per policy tier | CM approval above limits | each action |
| 11 | Pipeline monitoring | Pipeline Risk views | CM | Position = Σ locked (pull-through-weighted) | `exposure.threshold_breached` | — | — | snapshot cadence |
| 12–14 | UW changes / material change / reprice | Loan + Lock + Pricing Sheet | UW→LD | Material-change detection on registered fields → lock flagged `reprice_required`; reprice via new pricing-sheet version (staleness idiom from pricing plan) | `loan.material_change` `lock.reprice_required` `pricing_sheet.issued` | LD confirms reprice | Tolerance rules (e.g. amount ±$1k ignore) | change→reprice |
| 15–16 | Closing / funding | Loan status (transition gates incl. `rate_lock_valid`) | OPS | Funded loans enter allocation queue | `loan.status_changed→funded` (exists) | Gates | — | lock→fund (pull-through) |
| 17 | Investor allocation | Allocation (new) | SM analyst | Best-ex ranking + commitment capacity + concentration checks | `loan.allocated` | Above-threshold CM | Manual override w/ reason | fund→allocate |
| 18 | Pool construction | Pool (new) | SM analyst | Pool eligibility rules; WA targets | `pool.updated` `loan.added_to_pool` | CM | Kick-out list | build time |
| 19 | Investor delivery | Delivery (new) | OPS | Condition checklist per investor | `loan.delivered` `delivery.condition_cleared` | — | Kick handling | allocate→deliver |
| 20–21 | Purchase + advice | Purchase Advice (new) | FIN/OPS | Advice lines matched to expected proceeds | `loan.purchased` `purchase_advice.received` | — | Variance dispute | deliver→purchase |
| 22 | Reconciliation | Reconciliation record | FIN | Variance tolerance; suspense workflow | `reconciliation.completed` `variance.flagged` | FIN accept | Dispute w/ investor | purchase→reconciled |
| 23 | Post-close adjustment | Adjustment record | FIN | EPO/EPD clawbacks, premium recapture | `post_purchase_adjustment` | FIN | — | — |
| 24 | Performance reporting | Analytics store | EXEC | Metric lineage to events | — | — | — | — |

### 5.1 Field-change impact matrix (material-change engine)

The material-change detector is a **registered-field watcher**: a config table maps loan fields →
impact domains. `[REC]` Implement as config (controlled by admin, versioned), not code, so
tolerance changes don't need deploys. Effects: **P** = reprice required, **E** = re-run
eligibility, **A** = re-run allocation/best-ex if not yet delivered, **H** = adjust hedge
exposure.

| Field | P | E | A | H | Notes |
|---|---|---|---|---|---|
| Loan amount | ● | ● | ● | ● | Tolerance band (e.g. ±$1,000) before triggering `[OPEN: tolerance values]` |
| Loan purpose | ● | ● | ● | ● | Purchase↔cash-out changes LLPA + program |
| Property type | ● | ● | ● | — | 2–4 unit / condo adjustments |
| Occupancy | ● | ● | ● | — | Investor↔primary is also a compliance event (ATR/QM status flips) |
| State | ● | ● | ● | — | State eligibility + adjustments |
| Credit score | ● | ● | ● | — | Band-crossing only |
| LTV / CLTV | ● | ● | ● | ● | Band-crossing; recompute on amount or value change |
| DTI / DSCR | ● | ● | ● | — | DSCR band-crossing is the big Non-QM one |
| Documentation / income type | ● | ● | ● | — | Bank-statement months, P&L-only etc. |
| Prepayment penalty term | ● | ● | ● | — | Major Non-QM price driver; some states cap/kill PPP |
| IO period / term / amortization | ● | ● | ● | ● | Duration change affects hedge |
| Rate / points chosen | ● | — | ● | ● | Re-quote within sheet |
| Compensation (LPC/BPC) | ● | — | — | — | Net price recompute |
| Fees | — | — | — | — | Disclosure domain, not CM (unless net-funding impact) |
| Lock period | ● | — | — | ● | Period-based price delta |
| Closing date | — | — | — | ● | Expiry risk → extension probability |
| Investor / product | ● | ● | ● | ● | Full re-run |
| UW status | — | — | ● | ● | Pull-through weight changes |
| Exception status | — | ● | ● | — | Approved exception may restore eligibility |

---

## 6. Proposed workspace structure

**Not a dashboard — an operational command center.** Design commitments:

- **Two-tier layout:** a persistent **cockpit** (home) plus dockable **modules** opened as tabs
  or split panes. `[REC]` v1 supports: single, 2-pane horizontal/vertical, 4-pane grid; saved
  layouts per user (Zustand persisted store, same idiom as `pipelineStore`).
- **Context bus:** selecting a loan/investor/pool in one pane broadcasts context; other panes
  opt in to follow (e.g. Loan Detail follows Pipeline selection). Context preserved per tab.
- **Everything drills to the loan record.** Any loan number anywhere opens the existing loan
  workspace (`/loans/[id]`) — capital markets is a lens on the same loan, not a copy.
- Frontend: new route group `/capital-markets/*` wrapped in `AppLayout allowedRoles={[capital_markets, lock_desk, it_admin]}`,
  React Query hooks per module, one new `cmStore` for layout/context. CSS in `globals.css`
  (+ `capital-markets.css` if warranted, following the `analytics.css` precedent).

### 6.1 Cockpit (home page)

Top strip: market snapshot (10Y UST, key rates — mocked in PoC) · active rate-sheet version +
age · alert bell. Body (default layout): **Pipeline exposure summary** (locked/floating/
expected-funded, by product), **Lock activity queue** (pending requests, today's expiries),
**Margin monitor** (locked margin vs target, trend), **Alerts & tasks**. Each tile opens its
full module.

### 6.2 Module inventory

| Module | Purpose | Primary user | Data shown | Key actions | Key calcs | Alerts | Drill-down | PoC? |
|---|---|---|---|---|---|---|---|---|
| Pipeline overview | Whole-book position | CM head | Locked/floating/funded by product, channel, status; concentration bars | Filter, export | Balances, pull-through-weighted expected volume | Exposure breach | → loan list → loan | **Yes** |
| Lock pipeline | Work the locked book | LD | All active locks, status, age, expiry, reprice-required flags | Confirm, extend, relock, deny | Days-to-expiry, extension cost preview | Expiring 72/48/24h; material change on locked loan | → lock detail → loan | **Yes (subset)** |
| Lock expiration calendar | Expiry planning | LD | Calendar heat of expiries vs est. closing dates | Bulk-notify, queue extensions | Closing-date confidence `[PROD]` | Cluster warnings | → lock | No (v1.1) |
| Pricing monitor | Live sheet state | PR | Active sheet, pending drafts, market inputs, staleness | Trigger reprice draft | Sheet age vs threshold | Market move > threshold | → sheet version | Partial (static) |
| Rate-sheet comparison | Diff sheets/versions | PR | Side-by-side sheet grids, cell deltas | Annotate, roll forward | Price deltas | — | → product cell history | No |
| Investor comparison | Normalized investor pricing | CM/PR | Investor × product price grid, SRP, adjustments | Pin scenarios | Net execution per investor | Investor sheet updated | → investor detail | **Yes (mocked sheets)** |
| Best execution | Rank exits per loan/cohort | SM | Eligible investors, net proceeds each, rank, chosen vs best | Run best-ex, choose exit, document override | §7 best-ex stack | Chosen ≠ best (variance) | → calc breakdown | **Yes** |
| Investor eligibility | Pass/fail per program | SM/UW | Rule-by-rule hit/miss with reasons | Request exception | Eligibility evaluation | Eligibility lost on locked loan | → failing rule → loan field | **Yes (simplified rules)** |
| Margin monitor | Margin posture | CM head | Gross/net margin by product/branch/AE vs floors | Drill, flag | §7 margin stack | Below-floor lock | → loan | **Yes (basic)** |
| Hedge position | Coverage state | CM | Positions (from advisor feed), exposure, coverage ratio | Record trade `[PROD]` | Coverage ratio | Coverage out of band | → position | No — **mock tile only** |
| Pull-through analysis | Calibrate assumptions | CM | Cohort funnel lock→fund, assumption vs actual | Update assumption (versioned) | Pull-through rates | Drift vs assumption | → cohort loans | No (needs history) |
| Investor commitments | Capacity ledger | SM | Open commitments, utilization, expiry | Draw, roll | Utilization %, shortfall | Expiry/shortfall approaching | → trades | Partial (static ledger) |
| Loan allocation queue | Assign exits | SM | Fundable/funded unallocated loans + best-ex results | Allocate, override w/ reason | Best-ex + concentration checks | Blocked allocations | → loan | **Yes** |
| Pool builder | Assemble bulk pools | SM | Candidates, WA stats live-updating, eligibility fails | Add/remove, save version | WA coupon/FICO/LTV/DSCR, composition % | WA target breach | → loan | **Yes (sample pool)** |
| Loan sale pipeline | Trades in flight | SM | Trades, deliveries, purchase status | Record milestones | Aging | SLA at risk | → trade → loans | No |
| Gain-on-sale analysis | Realized economics | FIN | Expected vs realized GoS by loan/segment | Accept reconciliation | §7 GoS stack | Variance > tolerance | → purchase advice lines | Partial (expected only) |
| Exceptions & approvals | Authority workflow | CM head/LD | Pending pricing/margin exceptions, history | Approve/deny w/ reason | Exception cost | Aging requests | → loan + requester | **Yes (one flow)** |
| Alerts & tasks | Unified inbox | All | All CM alerts, assignments | Ack, assign, resolve | — | — | → source module | **Yes (basic)** |
| Scenario modeling | What-if | CM | Shocked pipeline value/margin under rate scenarios | Save scenarios | Scenario reval `[PROD]` | — | → loan contributions | No — **mock only** |
| Market data | Rates dashboard | All | UST curve, SOFR, MBS proxies | — | — | Stale feed | — | Mocked panel |
| Executive scorecard | Leadership view | EXEC | Volume, margin, pull-through, exposure trends | Export | Aggregations | — | → underlying module | No (v1.1) |
| Audit history | Reconstruction | Admin/FIN | Event log per entity, snapshots, versions | Export evidence pack | — | — | → snapshot diff | **Yes** |

---

## 7. Calculation inventory

Ownership key: **PE** = Pricing Engine · **EE** = Eligibility Engine · **CMS** = Capital Markets
service (new) · **AN** = Analytics Platform · **REC** = Reconciliation service · **EXT** =
external vendor (integrate, don't build).

General rules `[REC]`: prices in points as `numeric(8,3)` (par = 100.000); bps as `int`;
currency `numeric(12,2)`; rates `numeric(6,4)`. Round half-up at final presentation only; store
unrounded intermediates. Every stored calculation result carries `input_hash`,
`calc_version`, `rate_sheet_version_id`/`assumption_version` as applicable — the same
reproducibility idiom as `pricing_runs`/`pricing_sheets`. Real-time (RT) = computed on request
< 1s; Snapshot (SN) = computed on event and persisted; Batch (B) = scheduled.

### 7.1 Pricing calculations

| Calc | Definition / formula | Inputs | Level | Mode | Owner | Edge cases |
|---|---|---|---|---|---|---|
| Par rate | Lowest rate on active sheet where net price ≥ 100 | Sheet grid, LLPAs | Loan | RT | PE | No par available on sheet (all discount) → report nearest |
| Note rate | Chosen rate from sheet row | Broker selection | Loan | RT | PE | — |
| Base price | Sheet price for (product, rate, lock period) | Rate-sheet version | Loan | RT | PE | Rate not on grid → interpolate? `[REC: no — grid-only in v1]` |
| LLPA stack | Ordered Σ adjustments from grids | FICO/LTV/DSCR/doc/occ/state/PPP grids (versioned) | Loan | RT | PE | Overlapping grid cells; cap/floor rules; missing field → block not default |
| Adjusted price | Base + Σ LLPA | Above | Loan | RT | PE | — |
| Broker comp (LPC) | Comp plan % × amount, min/max clamped | Comp plan, amount | Loan | RT | PE | Plan change mid-lock → locked plan governs (snapshot) |
| Borrower-paid comp | Points charged directly | Broker input | Loan | RT | PE | Anti-steering: LPC and BPC mutually exclusive |
| Discount points / lender credit | Net price − 100, sign-split | Adjusted price, comp | Loan | RT | PE | Credit caps |
| Net price (to lender) | Adjusted price − LPC − concessions | Above | Loan | RT/SN | PE | Snapshot at lock — this is *the* locked economics |
| Gross margin | Net execution price − net locked price to broker, in bps | Lock snapshot, best-ex | Loan | SN | CMS | No eligible investor → margin undefined, alert |
| Net margin | Gross − hedge cost − extension/concession costs − est. ops cost/loan | Cost allocations | Loan/segment | SN/B | CMS+AN | Cost allocation model versioned `[OPEN: finance methodology]` |
| Min margin check | Net margin ≥ floor(product, channel) | Margin config | Loan | RT | CMS | Below floor → exception workflow, never silent |
| Price concession | Granted price − policy price | Exception record | Loan | SN | CMS | — |
| Exception cost | Σ concessions per loan | Exceptions | Loan/branch | SN | CMS | — |
| Extension cost | bps/day schedule × days, from policy version | Lock, policy | Loan | RT→SN | CMS | Cumulative caps; free-extension allowance |
| Relock cost | Policy: max(worst-case basis, current) delta | Lock chain, sheet history | Loan | RT→SN | CMS | Multiple prior locks → worst across chain |
| Float-down cost | Locked − current price at grant, per policy split | Lock, active sheet | Loan | RT→SN | CMS | — |
| Worst-case price | min(net price across all sheets loan was priced/locked under) | Price/lock history | Loan | RT | CMS | Product changed between locks → compare comparable products only |
| Investor execution price | Investor base + investor LLPAs + SRP − delivery fees | Normalized investor sheet | Loan×Investor | RT | CMS | Sheet expired → mark stale, exclude from best-ex |
| Competitive position | Origina sheet vs competitor sheet, matched scenario | Competitor snapshots | Product | B | AN | Scenario matching is approximate — label it |
| Investor price spread | max − min investor execution | Best-ex run | Loan | RT | CMS | <2 eligible investors |

### 7.2 Pipeline calculations

| Calc | Definition | Level | Mode | Owner | Notes |
|---|---|---|---|---|---|
| Locked / floating / funded balances | Σ UPB by lock & loan status | Product/channel/enterprise | RT (indexed query) + SN daily | CMS | Floating = active loans, no active lock |
| Fallout / pull-through | funded ÷ locked (cohort), by segment × status | Cohort | B (weekly calibration) | AN | Needs ≥ 1 cohort cycle of history — **cannot be real in PoC** |
| Weighted pull-through | Σ(UPB × pull-through(segment, status)) | Pipeline | RT | CMS | Uses versioned assumption table |
| Expected funded volume | Weighted pull-through × balances | Pipeline | RT | CMS | — |
| Lock conversion, avg lock age, days-to-expiry | Direct from lock rows | Lock/pipeline | RT | CMS | — |
| Extension/cancellation probability | Hazard model on history | Lock | B | AN `[PROD]` | v2 — start with base rates |
| Approval-to-close conversion, closing-date confidence | Status-history stats | Loan | B | AN `[PROD]` | v2 |
| Concentration set (product, geo, investor, credit band, LTV band, doc type) | segment UPB ÷ total, vs thresholds | Pipeline/pool | RT | CMS | Threshold config in admin rules |

### 7.3 Secondary & execution calculations

| Calc | Definition | Level | Mode | Owner | Notes |
|---|---|---|---|---|---|
| Best execution | argmax over eligible (investor, program, channel) of net proceeds = exec price + SRP − fees − est. carry | Loan | RT + SN on decision | CMS | Persist full ranked table, not just winner |
| Expected gain on sale | (best-ex net proceeds − net locked basis) × UPB + fee income − direct costs | Loan | SN | CMS | Basis definition needs FIN sign-off `[OPEN]` |
| Realized gain on sale | Purchase advice proceeds − booked basis | Loan | SN | REC | GAAP-grade → GL is authority; ours is operational `[ASSUMPTION A9]` |
| Mark-to-market (pipeline) | Reval locked pipeline at current exec prices | Pipeline | B daily | CMS (v1 approx) / EXT (full) | v1: exec-price reval only; no OAS — **label as approximation** |
| Pair-off exposure | Commitment shortfall × pair-off fee | Commitment | RT | CMS | — |
| Commitment utilization / shortfall / overage | delivered ÷ committed; gaps vs window | Commitment | RT | CMS | — |
| Pool WA stats (WAC, WAM, FICO, LTV, DTI, DSCR) | UPB-weighted means | Pool | RT | CMS | Live-update in pool builder |
| Pool composition / eligibility | Segment % vs pool rules | Pool | RT | CMS+EE | — |
| Servicing value (SRP) | From investor sheet (released) | Loan×Investor | RT | CMS | MSR retained valuation = **EXT** |
| Execution variance | Chosen − best net proceeds | Loan | SN | CMS | The honesty metric — always stored |
| Purchase-price variance / suspense / haircut / post-purchase adj. | Advice lines vs expected | Loan | SN | REC | Line-item typed variances |

### 7.4 Risk & forecasting calculations

| Calc | Owner | Stance |
|---|---|---|
| Interest-rate exposure (duration-weighted pipeline DV01) | **EXT** (hedge advisor) with CMS supplying the pipeline tape | `[REC]` Origina produces a clean, event-fresh tape + consumes back positions/coverage. Building DV01/convexity engines in-house is unsafe without a rates infrastructure. |
| Pipeline / price / pull-through sensitivity, margin-at-risk, scenario GoS | AN (simple deterministic shocks) → EXT for model-based | v1: deterministic ±25/50/100bp reprice using sheet deltas — clearly labeled approximation |
| Expected fallout | AN | From pull-through model |
| Volume / funding / delivery forecast | AN | Pipeline roll-forward |
| Hedge coverage / effectiveness | EXT feed; CMS displays | Never computed internally in v1 |
| Concentration risk | CMS | Threshold rules, §7.2 |

**Explicit non-goals (build = unsafe):** OAS, prepayment/credit/severity models, tranche
waterfalls, MSR stochastic valuation. These are Intex/Yield Book/RiskSpan-class problems; the
research report confirms even large vendors specialize. Origina's seam: export a
tape (`GET /v1/cm/pipeline-tape`), import results. `[REC — treat as ADR]`

---

## 8. Domain model

New schema domain `cm_*` (migrations **135+**). All tables follow house rules: UUID PK,
`tenant_id`, TEXT+CHECK statuses, audit triggers on mutating tables, satellite/child tables as
needed. Statuses as plain-class constants with frozensets.

| Entity | Purpose | Key fields | Relationships | Versioning / immutability | Status model |
|---|---|---|---|---|---|
| **RateSheet** | Published pricing artifact | version, effective_from/to, channel, published_by/at, source_note | has many RateSheetEntry, LLPAGrid refs | Immutable once published; supersession chain (pricing-sheet idiom) | draft → pending_approval → published → superseded / withdrawn |
| **RateSheetEntry** | Grid row | product_id, rate, lock_period_days, base_price | belongs to RateSheet | Frozen with sheet | — |
| **AdjustmentGrid / AdjustmentCell** | LLPA matrices | dimension spec (e.g. FICO×LTV), cell values, applies_to product set | referenced by RateSheet version | Versioned with sheet; cells immutable per version | — |
| **PricingScenario / PricingResult** | A quote computation | loan snapshot hash, sheet version, adjustment lines, net price | loan, rate sheet | Append-only (extends existing `pricing_runs`) | — |
| **Lock** | The lock artifact | loan_id, rate_sheet_id, pricing_result_id, rate, base/adjusted/net price, lock_period, locked_at, expires_at, loan_snapshot jsonb, snapshot_hash, prior_lock_id (relock chain) | loan, rate sheet, LockEvents | Core terms immutable after confirm; changes only via LockEvent-producing actions | requested → confirmed → (reprice_required ⇄) → extended* → expired / cancelled / funded_delivered; relock = new row chained |
| **LockEvent** | Append-only lifecycle log | lock_id, event_type, price_delta, cost, policy_version, actor, approval_id | lock | AppendOnlyModel | — |
| **PricingException / MarginException** | Authority workflow | loan_id/lock_id, requested vs policy price, cost, rationale, approver chain | lock, Approval | Append-only decisions | requested → approved / denied / escalated / expired |
| **Investor** | Counterparty master | name, contacts, delivery specs, wire info, status | has Programs, Commitments | Effective-dated fields | active / suspended / offboarded |
| **InvestorProgram** | Buyable program | product mapping, guideline ref, overlay set, SRP schedule | investor; has Overlays | Versioned, effective-dated | — |
| **InvestorOverlay** | Rule deltas vs base guideline | rule expr (validated schema), severity | program | Versioned | — |
| **InvestorRateSheetSnapshot** | Ingested investor pricing | raw file ref (S3 — Sprint 7 storage), normalized grid jsonb, received_at, effective window | investor | Immutable snapshots | received → normalized → active → expired |
| **EligibilityResult** | Evaluation evidence | loan snapshot hash, program version, pass/fail, rule hits/misses | loan × program | Append-only | — |
| **BestExecutionRun** | Ranked exits | loan snapshot hash, inputs (sheet snapshot ids), ranked results jsonb, chosen, variance, rationale | loan; feeds Allocation | Append-only | — |
| **Commitment** | Capacity ledger header | investor, type (best-efforts/mandatory/bulk), amount, window, price basis | investor; CommitmentEvents | Ledger = append-only events | open → partially_filled → filled / expired / paired_off |
| **HedgePosition / Trade** | External positions mirror | instrument, notional, direction, source=advisor feed | — | Append-only mirror | — `[PROD]` |
| **Allocation** | Loan → exit assignment | loan_id, best_ex_run_id, investor/pool, approver, override_reason | loan, pool, commitment | New allocation supersedes prior (chain) | proposed → approved → delivered → purchased / withdrawn |
| **Pool** | Bulk grouping | criteria, WA stats snapshot, target investor | has loans via Allocation | Pool versions on membership change | building → locked → delivered → purchased |
| **Delivery** | Package tracking | allocation_id, condition checklist, milestones | allocation, documents | Append-only milestones | pending → delivered → conditions_outstanding → accepted / kicked |
| **PurchaseAdvice** | Investor's settlement doc | raw file ref, parsed lines, proceeds, fees | delivery, Reconciliation | Immutable | received → matched → disputed → settled |
| **Reconciliation** | Expected vs actual | expected proceeds calc ref, variance lines (typed), suspense amount | purchase advice | Append-only resolutions | open → variance_review → accepted / disputed → closed |
| **MarketDataSnapshot** | Rates at a moment | source, series, values, as_of | referenced by sheets/runs | Immutable | — |
| **CompetitorPriceSnapshot** | External sheets | source, scenario grid, as_of | — | Immutable | — |
| **AssumptionSet** | Pull-through etc. | type, values by cohort, effective_from | referenced by exposure calcs | Versioned | draft → active → superseded |
| **Approval** | Reusable approval evidence | subject type/id, rule that required it, approver, decided_at, rationale | any exception/publication | Append-only | — |
| **Alert** | Actionable notifications | type, severity, subject, assignee, state | any entity | — | open → acked → resolved |

Retention `[PROD-REQ]`: locks, exceptions, best-ex runs, allocations, advices, reconciliations,
and all snapshots retained ≥ 7 years (mortgage record norms; confirm with compliance `[OPEN]`).
Audit triggers: add `locks`, `allocations`, `commitments`, `reconciliations` to the audited set.

### 8.1 Historical accuracy strategy

The reproducibility requirement — *"replay why this loan locked at 101.375 on this sheet under
these guidelines"* — is satisfied by five reinforcing mechanisms, all already idiomatic in
Origina:

1. **Immutable input snapshots.** Every decision row (Lock, EligibilityResult, BestExecutionRun,
   PricingResult) embeds the loan-data snapshot (jsonb) + `snapshot_hash`. Staleness = hash
   mismatch vs live loan — same mechanic as `pricing_sheets.input_hash`.
2. **Versioned configuration.** Rate sheets, adjustment grids, investor programs, policies,
   assumption sets are effective-dated versions; decisions store the version FK, never "current".
3. **Append-only event history.** LockEvents, CommitmentEvents, `domain_events` outbox rows,
   and audit_log triggers give the temporal spine.
4. **Deterministic recalculation.** Calc services accept `(snapshot, config_version)` and are
   pure — replaying a stored decision must reproduce it bit-for-bit; a CI test enforces this
   (§18). Calc code itself is stamped (`calc_version`) so a formula fix doesn't silently rewrite
   history.
5. **Overrides as first-class data.** A manual override is never an edit — it is an Approval +
   override_reason on a new decision row superseding the old.

---

## 9. Service architecture

`[REC]` **Stay in the monolith, enforce boundaries at the package level.** Origina is a modular
FastAPI monolith with an outbox; carving capital markets into deployed microservices now would
add operational cost with no scale justification. Structure the code so each "service" below is
a package (`services/cm/…`) with its own router file, service module, and owned tables — the
platform-era extraction seam is the package boundary + the event contracts, per the existing
platform ADR direction.

| Component | Responsibility | Owns data | API surface (under `/api/v1/cm/`) | Consumes events | Emits events | Sync/Async | PoC? |
|---|---|---|---|---|---|---|---|
| CM Workspace frontend | Cockpit + modules | — (client state) | — | (via polling/React Query; SSE later) | — | — | **Yes** |
| CM BFF layer | Aggregate reads for cockpit tiles (thin; may just be composed endpoints) | — | `GET /cockpit`, module list endpoints | — | — | Sync | **Yes** |
| Rate Sheet service | Sheet lifecycle, publication | rate_sheets, entries, grids | CRUD draft, `POST /rate-sheets/{id}/publish` | — | `rate_sheet.published` | Sync | Static seed only |
| Pricing Engine (extends existing pricing_runs/sheets) | Quote computation: base + LLPA + comp | pricing_results | `POST /pricing/quote` | `loan.updated` (staleness) | `pricing.completed` | Sync, <500ms | **Yes (simplified grid)** |
| Eligibility service | Loan × program rule evaluation | eligibility_results | `POST /eligibility/evaluate` | `loan.material_change` | `eligibility.changed` | Sync, <300ms | **Yes (5–8 rules)** |
| Lock service | Full lock lifecycle + policy | locks, lock_events, exceptions | request/confirm/extend/relock/float-down/deny endpoints | `loan.material_change` → flag reprice | `lock.*` family | Sync command, async watchers | **Yes (request/confirm/expire + material-change flag)** |
| Pipeline Risk service | Balances, exposure, concentration, expected volume | assumption_sets, exposure snapshots | `GET /pipeline/exposure`, `GET /pipeline/concentration` | `lock.*`, `loan.status_changed` | `exposure.threshold_breached` | Async recompute on event; cached reads | **Yes (balances + concentration)** |
| Best Execution service | Rank exits | best_execution_runs | `POST /best-ex/run` (loan or batch) | `pricing.completed`, `eligibility.changed` | `best_ex.completed` | Sync single loan <1s; async batch | **Yes** |
| Allocation & Pooling service | Assignments, pools, WA stats | allocations, pools | allocate / pool CRUD / add-remove loans | `loan.status_changed→funded` | `loan.allocated`, `pool.updated` | Sync | **Yes (single pool)** |
| Commitment service | Capacity ledger | commitments + events | ledger CRUD, utilization | `loan.allocated`, `loan.purchased` | `commitment.threshold` | Sync | Static seed |
| Market Data service | Ingest + serve rates | market_data_snapshots | `GET /market/latest` | — | `market.updated`, `market.stale` | Async ingest (scheduled), cached serve | **Mocked feed** |
| Investor Sheet Ingestion | Normalize investor pricing | investor_rate_sheet_snapshots | upload + review endpoints | — | `investor_sheet.updated` | Async (human-in-loop review) | Seeded JSON, no ingestion |
| Gain-on-Sale service | Expected/realized GoS | gos calcs (derived, stored) | `GET /gos/loan/{id}`, segment rollups | `best_ex.completed`, `purchase_advice.received` | — | Async | Expected-only |
| Reconciliation service | Advice matching, variances | purchase_advices, reconciliations | upload advice, match, accept | `loan.delivered` | `variance.flagged`, `loan.purchased` | Async + human review | No |
| Rules/Authority service | Policy config: floors, limits, authority matrix, material-change registry | policy tables (validated schemas) | admin CRUD + simulate | — | `policy.published` | Sync | Hard-coded policy `[POC-SHORTCUT]` |
| Alerting service | CM alert fan-out | alerts | list/ack/resolve | all CM events | `alert.raised` | Async consumer (one file, outbox pattern) | **Yes (basic)** |
| Audit/lineage | Already exists (audit_log + triggers + outbox) | — | existing + `GET /cm/audit/{entity}` | — | — | — | **Yes** |
| Analytics store | Metric aggregation | warehouse tables | via Analytics Platform | all events | — | Batch | No |

**Storage mapping `[REC]`:** transactional Postgres for everything above (it is all
low-thousands rows/day); analytical rollups in Postgres materialized views until the Analytics
Platform warehouse exists; **no** separate time-series DB, cache, search index, or streaming
infra in v1 — the outbox + Postgres carries the load at this scale. Object storage (Sprint 7
`StorageBackend`) for investor sheet files, purchase advices, delivery packages. Revisit
streaming (Kafka-class) only at platform extraction time.

**Consistency:** strong (single transaction) for: lock confirm (lock row + event + outbox),
allocation (allocation + commitment draw), exception decisions, sheet publication. Eventual for:
exposure recompute, alerts, best-ex batch refresh, analytics, GoS rollups. Every command
endpoint uses `get_audited_db`; every emitted event is written in the same transaction via the
outbox (already the Sprint 4 pattern) — consumers are idempotent on `event_id`.

## 10. Integration architecture

| Integration | Purpose | Direction | Pattern / frequency | Source of truth | Build vs buy | PoC treatment |
|---|---|---|---|---|---|---|
| Market rates (UST, SOFR, MBS proxies) | Sheet triggers, dashboards | Inbound | Vendor API poll (1–15 min) + staleness watchdog | Vendor | **Buy** (data vendor) | **Mock** (fixture JSON, manual "move the market" control for demo) |
| Hedge advisory platform (MCT-class) | Positions, coverage, recommendations | Bidirectional (tape out, positions in) | Daily+intraday SFTP/API; pipeline-tape export | Advisor for hedge math; Origina for tape | **Buy/partner** | **Mock tile** |
| Investor rate sheets | Execution pricing | Inbound | Email/portal file → ingestion review UI; daily | Investor | Build ingestion, buy nothing | **Seeded JSON snapshots** |
| Investor portals / delivery | Delivery packages, purchase advices | Outbound + inbound | Per-investor spec (file layouts); event-driven | Investor for purchase terms | Build per-investor adapters incrementally | Out of scope |
| Competitor pricing | Positioning | Inbound | Weekly snapshots (survey/vendor) | Vendor | **Buy** if available `[OPEN: budget]` | Out of scope |
| Accounting / GL | GoS booking, suspense | Outbound journal summaries | Batch daily/monthly | **GL** for books | Integrate (CSV/API export first) | Out of scope |
| Wire systems | Purchase proceeds | Inbound confirmation | Bank feed | Bank | Integrate later | Out of scope |
| Document platform | Delivery docs, advice files | Internal | Sprint 7 StorageBackend | Origina | Internal | Reuse if landed |
| Broker portal / LOS | Pricing display, lock requests | Internal | Native | Origina | Internal | **Real (internal)** |
| BI tools | Exec reporting | Outbound | Warehouse views | Origina | Integrate | Out of scope |

Error-handling standard for all inbound feeds `[PROD-REQ]`: staleness clocks per feed with
visible "as-of" stamps in every module that displays derived numbers; a stale feed **degrades
to labeled-stale, never to hidden-stale**; reconciliation jobs compare feed vs stored snapshots.

## 11. Event model

New event types on the existing `domain_events` outbox (`aggregate_type`, `aggregate_id`,
`event_type`, `payload`, same envelope as Sprint 4):

```
rate_sheet.published        lock.requested          lock.confirmed         lock.denied
lock.extended               lock.relocked           lock.float_down        lock.expired
lock.reprice_required       loan.material_change    pricing.completed      eligibility.changed
best_ex.completed           loan.allocated          allocation.overridden  pool.updated
loan.added_to_pool          loan.removed_from_pool  commitment.drawn       commitment.threshold
loan.delivered              delivery.kicked         purchase_advice.received  loan.purchased
variance.flagged            reconciliation.completed  margin_exception.requested
margin_exception.approved   policy.published        market.updated         market.stale
exposure.threshold_breached alert.raised
```

Consumer files (one transport concern per file, per the platform ADR): `alert_consumer`
(events → Alert rows + Notification Platform), `exposure_consumer` (lock/status events →
recompute exposure), `staleness_consumer` (material change → flag locks/sheets),
`analytics_consumer` (all → warehouse). Payloads carry the snapshot hash and config-version ids
so consumers never re-read mutable state to interpret an event.

## 12. Security and control model

Extends the existing RBAC + audit substrate. Highest-risk actions and controls:

| Risk action | Control `[PROD-REQ unless noted]` |
|---|---|
| Publishing a rate sheet | Maker–checker: drafter ≠ publisher; diff-vs-prior shown at approval; immediate rollback = republish prior version (new version, old never mutated) |
| Margin/pricing exception approval | Authority matrix (amount/bps tiers) in Rules service; approver ≠ requester; dual approval above tier 2; all evidence on Approval rows |
| Manual best-ex override | Allowed with mandatory reason + variance auto-computed and reported weekly; repeated overrides to same investor flagged (steering risk) |
| Lock policy change | Versioned, effective-dated, approval workflow, simulation against yesterday's lock volume before publish |
| Allocation above $ threshold | CM-head approval gate |
| Reconciliation acceptance with variance | FIN role only; variance typed + explained or routed to dispute |
| Data export | Export events logged (who/what/when); investor-confidential pricing marked and access-controlled per investor `[REC]` |
| Admin config changes | Admin cannot execute CM business actions (SoD); immutable audit; config publishes emit `policy.published` |
| API access (future platform) | Read-only scopes first; per-partner keys; no external write to locks in M4 preview |

Cross-cutting: RBAC roles §4; ABAC attributes for approval tiers; TLS + at-rest encryption
(existing posture); no new PII classes introduced (loan PII already governed; investor wire
details treated as secrets); reproducibility of every pricing decision per §8.1 is itself a
compliance control (fair-lending consistency evidence, investor audit response, financial
restatement defense).

## 13. Metrics and success criteria

Instrumentation rides on `domain_events` + frontend telemetry; formulas below are the v1
definitions (owner = who acts on it).

| Metric | Formula | Source | Owner | Cadence | Target `[ASSUMPTION]` |
|---|---|---|---|---|---|
| Lock turnaround | confirm_ts − request_ts, p50/p95 | lock events | LD lead | Daily | p95 < 30 min (auto-confirm in-policy: seconds) |
| Pricing response time | quote latency | API telemetry | Eng | Continuous | p95 < 500 ms |
| Exception approval time | decision_ts − request_ts | exception events | CM head | Weekly | p95 < 4 h |
| Reprice latency after material change | pricing_sheet.issued − material_change | events | LD | Weekly | p95 < 1 business day |
| Gross / net margin | §7.1 | lock + best-ex snapshots | CM head | Daily | vs plan |
| Margin leakage | Σ(concessions + extension subsidies + execution variance) ÷ volume | exception + best-ex rows | CM head | Weekly | trending ↓; baseline in Phase 0 |
| Execution variance | Σ(chosen − best) | best-ex runs | SM | Weekly | ≈ 0 with documented reasons |
| Pull-through | funded ÷ locked per cohort | lock + status events | CM | Monthly | assumption vs actual drift < 5 pts |
| Commitment utilization | delivered ÷ committed in window | commitment ledger | SM | Weekly | > 90% mandatory |
| Purchase-price variance / suspense aging | typed variance Σ; days open | reconciliations | FIN | Monthly | unexplained ≈ 0; suspense < 30 d |
| Pricing reproducibility | replayed decisions bit-identical ÷ sampled | CI + prod sampler | Eng | Per release | 100% |
| Data freshness | max feed age vs SLA | staleness clocks | Eng | Continuous | 0 hidden-stale incidents |
| Manual touches per loan (lock→purchase) | count of manual actions | events | Product | Monthly | trending ↓ |
| Module usage / context switches / task time | frontend telemetry | telemetry | Product | Monthly | screens-per-task ↓ vs baseline |
| Override rate & reversal rate | overrides ÷ decisions; reversed ÷ overrides | approval rows | CM head | Monthly | flag > 10% `[ASSUMPTION]` |
| Audit completeness | actions with full evidence ÷ actions | audit sampler | Compliance | Quarterly | 100% |

**Product success =** (1) spreadsheet retirement: rate-sheet build, lock log, best-ex model,
and allocation tracker replaced; (2) reproducibility at 100%; (3) measured margin-leakage
reduction; (4) lock turnaround p95 under target. These four are the CTO-reportable outcomes.

---

## 14. Off-sprint proof-of-concept scope

**Goal:** prove the *connected loop* — pipeline → loan → eligibility → investor comparison →
best-ex → material change → reprice → re-rank → allocate → audit — natively on the loan record.
**Anti-goal:** any hedge/OAS/model math, any real external feed, any investor-facing output.

### 14.1 Real vs mocked

| Real | Mocked / shortcut |
|---|---|
| 202 seeded Non-QM loans + loan workspace | Market data feed (fixture JSON + a demo-only "shift market ±25bp" control) `[POC-SHORTCUT]` |
| New tables: locks, lock_events, eligibility_results, best_execution_runs, allocations, pools, alerts (migrations 135–139) | Investor rate sheets: 3 fictional investors seeded as normalized JSON snapshots (no ingestion pipeline) |
| Lock request→confirm→expire + material-change flagging, persisted + audited | Lock policy & authority matrix hard-coded constants (Rules service deferred) |
| Simplified pricing: one seeded Origina rate sheet + 3 LLPA grids (FICO×LTV, DSCR band, doc type) | Broker comp fixed at a single LPC plan |
| Eligibility: 6–8 real rules/program (FICO min, LTV max, DSCR min, state list, loan-amount range, doc type, PPP requirement) | Full guideline engine, overlays UI |
| Best-ex: net execution = investor base + investor LLPAs + SRP − delivery fee; full ranked table persisted with snapshot hash | Carry-cost term (constant per day) |
| Expected GoS per loan | Realized GoS, purchase advice, reconciliation (out entirely) |
| Allocation to investor + one sample pool with live WA stats | Commitments (static ledger display only), delivery workflow |
| Alerts: reprice-required, eligibility-lost, below-margin-floor | Notification fan-out (in-app list only) |
| Audit trail: every action → audit_log + domain_events; per-loan CM history view | Exec scorecard, hedge tile (static image/placeholder data labeled MOCK) |
| Frontend: cockpit + 2-pane layout + 6 modules (Pipeline, Lock queue, Loan CM detail, Investor comparison/Best-ex, Allocation+Pool, Alerts/Audit) | 4-pane grid, saved layouts, context-bus beyond pipeline→detail |

### 14.2 Required backend surface (PoC)

Routes (new router files, thin, logic in `services/cm/*_repo.py`):
`GET /cm/pipeline` · `POST /cm/locks` · `POST /cm/locks/{id}/confirm` · `POST /cm/locks/{id}/expire` ·
`GET /cm/loans/{id}/summary` · `POST /cm/eligibility/evaluate` · `POST /cm/best-ex/run` ·
`POST /cm/loans/{id}/reprice` · `POST /cm/allocations` · `GET/POST /cm/pools…` ·
`GET /cm/alerts` · `GET /cm/audit/{entity_type}/{id}`. Events per §11 subset. Seed script
`scripts/seed_capital_markets.py` (investors, programs, sheets, locks on ~120 of 202 loans).

### 14.3 Acceptance criteria

1. Pipeline module shows locked/floating/expected-funded balances that reconcile to seeded data.
2. Locking a loan snapshots loan data + sheet version; the lock detail reproduces its pricing
   from the snapshot (hash-verified), not from live loan data.
3. Editing a registered field (e.g. FICO 700→678) on a locked loan raises `loan.material_change`,
   flags the lock `reprice_required`, and raises an alert — within one poll cycle.
4. Reprice issues a new pricing result; best-ex re-run changes the investor ranking when the
   change crosses an LLPA/eligibility band; eligibility loss is visible with the failing rule.
5. Allocation writes an immutable record (with best-ex run FK + any override reason) and updates
   pool WA stats live.
6. The audit view reconstructs the full chain for the demo loan: lock → change → reprice →
   re-rank → allocation, with actors and timestamps.
7. Backend tests green (see §18 PoC slice); no regression to existing suites.

### 14.4 What the PoC proves / does not prove

**Proves:** capital markets can live on the loan record with event-driven staleness, versioned
config, and reproducible decisions; the workspace pattern (cockpit + modules + drill-to-loan)
works; the pricing-plan substrate (snapshots, supersession, gates, outbox) generalizes.
**Does not prove:** pricing correctness against real investor sheets, policy completeness, hedge
or risk math, ingestion at production quality, performance at scale, or anything about
reconciliation. Say this out loud in the demo.

## 15. CTO demo script (~15 min)

1. **Cockpit** (1 min): position at a glance — locked $X across N loans, floating $Y, expected
   funded $Z; margin monitor; three open alerts. "Every number drills down."
2. **Pipeline → loan** (2 min): filter to DSCR products, open a loan; CM summary pane shows
   its lock (rate/price/expiry), the sheet version it locked under, snapshot hash.
3. **Investor comparison / best-ex** (3 min): three investors, rule-by-rule eligibility, ranked
   net executions with the calculation breakdown open — "no black box; every line traceable to
   a versioned grid."
4. **Material change** (4 min — the money moment): edit FICO 700→678 in the loan workspace.
   Return to CM: lock flagged *reprice required*, alert raised, Investor B now ineligible
   (failing rule shown). Reprice → new price, best-ex re-ranks, expected GoS moves. "A
   spreadsheet finds this Friday; the LOS found it instantly, because it *is* the LOS."
5. **Allocate** (2 min): allocate to the pool; WA FICO/LTV/DSCR update live; margin-floor alert
   demo on a second loan → exception routing stub.
6. **Audit** (2 min): full reconstructed chain for the loan; point out snapshot hashes and
   version FKs. "Reproducible by construction — same idiom as the pricing-sheet plan."
7. **Close** (1 min): what was mocked (market data, investor sheets, hedge, policy config);
   what production requires (§16); recommended next decision points (§21–22).

## 16. Phased execution roadmap

Estimates are relative (S/M/L ≈ <1 / 1–2 / 3+ engineer-weeks) assuming the current team shape
(1–2 full-stack engineers + founder as PM/SME). **No false precision.**

| Phase | Objective | Scope highlights | Effort | Entry criteria | Exit criteria | Risks |
|---|---|---|---|---|---|---|
| **0 — Discovery** | Validate assumptions A1–A4, A9–A10 | Interviews (CM head/design partner, lock desk, finance); spreadsheet inventory; calc validation against a real best-ex workbook; source-of-truth map; baseline metrics (lock turnaround, leakage) | S–M (1–2 wk, mostly non-eng) | CTO green-light | Assumption log resolved; PoC scope confirmed/cut | No design-partner access → plan stays theoretical (top risk §19) |
| **1 — Architecture foundation** | Freeze contracts | Domain model review, migrations 135–139 spec'd, API + event contracts, calc-ownership ADRs (§21), authority-matrix draft | S (concurrent w/ 0) | — | ADRs accepted; schemas reviewed | Over-design; timebox to the PoC's needs |
| **2 — Off-sprint PoC** | §14 | Seed data, 5 migrations, ~12 routes, 6 UI modules, demo | **L (3–4 wk)** — the off-sprint budget `[OPEN: confirm window]` | Phase 1 contracts | §14.3 criteria + CTO demo delivered | Scope creep — cut list pre-agreed: pool builder → static pool; alerts → audit-view only |
| **3 — MVP (lock desk live)** | First production value: locks + pricing | Real rate-sheet build/publish + approval workflow; full lock lifecycle incl. extensions/relocks/worst-case; Rules service v1 (validated schemas, effective dates, simulation); eligibility v1; pipeline monitoring; RBAC roles; telemetry | XL (2–3 sprints) | PoC accepted; design partner committed; Sprint 7 storage landed (sheet/file refs) | Lock desk runs a real day without the spreadsheet; reproducibility test in CI | Policy edge cases (relock/worst-case) — SME validation gate before go-live |
| **4 — Secondary execution** | Sell-side loop | Investor sheet ingestion (human-in-loop), commitments, allocation + pools production-grade, delivery workflow, purchase advice + reconciliation, realized GoS | XL (2–3 sprints) | MVP stable; ≥1 investor's specs documented | One real loan tracked lock→purchase→reconciled in-system | Per-investor variance; start with the top investor only |
| **5 — Advanced** | Risk + intelligence | Hedge-advisor integration (tape out/positions in), scenario shocks, predictive pull-through, margin-at-risk, competitive intel, allocation optimization, AI-assisted exception triage (post-AI-prerequisites, per AI Scope ADR) | XL, incremental | Phase 4 + hedge advisor contract | Coverage visible in-app; assumptions backtested | Vendor dependency; model governance `[PROD-REQ: assumption versioning + backtests before any model output drives decisions]` |

Testing approach per phase: 0–1 none (docs); 2 = PoC test slice; 3+ = full §18 strategy with
CI gates extending the existing coverage gates. Each phase ends with a demo milestone.

---

## 17. Prioritized backlog (PoC + foundation)

Epics: **E1** CM data foundation · **E2** Lock lifecycle · **E3** Pricing & eligibility ·
**E4** Best-ex & allocation · **E5** Workspace UI · **E6** Events/alerts/audit · **E7** Rules &
authority (post-PoC) · **E8** Ingestion & reconciliation (post-PoC). Priority: **M** must-have
for CTO demo · **S** should-have · **F** future.

| # | Item | Type | Epic | Pri | LOE | Depends on | Acceptance criteria (abbrev.) |
|---|---|---|---|---|---|---|---|
| B1 | ADR set §21 written + accepted | Decision | E1 | **M** | S | — | ADRs merged into DECISIONS.md |
| B2 | Migrations 135–139 (locks, eligibility_results, best_ex_runs, allocations+pools, alerts + investor/program/sheet seed tables) | Data | E1 | **M** | M | B1 | Applied by db_migrate; audit triggers attached; models + schemas |
| B3 | Seed script: 3 investors, programs, sheets, Origina sheet + grids, ~120 locks | Data | E1 | **M** | S | B2 | Deterministic, re-runnable |
| B4 | Lock service: request/confirm/expire + snapshot/hash | Feature | E2 | **M** | M | B2 | §14.3-2 |
| B5 | Material-change watcher + `reprice_required` flag | Feature | E2 | **M** | M | B4 | §14.3-3 |
| B6 | Simplified pricing calc (base + 3 grids + LPC) | Feature | E3 | **M** | M | B3 | Golden-file tests pass (§18) |
| B7 | Eligibility evaluator (6–8 rules/program) | Feature | E3 | **M** | S | B3 | Rule-level pass/fail with reasons |
| B8 | Best-ex service + persisted ranked runs | Feature | E4 | **M** | M | B6,B7 | §14.3-4; full table stored w/ hashes |
| B9 | Allocation + sample pool w/ WA stats | Feature | E4 | **M** | S | B8 | §14.3-5 |
| B10 | Cockpit + pipeline + lock queue UI | UX | E5 | **M** | M | B4 | Balances reconcile; drill to loan |
| B11 | Loan CM detail + investor comparison/best-ex UI | UX | E5 | **M** | M | B8 | Calc breakdown visible |
| B12 | Allocation/pool UI + alerts inbox + audit view | UX | E5/E6 | **M** | M | B9 | §14.3-6 |
| B13 | CM event types + alert consumer | Tech | E6 | **M** | S | B2 | Events in outbox; alerts raised |
| B14 | PoC test slice (§18) | Testing | all | **M** | M | B4–B9 | CI green |
| B15 | Demo polish: market-shift control, demo script data | UX | E5 | S | S | B10–B12 | Demo runs end-to-end in <15 min |
| B16 | 2-pane layout + cmStore persistence | UX | E5 | S | S | B10 | Layout survives reload |
| B17 | Margin monitor tile (locked vs target) | Feature | E5 | S | S | B6 | — |
| B18 | Static commitments ledger display | Feature | E4 | S | S | B3 | — |
| B19 | Rules service v1 (validated schemas, effective dates, simulate, approve/publish) | Feature | E7 | F | L | MVP | — |
| B20 | Rate-sheet builder + publication workflow | Feature | E7 | F | L | B19 | — |
| B21 | Lock extensions/relocks/float-downs/worst-case | Feature | E2 | F | L | B19 | — |
| B22 | Investor sheet ingestion (human-in-loop) | Feature | E8 | F | L | Sprint 7 storage | — |
| B23 | Delivery + purchase advice + reconciliation | Feature | E8 | F | XL | B22 | — |
| B24 | Hedge-advisor tape export/position import | Integration | E8 | F | L | vendor | — |
| B25 | Research spike: investor sheet formats across 3 target investors | Spike | E8 | S (Phase 0) | S | — | Normalization schema validated |
| B26 | Research spike: pull-through data requirements | Spike | E1 | F | S | — | — |

**Sequence:** B1 → B2/B3 → (B4→B5, B6→B7→B8→B9 in parallel with B10→B11→B12) → B13/B14 → B15.
Parallelizable: backend E2/E3/E4 vs frontend E5 once API contracts (Phase 1) are frozen.
**Decisions that must precede coding:** the §21 ADRs, migration numbering (A8), RBAC role names.

## 18. Testing strategy

Extends the existing pytest/vitest + CI-gate setup; backend tests marked `smoke`/`integration`
per house convention.

| Area | Approach | Representative Non-QM scenarios |
|---|---|---|
| Formula validation | **Golden-file tests**: fixture loans × sheet versions → expected price/margin/best-ex, hand-verified (Phase 0 SME sign-off); any calc change must update goldens deliberately | DSCR 1.28 / FICO 742 / LTV 70 / 36-mo PPP / TX → base 101.500, LLPAs −0.875, LPC −1.000 → net 99.625; DSCR 0.98 crossing <1.0 band → adjustment + Investor B ineligible; bank-statement 12-mo vs 24-mo doc-type delta |
| Pricing regression | Full fixture book repriced per release; diff report must be empty or explained | 202-loan seed book |
| Eligibility regression | Rule matrix: each rule × pass/boundary/fail per program | FICO 680 exactly at min (inclusive?); state NY excluded; loan amount at program ceiling |
| Rate-sheet versioning | Publish v2 → in-flight quote still priced on its referenced version; lock on superseded sheet reproduces | — |
| Lock lifecycle | State-machine test: every legal/illegal transition; expiry job; relock chains to prior | Confirm → material change → reprice → confirm; expire → relock uses worst-case |
| Material changes | Each registered field: crossing vs non-crossing (tolerance) changes; unregistered fields do nothing | Amount +$500 (no trigger) vs +$5,000 (trigger); FICO 702→698 band-cross |
| Best-ex / investor comparison | Ranked order deterministic; ineligible excluded; tie-break rule; override records variance | Investor spread scenarios incl. single-eligible and zero-eligible |
| Margin exceptions & authority | Below-floor lock blocked without approval; approver ≠ requester enforced; tier routing | — |
| Pool eligibility | WA targets, composition caps, ineligible-loan rejection | Pool DSCR-WA floor breach on add |
| Event processing | Outbox rows written transactionally with commands; consumers idempotent (replay same event twice) | — |
| Integration failure | Stale market feed → labeled stale, pricing blocked or warned per config, never silent | — |
| Audit reconstruction | End-to-end: seeded action chain → audit view returns complete ordered evidence | The §15 demo chain as an automated test |
| Historical reproducibility | **The keystone test**: sample N stored decisions, replay from (snapshot, config version, calc_version) → bit-identical; run in CI per release | — |
| Permissions | Extend `test_rbac_coverage.py` matrix with CM roles × CM routes | lock_desk cannot allocate; admin cannot approve exceptions |
| Performance / volume | Pipeline + best-ex batch against a 5,000-loan synthetic book; exposure query < 1s | `[PROD-REQ]`, not PoC |

PoC slice = golden pricing files, lock state machine, material-change triggers, best-ex
determinism, allocation immutability, audit reconstruction, RBAC additions.

## 19. Risk register

| Risk | P | I | Mitigation | Owner | Early warning |
|---|---|---|---|---|---|
| Incorrect financial calculations | M | **H** | Golden files SME-verified in Phase 0; reproducibility CI; approximations labeled in-UI; GL remains books of record | Eng + CM SME | Golden-file churn without sign-off |
| Insufficient capital-markets SME validation (the meta-risk) | **H** | **H** | Phase 0 is a hard gate: no design partner / SME access → PoC still runs (it's architectural) but Phase 3 does **not** start | CTO | Interviews keep slipping |
| Stale market/investor data driving decisions | M | H | Staleness clocks + labeled-stale degradation; feeds excluded from best-ex when expired | Eng | Stale-data incident count |
| Incorrect investor eligibility → kicked deliveries | M | H | Rule-level evidence per evaluation; re-eval at lock, allocation, delivery; kick post-mortems feed rule fixes | SM | Kick rate |
| Pricing version mismatch / missing snapshots | L | H | Snapshots + version FKs are NOT NULL by schema; reproducibility test | Eng | Any replay failure |
| Overlapping service ownership (PE vs CMS vs AN) | M | M | §7 ownership column is normative; ADR-7 below | Arch | Duplicate calc implementations |
| Vendor coupling (hedge, market data) | M | M | Protocol seams (tape export / position import); vendor behind interface like `StorageBackend` | Arch | Vendor-specific types leaking inland |
| Spreadsheet shadow-system persists post-MVP | H | M | Phase 3 exit = a real lock-desk day without the sheet; retire artifacts explicitly | Product | Exports spiking |
| Manual override abuse | M | M | §12 controls; override + reversal metrics | CM head | Override rate > 10% |
| Incomplete accounting reconciliation | M | H | Phase 4 scope; GL authoritative meanwhile; typed variances | FIN | Suspense aging |
| Hedge-model complexity creep | M | H | Hard non-goal (§7.4); ADR-2 | CTO | Any in-house DV01 PR |
| Competitive pricing data unavailable | H | L | Feature is optional; degrade to manual snapshots | Product | — |
| Scope expansion of the off-sprint | **H** | M | §16 pre-agreed cut list; PoC shortcut labels in this doc are the contract | CTO | Week-2 burndown |
| PoC economics mistaken for real pricing | M | M | "DEMO DATA — fictional investors" banner in PoC UI `[POC-SHORTCUT made safe]` | Product | — |

## 20. Open stakeholder questions

**CTO:** Off-sprint window length and eng allocation? Is a design partner (real Non-QM lender)
available for Phase 0, and when? Does CM justify a milestone re-plan (it isn't in M2–M4 scope
today — where does Phase 3 land relative to Sprints 8–15)?
**Head of Capital Markets (or proxy SME):** Validate A1/A2 (exit mix, hedge practice). Real
extension/relock/float-down policy tables? Authority tiers? Which 3 investors first, and can we
get their sheets + delivery specs? Worst-case pricing rule as actually practiced?
**Lock desk:** Current request intake channel and volume? Auto-confirm appetite? Tolerance
bands per field for material change?
**Finance:** GoS basis definition and GL boundary (A9)? Variance tolerance and suspense
workflow? Cost-allocation model for net margin?
**Operations:** Delivery condition checklists per investor? Where do purchase advices arrive
today?
**Product:** Broker-facing lock request UX — portal now or v2? Which persona is the launch
user (bet: lock desk)?
**Engineering:** Concurrent-edit semantics between loan workspace and CM actions (optimistic
locking on snapshot hash?)? Polling vs SSE for the cockpit in v1?
**Compliance:** Retention period confirmation; fair-lending review of exception/concession
reporting; investor-confidentiality obligations on sheet data.
**Data team:** Historical lock/fund data available anywhere (for pull-through bootstrap)?

## 21. Architecture decision records to create

Write into [DECISIONS.md](DECISIONS.md) before coding (B1):

1. **ADR: Capital markets scope boundary** — build origination-side CM natively; integrate
   hedge/OAS/prepay/severity/MSR/waterfall analytics; the seam is the pipeline-tape export +
   position import.
2. **ADR: No in-house rate-risk math** — DV01/convexity/scenario reval beyond deterministic
   sheet-delta shocks comes from the hedge advisor; deterministic shocks always labeled.
3. **ADR: Lock as artifact** — locks follow the pricing-sheet idiom (immutable core + event
   chain + snapshot hash), not a mutable status field on loans.
4. **ADR: Material-change registry as versioned config** — field→impact map + tolerances in
   admin-managed validated config, not code.
5. **ADR: Investor overlays via shadowing** — overlay rows shadow base guidelines exactly as
   tenant controlled-values shadow system values.
6. **ADR: CM stays in the monolith** — package-boundary modularity (`services/cm/`), outbox
   contracts as the future extraction seam; no new infra (streaming/cache/TSDB) in v1.
7. **ADR: Calculation ownership map** — §7's owner column is normative; one implementation per
   calc; Analytics reads snapshots, never re-derives economics.
8. **ADR: Reproducibility as invariant** — every priced/ranked/allocated decision persists
   (snapshot, config versions, calc_version); CI replays samples; a failure blocks release.

## 22. Recommended immediate next actions

1. **CTO review of this document** — confirm scope stance (§1 four moves), the PoC cut
   (§14), and the off-sprint window (§20-CTO).
2. **Write the 8 ADRs** (B1, ~a day) and merge into DECISIONS.md.
3. **Schedule Phase 0 interviews** — at minimum one CM SME and finance; if no design partner
   exists, CTO decides whether the PoC proceeds on assumptions (it can — it proves
   architecture, not policy).
4. **Freeze PoC contracts** — migrations 135–139 draft, API + event list (§14.2), seed-data
   design; half a week alongside Phase 0.
5. **Build the PoC** per §17 sequence (B2–B14), demo per §15.
6. **Decide the roadmap slot** — where Phase 3 (MVP) lands against Sprints 8+ and the M2/M3
   gates; update [sprints/MILESTONES.md](sprints/MILESTONES.md) accordingly rather than letting
   this live as an unscheduled side-track.

---

**Critical self-assessment (what would be unsafe or unrealistic):** building hedge/OAS/MSR math
in-house (unsafe — excluded); production lock policy without SME validation (unsafe — gated at
Phase 3); investor sheet ingestion in the off-sprint (unrealistic — seeded snapshots instead);
real-time market feeds in the PoC (unnecessary — mocked with a demo control); the full module
inventory in §6.2 (unrealistic — 6 modules in PoC, rest phased). The smallest coherent
implementation is the §14 loop: it exercises every architectural commitment (snapshots,
versions, events, gates, audit) on one thin path, which is exactly what the CTO needs to judge
whether capital markets belongs inside Origina. The answer this plan argues for: the
origination side does; the quant side never should.

