from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import pytest
from sqlmodel import delete, select

from app.api.v1 import jobs as jobs_api
from app.db.models import AttributeRecord, ProductRecord, ProcessingJob
from app.db.session import async_session_factory, init_db
from app.models.domain import BoundingBox, Evidence, Product, ProductAttribute


@pytest.fixture(scope="session", autouse=True)
def local_tmp_path_base(tmp_path_factory: pytest.TempPathFactory):
    local_base = Path(__file__).parents[2] / ".pytest-tmp"
    local_base.mkdir(parents=True, exist_ok=True)
    tmp_path_factory._given_basetemp = local_base
    yield


def _product(status: str = "REVIEW_REQUIRED") -> Product:
    evidence_id = uuid4()
    attribute = ProductAttribute(
        attribute_id=uuid4(),
        canonical_key="pressure_rating",
        raw_key="Max Pressure",
        raw_value="600 PSI",
        normalized_value="600 PSI",
        numeric_value=600.0,
        unit="PSI",
        normalization_method="PINT",
        evidence_id=evidence_id,
        evidence=Evidence(
            evidence_id=evidence_id,
            evidence_type="SOURCE",
            source_text="Max Pressure: 600 PSI",
            page_number=1,
            bounding_box=BoundingBox(
                page_number=1,
                top_pct=10.0,
                left_pct=10.0,
                width_pct=20.0,
                height_pct=5.0,
            ),
            confidence_score=0.98,
            is_verified=True,
        ),
    )
    return Product(
        product_id=uuid4(),
        sku="JOB-TEST-001",
        category_id="CAT_PIPING_001",
        status=status,
        attributes=[attribute],
        composite_confidence=0.96,
        category_confidence=0.96,
    )


@pytest.mark.asyncio
async def test_background_graph_run_persists_state_product_and_evidence(monkeypatch, tmp_path):
    await init_db()
    job_id = uuid4()
    file_path = tmp_path / "catalog.pdf"
    file_path.write_bytes(b"%PDF-1.4")

    async with async_session_factory() as session:
        session.add(
            ProcessingJob(
                job_id=job_id,
                status="PENDING",
                file_path=str(file_path),
                created_at=datetime.now(timezone.utc),
            )
        )
        await session.commit()

    product = _product()

    class FakeGraph:
        def invoke(self, state):
            return {
                **state,
                "parse_status": "SUCCESS",
                "raw_document_markdown": "Max Pressure: 600 PSI",
                "document_markdown": "Max Pressure: 600 PSI",
                "page_layout_map": [],
                "sku_segments": [{"sku": product.sku}],
                "attributes": product.attributes,
                "category_id": product.category_id,
                "category_confidence": product.category_confidence,
                "product": product,
            }

    monkeypatch.setattr(jobs_api, "build_graph", lambda: FakeGraph())

    await jobs_api.process_job_background(job_id, str(file_path))

    async with async_session_factory() as session:
        job = await session.get(ProcessingJob, job_id)
        persisted_product = (
            await session.execute(
                select(ProductRecord).where(ProductRecord.job_id == job_id)
            )
        ).scalar_one()
        persisted_attribute = (
            await session.execute(
                select(AttributeRecord).where(
                    AttributeRecord.product_id == persisted_product.product_id
                )
            )
        ).scalar_one()

        assert job is not None
        assert job.status == "REVIEW_REQUIRED"
        assert job.total_pages == 0
        assert job.skus_found == 1
        assert job.completed_at is not None
        assert "Max Pressure: 600 PSI" in (job.graph_state_json or "")
        assert persisted_product.job_id == job_id
        assert persisted_product.sku == product.sku
        assert persisted_attribute.evidence_id == product.attributes[0].evidence_id
        assert persisted_attribute.source_text == "Max Pressure: 600 PSI"

    async with async_session_factory() as session:
        product_row = (
            await session.execute(
                select(ProductRecord).where(ProductRecord.job_id == job_id)
            )
        ).scalar_one()
        await session.execute(
            delete(AttributeRecord).where(
                AttributeRecord.product_id == product_row.product_id
            )
        )
        await session.delete(product_row)
        job_row = await session.get(ProcessingJob, job_id)
        if job_row:
            await session.delete(job_row)
        await session.commit()


@pytest.mark.asyncio
async def test_background_graph_failure_marks_job_failed(monkeypatch, tmp_path):
    await init_db()
    job_id = uuid4()
    file_path = tmp_path / "catalog.pdf"
    file_path.write_bytes(b"%PDF-1.4")

    async with async_session_factory() as session:
        session.add(
            ProcessingJob(
                job_id=job_id,
                status="PENDING",
                file_path=str(file_path),
                created_at=datetime.now(timezone.utc),
            )
        )
        await session.commit()

    class FailingGraph:
        def invoke(self, state):
            raise RuntimeError("graph configuration is invalid")

    monkeypatch.setattr(jobs_api, "build_graph", lambda: FailingGraph())

    await jobs_api.process_job_background(job_id, str(file_path))

    async with async_session_factory() as session:
        job = await session.get(ProcessingJob, job_id)
        assert job is not None
        assert job.status == "FAILED"
        assert job.error_code == "GRAPH_EXECUTION_FAILED"
        assert job.error_message == "graph configuration is invalid"
        assert job.completed_at is not None

        await session.delete(job)
        await session.commit()
