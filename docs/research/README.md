# Research

Industry deep-research reports for ongoing monitoring of the mortgage/LOS landscape and improvement thinking. Reports live here as the **citation trail**; conclusions do not.

## How findings flow out of this directory

- **Changes a made decision or establishes a new pattern** → write an ADR in [DECISIONS.md](../DECISIONS.md), citing the report.
- **Shapes future scope or priorities** → update [ROADMAP.md](../ROADMAP.md) (or the relevant sprint spec).
- **Refines the platform blueprint** → fold into [CONFIG_AND_DECISION_PLATFORM.md](../CONFIG_AND_DECISION_PLATFORM.md).
- The report itself stays untouched after ingestion — it is the evidence, not the plan.

A report is "ingested" once its actionable findings have landed in one of the docs above. Add new reports to the index below with a one-line hook and ingestion status.

## Index

| Report | Topic | Status |
|---|---|---|
| [enterprise-architecture-for-a-multi-tenant-saas-los-platform-deepresearch.md](enterprise-architecture-for-a-multi-tenant-saas-los-platform-deepresearch.md) | Multi-tenant SaaS LOS architecture: control/runtime planes, canonical dictionary, rules platforms, BRMS survey | Ingested 2026-07-09 — 4 findings folded into the platform blueprint (MISMO anchoring, RLS defense-in-depth, package content hashes, static analysis as publish gates); divergences assessed and blueprint positions held (one spine vs. two platforms, no config environments, six-state evaluation) |
| [industry-standard-workflow-deep-research-report.md](industry-standard-workflow-deep-research-report.md) | Non-QM wholesale operations: 7-day fast-lane close, event-driven exception-based operating model, SLA/telemetry design, automation tiers | Pending — telemetry taxonomy and gross-vs-controllable cycle-time split earmarked for Sprint 4 (domain events + analytics); fast-lane SLA model earmarked for Decision Platform Phase 3+ |
| [bank-account-aggregator-deep-research.md](bank-account-aggregator-deep-research.md) | Automated income evaluation via aggregators (Plaid/MX/Yodlee/Finicity/TrueLayer/Salt Edge): waterfall pattern, income decisioning layer, consent/compliance (CFPB 1033, FCRA, GLBA), economics, roadmap | Pending — future capability, blocked on S3 + domain events + async jobs (same prerequisites as AI ADR). Its "income decisioning layer" (policy, confidence, explainability) is the Decision Platform; aggregator connectors slot into the integrations namespace. For Non-QM, exact statement-PDF retrieval (Plaid/MX) matters for investor delivery, not just structured data. Revisit at Decision Platform Phase 3+ |
