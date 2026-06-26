# Settings Module Architecture

> Part of [Architecture Index](README.md)
>
> Source: MiniMax M2.7 design session, 2026-06-25.

---

## North Star

Settings should feel like a control center, not a form graveyard. Every settings screen should answer:

1. What is this?
2. What's blocking me from changing it?
3. Who else can see it?
4. What's the next action?

---

## Information Architecture

### Tier 1 — Personal (`/settings/*`, every role, avatar menu)

| Section | Purpose |
|---|---|
| Profile | Name, title, email, phone, avatar, signature, bio |
| Security | Password change, MFA toggle, active sessions, recent sign-ins |
| Notifications | Email digest cadence, mention alerts, escalation alerts, quiet hours |
| Preferences | Default landing page, table density, time zone, locale, theme, reduced-motion override |

### Tier 2 — Workspace (`/admin/*`, `it_admin` + `account_manager`, sidebar Admin item)

| Section | Purpose |
|---|---|
| Organization | Tenant name, logo, primary color, support email, business hours |
| People | User list, invites, role assignment, team membership, bulk import, deactivate |
| Roles | Built-in role overview; custom role matrix (future) |
| Products | DSCR / Bank Statement / Asset Depletion / IO / Jumbo Non-QM — guideline defaults, LTV/FICO ranges, doc requirements |
| Workflow | Status pipeline config, SLA timers, condition templates, exception categories, authority matrix |
| Pipeline defaults | Org-wide saved views, default columns, default sort |
| Notifications (org) | Digest schedules, escalation policies, mention groups |
| Security (org) | Password policy, MFA enforcement, SSO config, IP allowlist, session timeout, audit retention |
| Integrations | S3, eSign, pricing engine, credit bureau, MISMO, email/SES |
| Audit log | Read-only explorer of `audit_log` scoped to tenant |
| Brokers | Broker directory, commission tiers, channel assignments, submission quality rules |

### Tier 3 — Future (not in this build)

Billing, custom domains, developer API, data residency.

---

## URL Structure

```
/settings             → redirect to /settings/profile
/settings/profile
/settings/security
/settings/notifications
/settings/preferences

/admin                → redirect to /admin/organization
/admin/organization
/admin/people
/admin/roles
/admin/products
/admin/workflow
/admin/pipeline
/admin/notifications
/admin/security
/admin/integrations
/admin/audit-log
/admin/brokers        (account_manager + it_admin)
```

Mental model: `/settings/*` = yours, `/admin/*` = the company's.

---

## Layout Pattern — `SettingsLayout`

The primary reusable primitive. Used by every page in both tiers.

```
┌─────────────────────────────────────────────────────────────────┐
│ Page Header                                                     │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ Title + one-line description        Last saved 2m ago · ↗   ││
│ └──────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌──────────────┐ ┌────────────────────────────────────────────┐ │
│ │ In-page rail │ │ Content (form sections as cards)           │ │
│ │              │ │                                            │ │
│ │ ▌ Profile    │ │ ┌── Identity ──────────────────────────┐  │ │
│ │   Security   │ │ │ First name []                        │  │ │
│ │   Notifs     │ │ │ Last name  []                        │  │ │
│ │   Prefs      │ │ └──────────────────────────────────────┘  │ │
│ │              │ │ ┌── Contact ───────────────────────────┐  │ │
│ │ 🔍 search    │ │ │ Email []                             │  │ │
│ └──────────────┘ │ │ Phone []                             │  │ │
│                  │ └──────────────────────────────────────┘  │ │
│                  │                                            │ │
│                  │ ┌─ SaveBar (sticky bottom) ─────────────┐ │ │
│                  │ │ ● Unsaved changes  [Cancel]  [Save]   │ │ │
│                  │ └───────────────────────────────────────┘ │ │
│                  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Layout Rules

- In-page rail: 2px accent bar on active item (not fill) — matches existing sidebar pattern
- Content cards: title + optional helper text; never bleed into each other
- Slide-overs (right-anchored Sheet) for sub-card edits — users don't lose list context
- Modals only for destructive confirmations
- Rail search box filters sections live (no page reload)
- SaveBar: sticky, three states: `Saved 2m ago` (green dot) / `Unsaved changes` (orange dot) / `Saving…` (animated dot, respects `prefers-reduced-motion`)
- Dirty-state guard on route change: `beforeunload` warning + Next.js router prompt
- Skeletons on tab switch, never spinners
- All animations 150–300ms, CSS-first, `transform`/`opacity` only

---

## Component Reuse

| Need | Use |
|---|---|
| Card containers | shadcn `Card` |
| Form fields | shadcn `Input`, `Select`, `Switch`, `Textarea`, `Checkbox` |
| Form orchestration | `react-hook-form` + shadcn `Form` (Zod resolver, mirrors Pydantic) |
| Slide-overs | shadcn `Sheet` |
| Modals (destructive) | shadcn `Dialog` (typed-confirmation pattern) |
| Toasts | shadcn `Toast` / Sonner |
| Skeletons | existing `components/feedback/` skeleton primitives |
| Page header | existing `components/dashboard/PageHeader.tsx` (extend with `lastSavedAt` + audit link) |
| Status pills | existing pattern (always paired with text) |
| Empty/Error/Loading | existing `components/feedback/{EmptyState,ErrorState,LoadingSpinner}` |

**Net-new primitives** (all in `src/components/settings/`):

- `SettingsLayout`
- `SectionCard`
- `SaveBar`
- `SearchableSectionNav`
- `DestructiveConfirmDialog`
- `LastEditedByChip`

---

## Backend Data Model — Migrations 126–131

| Migration | Purpose |
|---|---|
| `126_user_profile.sql` | Add `users.phone`, `title`, `avatar_url`, `locale`, `timezone`, `preferences JSONB`, `notification_preferences JSONB`, `mfa_enabled`, `signature`, `bio` |
| `127_user_sessions.sql` | New `user_sessions` (`id`, `user_id`, `tenant_id`, `ip`, `user_agent`, `last_active_at`, `expires_at`, `revoked_at`) — feeds Security page |
| `128_tenant_settings.sql` | Add `tenants.logo_url`, `primary_color`, `support_email`, `business_hours JSONB`, `audit_retention_days`, `password_policy JSONB`, `mfa_required`, `sso_config JSONB`, `defaults JSONB` |
| `129_loan_program_defaults.sql` | New `loan_program_defaults` (`id`, `tenant_id`, `program`, `min_fico`, `max_ltv`, `max_dti`, `min_dscr`, `doc_requirements JSONB`, `pricing_scenario_id`, `is_active`) |
| `130_notification_policies.sql` | New `notification_policies` (`id`, `tenant_id`, `scope`, `channel`, `cadence`, `recipients`, `triggers JSONB`, `is_active`) |
| `131_condition_templates.sql` | New `condition_templates` (`id`, `tenant_id`, `name`, `category`, `applies_to_program[]`, `default_text`, `requires_document BOOL`, `sort_order`, `is_active`) |

All tables: multi-tenant, audited (`log_audit_event()` trigger), `tenant_id` never accepted from request body.

---

## API Endpoint Families

All under `/api/v1/`, `Depends(get_audited_db)` for writes, `require_roles(...)` gated.

```
# Personal
GET  /users/me
PATCH /users/me
PATCH /users/me/preferences
PATCH /users/me/notifications
POST  /users/me/password
GET   /users/me/sessions
POST  /users/me/sessions/{id}/revoke
POST  /users/me/sessions/revoke-all

# Tenant / Org
GET  /tenants/current
PATCH /tenants/current
GET  /audit-log          (filters: actor, table, date range, loan_id)

# People (admin)
GET    /users
POST   /users/invite
PATCH  /users/{id}
DELETE /users/{id}        (soft)
POST   /users/{id}/deactivate

# Products (admin)
GET    /products
POST   /products
PATCH  /products/{id}
DELETE /products/{id}

# Condition templates (admin)
GET    /condition-templates
POST   /condition-templates
PATCH  /condition-templates/{id}
DELETE /condition-templates/{id}

# Notification policies (admin)
GET    /notification-policies
POST   /notification-policies
PATCH  /notification-policies/{id}
DELETE /notification-policies/{id}
```

---

## Phase Plan

### Phase 1 — Foundation (~1 week)

- `npx shadcn@latest init`
- Install and configure `@tanstack/react-query` ✅ (already done)
- Build `SettingsLayout`, `SectionCard`, `SaveBar`, `SearchableSectionNav`
- Extend `TopHeader.tsx` with avatar menu → "Settings" link
- Extend `Sidebar.tsx` with conditional Admin item
- Migrations 126, 127, 128
- Backend: `GET/PATCH /users/me`, `GET/PATCH /tenants/current`, `GET /audit-log`
- Frontend: `/settings/profile`, `/settings/security`, `/admin/organization`
- Wire to real API

### Phase 2 — People & Personal Preferences (~4 days)

- Migrations 130, 131
- Frontend: `/admin/people`, `/admin/roles` (read-only overview)
- Frontend: `/settings/notifications`, `/settings/preferences`
- Backend: `/users/*`, `/users/invite`

### Phase 3 — Product Configuration (~4 days)

- Migration 129
- Frontend: `/admin/products` (list + slide-over for edit)
- Reuses `controlled_values` for enums — no new enum tables
- Backend: `/products/*`

### Phase 4 — Workflow, Org Security, Integrations, Audit (~1 week)

- Frontend: `/admin/workflow`, `/admin/notifications`, `/admin/security`, `/admin/integrations`, `/admin/audit-log`, `/admin/brokers`
- Backend: `/condition-templates/*`, `/notification-policies/*`, `/audit-log` filters

---

## Acceptance Criteria

Every settings page must satisfy before merge:

- Answers: what is this? what blocks the change? who else can see it? what's the next action?
- Most important action is visually obvious (SaveBar)
- Labels use user language ("Workspace" not "Tenant", "Member" not "User row")
- Role-aware defaults (broker never sees `/admin/*`; account_manager lands on `/admin/brokers`)
- Task happens inside the page (slide-overs for sub-card edits, no full-page nav)
- Ownership visible (`Last edited by <user> · 2m ago`)
- Activity appears in audit log
- Animations communicate state (Saved → Saving → Unsaved)
- CSS-first, `transform`/`opacity` only, 150–300ms, respects `prefers-reduced-motion`
- Keyboard reachable end-to-end
- Icon-only controls have `aria-label`
- Active rail item uses `aria-current="page"`
- Color always paired with text/icon
- Heading hierarchy correct (h1 page → h2 section → h3 card)
- Form fields have visible labels
- Errors explain what happened + how to recover
- Loading preserves layout (skeletons)
- Empty states have a next action
- Error states have retry
- Destructive actions require typed confirmation (delete product, deactivate user, revoke all sessions)
- Entered data preserved on save failure
- Reuses existing components
- Terminology consistent ("workspace", "member", "condition")
- Layout still works with 200 members, 18 products, 50 condition templates

---

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Settings storage split | Per-user prefs in `users.preferences JSONB`, per-tenant config in `tenants.defaults JSONB` + dedicated tables for lifecycle-bearing entities | Matches existing pattern; avoids a generic KV bag |
| React Query timing | Phase 1, before any settings pages built | Settings is the most-mutated surface; adding later means rewriting every hook |
| In-page rail vs tabs | In-page rail | Scales past 4 sections; matches density ethos; tabs only work cleanly for ≤4 sections |
