# Feature Implementation Guides

> Part of [Architecture Index](README.md)

Checklists for adding new pieces to the system. Follow these to stay consistent with existing patterns.

---

## New API Endpoint

1. Add Pydantic schema in `schemas/<domain>_schema.py`
2. Add route to `api/v1/<domain>.py` — use `get_audited_db` for writes, `get_db` for reads
3. Implement logic in `services/<domain>_repo.py`
4. Return `<Domain>Out` schema
5. Mirror shape in `src/frontend/src/types/api.ts`

---

## New Database Table

1. Create `db/migrations/<next_number>_<name>.sql`
2. Add SQLAlchemy model in `models/`
3. Run `scripts/db_migrate.sh`
4. If audited: attach `log_audit_event()` trigger; add table name to `_LOAN_ID_PK` array in trigger function if PK is `loan_id` not `id`
5. If it contains controlled values: add rows to `controlled_value_sets` + `controlled_values` in the same migration
6. Update the migration sequence in [database.md](database.md)

---

## New Frontend Page

1. Add file to `src/pages/<domain>/index.tsx` (or `[id].tsx` for detail routes)
2. Wrap with `<AppLayout allowedRoles={[...]}>` for auth guard
3. Add a `useQuery`-based hook in `src/hooks/` for any data fetching (do not use raw `useEffect + fetch`)
4. Add route to `components/app/Sidebar.tsx` with `roles` array
5. For settings/admin pages: use `SettingsLayout` instead of `AppLayout`

---

## New Controlled Value Set

1. Add `INSERT INTO controlled_value_sets` in the migration
2. Add `INSERT INTO controlled_values` seed rows (`tenant_id = NULL`) for all initial values
3. Add plain class constants in the relevant Python model file
4. Update the `CHECK` constraint on the relevant column
5. Update the value set list in [database.md](database.md)

---

## New React Query Hook

```ts
// src/hooks/use<Domain>.ts
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/services/apiClient";
import { useAuth } from "@/state/auth";
import type { <Domain>Out } from "@/types/api";

export function use<Domain>(id?: string) {
  const { token } = useAuth();
  return useQuery<<Domain>Out>({
    queryKey: ["<domain>", id],
    queryFn: () => apiRequest<<Domain>Out>(`/<domain>/${id}`, { token: token ?? undefined }),
    enabled: !!token && !!id,
    staleTime: 5 * 60 * 1000,
  });
}
```

For mutations, invalidate the relevant query key on success:
```ts
onSuccess: () => queryClient.invalidateQueries({ queryKey: ["<domain>"] })
```
