# Sprint 19 — Build Spec (OUTLINE — pre-draft, two milestones out)
## SDK, Developer Docs & First Partner Integration

> **Status:** outline (pre-draft). Refine to DRAFT during M3; promote at the M3 gate (Sprint 15.4).
> **Milestone:** [M4 — Platform](MILESTONES.md) (sprint 4 of 5)
> **Sprint goal:** A partner engineer can integrate in a day without a phone call — and the first real partner integration goes live on it.

## Planned phases (outline)

- **19.1 TypeScript SDK:** generated from the `/api/ext/v1` OpenAPI spec (generator choice: openapi-generator vs a hand-rolled thin client — decide by output quality), publish pipeline, smoke-tested against sandbox in CI.
- **19.2 Developer docs:** quickstart (key → first request in 5 minutes), auth guide, pagination, webhook guide with verify-signature sample code, error catalog, the 16.1 changelog surfaced publicly.
- **19.3 CRM integration (the partner deliverable):** inbound — CRM lead creates a draft loan via the write API; outbound — `loan.status_changed` webhook posts to the CRM timeline. **Partner and CRM chosen at the M3 gate by what the pilot lender actually uses** — do not pick the CRM now.
- **19.4 Integration UAT with the partner:** their engineer, their environment, our sandbox.

## Pivot trigger (pre-agreed)

**No committed partner by the end of Sprint 17 →** 19.3/19.4 become a reference integration app we own (proves the same surface), and M5 prework (guideline data model) pulls forward into the freed capacity. The sprint does not idle waiting on a partner's legal department.

## Key decisions (ADRs)

SDK generator + publishing model (public npm vs partner-scoped) · partner selection criteria (pilot lender's real CRM > logo appeal) · support model for the SDK (versioning cadence tied to the 16.1 policy).

## B-gates (sketch)

SDK round-trip in CI (create loan via SDK against sandbox) · quickstart followed verbatim by someone who didn't write it, timed · partner (or reference app) end-to-end green: lead in → draft loan → status webhook out.
