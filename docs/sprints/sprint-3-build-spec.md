# Sprint 3 — Implementation Spec
## Full Workspace: Every Section Does Real Work

> **For:** MiniMax M3 (or any LLM/developer implementing this sprint)
> **Validated by:** Claude Code after completion
> **Sprint goal:** A complete loan review cycle is possible inside the workspace — notes posted, status transitioned with a reason, underwriter issues a decision, documents uploaded and tracked.
> **Prerequisite:** Sprints 1 and 2 must be complete and all their tests green.

---

## Repo Context

```
src/backend/app/
  api/v1/
    workflow.py      ← Notes: POST /notes/, GET /notes/  (fully functional)
    audit.py         ← GET /audit-logs/, GET /snapshots/, GET /loans/{id}/fields/{key}/history
    status.py        ← GET /{loan_id}/status, GET /{loan_id}/status/history, POST /{loan_id}/status/transition
    decisioning.py   ← Pricing runs, eligibility runs (functional but no FRONTEND component)
    documents.py     ← Full upload/download/archive implementation

src/frontend/src/
  components/loans/workspace/
    WorkspaceConversation.tsx  ← ALL hardcoded mock data — needs API wiring
    WorkspaceAuditLog.tsx      ← ALL hardcoded mock data — needs API wiring
    WorkspaceStatus.tsx        ← Fetches real status + history; transition UI partially built
    WorkspaceDocuments.tsx     ← ALL hardcoded mock data — needs API wiring
    (no WorkspaceUnderwriting.tsx — needs to be created)
  services/
    conditionsService.ts       ← Fully wired (from Sprint 2)
  hooks/
    useConditions.ts           ← Works (from Sprint 2)
```

**Key insight:** The backend for notes, audit, status transitions, and documents is already built. This sprint is almost entirely frontend wiring. The only new backend work is a minor documents query improvement.

---

## Phase 3.1 — Notes + Audit Log Wiring

**Goal:** `WorkspaceConversation` posts and reads real notes. `WorkspaceAuditLog` reads real audit events.

### Notes: audit existing backend endpoints

Before coding, verify these endpoints return data for a loan that has notes:
- `GET /api/v1/notes/?loan_id={id}&limit=50` — returns `list[NoteOut]`
- `POST /api/v1/notes/` with body `{ "loan_id": "...", "body": "..." }` — returns `NoteOut`

The `NoteOut` schema is in `src/backend/app/schemas/workflow_schema.py`. Verify it includes: `id`, `loan_id`, `body`, `created_by`, `created_at`.

### Add `NoteOut` type to `src/frontend/src/types/api.ts`

```typescript
export type NoteOut = {
  id: string;
  loan_id: string;
  tenant_id: string;
  body: string;
  created_by: string;
  created_at: string;
};
```

### Create `src/frontend/src/services/notesService.ts`

```typescript
import { apiRequest } from "@/services/apiClient";
import type { NoteOut } from "@/types/api";

export async function listNotes(loanId: string, token: string): Promise<NoteOut[]> {
  return apiRequest<NoteOut[]>(`/notes/?loan_id=${loanId}&limit=100`, { token });
}

export async function createNote(loanId: string, body: string, token: string): Promise<NoteOut> {
  return apiRequest<NoteOut>("/notes/", {
    method: "POST",
    body: JSON.stringify({ loan_id: loanId, body }),
    token,
  });
}
```

### Rewrite `WorkspaceConversation.tsx`

Replace the hardcoded `MESSAGES` array. The new component:
1. Fetches notes from `/notes/?loan_id={id}` on mount
2. Shows them in chronological order (oldest first, since the backend returns newest first — reverse the list)
3. Has a textarea + submit button to post a new note
4. On successful post, refetches the notes list (or optimistically appends)
5. Shows a loading skeleton while fetching
6. Shows an `EmptyState` when there are no notes yet

**Shape of the new component:**

```tsx
import { useEffect, useState } from "react";
import { listNotes, createNote } from "@/services/notesService";
import { useAuth } from "@/state/auth";
import type { NoteOut } from "@/types/api";
import type { LoanSummary } from "@/types/loan";

type Props = { loan: LoanSummary };

export function WorkspaceConversation({ loan }: Props) {
  const { token, user } = useAuth();
  const [notes, setNotes] = useState<NoteOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  async function fetchNotes() {
    if (!token) return;
    try {
      const data = await listNotes(loan.id, token);
      setNotes([...data].reverse()); // oldest first
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchNotes(); }, [loan.id, token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !token) return;
    setPosting(true);
    try {
      await createNote(loan.id, body.trim(), token);
      setBody("");
      await fetchNotes();
    } finally {
      setPosting(false);
    }
  }

  // ... render notes list + form
}
```

Keep the existing CSS class names (`conversation-message`, `conversation-avatar`, etc.) — only the data source changes. Show the note's `created_at` formatted with `formatDate` from `lib/utils.ts`. Use `created_by` (a UUID) as the avatar initial source — fetch and cache user names if needed, or just show "Team Member" as a fallback for now.

### Add `AuditLogEntry` type to `src/frontend/src/types/api.ts`

```typescript
export type AuditLogEntry = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  diff: Record<string, unknown> | null;
  actor_user_id: string | null;
  occurred_at: string;
};
```

### Create `src/frontend/src/services/auditService.ts`

```typescript
import { apiRequest } from "@/services/apiClient";
import type { AuditLogEntry } from "@/types/api";

export async function listAuditLogs(loanId: string, token: string): Promise<AuditLogEntry[]> {
  return apiRequest<AuditLogEntry[]>(
    `/audit-logs/?entity_id=${loanId}&limit=100`,
    { token },
  );
}
```

### Rewrite `WorkspaceAuditLog.tsx`

Replace the hardcoded `AUDIT_EVENTS` array. The new component fetches from `GET /audit-logs/?entity_id={loan_id}`.

Each entry should show:
- `action` (INSERT/UPDATE/DELETE) rendered as a human label ("Created", "Updated", "Deleted")
- `entity_type` — which table was changed
- `occurred_at` formatted as a date/time
- `diff` — a JSON object showing before/after values. Render the top-level keys as field names.

```tsx
export function WorkspaceAuditLog({ loan }: Props) {
  const { token } = useAuth();
  const [events, setEvents] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    listAuditLogs(loan.id, token)
      .then(setEvents)
      .finally(() => setLoading(false));
  }, [loan.id, token]);

  // Render events — keep existing CSS classes
}
```

### Write `tests/backend/test_notes_and_audit.py`

```python
# tests/backend/test_notes_and_audit.py
"""Notes and audit log endpoint tests."""
import pytest


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
async def test_create_and_list_notes(client, db, seed_minimum):
    token = seed_minimum["token"]

    # Create a loan
    loan_r = await client.post("/api/v1/loans/", json={"purpose": "purchase", "loan_program": "dscr"}, headers=_auth(token))
    loan_id = loan_r.json()["id"]

    # Create a note
    note_r = await client.post(
        "/api/v1/notes/",
        json={"loan_id": loan_id, "body": "Bank statements received."},
        headers=_auth(token),
    )
    assert note_r.status_code == 201
    note = note_r.json()
    assert note["body"] == "Bank statements received."
    assert note["created_by"] == seed_minimum["user_id"]

    # List notes for this loan
    list_r = await client.get(f"/api/v1/notes/?loan_id={loan_id}", headers=_auth(token))
    assert list_r.status_code == 200
    assert any(n["id"] == note["id"] for n in list_r.json())


@pytest.mark.integration
async def test_notes_are_tenant_isolated(client, db, seed_minimum):
    """Notes from one loan are not returned when querying a different loan."""
    token = seed_minimum["token"]

    loan1_r = await client.post("/api/v1/loans/", json={"purpose": "purchase", "loan_program": "dscr"}, headers=_auth(token))
    loan2_r = await client.post("/api/v1/loans/", json={"purpose": "refinance", "loan_program": "bank_statement"}, headers=_auth(token))
    loan1_id = loan1_r.json()["id"]
    loan2_id = loan2_r.json()["id"]

    await client.post("/api/v1/notes/", json={"loan_id": loan1_id, "body": "Note for loan 1"}, headers=_auth(token))

    list_r = await client.get(f"/api/v1/notes/?loan_id={loan2_id}", headers=_auth(token))
    assert list_r.status_code == 200
    assert len(list_r.json()) == 0


@pytest.mark.integration
async def test_audit_log_captures_loan_creation(client, db, seed_minimum):
    token = seed_minimum["token"]
    loan_r = await client.post("/api/v1/loans/", json={"purpose": "purchase", "loan_program": "dscr"}, headers=_auth(token))
    loan_id = loan_r.json()["id"]

    audit_r = await client.get(f"/api/v1/audit-logs/?entity_id={loan_id}", headers=_auth(token))
    assert audit_r.status_code == 200
    events = audit_r.json()
    assert len(events) >= 1
    assert any(e["action"] == "INSERT" for e in events)
```

**Phase 3.1 done when:** Notes post and appear without a page refresh. Audit log shows real events. All 3 new tests pass.

---

## Phase 3.2 — Status Transition UI

**Goal:** The status pill in `WorkspaceStatus.tsx` becomes a dropdown. Selecting a status calls `POST /{loan_id}/status/transition` and updates the UI immediately.

### Audit `WorkspaceStatus.tsx` first

The component already:
- Fetches `GET /loans/{id}/status` → `statusOut` (current status + available transitions)
- Fetches `GET /loans/{id}/status/history` → `history`
- Has `confirming`, `reason`, `transitioning`, `transitionError` state

What it is likely missing (verify by reading the full component): the submit handler that calls `POST /loans/{id}/status/transition`.

### Add transition handler

Find where `confirming` is set or where available transitions are rendered. The submit handler should be:

```tsx
async function handleTransition() {
  if (!confirming || !token) return;
  setTransitioning(true);
  setTransitionError(null);
  try {
    await apiRequest(`/loans/${loan.id}/status/transition`, {
      method: "POST",
      body: JSON.stringify({ to_status: confirming, reason: reason.trim() || undefined }),
      token,
    });
    setConfirming(null);
    setReason("");
    // Re-fetch status + history
    const [s, h] = await Promise.all([
      apiRequest<LoanStatusOut>(`/loans/${loan.id}/status`, { token }),
      apiRequest<StatusEventOut[]>(`/loans/${loan.id}/status/history`, { token }),
    ]);
    setStatusOut(s);
    setHistory(h);
  } catch (e: unknown) {
    setTransitionError(e instanceof Error ? e.message : "Transition failed");
  } finally {
    setTransitioning(false);
  }
}
```

The UI flow:
1. Current status shown as a colored pill
2. "Change Status" button (only visible if `statusOut.available_transitions.length > 0` and `!statusOut.is_terminal`)
3. Clicking opens a small form: a `<select>` of available transitions + a `<textarea>` for reason
4. "Confirm" button calls `handleTransition`
5. "Cancel" resets `confirming` to null

### Write `tests/backend/test_status_transitions.py`

```python
# tests/backend/test_status_transitions.py
"""Status transition tests — verifies state machine and audit trail."""
import pytest


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
async def test_transition_new_draft_to_submitted(client, db, seed_minimum):
    token = seed_minimum["token"]
    loan_r = await client.post("/api/v1/loans/", json={"purpose": "purchase", "loan_program": "dscr"}, headers=_auth(token))
    loan_id = loan_r.json()["id"]

    r = await client.post(
        f"/api/v1/loans/{loan_id}/status/transition",
        json={"to_status": "submitted", "reason": "All docs received."},
        headers=_auth(token),
    )
    assert r.status_code == 201
    assert r.json()["to_status"] == "submitted"
    assert r.json()["from_status"] == "new_draft"


@pytest.mark.integration
async def test_invalid_transition_returns_422(client, db, seed_minimum):
    """Cannot transition from new_draft directly to approved."""
    token = seed_minimum["token"]
    loan_r = await client.post("/api/v1/loans/", json={"purpose": "purchase", "loan_program": "dscr"}, headers=_auth(token))
    loan_id = loan_r.json()["id"]

    r = await client.post(
        f"/api/v1/loans/{loan_id}/status/transition",
        json={"to_status": "approved"},
        headers=_auth(token),
    )
    assert r.status_code == 422


@pytest.mark.integration
async def test_status_history_grows_with_transitions(client, db, seed_minimum):
    token = seed_minimum["token"]
    loan_r = await client.post("/api/v1/loans/", json={"purpose": "purchase", "loan_program": "dscr"}, headers=_auth(token))
    loan_id = loan_r.json()["id"]

    # Initial history should have 1 event (new_draft)
    h1 = await client.get(f"/api/v1/loans/{loan_id}/status/history", headers=_auth(token))
    initial_count = len(h1.json())

    await client.post(
        f"/api/v1/loans/{loan_id}/status/transition",
        json={"to_status": "submitted"},
        headers=_auth(token),
    )

    h2 = await client.get(f"/api/v1/loans/{loan_id}/status/history", headers=_auth(token))
    assert len(h2.json()) == initial_count + 1


@pytest.mark.integration
async def test_terminal_status_has_no_available_transitions(client, db, seed_minimum):
    token = seed_minimum["token"]
    loan_r = await client.post("/api/v1/loans/", json={"purpose": "purchase", "loan_program": "dscr"}, headers=_auth(token))
    loan_id = loan_r.json()["id"]

    # Transition to a terminal status
    await client.post(f"/api/v1/loans/{loan_id}/status/transition", json={"to_status": "withdrawn"}, headers=_auth(token))

    status_r = await client.get(f"/api/v1/loans/{loan_id}/status", headers=_auth(token))
    body = status_r.json()
    assert body["is_terminal"] is True
    assert body["available_transitions"] == []
```

**Phase 3.2 done when:** Status dropdown renders available transitions from the API. Selecting and confirming a transition updates both the status pill and the history timeline in real-time. All 4 new tests pass.

---

## Phase 3.3 — Underwriting + Decision Panel

**Goal:** Create `WorkspaceUnderwriting.tsx` that shows pricing runs, eligibility runs, and any exceptions on the loan.

### What the backend already has

**Pricing runs** — `GET /api/v1/pricing-runs/?loan_id={id}` returns `list[PricingRunOut]`

Read `src/backend/app/schemas/decisioning_schema.py` to get the exact fields of `PricingRunOut` and `EligibilityRunOut`.

**Eligibility runs** — `GET /api/v1/eligibility-runs/?loan_id={id}` returns `list[EligibilityRunOut]`

**Exceptions** — `GET /api/v1/exceptions/?loan_id={id}` returns the exception list for the loan (exception module built in prior sessions).

### Add types to `src/frontend/src/types/api.ts`

Read `src/backend/app/schemas/decisioning_schema.py` and add matching TypeScript types:

```typescript
export type PricingRunOut = {
  id: string;
  loan_id: string;
  run_by: string;
  run_at: string;
  note: string | null;
  // add any rate/cost fields from the schema
};

export type EligibilityRunOut = {
  id: string;
  loan_id: string;
  run_by: string;
  run_at: string;
  is_eligible: boolean;
  reason: string | null;
};
```

### Create `src/frontend/src/services/decisioningService.ts`

```typescript
import { apiRequest } from "@/services/apiClient";
import type { PricingRunOut, EligibilityRunOut } from "@/types/api";

export async function listPricingRuns(loanId: string, token: string): Promise<PricingRunOut[]> {
  return apiRequest<PricingRunOut[]>(`/pricing-runs/?loan_id=${loanId}`, { token });
}

export async function listEligibilityRuns(loanId: string, token: string): Promise<EligibilityRunOut[]> {
  return apiRequest<EligibilityRunOut[]>(`/eligibility-runs/?loan_id=${loanId}`, { token });
}
```

### Create `src/frontend/src/components/loans/workspace/WorkspaceUnderwriting.tsx`

This is a new component. It renders three panels inside the workspace section:

1. **Eligibility** — latest eligibility run result (eligible/not eligible + reason). Button to run a new eligibility check (calls `POST /eligibility-runs/`).
2. **Pricing** — list of pricing runs in reverse chronological order. Button to add a pricing run.
3. **Exceptions** — list of exceptions on this loan from the exception module (if any). Link to the `/exceptions` page for full management.

```tsx
import { useEffect, useState } from "react";
import { listPricingRuns, listEligibilityRuns } from "@/services/decisioningService";
import { useAuth } from "@/state/auth";
import type { LoanSummary } from "@/types/loan";
import type { PricingRunOut, EligibilityRunOut } from "@/types/api";

type Props = { loan: LoanSummary };

export function WorkspaceUnderwriting({ loan }: Props) {
  const { token } = useAuth();
  const [pricingRuns, setPricingRuns] = useState<PricingRunOut[]>([]);
  const [eligibilityRuns, setEligibilityRuns] = useState<EligibilityRunOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      listPricingRuns(loan.id, token),
      listEligibilityRuns(loan.id, token),
    ])
      .then(([pricing, eligibility]) => {
        setPricingRuns(pricing);
        setEligibilityRuns(eligibility);
      })
      .finally(() => setLoading(false));
  }, [loan.id, token]);

  // Render panels
}
```

### Register in the workspace navigation

Open `src/frontend/src/pages/loans/[loanId].tsx` (or wherever workspace section tabs are defined). Find where `WorkspaceStatus`, `WorkspaceConditions`, etc. are registered. Add:

```tsx
import { WorkspaceUnderwriting } from "@/components/loans/workspace/WorkspaceUnderwriting";

// In the section map/array:
{ key: "underwriting", label: "Underwriting", component: WorkspaceUnderwriting }
```

**Phase 3.3 done when:** The workspace has an "Underwriting" tab. It loads and displays (empty state is fine) without errors. Pricing and eligibility runs appear when they exist. No new backend work required.

---

## Phase 3.4 — Documents Section

**Goal:** `WorkspaceDocuments.tsx` uploads real files to `POST /documents/upload` and lists real documents from `GET /documents/?loan_id={id}`.

### Audit the backend first

Read `src/backend/app/api/v1/documents.py` fully. The upload endpoint accepts `multipart/form-data` with:
- `file` — binary file
- `loan_id` — UUID
- `doc_type` — optional string
- `condition_id` — optional UUID
- `tags` — optional JSON string

The download endpoint is `GET /documents/{id}/download` and returns raw bytes.

Read `src/backend/app/schemas/document_schema.py` to get `DocumentOut` fields.

### Add `DocumentOut` type to `src/frontend/src/types/api.ts`

After reading the schema, add the TypeScript type. It will include at minimum:
```typescript
export type DocumentOut = {
  id: string;
  loan_id: string;
  tenant_id: string;
  file_name: string;
  doc_type: string | null;
  condition_id: string | null;
  storage_key: string;
  content_type: string | null;
  size_bytes: number;
  sha256: string;
  tags: Record<string, string>;
  uploaded_by: string;
  uploaded_at: string;
  archived_at: string | null;
};
```

### Create `src/frontend/src/services/documentsService.ts`

```typescript
import { apiRequest } from "@/services/apiClient";
import type { DocumentOut } from "@/types/api";

export async function listDocuments(loanId: string, token: string): Promise<DocumentOut[]> {
  return apiRequest<DocumentOut[]>(`/documents/?loan_id=${loanId}`, { token });
}

export async function uploadDocument(
  loanId: string,
  file: File,
  options: { docType?: string; conditionId?: string },
  token: string,
): Promise<DocumentOut> {
  const form = new FormData();
  form.append("loan_id", loanId);
  form.append("file", file);
  if (options.docType) form.append("doc_type", options.docType);
  if (options.conditionId) form.append("condition_id", options.conditionId);
  form.append("tags", "{}");

  const resp = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1"}/documents/upload`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      // Do NOT set Content-Type manually — browser sets it with the boundary
      body: form,
    },
  );
  if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
  return resp.json();
}

export async function archiveDocument(id: string, token: string): Promise<void> {
  await apiRequest<void>(`/documents/${id}`, { method: "DELETE", token });
}
```

**Important:** Do not use `apiClient.ts`'s `apiRequest` for the upload — it sets `Content-Type: application/json` which would break multipart. Use `fetch` directly with the `Authorization` header set manually (as shown above).

### Rewrite `WorkspaceDocuments.tsx`

Replace the `DOCUMENTS` hardcoded array. The new component:

1. Fetches `GET /documents/?loan_id={id}` on mount
2. Renders the document list using the same CSS classes as the current mock UI
3. Has a drag-and-drop or `<input type="file">` upload area at the top
4. On file selection: calls `uploadDocument`, then refetches the list
5. Archive button calls `archiveDocument` and refetches
6. Shows a download link: `href="/api/v1/documents/{id}/download"` (direct link, not apiRequest — the browser handles the file download natively)

The download link should open in a new tab:
```tsx
<a
  href={`${API_BASE_URL}/documents/${doc.id}/download`}
  target="_blank"
  rel="noreferrer"
>
  Download
</a>
```

Where `API_BASE_URL` is `process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1"`.

### Add list endpoint for documents to `documents.py` (if missing)

Check if `GET /documents/` exists. It likely doesn't — the current `documents.py` only has `POST /upload`, `GET /{id}`, `GET /{id}/download`, `DELETE /{id}`.

If it's missing, add:
```python
@router.get("/", response_model=list[DocumentOut])
def list_documents(
    loan_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Document).filter(
        Document.tenant_id == current_user.tenant_id,
        Document.archived_at.is_(None),  # exclude archived
    )
    if loan_id:
        query = query.filter(Document.loan_id == loan_id)
    return query.order_by(Document.uploaded_at.desc()).offset(skip).limit(limit).all()
```

### Write `tests/backend/test_documents.py`

```python
# tests/backend/test_documents.py
"""Document upload, list, download, and archive tests."""
import pytest
import io


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
async def test_upload_and_list_document(client, db, seed_minimum):
    token = seed_minimum["token"]

    loan_r = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth(token),
    )
    loan_id = loan_r.json()["id"]

    # Upload a file
    file_content = b"fake pdf content for testing"
    r = await client.post(
        "/api/v1/documents/upload",
        data={"loan_id": loan_id, "doc_type": "bank_statement"},
        files={"file": ("test.pdf", io.BytesIO(file_content), "application/pdf")},
        headers=_auth(token),
    )
    assert r.status_code == 201
    doc = r.json()
    assert doc["file_name"] == "test.pdf"
    assert doc["doc_type"] == "bank_statement"
    assert doc["loan_id"] == loan_id

    # List documents for the loan
    list_r = await client.get(f"/api/v1/documents/?loan_id={loan_id}", headers=_auth(token))
    assert list_r.status_code == 200
    docs = list_r.json()
    assert any(d["id"] == doc["id"] for d in docs)


@pytest.mark.integration
async def test_download_document(client, db, seed_minimum):
    token = seed_minimum["token"]
    loan_r = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth(token),
    )
    loan_id = loan_r.json()["id"]

    file_content = b"downloadable content"
    upload_r = await client.post(
        "/api/v1/documents/upload",
        data={"loan_id": loan_id},
        files={"file": ("dl.txt", io.BytesIO(file_content), "text/plain")},
        headers=_auth(token),
    )
    doc_id = upload_r.json()["id"]

    dl_r = await client.get(f"/api/v1/documents/{doc_id}/download", headers=_auth(token))
    assert dl_r.status_code == 200
    assert dl_r.content == file_content


@pytest.mark.integration
async def test_archive_excludes_from_list(client, db, seed_minimum):
    token = seed_minimum["token"]
    loan_r = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth(token),
    )
    loan_id = loan_r.json()["id"]

    upload_r = await client.post(
        "/api/v1/documents/upload",
        data={"loan_id": loan_id},
        files={"file": ("archive-me.pdf", io.BytesIO(b"x"), "application/pdf")},
        headers=_auth(token),
    )
    doc_id = upload_r.json()["id"]

    # Archive
    del_r = await client.delete(f"/api/v1/documents/{doc_id}", headers=_auth(token))
    assert del_r.status_code == 204

    # Should no longer appear in list
    list_r = await client.get(f"/api/v1/documents/?loan_id={loan_id}", headers=_auth(token))
    assert not any(d["id"] == doc_id for d in list_r.json())
```

**Phase 3.4 done when:** A real file can be uploaded to a loan via the workspace. The document list shows uploaded files. Clicking download streams the file back. Archiving removes it from the list. All 3 new tests pass.

---

## Sprint 3 B-gate checklist

- [ ] Sprint 1 + 2 tests still green
- [ ] `tests/backend/test_notes_and_audit.py` (3 new tests)
- [ ] `tests/backend/test_status_transitions.py` (4 new tests)
- [ ] `tests/backend/test_documents.py` (3 new tests)
- [ ] Manual: post a note → appears without refresh
- [ ] Manual: transition status from conditions_review → approved_pending
- [ ] Manual: upload a PDF → appears in document list → download returns the file
- [ ] WorkspaceUnderwriting tab renders without errors (empty state is fine)
