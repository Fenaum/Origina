"""Document upload, list, download, and archive tests — Sprint 3 §3.4.

The Documents workspace pane drives these endpoints. Note that archive
returns 200 with the archived row (not 204) — the documents module keeps
soft-delete semantics and returns the row so the UI can update immediately.
"""
import io

import pytest


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _seed_loan(client, token: str) -> str:
    r = await client.post(
        "/api/v1/loans/",
        json={"purpose": "purchase", "loan_program": "dscr"},
        headers=_auth(token),
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


@pytest.mark.integration
async def test_upload_and_list_document(client, db, seed_minimum):
    token = seed_minimum["token"]
    loan_id = await _seed_loan(client, token)

    file_content = b"fake pdf content for testing"
    r = await client.post(
        "/api/v1/documents/upload",
        data={"loan_id": loan_id, "doc_type": "bank_statement"},
        files={"file": ("test.pdf", io.BytesIO(file_content), "application/pdf")},
        headers=_auth(token),
    )
    assert r.status_code == 201, r.text
    doc = r.json()
    assert doc["file_name"] == "test.pdf"
    assert doc["doc_type"] == "bank_statement"
    assert doc["loan_id"] == loan_id
    assert doc["file_size_bytes"] == len(file_content)

    list_r = await client.get(
        f"/api/v1/documents/?loan_id={loan_id}",
        headers=_auth(token),
    )
    assert list_r.status_code == 200
    docs = list_r.json()
    assert isinstance(docs, list)
    assert any(d["id"] == doc["id"] for d in docs)


@pytest.mark.integration
async def test_download_document(client, db, seed_minimum):
    token = seed_minimum["token"]
    loan_id = await _seed_loan(client, token)

    file_content = b"downloadable content"
    upload_r = await client.post(
        "/api/v1/documents/upload",
        data={"loan_id": loan_id},
        files={"file": ("dl.pdf", io.BytesIO(file_content), "application/pdf")},
        headers=_auth(token),
    )
    assert upload_r.status_code == 201, upload_r.text
    doc_id = upload_r.json()["id"]

    dl_r = await client.get(
        f"/api/v1/documents/{doc_id}/download",
        headers=_auth(token),
    )
    assert dl_r.status_code == 200
    assert dl_r.content == file_content


@pytest.mark.integration
async def test_archive_excludes_from_list(client, db, seed_minimum):
    token = seed_minimum["token"]
    loan_id = await _seed_loan(client, token)

    upload_r = await client.post(
        "/api/v1/documents/upload",
        data={"loan_id": loan_id},
        files={"file": ("archive-me.pdf", io.BytesIO(b"x"), "application/pdf")},
        headers=_auth(token),
    )
    assert upload_r.status_code == 201, upload_r.text
    doc_id = upload_r.json()["id"]

    del_r = await client.delete(
        f"/api/v1/documents/{doc_id}",
        headers=_auth(token),
    )
    assert del_r.status_code == 200, del_r.text
    archived = del_r.json()
    assert archived["id"] == doc_id
    assert archived["archived_at"] is not None

    list_r = await client.get(
        f"/api/v1/documents/?loan_id={loan_id}",
        headers=_auth(token),
    )
    assert list_r.status_code == 200
    assert not any(d["id"] == doc_id for d in list_r.json()), (
        "Archived document must be filtered out of the default list"
    )
