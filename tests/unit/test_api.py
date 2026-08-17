"""Phase 7 – RED step: API client tests for FastAPI endpoints.

These tests target four endpoints that do NOT exist yet:
  POST /api/v1/jobs/upload
  GET  /api/v1/jobs/{job_id}
  GET  /api/v1/review/queue
  POST /api/v1/review/submit

All tests are expected to FAIL because app.main has not been implemented.
"""

from __future__ import annotations

import io
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

# This import is the intentional failure point: app.main does not exist yet.
from app.main import app  # type: ignore[import-not-found]


@pytest.fixture()
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(autouse=True)
def disable_background_processing_for_api_contract_tests(monkeypatch):
    """Keep endpoint contract tests independent of the graph worker."""
    async def _noop(*args, **kwargs):
        return None

    monkeypatch.setattr("app.api.v1.jobs.process_job_background", _noop)


@pytest.fixture()
async def client():
    """Async HTTP test client backed by the FastAPI ASGI application."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


# ── 1. POST /api/v1/jobs/upload ─────────────────────────────────────────────


class TestJobUpload:
    """PDF upload should return a job_id with PENDING status."""

    async def test_upload_pdf_returns_job_id(self, client: AsyncClient) -> None:
        pdf_bytes = b"%PDF-1.4 fake-test-content"
        response = await client.post(
            "/api/v1/jobs/upload",
            files={"file": ("catalog.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        )

        assert response.status_code == 201
        body = response.json()
        assert "job_id" in body
        assert body["job_id"]  # non-empty

    async def test_upload_pdf_initial_status_is_pending(
        self, client: AsyncClient
    ) -> None:
        pdf_bytes = b"%PDF-1.4 fake-test-content"
        response = await client.post(
            "/api/v1/jobs/upload",
            files={"file": ("catalog.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        )

        assert response.status_code == 201
        body = response.json()
        assert body["status"] == "PENDING"

    async def test_upload_rejects_non_pdf_file(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/jobs/upload",
            files={"file": ("data.csv", io.BytesIO(b"a,b,c"), "text/csv")},
        )

        assert response.status_code == 422  # Unprocessable Entity

    async def test_upload_rejects_missing_file(self, client: AsyncClient) -> None:
        response = await client.post("/api/v1/jobs/upload")

        assert response.status_code == 422


# ── 2. GET /api/v1/jobs/{job_id} ─────────────────────────────────────────────


class TestJobStatus:
    """Job status endpoint should return processing state."""

    async def test_get_job_returns_status(self, client: AsyncClient) -> None:
        # First create a job
        pdf_bytes = b"%PDF-1.4 fake-test-content"
        upload_resp = await client.post(
            "/api/v1/jobs/upload",
            files={"file": ("catalog.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        )
        job_id = upload_resp.json()["job_id"]

        response = await client.get(f"/api/v1/jobs/{job_id}")

        assert response.status_code == 200
        body = response.json()
        assert "status" in body
        assert body["job_id"] == job_id

    async def test_get_job_includes_graph_state(self, client: AsyncClient) -> None:
        pdf_bytes = b"%PDF-1.4 fake-test-content"
        upload_resp = await client.post(
            "/api/v1/jobs/upload",
            files={"file": ("catalog.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        )
        job_id = upload_resp.json()["job_id"]

        response = await client.get(f"/api/v1/jobs/{job_id}")

        assert response.status_code == 200
        body = response.json()
        # The response must include the graph/processing state
        assert "state" in body

    async def test_get_nonexistent_job_returns_404(
        self, client: AsyncClient
    ) -> None:
        fake_id = str(uuid4())
        response = await client.get(f"/api/v1/jobs/{fake_id}")

        assert response.status_code == 404


# ── 3. GET /api/v1/review/queue ──────────────────────────────────────────────


class TestReviewQueue:
    """Review queue must return jobs requiring human review."""

    async def test_review_queue_returns_list(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/review/queue")

        assert response.status_code == 200
        body = response.json()
        assert isinstance(body, list)

    async def test_review_queue_includes_review_required_status(
        self, client: AsyncClient
    ) -> None:
        response = await client.get("/api/v1/review/queue")

        assert response.status_code == 200
        body = response.json()
        # All returned items must have a reviewable status
        allowed_statuses = {"REVIEW_REQUIRED", "UNCLASSIFIED_HUMAN_REVIEW"}
        for item in body:
            assert item["status"] in allowed_statuses

    async def test_review_queue_items_have_job_id(
        self, client: AsyncClient
    ) -> None:
        response = await client.get("/api/v1/review/queue")

        assert response.status_code == 200
        body = response.json()
        for item in body:
            assert "job_id" in item


# ── 4. POST /api/v1/review/submit ───────────────────────────────────────────


class TestReviewSubmitAccept:
    """ACCEPT_AND_SUBMIT action must enforce Gate 8 and write an audit log."""

    async def test_accept_requires_audit_reason(
        self, client: AsyncClient
    ) -> None:
        payload = {
            "job_id": str(uuid4()),
            "action": "ACCEPT_AND_SUBMIT",
            "modified_attributes": [],
            # Missing audit_reason — should be rejected
        }
        response = await client.post("/api/v1/review/submit", json=payload)

        assert response.status_code == 422

    async def test_accept_with_valid_payload_succeeds(
        self, client: AsyncClient
    ) -> None:
        payload = {
            "job_id": str(uuid4()),
            "action": "ACCEPT_AND_SUBMIT",
            "modified_attributes": [],
            "audit_reason": "Reviewer verified all specifications against source PDF.",
        }
        response = await client.post("/api/v1/review/submit", json=payload)

        # Should succeed or return a domain-specific status
        assert response.status_code in {200, 201}
        body = response.json()
        assert "audit_log_id" in body

    async def test_accept_enforces_gate8_verification(
        self, client: AsyncClient
    ) -> None:
        """Submit with a locked attribute whose hash is tampered must be rejected."""
        payload = {
            "job_id": str(uuid4()),
            "action": "ACCEPT_AND_SUBMIT",
            "modified_attributes": [
                {
                    "attribute_id": str(uuid4()),
                    "canonical_key": "pressure_rating",
                    "raw_value": "600 PSI",
                    "normalized_value": "TAMPERED_VALUE",
                    "is_human_locked": True,
                    "locked_state_hash": "sha256:definitely-wrong-hash",
                }
            ],
            "audit_reason": "Attempting to bypass Gate 8.",
        }
        response = await client.post("/api/v1/review/submit", json=payload)

        # Gate 8 violation should be rejected
        assert response.status_code == 409  # Conflict

    async def test_accept_writes_audit_log_entry(
        self, client: AsyncClient
    ) -> None:
        payload = {
            "job_id": str(uuid4()),
            "action": "ACCEPT_AND_SUBMIT",
            "modified_attributes": [],
            "audit_reason": "All attributes verified against source document.",
        }
        response = await client.post("/api/v1/review/submit", json=payload)

        if response.status_code in {200, 201}:
            body = response.json()
            assert "audit_log_id" in body
            assert body["audit_log_id"]  # non-empty


class TestReviewSubmitDraft:
    """SAVE_DRAFT action must save progress without triggering graph re-validation."""

    async def test_save_draft_succeeds(self, client: AsyncClient) -> None:
        payload = {
            "job_id": str(uuid4()),
            "action": "SAVE_DRAFT",
            "modified_attributes": [
                {
                    "attribute_id": str(uuid4()),
                    "canonical_key": "pipe_diameter",
                    "raw_value": "4 inch",
                    "normalized_value": "4 in",
                }
            ],
        }
        response = await client.post("/api/v1/review/submit", json=payload)

        assert response.status_code in {200, 201}

    async def test_save_draft_does_not_trigger_revalidation(
        self, client: AsyncClient
    ) -> None:
        payload = {
            "job_id": str(uuid4()),
            "action": "SAVE_DRAFT",
            "modified_attributes": [],
        }
        response = await client.post("/api/v1/review/submit", json=payload)

        assert response.status_code in {200, 201}
        body = response.json()
        # Draft saves must not trigger graph re-validation
        assert body.get("revalidation_triggered") is not True

    async def test_save_draft_does_not_require_audit_reason(
        self, client: AsyncClient
    ) -> None:
        """SAVE_DRAFT should succeed without an audit_reason field."""
        payload = {
            "job_id": str(uuid4()),
            "action": "SAVE_DRAFT",
            "modified_attributes": [],
        }
        response = await client.post("/api/v1/review/submit", json=payload)

        assert response.status_code in {200, 201}

    async def test_save_draft_does_not_write_audit_log(
        self, client: AsyncClient
    ) -> None:
        payload = {
            "job_id": str(uuid4()),
            "action": "SAVE_DRAFT",
            "modified_attributes": [],
        }
        response = await client.post("/api/v1/review/submit", json=payload)

        if response.status_code in {200, 201}:
            body = response.json()
            # Draft saves must not produce an audit log entry
            assert "audit_log_id" not in body or body["audit_log_id"] is None
