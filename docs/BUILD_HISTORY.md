# Origina LOS — Build History

A session-by-session record of what was built, reviewed, and decided. Use this to trace why things are the way they are.

> **Archives:**
> - Sessions 1–18 (Phase 1) — [docs/archive/BUILD_HISTORY_PHASE1.md](archive/BUILD_HISTORY_PHASE1.md)
> - Sessions 19–30 (Phase 2 / Sprint 1+2) — [docs/archive/BUILD_HISTORY_PHASE2.md](archive/BUILD_HISTORY_PHASE2.md)

The current file starts at **Session 31 (Sprint 3 — Full Workspace)**.

---

## Bug Log

| ID | Date | Severity | Title | Fix |
|----|------|----------|-------|-----|
| BUG-2026-07-09-001 | 2026-07-09 | High | ProtectedRoute redirect loop — `it_admin` users stuck on "Redirecting…" after role-vocabulary reconciliation | `ADMIN_ROLES = ["it_admin", "admin"]` so admins pass every page guard, plus a `target !== router.pathname` guard that bails out instead of redirecting into a denied page |

### BUG-2026-07-09-001 — `ProtectedRoute` redirect loop

**Reported by:** user (manual QA after Sprint 2 sign-off)

**Symptom:** Logging in as `admin@origina.dev` (`it_admin` role) and hitting `/dashboard` resulted in `/dashboard/account-executive` rendering "Redirecting…" indefinitely.

**Root cause:** `src/frontend/src/components/app/ProtectedRoute.tsx` declared `const isAdmin = user?.role === "admin";`. Once Sprint 2 reconciled the role vocabulary and the canonical backend name became `"it_admin"` (legacy alias `"admin"` preserved), an `it_admin` user landing on a page with `allowedRoles={["account_executive"]}` was denied (role mismatch) AND was redirected to `roleDashboardPaths["it_admin"] = "/dashboard/account-executive"` — the same denied page. `router.replace` would then immediately fire again because the target matched the current path semantics — infinite loop.

**Fix:**
1. `const ADMIN_ROLES: UserRole[] = ["it_admin", "admin"]` — both names treated as superusers in the page guard.
2. Bail out when `target === router.pathname` — defensive guard eliminates the loop class even if a future role mismatch happens.

**Regression coverage:** Manual verification after fix — `admin@origina.dev` → `/dashboard` → renders `/dashboard/account-executive` correctly.

---

## Session 31 — Sprint 2 Closure: Bug Log, Archives, BUILD_HISTORY Reset

**Type:** Documentation hygiene — log the ProtectedRoute bug, archive Sprint 1/2 history into `BUILD_HISTORY_PHASE2.md`, start a fresh `BUILD_HISTORY.md` for Sprint 3 onward.

### What was done

1. **Bug logged** in the new `## Bug Log` table at the top of `BUILD_HISTORY.md` (BUG-2026-07-09-001).
2. **Archived** `docs/BUILD_HISTORY.md` (sessions 19–30, Phase 2 era) into `docs/archive/BUILD_HISTORY_PHASE2.md`. Updated the inline archive reference in the moved file.
3. **Reset** `docs/BUILD_HISTORY.md` to start at Session 31 with the bug log + this closure entry. The file will accumulate Sprint 3+ sessions from here.

### Files touched

- `docs/BUILD_HISTORY.md` — replaced with the reset version.
- `docs/archive/BUILD_HISTORY_PHASE2.md` — new archive, contains everything that used to be in `BUILD_HISTORY.md`.

### Validation

- `ls docs/archive/` shows both `BUILD_HISTORY_PHASE1.md` and `BUILD_HISTORY_PHASE2.md`.
- Both files open without `<!-- broken link -->` markers; cross-references updated.
